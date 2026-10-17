import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { SettingsGroup, SettingsHeader, SettingsRow } from '@/components/settings/SettingsUI';
import { useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

interface Item {
  id: string;
  icon: IconName;
  label: string;
  subtitle?: string;
  keywords?: string;
  route?: string;
  danger?: boolean;
  onPress?: () => void;
}

interface Section {
  title?: string;
  items: Item[];
}

const go = (route: string) => () => router.push(route as never);

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { persona } = useAssistantPersona();
  const [query, setQuery] = useState('');

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'WM' : 'WM';
  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Your account';

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)' as never);
        },
      },
    ]);
  };

  const sections: Section[] = useMemo(() => {
    const list: Section[] = [
      {
        title: 'Your account',
        items: [
          { id: 'profile', icon: 'user', label: 'Edit profile', subtitle: 'Name, phone and photo', route: '/edit-profile', keywords: 'name phone photo account' },
          { id: 'security', icon: 'lock', label: 'Password & security', subtitle: 'Change your password', route: '/settings/security', keywords: 'password login safety' },
          { id: 'wallet', icon: 'credit-card', label: 'Wallet', subtitle: 'Balance and add money', route: '/wallet', keywords: 'money balance payment' },
        ],
      },
      {
        title: 'Assistant & appearance',
        items: [
          {
            id: 'assistant',
            icon: 'sparkles',
            label: 'AI Assistant',
            subtitle: `${persona.name} · ${persona.voice} voice`,
            route: '/settings/assistant',
            keywords: 'voice name personality language ai talk',
          },
          { id: 'appearance', icon: isDark ? 'moon' : 'sun', label: 'Appearance', subtitle: isDark ? 'Dark mode' : 'Light mode', route: '/settings/appearance', keywords: 'theme dark light mode' },
        ],
      },
      {
        title: 'Your activity',
        items: [
          { id: 'bookings', icon: 'calendar', label: 'My bookings', route: '/bookings', keywords: 'orders celebrity' },
          { id: 'orders', icon: 'shopping-bag', label: 'Wish orders', route: '/wish-orders', keywords: 'wishes videos' },
          { id: 'favorites', icon: 'heart', label: 'Favorites', route: '/favorites', keywords: 'liked saved celebrities' },
          { id: 'following', icon: 'users', label: 'Following', route: '/following', keywords: 'celebrities follow' },
          { id: 'loved', icon: 'heart', label: 'Loved ones', route: '/loved-ones', keywords: 'family friends people' },
          { id: 'alerts', icon: 'bell', label: 'Occasion alerts', route: '/occasion-alerts', keywords: 'birthday reminders notifications' },
        ],
      },
      {
        title: 'Rewards & plan',
        items: [
          { id: 'referrals', icon: 'share-2', label: 'Refer & earn', route: '/referrals', keywords: 'referral invite friends' },
          { id: 'plan', icon: 'award', label: 'My plan', route: '/select-plan', keywords: 'membership subscription upgrade' },
        ],
      },
      {
        title: 'For creators & business',
        items: [
          { id: 'business', icon: 'briefcase', label: 'WishMe for business', route: '/for-business', keywords: 'brand campaign' },
          user?.role === 'celebrity'
            ? { id: 'cdash', icon: 'star', label: 'Celebrity dashboard', route: '/celebrity-dashboard', keywords: 'creator' }
            : { id: 'become', icon: 'star', label: 'Become a celebrity', route: '/celebrity-signup', keywords: 'creator join apply' },
        ],
      },
      {
        title: 'Help',
        items: [{ id: 'support', icon: 'help-circle', label: 'Help & support', route: '/support', keywords: 'contact faq problem' }],
      },
    ];
    return list;
  }, [persona.name, persona.voice, isDark, user?.role]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: q
            ? section.items.filter((i) => `${i.label} ${i.subtitle ?? ''} ${i.keywords ?? ''}`.toLowerCase().includes(q))
            : section.items,
        }))
        .filter((section) => section.items.length > 0),
    [sections, q],
  );

  const showLogout = !q || 'log out logout sign out'.includes(q);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <SettingsHeader title="Settings" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={[s.search, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search settings"
            placeholderTextColor={colors.mutedForeground}
            style={[s.searchInput, { color: colors.foreground }]}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search settings"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Profile card */}
        {!q ? (
          <TouchableOpacity activeOpacity={0.7} onPress={go('/edit-profile')} style={[s.profile, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[s.avatar, { backgroundColor: colors.primary + '25' }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
                {fullName}
              </Text>
              <Text style={[s.email, { color: colors.mutedForeground }]} numberOfLines={1}>
                {user?.email ?? 'Tap to edit your profile'}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}

        {visible.map((section) => (
          <SettingsGroup key={section.title} title={section.title}>
            {section.items.map((item) => (
              <SettingsRow
                key={item.id}
                icon={item.icon}
                label={item.label}
                subtitle={item.subtitle}
                onPress={item.onPress ?? go(item.route!)}
              />
            ))}
          </SettingsGroup>
        ))}

        {q && visible.length === 0 && !showLogout ? (
          <Text style={[s.empty, { color: colors.mutedForeground }]}>No settings match “{query}”.</Text>
        ) : null}

        {showLogout ? (
          <SettingsGroup title="Login">
            <SettingsRow icon="log-out" label="Log out" onPress={confirmLogout} danger />
          </SettingsGroup>
        ) : null}

        <Text style={[s.version, { color: colors.mutedForeground }]}>WishMe · version {version}</Text>
      </ScrollView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 16, paddingHorizontal: 14, height: 46, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15.5, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginTop: 18, padding: 14, borderRadius: 18, borderWidth: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  email: { fontSize: 13.5, fontFamily: 'Inter_400Regular', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15, fontFamily: 'Inter_400Regular' },
  version: { textAlign: 'center', marginTop: 28, fontSize: 12.5, fontFamily: 'Inter_400Regular' },
});
