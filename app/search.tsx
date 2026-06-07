import React, { useState, useEffect, useCallback } from 'react';
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

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // ── When user taps a result ──
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

  // ── Render a single result row ──
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Title ── */}
      <Text style={styles.title}>Where are you going?</Text>

      {/* ── Search Input ── */}
      <View style={styles.inputWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search destination..."
          placeholderTextColor="#555555"
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
        />
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={C.green}
            style={styles.spinner}
          />
        )}
      </View>

      {/* ── Results List ── */}
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.place_id)}
        renderItem={renderResultItem}
        keyboardShouldPersistTaps="handled"
        style={styles.resultsList}
        ListEmptyComponent={
          searchText.length >= 3 && !isLoading ? (
            <Text style={styles.emptyText}>No results found</Text>
          ) : searchText.length === 0 ? (
            <View style={styles.hintContainer}>
              <Text style={styles.hintEmoji}>📍</Text>
              <Text style={styles.hintText}>
                Search for any location in India
              </Text>
              <Text style={styles.hintSubText}>
                Type at least 3 characters to search
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    marginTop: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: C.textPrimary,
    paddingVertical: 12,
  },
  spinner: {
    marginLeft: 8,
  },
  resultsList: {
    flex: 1,
    marginTop: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: C.divider,
    borderRadius: 8,
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
    marginTop: 40,
  },
  hintContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  hintEmoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  hintText: {
    fontSize: 16,
    color: C.textHint,
    textAlign: 'center',
    marginBottom: 8,
  },
  hintSubText: {
    fontSize: 13,
    color: '#555555',
    textAlign: 'center',
  },
});
