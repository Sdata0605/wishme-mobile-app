import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';

import { AuthProvider } from '@/context/AuthContext';
import { DrawerProvider } from '@/context/DrawerContext';
import { ThemeProvider } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="celebrity/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="wish-orders" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="loved-ones" />
      <Stack.Screen name="photo-wish" />
      <Stack.Screen name="wish-celebrity" />
      <Stack.Screen name="wish-friend" />
      <Stack.Screen name="for-business" />
      <Stack.Screen name="greeting-cards" />
      <Stack.Screen name="image-promotions" />
      <Stack.Screen name="referrals" />
      <Stack.Screen name="commission" />
      <Stack.Screen name="occasions" />
      <Stack.Screen name="occasion-book/[id]" />
      <Stack.Screen name="occasion-alerts" />
      <Stack.Screen name="occasion-wishes" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="celebrity-signup" />
      <Stack.Screen name="celebrity-dashboard" />
      <Stack.Screen name="select-plan" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenCapture.allowScreenCaptureAsync();
      const sub = AppState.addEventListener('change', state => {
        if (state === 'active') ScreenCapture.allowScreenCaptureAsync();
      });
      return () => sub.remove();
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
              <AuthProvider>
                <DrawerProvider>
                  <RootLayoutNav />
                </DrawerProvider>
              </AuthProvider>
            </ThemeProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
