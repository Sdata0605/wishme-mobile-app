import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { Icon, type IconName } from '@/components/Icon';
import { choiceAccents } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import {
  getPermissionStates,
  isBlocked,
  isSupported,
  openSettings,
  request,
  type PermissionKind,
  type PermissionState,
  type PermissionStates,
} from '@/services/permissions';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

interface Row {
  kind: PermissionKind;
  icon: IconName;
  title: string;
  /** A few plain words saying what the app does with it; short, because tiles are half-width. */
  reason: string;
  accent: string;
}

const ROWS: readonly Row[] = [
  {
    kind: 'microphone',
    icon: 'mic',
    title: 'Microphone',
    reason: 'Talk to your assistant.',
    accent: choiceAccents.orange,
  },
  {
    kind: 'speechRecognition',
    icon: 'volume-2',
    title: 'Speech recognition',
    reason: 'Turn your words into text.',
    accent: choiceAccents.pink,
  },
  {
    kind: 'contacts',
    icon: 'users',
    title: 'Contacts',
    reason: 'Call people by name.',
    accent: choiceAccents.blue,
  },
  {
    kind: 'camera',
    icon: 'camera',
    title: 'Camera',
    reason: 'Scan QR codes to pay.',
    accent: choiceAccents.green,
  },
  {
    kind: 'mediaLibrary',
    icon: 'image',
    title: 'Photos',
    reason: 'Save and pick photos for wishes.',
    accent: choiceAccents.purple,
  },
  {
    kind: 'notifications',
    icon: 'bell',
    title: 'Notifications',
    reason: 'Alert you when reminders are due.',
    accent: choiceAccents.amber,
  },
];

