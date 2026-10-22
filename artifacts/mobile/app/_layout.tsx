import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Alert, AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootLog } from '@/services/bootLog';
import { adoptRootFromInstance } from '@/assistant-hook';
import '@/constants/cancelableAlerts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AssistantOverlay } from '@/components/assistant/AssistantOverlay';

import { AssistantPersonaProvider, useAssistantPersona } from '@/context/AssistantPersonaContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DrawerProvider } from '@/context/DrawerContext';
import { OrderConfirmProvider } from '@/context/OrderConfirmContext';
import { OccasionInApp } from '@/components/OccasionInApp';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AgentStateProvider } from '@/context/AgentStateContext';
import { VoiceAssistantProvider } from '@/context/VoiceAssistantContext';
import { reminderIdFrom, syncScheduledReminders } from '@/services/hub/notifications';
import { acknowledgeReminder } from '@/services/hub/reminders';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const HIDDEN_SEGMENTS = new Set(['(auth)', 'onboarding', 'setting-up']);

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
 * Keeps the phone's own scheduled reminders in step with the server's.
 *
 * Android forgets scheduled notifications on reboot and when the app is force-stopped, so they are
 * rebuilt whenever the app starts or returns to the foreground. Tapping a reminder opens it.
 */
function ReminderNotifications() {
  const { session, getValidSession } = useAuth();
  const loggedIn = !!session?.access_token;

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;

    const sync = async () => {
      const token = (await getValidSession())?.access_token;
      if (!token || cancelled) return;
      // Never asks here: notification permission is requested on the Permissions screen.
      await syncScheduledReminders(token);
    };

    void sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [loggedIn, getValidSession]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = reminderIdFrom(response);
      if (!id) return;

      // Swiping a reminder away is the user dealing with it, exactly as the editor promises
      // ("if you have not dismissed the reminder in time..."). Without this it counted as ignored
      // and the escalation rang them anyway.
      const dismissed = response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? false : true;
      if (!dismissed) router.push(`/reminder-edit?id=${id}` as never);

      // Either way they have seen it, so nothing should ring about it later.
      void (async () => {
        const token = (await getValidSession())?.access_token;
        if (token) await acknowledgeReminder(token, id);
      })();
    });
    return () => sub.remove();
  }, []);

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

function RootLayoutNav() {
  const { neon } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: neon.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="celebrity/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="booking-summary" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="news-story" options={{ presentation: 'card' }} />
      <Stack.Screen name="quote-cards" options={{ presentation: 'card' }} />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="wish-orders" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="loved-ones" />
      <Stack.Screen name="pay-mobile" />
      <Stack.Screen name="pay-upi" />
      <Stack.Screen name="insurance" />
      <Stack.Screen name="garages" />
      <Stack.Screen name="vehicle-number" />
      <Stack.Screen name="vehicle-quote" />
      <Stack.Screen name="health-plan" />
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
      <Stack.Screen name="celebrity-dashboard" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="select-plan" />
      <Stack.Screen name="setting-up" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="services/index" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // MyAssistant's type: Manrope for text, Space Grotesk for headlines. They are registered under the family
    // names the app already uses (Inter_* and PlayfairDisplay_*), so every screen switches without edits.
    Inter_400Regular: Manrope_400Regular,
    Inter_500Medium: Manrope_500Medium,
    Inter_600SemiBold: Manrope_600SemiBold,
    Inter_700Bold: Manrope_700Bold,
    PlayfairDisplay_700Bold: SpaceGrotesk_700Bold,
    // Each file is registered once: loading one file under two names in parallel let one load read a half-written
    // cache file, which drew blank text.
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
    bootLog('root layout mounted: providers (login, persona, assistant) are being created now, fonts loaded =', fontsLoaded);
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#1B0829').catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      bootLog('fonts ready: native splash hides, the first screen can draw. error =', !!fontError);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // The providers mount at once, while the fonts are still loading behind the native splash: the assistant's connection
  // (login restore, voice token, socket, setup) starts then instead of after the first screen. Only what is drawn waits.
  const fontsReady = fontsLoaded || !!fontError;

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
                        {fontsReady ? (
                        <View style={{ flex: 1, backgroundColor: '#1B0829' }} ref={adoptRootFromInstance}>
                          <ThemedStatusBar />
                          <RootLayoutNav />
                          <FloatingButtons />
                          <AssistantSetupGate />
                          <SessionEndedGate />
                          <ReminderNotifications />
                          <OccasionInApp />
                        </View>
                        ) : null}
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
