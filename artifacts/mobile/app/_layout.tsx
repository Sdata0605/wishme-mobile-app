import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useSegments } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DraggableMoreButton } from '@/components/DraggableMoreButton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AIChatButton } from '@/components/AIChatButton';
import { VoiceAssistantButton } from '@/components/VoiceAssistantButton';

import { AuthProvider } from '@/context/AuthContext';
import { DrawerProvider } from '@/context/DrawerContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AgentStateProvider } from '@/context/AgentStateContext';
import { AIAssistantProvider } from '@/context/AIAssistantContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const HIDDEN_SEGMENTS = new Set(['(auth)', 'onboarding']);

function FloatingButtons() {
  const segments = useSegments();
  if (HIDDEN_SEGMENTS.has(segments[0] as string)) return null;
  return (
    <>
      <DraggableMoreButton />
      <AIChatButton />
      <VoiceAssistantButton />
    </>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="celebrity/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking-summary" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="wish-orders" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="loved-ones" />
      <Stack.Screen name="photo-wish" />
      <Stack.Screen name="wish-celebrity" />
      <Stack.Screen name="wish-celebrity-occasion/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="wish-booking/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="wish-confirmation/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="wish-congratulations" />
      <Stack.Screen name="wish-friend" />
      <Stack.Screen name="for-business" />
      <Stack.Screen name="greeting-cards" />
      <Stack.Screen name="image-promotions" />
      <Stack.Screen name="ugc-videos" />
      <Stack.Screen name="ugc-ads" />
      <Stack.Screen name="voice-call-wish" />
      <Stack.Screen name="referrals" />
      <Stack.Screen name="commission" />
      <Stack.Screen name="occasions" />
      <Stack.Screen name="occasion-book/[id]" />
      <Stack.Screen name="occasion-alerts" />
      <Stack.Screen name="occasion-wishes" />
      <Stack.Screen name="ai-assistant" options={{ presentation: 'card' }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="celebrity-signup" />
      <Stack.Screen name="celebrity-dashboard" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="select-plan" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="services/index" options={{ presentation: 'card', headerShown: false }} />
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
            <KeyboardProvider>
              <ThemeProvider>
                <AuthProvider>
                  <AgentStateProvider>
                    <AIAssistantProvider>
                      <DrawerProvider>
                        <View style={{ flex: 1 }}>
                          <RootLayoutNav />
                          <FloatingButtons />
                        </View>
                      </DrawerProvider>
                    </AIAssistantProvider>
                  </AgentStateProvider>
                </AuthProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