function PermissionTile({
  row,
  state,
  pending,
  onAllow,
  onOpenSettings,
}: {
  row: Row;
  state: PermissionState | undefined;
  pending: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
}) {
  const { colors, isDark } = useTheme();
  const granted = state?.granted === true;
  const blocked = state ? isBlocked(state) : false;
  const action = blocked ? 'settings' : granted ? 'done' : 'allow';

  return (
    <Pressable
      onPress={action === 'settings' ? onOpenSettings : action === 'allow' ? onAllow : undefined}
      disabled={pending || action === 'done'}
      accessibilityRole="button"
      accessibilityState={{ disabled: action === 'done' }}
      accessibilityLabel={
        action === 'done'
          ? `${row.title} access allowed`
          : action === 'settings'
            ? `Open settings to allow ${row.title}`
            : `Allow ${row.title} access`
      }
      style={({ pressed }) => [
        s.tile,
        {
          backgroundColor: granted ? row.accent + (isDark ? '1F' : '10') : colors.card,
          borderColor: granted ? row.accent + '88' : colors.border,
          borderWidth: granted ? 1.5 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={s.tileTop}>
        <View style={[s.iconWell, { backgroundColor: row.accent + (isDark ? '2E' : '1A') }]}>
          <Icon name={row.icon} size={20} color={row.accent} />
        </View>

        {action === 'done' ? (
          <View style={[s.badge, { backgroundColor: colors.success }]}>
            <Icon name="check" size={13} color="#fff" />
          </View>
        ) : pending ? (
          <ActivityIndicator size="small" color={row.accent} />
        ) : (
          <View
            style={[
              s.pill,
              { backgroundColor: action === 'settings' ? colors.warning + '24' : row.accent + (isDark ? '2E' : '1A') },
            ]}
          >
            <Text style={[s.pillText, { color: action === 'settings' ? colors.warning : row.accent }]}>
              {action === 'settings' ? 'Settings' : 'Allow'}
            </Text>
          </View>
        )}
      </View>

      <View style={s.tileBody}>
        <Text style={[s.tileTitle, { color: colors.foreground }]} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={[s.tileReason, { color: colors.mutedForeground }]} numberOfLines={2}>
          {blocked ? 'Turned off. Change it in Settings.' : row.reason}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * First-run permissions screen. It explains each permission in our own UI first and only triggers
 * the OS dialog when the user taps Allow. Nothing here is required: every path out of this screen
 * leads into the app, which works with reduced features if everything is refused.
 *
 * The permissions sit in a two-column grid sized to share the screen, so all of them are visible at
 * once without scrolling on a normal phone.
 */
export default function PermissionsScreen() {
  const { colors, gradients, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // A token rather than a path, so this screen can never be pointed at an arbitrary route.
  const { next } = useLocalSearchParams<{ next?: string }>();

  const rows = useMemo(() => ROWS.filter((row) => isSupported(row.kind)), []);
  const [states, setStates] = useState<PermissionStates | null>(null);
  const [pending, setPending] = useState<PermissionKind | null>(null);
  const [askingAll, setAskingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPermissionStates().then((loaded) => {
      if (!cancelled) setStates(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback((state: PermissionState) => {
    setStates((current) => (current ? { ...current, [state.kind]: state } : current));
  }, []);

  const allow = useCallback(
    async (kind: PermissionKind) => {
      setPending(kind);
      apply(await request(kind));
      setPending(null);
    },
    [apply],
  );

  const allowAll = useCallback(async () => {
    setAskingAll(true);
    // One dialog at a time, in the listed order, so the user always knows what is being asked.
    for (const row of rows) {
      const state = states?.[row.kind];
      if (state && (state.granted || !state.canAskAgain)) continue;
      setPending(row.kind);
      apply(await request(row.kind));
    }
    setPending(null);
    setAskingAll(false);
  }, [rows, states, apply]);

  const leave = useCallback(() => {
    if (next === 'auth') router.replace('/(auth)');
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/assistant' as never);
  }, [next]);

  const remaining = rows.filter((row) => {
    const state = states?.[row.kind];
    return !state || (!state.granted && state.canAskAgain);
  });
  const settled = states !== null && remaining.length === 0;
  const allowed = rows.filter((row) => states?.[row.kind]?.granted).length;

  // Two tiles per line; an odd one out takes the whole last line.
  const lines: Row[][] = [];
  for (let i = 0; i < rows.length; i += 2) lines.push(rows.slice(i, i + 2));

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <LinearGradient
        colors={[colors.secondary + (isDark ? '26' : '14'), colors.background]}
        style={[s.wash, { height: insets.top + 260 }]}
        pointerEvents="none"
      />

      {/* The ScrollView is only a safety net for very small screens or very large text: the grid
          normally fills exactly the space between the heading and the buttons. */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: 12,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={s.hero}>
          <LinearGradient
            colors={gradients.assistant as unknown as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroOrb}
          >
            <Icon name="shield" size={22} color="#fff" />
          </LinearGradient>
          <Text style={[s.title, { color: colors.foreground }]}>A few permissions</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Tap the ones you want. You can say no to any of them and still use the app.
          </Text>
          <View style={[s.progress, { backgroundColor: colors.success + '1A' }]}>
            <View
              style={[
                s.progressDot,
                { backgroundColor: allowed === rows.length ? colors.success : colors.primary },
              ]}
            />
            <Text style={[s.progressText, { color: colors.foreground }]}>
              {allowed} of {rows.length} allowed
            </Text>
          </View>
        </Animated.View>

        <View style={s.grid}>
          {lines.map((line, lineIndex) => (
            <View key={line[0].kind} style={s.line}>
              {line.map((row, i) => (
                <Animated.View
                  key={row.kind}
                  entering={FadeInDown.delay(70 * (lineIndex * 2 + i)).duration(320)}
                  style={s.cell}
                >
                  <PermissionTile
                    row={row}
                    state={states?.[row.kind]}
                    pending={pending === row.kind}
                    onAllow={() => void allow(row.kind)}
                    onOpenSettings={() => void openSettings()}
                  />
                </Animated.View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.note}>
          <Icon name="lock" size={13} color={colors.mutedForeground} />
          <Text style={[s.noteText, { color: colors.mutedForeground }]}>These stay on your phone.</Text>
        </View>
      </ScrollView>

      <View
        style={[
          s.footer,
          { paddingBottom: insets.bottom + 12, borderTopColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <GradientButton
          title={settled ? 'Continue' : 'Allow all'}
          onPress={settled ? leave : () => void allowAll()}
          loading={askingAll || states === null}
          height={52}
          icon={<Icon name={settled ? 'arrow-right' : 'check-circle'} size={18} color="#fff" />}
          textStyle={s.ctaText}
        />
        <Pressable
          onPress={leave}
          disabled={askingAll}
          accessibilityRole="button"
          accessibilityLabel="Skip permissions for now"
          style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[s.skipText, { color: colors.mutedForeground }]}>Not now</Text>
        </Pressable>
      </View>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },

  hero: { alignItems: 'center' },
  heroOrb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, lineHeight: 32, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 12 },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  progressDot: { width: 7, height: 7, borderRadius: 4 },
  progressText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },

  // The grid takes whatever height is left, so its lines grow to fill the screen. Below minHeight
  // the ScrollView takes over; maxHeight stops tiles looking stretched on tall phones.
  grid: { flex: 1, gap: 10, marginTop: 18 },
  line: { flex: 1, flexDirection: 'row', gap: 10, minHeight: 104, maxHeight: 150 },
  cell: { flex: 1 },

  tile: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 20,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWell: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  tileBody: { marginTop: 8 },
  tileTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  tileReason: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 2 },

  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  noteText: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  ctaText: { fontSize: 16.5, fontFamily: 'Inter_700Bold' },
  skipBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  skipText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
