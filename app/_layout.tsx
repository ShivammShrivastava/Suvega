import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import 'react-native-reanimated';

// ─── Colour palette ──────────────────────────────────────────
const C = {
  bg: '#0A0A0A',
  green: '#39FF14',
  textPrimary: '#FFFFFF',
};

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// ─── Custom In-App Splash ────────────────────────────────────
function SplashView() {
  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.iconContainer}>
        <View style={splashStyles.iconBox}>
          <View style={splashStyles.needleContainer}>
            <View style={splashStyles.needle} />
            <View style={splashStyles.needleDot} />
          </View>
          <View style={splashStyles.arcGray} />
          <View style={splashStyles.arcGreen} />
        </View>
      </View>
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
  iconContainer: { marginBottom: 32 },
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
    borderRadius: 1,
  },
  needleDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: C.bg,
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

// ─── Root Layout ─────────────────────────────────────────────
export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide native splash immediately — our custom splash takes over
    SplashScreen.hideAsync();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="search" />
      </Stack>
      <StatusBar style="light" />

      {/* Splash overlay — covers everything for 2.5s */}
      {showSplash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: fadeAnim, zIndex: 100 },
          ]}
        >
          <SplashView />
        </Animated.View>
      )}
    </View>
  );
}
