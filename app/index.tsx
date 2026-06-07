import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
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

// ─── Splash Screen Component ─────────────────────────────────
function SplashView() {
  return (
    <View style={splashStyles.container}>
      {/* Speedometer icon area */}
      <View style={splashStyles.iconContainer}>
        <View style={splashStyles.iconBox}>
          {/* Needle */}
          <View style={splashStyles.needleContainer}>
            <View style={splashStyles.needle} />
            <View style={splashStyles.needleDot} />
          </View>
          {/* Arc segments */}
          <View style={splashStyles.arcGray} />
          <View style={splashStyles.arcGreen} />
        </View>
      </View>

      {/* App name */}
      <Text style={splashStyles.title}>Suvega</Text>
      <Text style={splashStyles.subtitle}>RIDE THE GREEN</Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconBox: {
    width: 140,
    height: 140,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  needleContainer: {
    position: 'absolute',
    width: 70,
    height: 2,
    left: 20,
    top: 80,
    transform: [{ rotate: '-45deg' }],
    transformOrigin: 'right center',
    zIndex: 2,
  },
  needle: {
    position: 'absolute',
    width: 50,
    height: 2,
    backgroundColor: '#FFFFFF',
    left: 0,
    top: 0,
    borderRadius: 1,
  },
  needleDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: '#0A0A0A',
    right: -2,
    top: -4,
  },
  arcGray: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 5,
    borderColor: 'transparent',
    borderTopColor: '#444444',
    borderRightColor: '#444444',
    top: 25,
    transform: [{ rotate: '-45deg' }],
  },
  arcGreen: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 5,
    borderColor: 'transparent',
    borderTopColor: C.green,
    top: 25,
    transform: [{ rotate: '45deg' }],
  },
  title: {
    fontSize: 42,
    fontWeight: '300',
    color: C.textPrimary,
    letterSpacing: 2,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.green,
    letterSpacing: 6,
  },
});

// ─── Main Velocity Screen ────────────────────────────────────
function VelocityScreen() {
  const insets = useSafeAreaInsets();
  const [speed, setSpeed] = useState(0);
  const originalBrightness = useRef<number | null>(null);
  const isBrightnessMaxed = useRef(false);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      // Store original brightness for later restore
      try {
        const { status: brightnessStatus } =
          await Brightness.requestPermissionsAsync();
        if (brightnessStatus === 'granted') {
          originalBrightness.current = await Brightness.getBrightnessAsync();
        }
      } catch {
        // Brightness API may not be available on all devices
      }

      // Watch position with high accuracy, updates every ~1 second
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (location) => {
          // speed is in m/s, can be null
          const rawSpeed = location.coords.speed;
          const speedMs = rawSpeed != null && rawSpeed > 0 ? rawSpeed : 0;
          const speedKmh = Math.round(speedMs * 3.6);
          setSpeed(speedKmh);

          // Auto brightness: max when riding (> 10 km/h)
          handleAutoBrightness(speedKmh);
        }
      );
    };

    startLocationTracking();

    // Cleanup on unmount
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      // Restore original brightness
      restoreBrightness();
    };
  }, []);

  const handleAutoBrightness = useCallback(async (currentSpeed: number) => {
    try {
      if (currentSpeed > 10 && !isBrightnessMaxed.current) {
        // Save current brightness before maxing
        if (originalBrightness.current === null) {
          originalBrightness.current = await Brightness.getBrightnessAsync();
        }
        await Brightness.setBrightnessAsync(1.0);
        isBrightnessMaxed.current = true;
      } else if (currentSpeed <= 10 && isBrightnessMaxed.current) {
        // Restore original brightness
        const restore = originalBrightness.current ?? 0.5;
        await Brightness.setBrightnessAsync(restore);
        isBrightnessMaxed.current = false;
      }
    } catch {
      // Brightness control may fail on some devices — silently ignore
    }
  }, []);

  const restoreBrightness = useCallback(async () => {
    try {
      if (originalBrightness.current !== null) {
        await Brightness.setBrightnessAsync(originalBrightness.current);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ━━━ SECTION 1 — TOP BAR + SPEED BAND ━━━ */}
      <View style={styles.section1}>
        {/* ROW 1 — Header bar */}
        <View style={styles.headerBar}>
          <Text style={styles.hamburger}>≡</Text>
          <Text style={styles.headerTitle}>Velocity</Text>
          <Text style={styles.bellIcon}>🔔</Text>
        </View>

        {/* ROW 2 — Speed band */}
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

      {/* ━━━ SECTION 2 — MAP PLACEHOLDER ━━━ */}
      <View style={styles.section2}>
        <Text style={styles.mapText}>GOOGLE MAP</Text>
      </View>

      {/* ━━━ SECTION 3 — LIVE SPEEDOMETER ━━━ */}
      <View style={[styles.section3, { paddingBottom: insets.bottom + 12 }]}>
        {/* LINE 1 — Live speed */}
        <Text style={styles.liveSpeed}>
          Your speed: {speed} km/h
        </Text>

        {/* LINE 2 — Advice text (hardcoded) */}
        <Text style={styles.adviceText}>
          ✅  PERFECT — YOU WILL HIT GREEN!
        </Text>

        {/* LINE 3 — Distance text (hardcoded) */}
        <Text style={styles.distanceText}>
          📍  Vijay Nagar Chowk  340m →
        </Text>
      </View>
    </View>
  );
}

// ─── Root Screen — Splash → Velocity transition ─────────────
export default function RootScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const mainFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Show splash for 2.5 seconds, then fade out
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(mainFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSplash(false);
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Main screen (always mounted for GPS to start early) */}
      <Animated.View style={{ flex: 1, opacity: mainFadeAnim }}>
        <VelocityScreen />
      </Animated.View>

      {/* Splash overlay */}
      {showSplash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: fadeAnim, zIndex: 10 },
          ]}
        >
          <SplashView />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Section 1: Top Bar + Speed Band ──
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
  hamburger: {
    fontSize: 20,
    color: C.textPrimary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: C.textPrimary,
  },
  bellIcon: {
    fontSize: 18,
    color: C.textPrimary,
  },
  speedBand: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  speedItem: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: 36,
    fontWeight: '700',
    color: C.textPrimary,
  },
  speedLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  speedDash: {
    fontSize: 16,
    color: '#444444',
  },
  speedUnit: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },

  // ── Section 2: Map Placeholder ──
  section2: {
    flex: 1,
    backgroundColor: C.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapText: {
    fontSize: 14,
    color: C.border,
  },

  // ── Section 3: Live Speedometer ──
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
