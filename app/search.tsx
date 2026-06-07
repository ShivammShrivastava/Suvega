import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Colour palette ──────────────────────────────────────────
const C = {
  bg: '#0A0A0A',
  bgCard: '#1A1A1A',
  textPrimary: '#FFFFFF',
  textHint: '#A0A0A0',
  border: '#333333',
  divider: '#222222',
  green: '#39FF14',
};

// ─── Types ───────────────────────────────────────────────────
interface Place {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// ─── Background map HTML (user location only) ────────────────
function getSearchMapHtml(lat: number, lng: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#0d1b2a; }
    .leaflet-control-attribution { display:none !important; }
    /* Navy blue tint filter on tiles */
    .leaflet-tile-pane {
      filter: brightness(0.55) contrast(1.3) sepia(0.35) hue-rotate(180deg) saturate(2.2);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${lat}, ${lng}], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd'
    }).addTo(map);

    // Pulse ring
    L.circleMarker([${lat}, ${lng}], {
      radius: 20, color: '#4285F4', fillColor: '#4285F4',
      fillOpacity: 0.12, weight: 1.5
    }).addTo(map);

    // User dot
    var userDot = L.circleMarker([${lat}, ${lng}], {
      radius: 8, color: '#FFFFFF', fillColor: '#4285F4',
      fillOpacity: 1, weight: 2.5
    }).addTo(map);

    window.updateUserLocation = function(lat, lng) {
      userDot.setLatLng([lat, lng]);
      map.setView([lat, lng], 14, { animate: true });
    };
  </script>
</body>
</html>`;
}

// ─── Search Screen ───────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLat, setUserLat] = useState(22.7196);  // Default: Indore
  const [userLng, setUserLng] = useState(75.8577);
  const [mapReady, setMapReady] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const webViewRef = useRef<WebView>(null);

  // ── Get user location on mount ──
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLat(loc.coords.latitude);
      setUserLng(loc.coords.longitude);

      if (mapReady && webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.updateUserLocation(${loc.coords.latitude}, ${loc.coords.longitude}); true;`
        );
      }
    })();
  }, [mapReady]);

  // ── Debounced Nominatim search ──
  useEffect(() => {
    if (searchText.length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchResults(searchText);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchResults = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(query)}` +
        `&format=json&limit=5&countrycodes=in&addressdetails=1`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'SuvegaApp/1.0' },
      });
      if (!response.ok) throw new Error('Network error');
      const data: Place[] = await response.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectPlace = useCallback(
    (item: Place) => {
      Keyboard.dismiss();
      router.push({
        pathname: '/',
        params: {
          destLat: item.lat,
          destLng: item.lon,
          destName: item.display_name.split(',')[0],
        },
      });
    },
    [router]
  );

  const renderResultItem = useCallback(
    ({ item }: { item: Place }) => {
      const mainText = item.display_name.split(',')[0];
      const subText =
        item.display_name.length > 50
          ? item.display_name.substring(0, 50) + '…'
          : item.display_name;

      return (
        <TouchableOpacity
          style={styles.resultRow}
          activeOpacity={0.7}
          onPress={() => handleSelectPlace(item)}
        >
          <Text style={styles.pinIcon}>📍</Text>
          <View style={styles.resultTextContainer}>
            <Text style={styles.resultMainText} numberOfLines={1}>
              {mainText}
            </Text>
            <Text style={styles.resultSubText} numberOfLines={1}>
              {subText}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectPlace]
  );

  const mapHtml = getSearchMapHtml(userLat, userLng);
  const showResults = isSearchFocused && (results.length > 0 || (searchText.length >= 3 && !isLoading));

  return (
    <View style={styles.container}>
      {/* ── Full-screen map background ── */}
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={StyleSheet.absoluteFillObject}
        onLoad={() => setMapReady(true)}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={['*']}
        mixedContentMode="always"
      />

      {/* ── Floating search bar ── */}
      <View style={[styles.searchOverlay, { paddingTop: insets.top + 12 }]}>
        <View style={styles.searchBar}>
          {/* Suvega mini icon */}
          <View style={styles.miniIcon}>
            <View style={styles.miniNeedle} />
            <View style={styles.miniArc} />
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search here"
            placeholderTextColor="#888888"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setIsSearchFocused(true)}
            returnKeyType="search"
            autoCorrect={false}
          />

          {isLoading ? (
            <ActivityIndicator size="small" color={C.green} />
          ) : (
            <Text style={styles.searchTrailingIcon}>🔍</Text>
          )}
        </View>

        {/* ── Results overlay ── */}
        {showResults && (
          <View style={styles.resultsOverlay}>
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.place_id)}
              renderItem={renderResultItem}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchText.length >= 3 && !isLoading ? (
                  <Text style={styles.emptyText}>No results found</Text>
                ) : null
              }
            />
          </View>
        )}
      </View>

      {/* ── Tap to dismiss results ── */}
      {showResults && (
        <TouchableOpacity
          style={styles.dismissOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            setIsSearchFocused(false);
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1b2a',
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.92)',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(100, 100, 100, 0.3)',
  },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  miniNeedle: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    left: 4,
    top: 15,
  },
  miniArc: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: C.green,
    top: 3,
    transform: [{ rotate: '30deg' }],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: C.textPrimary,
    paddingVertical: 4,
  },
  searchTrailingIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  resultsOverlay: {
    marginTop: 8,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 16,
    maxHeight: 320,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(100, 100, 100, 0.2)',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.divider,
  },
  pinIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultMainText: {
    fontSize: 15,
    color: C.textPrimary,
    fontWeight: '500',
    marginBottom: 2,
  },
  resultSubText: {
    fontSize: 12,
    color: '#666666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#555555',
    fontSize: 14,
    paddingVertical: 24,
  },
  dismissOverlay: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
});
