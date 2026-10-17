import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import { Alert, AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { adoptRootFromInstance } from '@/assistant-hook';
import '@/constants/cancelableAlerts';
import { AppUpdateGate } from '@/components/AppUpdateGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AssistantOverlay } from '@/components/assistant/AssistantOverlay';

import { AssistantPersonaProvider, useAssistantPersona } from '@/context/AssistantPersonaContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DrawerProvider } from '@/context/DrawerContext';
import { OrderConfirmProvider } from '@/context/OrderConfirmContext';
import { OccasionInApp } from '@/components/OccasionInApp';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import * as SystemUI from 'expo-system-ui';
import { AgentStateProvider } from '@/context/AgentStateContext';
import { VoiceAssistantProvider } from '@/context/VoiceAssistantContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const HIDDEN_SEGMENTS = new Set(['(auth)', 'onboarding']);

function FloatingButtons() {
  const segments = useSegments();
  if (HIDDEN_SEGMENTS.has(segments[0] as string)) return null;
  return (
    <AssistantOverlay />
  );
}

/**
 * Asks each user to set up their assistant once: when the database has no saved settings for
 * them (new accounts, and existing users the first time after this feature shipped).
 * It waits until they reach the main app so it never interrupts sign-up or plan selection.
 */
function AssistantSetupGate() {
  const { user } = useAuth();
  const { status } = useAssistantPersona();
  const segments = useSegments();
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || status !== 'needs-setup') return;
    if (segments[0] !== '(tabs)') return;
    if (asked.current === user.id) return;
    asked.current = user.id;
    router.push('/assistant-setup' as never);
  }, [user?.id, status, segments]);

  return null;
}

/**
 * Status-bar icons follow the theme: dark on light surfaces, light on dark ones. Without this the
 * clock, battery and signal icons stayed white and vanished on every light screen (QA audit M-04).
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

/**
 * When the server ends a login (signing in on another device does it), the assistant and the app's functions are refused
 * with "unauthorized" while ordinary pages still seem to work. The auth layer then signs the user out; this tells them why
 * once and opens the sign-in screen, instead of leaving the assistant saying it cannot reach the internet.
 */
function SessionEndedGate() {
  const { sessionEndedAt } = useAuth();
  useEffect(() => {
    if (!sessionEndedAt) return;
    Alert.alert('Please sign in again', 'Your login has ended, for example because you signed in on another device.');
    router.replace('/(auth)' as never);
  }, [sessionEndedAt]);
  return null;
}

/**
 * Paints the app's page colour behind everything: the phone's window and the navigator's cards. Without it the
 * navigator's default near-white background showed for a moment between the animated splash and the next screen.
 */
function useAppBackground() {
  const { neon } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(neon.bg).catch(() => {});
  }, [neon.bg]);
  return neon.bg;
}

/** The screens the splash hands over to: they fade in over the same page colour instead of sliding in. */
const AFTER_SPLASH = { animation: 'fade' as const, animationDuration: 320 };

/** The root view under the navigator, in the same page colour, so nothing lighter is ever behind a screen. */
function AppRoot({ children }: { children: React.ReactNode }) {
  const background = useAppBackground();
  return (
    <View style={{ flex: 1, backgroundColor: background }} ref={adoptRootFromInstance}>
      {children}
    </View>
  );
}

function RootLayoutNav() {
  const { neon } = useTheme();
  const background = neon.bg;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={AFTER_SPLASH} />
      <Stack.Screen name="(tabs)" options={AFTER_SPLASH} />
      <Stack.Screen name="onboarding" options={AFTER_SPLASH} />
      <Stack.Screen name="celebrity/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking-summary" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="favorites" />
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
      <Stack.Screen name="library" />
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
      <Stack.Screen name="settings" />
      <Stack.Screen name="ai-calls" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="reminders" />
      <Stack.Screen name="reminder-edit" options={{ presentation: 'card' }} />
      <Stack.Screen name="event-edit" options={{ presentation: 'card' }} />
      <Stack.Screen name="call-logs" />
      <Stack.Screen name="call-log/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="documents" />
      <Stack.Screen name="finance" />
      <Stack.Screen name="features" />
      <Stack.Screen name="news" />
      <Stack.Screen name="document/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="assistant-setup" options={{ presentation: 'card' }} />
      <Stack.Screen name="celebrity-signup" />
      <Stack.Screen name="celebrity-dashboard" options={AFTER_SPLASH} />
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
    // WishMe's type: Inter for text, Playfair Display for headlines.
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
                    <AssistantPersonaProvider>
                    <VoiceAssistantProvider>
                      <DrawerProvider>
                      <OrderConfirmProvider>
                        <AppRoot>
                          <ThemedStatusBar />
                          <RootLayoutNav />
                          <FloatingButtons />
                          <AssistantSetupGate />
                          <SessionEndedGate />
                          <OccasionInApp />
                          <AppUpdateGate />
                        </AppRoot>
                      </OrderConfirmProvider>
                      </DrawerProvider>
                    </VoiceAssistantProvider>
                    </AssistantPersonaProvider>
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
