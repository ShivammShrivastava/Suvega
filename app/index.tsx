import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Brightness from 'expo-brightness';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Colour palette ──────────────────────────────────────────
const C = {
  bg: '#0A0A0A',
  bgCard: '#1A1A1A',
  bgBar: '#111111',
  textPrimary: '#FFFFFF',
  textSecond: '#E0E0E0',
  textHint: '#A0A0A0',
  divider: '#2A2A2A',
  border: '#333333',
  green: '#39FF14',
};

// ─── Leaflet HTML Generator ─────────────────────────────────
function getMapHtml(
  destLat: number,
  destLng: number,
  destName: string
): string {
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
    /* Navy blue tint filter on tiles */
    .leaflet-tile-pane {
      filter: brightness(0.78) contrast(1.15) sepia(0.3) hue-rotate(180deg) saturate(1.8);
    }
    .dark-tooltip {
      background: rgba(13,27,42,0.92);
      color: #FFFFFF;
      border: 1px solid rgba(66,133,244,0.3);
      border-radius: 6px;
      font-size: 11px;
      padding: 4px 8px;
      font-family: -apple-system, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
    }
    .dark-tooltip::before {
      border-top-color: rgba(13,27,42,0.92) !important;
    }
    .leaflet-control-attribution { display:none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${destLat}, ${destLng}], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Destination marker (green)
    var destMarker = L.circleMarker([${destLat}, ${destLng}], {
      radius: 9, color: '#39FF14', fillColor: '#39FF14', fillOpacity: 0.9, weight: 2
    }).addTo(map).bindTooltip('${destName.replace(/'/g, "\\'")}', {
      permanent: true, direction: 'top', className: 'dark-tooltip', offset: [0, -8]
    });

    // Vijay Nagar Chowk marker (red)
    var vjMarker = L.circleMarker([22.7533, 75.8937], {
      radius: 7, color: '#FF4444', fillColor: '#FF4444', fillOpacity: 0.9, weight: 2
    }).addTo(map).bindTooltip('Vijay Nagar', {
      permanent: false, direction: 'top', className: 'dark-tooltip', offset: [0, -6]
    });

    // User location marker (blue) — updated live
    var userMarker = null;
    var userPulse = null;

    // Route polyline
    var routeLine = null;

    window.updateUserLocation = function(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
        if (userPulse) userPulse.setLatLng([lat, lng]);
      } else {
        // Pulse ring
        userPulse = L.circleMarker([lat, lng], {
          radius: 16, color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.15, weight: 1
        }).addTo(map);
        // Solid dot
        userMarker = L.circleMarker([lat, lng], {
          radius: 7, color: '#FFFFFF', fillColor: '#4285F4', fillOpacity: 1, weight: 2
        }).addTo(map);
      }
    };

    window.drawRoute = function(coords) {
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline(coords, {
        color: '#39FF14', weight: 4, opacity: 0.85,
        lineJoin: 'round', lineCap: 'round'
      }).addTo(map);
      // Fit bounds to show full route
      try {
        var allPoints = coords.slice();
        if (userMarker) allPoints.push(userMarker.getLatLng());
        allPoints.push([${destLat}, ${destLng}]);
        map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] });
      } catch(e) {}
    };

    window.centerOnUser = function(lat, lng) {
      map.setView([lat, lng], 15, { animate: true });
    };
  </script>
