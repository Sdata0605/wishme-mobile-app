import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { dueInAppMessages, fetchAlerts, scheduleOccasionNotifications, type InAppMessage } from '@/services/occasionAlerts';

const SEEN_PREFIX = 'occasion-inapp:';

/**
 * Keeps occasion alerts working in the background of the whole app:
 *  - rebuilds the phone's scheduled occasion notifications whenever the app starts or comes back,
 *  - shows an in-app message when an occasion is today (or the heads-up day) and its time has come,
 *  - opens the Occasion Alerts screen when a notification is tapped.
 */
export function OccasionInApp() {
  const { colors } = useTheme();
  const { user, session, getValidSession } = useAuth();
  const profileId = user?.profileId ?? '';
  const loggedIn = !!session?.access_token && !!profileId;

  const [queue, setQueue] = useState<InAppMessage[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const token = (await getValidSession())?.access_token;
      if (!token) return;
      const rows = await fetchAlerts(profileId, token);
      void scheduleOccasionNotifications(rows);

      const first = dueInAppMessages(rows, new Set());
      const stored = await AsyncStorage.multiGet(first.due.map(m => SEEN_PREFIX + m.key));
      const seen = new Set(stored.filter(([, v]) => !!v).map(([k]) => k.slice(SEEN_PREFIX.length)));
      const fresh = first.due.filter(m => !seen.has(m.key));
      setQueue(prev => {
        const have = new Set(prev.map(m => m.key));
        const add = fresh.filter(m => !have.has(m.key));
        if (add.length) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return add.length ? [...prev, ...add] : prev;
      });

      // An occasion later today at its chosen time: look again then.
      if (timer.current) clearTimeout(timer.current);
      if (first.msUntilNext !== null && first.msUntilNext < 12 * 3600_000) {
        timer.current = setTimeout(() => { void check(); }, first.msUntilNext + 1500);
      }
    } catch (e) {
      console.warn('[occasions] check failed', e instanceof Error ? e.message : e);
    }
  }, [loggedIn, profileId, getValidSession]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { kind?: string } | undefined;
      if (data?.kind === 'occasion') router.push('/occasion-alerts' as never);
    });
    return () => sub.remove();
  }, []);

  const current = queue[0] ?? null;

  const dismiss = (goToWish: boolean) => {
    if (!current) return;
    AsyncStorage.setItem(SEEN_PREFIX + current.key, '1').catch(() => {});
    setQueue(prev => prev.slice(1));
    if (goToWish) setTimeout(() => router.push('/wish-friend' as never), 80);
  };

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => dismiss(false)} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={() => dismiss(false)}>
        <Pressable onPress={() => {}} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={[current?.color ?? '#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.top}>
            <Text style={s.emoji}>{current?.emoji}</Text>
            <Text style={s.kind}>{current?.kind === 'today' ? 'HAPPENING TODAY' : 'COMING UP'}</Text>
          </LinearGradient>
          <View style={s.body}>
            <Text style={[s.title, { color: colors.foreground }]}>{current?.title.replace(/^\S+\s/, '')}</Text>
            <Text style={[s.text, { color: colors.mutedForeground }]}>{current?.body}</Text>
            <TouchableOpacity onPress={() => dismiss(true)} activeOpacity={0.9}>
              <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
                <Text style={s.primaryText}>Send a wish</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dismiss(false)} style={[s.ghost, { borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  top: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emoji: { fontSize: 52 },
  kind: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  body: { padding: 20, gap: 10 },
  title: { fontSize: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  text: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center', marginBottom: 6 },
  primary: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  ghost: { height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