</body>
</html>`;
}

// ─── Home Screen ─────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    destLat: string;
    destLng: string;
    destName: string;
  }>();

  // If no destination params → redirect to search
  if (!params.destLat || !params.destLng) {
    return <Redirect href={'/search' as any} />;
  }

  const destLat = parseFloat(params.destLat);
  const destLng = parseFloat(params.destLng);
  const destName = params.destName || 'Destination';

  // ── State ──
  const [speed, setSpeed] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [routeFetched, setRouteFetched] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const webViewReady = useRef(false);
  const originalBrightness = useRef<number | null>(null);
  const isBrightnessMaxed = useRef(false);
  const pendingInjections = useRef<string[]>([]);

  // ── Inject JS into WebView (queues if not ready) ──
  const injectJS = useCallback((js: string) => {
    if (webViewReady.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(js + '; true;');
    } else {
      pendingInjections.current.push(js);
    }
  }, []);

  // ── Flush pending injections when WebView loads ──
  const handleWebViewLoad = useCallback(() => {
    webViewReady.current = true;
    pendingInjections.current.forEach((js) => {
      webViewRef.current?.injectJavaScript(js + '; true;');
    });
    pendingInjections.current = [];

    // If we already have user location, inject it
    if (userLocation) {
      webViewRef.current?.injectJavaScript(
        `window.updateUserLocation(${userLocation.lat}, ${userLocation.lng}); true;`
      );
    }
  }, [userLocation]);

  // ── GPS Location Tracking ──
  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Save original brightness
      try {
        const { status: bStatus } =
          await Brightness.requestPermissionsAsync();
        if (bStatus === 'granted') {
          originalBrightness.current = await Brightness.getBrightnessAsync();
        }
      } catch {}

      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (loc) => {
          const rawSpeed = loc.coords.speed;
          const speedMs = rawSpeed != null && rawSpeed > 0 ? rawSpeed : 0;
          const speedKmh = Math.round(speedMs * 3.6);
          setSpeed(speedKmh);

          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setUserLocation({ lat, lng });

          // Update user marker on map
          injectJS(`window.updateUserLocation(${lat}, ${lng})`);

          // Auto brightness
          handleAutoBrightness(speedKmh);
        }
      );
    };

    startTracking();

    return () => {
      locationSub?.remove();
      restoreBrightness();
    };
  }, []);

  // ── Fetch OSRM Route when user location is available ──
  useEffect(() => {
    if (!userLocation || routeFetched) return;

    const fetchRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${userLocation.lng},${userLocation.lat};${destLng},${destLat}` +
          `?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        if (!data.routes || data.routes.length === 0) return;

        const coords = data.routes[0].geometry.coordinates;
        // Convert [lng, lat] → [lat, lng] for Leaflet
        const leafletCoords = coords.map((c: number[]) => [c[1], c[0]]);

        injectJS(`window.drawRoute(${JSON.stringify(leafletCoords)})`);
        setRouteFetched(true);
      } catch {
        // Route fetch failed — map still works, just no polyline
      }
    };

    fetchRoute();
  }, [userLocation, routeFetched, destLat, destLng, injectJS]);

  // ── Auto Brightness ──
  const handleAutoBrightness = useCallback(async (currentSpeed: number) => {
    try {
      if (currentSpeed > 10 && !isBrightnessMaxed.current) {
        if (originalBrightness.current === null) {
          originalBrightness.current = await Brightness.getBrightnessAsync();
        }
        await Brightness.setBrightnessAsync(1.0);
        isBrightnessMaxed.current = true;
      } else if (currentSpeed <= 10 && isBrightnessMaxed.current) {
        await Brightness.setBrightnessAsync(
          originalBrightness.current ?? 0.5
        );
        isBrightnessMaxed.current = false;
      }
    } catch {}
  }, []);

  const restoreBrightness = useCallback(async () => {
    try {
      if (originalBrightness.current !== null) {
        await Brightness.setBrightnessAsync(originalBrightness.current);
      }
    } catch {}
  }, []);

  // ── Map HTML ──
  const mapHtml = getMapHtml(destLat, destLng, destName);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ━━━ SECTION 1 — TOP BAR + SPEED BAND ━━━ */}
      <View style={styles.section1}>
        {/* Row 1 — Header */}
        <View style={styles.headerBar}>
          <Text style={styles.hamburger}>≡</Text>
          <Text style={styles.headerTitle}>Suvega</Text>
          <Text style={styles.bellIcon}>🔔</Text>
        </View>

        {/* Row 2 — Speed band */}
        <View style={styles.speedBand}>
          <View style={styles.speedItem}>
            <Text style={styles.speedValue}>22</Text>
            <Text style={styles.speedLabel}>MIN</Text>
          </View>
          <View style={styles.speedItem}>
            <Text style={styles.speedDash}>————————</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
          <View style={styles.speedItem}>
            <Text style={styles.speedValue}>35</Text>
            <Text style={styles.speedLabel}>MAX</Text>
          </View>
        </View>
      </View>

      {/* ━━━ SECTION 2 — LIVE MAP ━━━ */}
      <View style={styles.section2}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.webView}
          onLoad={handleWebViewLoad}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.mapLoading}>
              <Text style={styles.mapLoadingText}>Loading map…</Text>
            </View>
          )}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          // Allow WebView to load Leaflet resources
          originWhitelist={['*']}
          mixedContentMode="always"
        />
      </View>

      {/* ━━━ SECTION 3 — LIVE SPEEDOMETER ━━━ */}
      <View style={[styles.section3, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={styles.liveSpeed}>Your speed: {speed} km/h</Text>
        <Text style={styles.adviceText}>
          ✅  PERFECT — YOU WILL HIT GREEN!
        </Text>
        <Text style={styles.distanceText}>📍  Vijay Nagar Chowk  340m →</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Section 1
  section1: {
    backgroundColor: C.bgBar,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
  },
  hamburger: { fontSize: 20, color: C.textPrimary },
  headerTitle: { fontSize: 18, fontWeight: '500', color: C.textPrimary },
  bellIcon: { fontSize: 18, color: C.textPrimary },
  speedBand: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  speedItem: { alignItems: 'center' },
  speedValue: { fontSize: 36, fontWeight: '700', color: C.textPrimary },
  speedLabel: { fontSize: 11, color: '#666666', marginTop: 2 },
  speedDash: { fontSize: 16, color: '#444444' },
  speedUnit: { fontSize: 11, color: '#666666', marginTop: 2 },

  // Section 2
  section2: {
    flex: 1,
    backgroundColor: '#0d1b2a',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0d1b2a',
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1b2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLoadingText: {
    color: C.border,
    fontSize: 14,
  },

  // Section 3
  section3: {
    backgroundColor: C.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  liveSpeed: {
    fontSize: 15,
    color: C.textPrimary,
    marginBottom: 8,
  },
  adviceText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.green,
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
