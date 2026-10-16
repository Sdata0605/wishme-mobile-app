import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { supabaseFetch } from '@/constants/supabase';
import type { User } from '@/context/AuthContext';
import { fmtRupee, styles } from '@/components/celebrity-dashboard/shared';
import type { Celebrity } from '@/components/celebrity-dashboard/shared';
import { DashboardDrawer } from '@/components/celebrity-dashboard/DashboardDrawer';
import { OverviewScreen } from '@/components/celebrity-dashboard/OverviewScreen';
import { sectionByKey } from '@/components/celebrity-dashboard/sections';
import { useDashboardData } from '@/components/celebrity-dashboard/useDashboardData';
import { OrdersTab } from '@/components/celebrity-dashboard/OrdersTab';
import { WalletTab } from '@/components/celebrity-dashboard/WalletTab';
import { MessagesTab } from '@/components/celebrity-dashboard/MessagesTab';
import { ReviewsTab } from '@/components/celebrity-dashboard/ReviewsTab';
import { FollowersTab } from '@/components/celebrity-dashboard/FollowersTab';
import { ContentTab } from '@/components/celebrity-dashboard/ContentTab';
import { TdsTab } from '@/components/celebrity-dashboard/TdsTab';
import { ProfileTab } from '@/components/celebrity-dashboard/ProfileTab';

export default function CelebrityDashboardScreen() {
  const { colors } = useTheme();
  const { user, session, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;

  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [notCeleb, setNotCeleb] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useDashboardData(celebrity?.id, user?.profileId, session, refreshKey);

  // Back from any section goes to the Overview first; only there does it leave the dashboard.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuOpen) { setMenuOpen(false); return true; }
      if (activeTab !== 'overview') { setActiveTab('overview'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [menuOpen, activeTab]);

  const fetchCelebrity = useCallback(async () => {
    if (!user?.profileId || !session?.access_token) { setLoading(false); return; }
    setFetchError(null);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrities?profile_id=eq.${user.profileId}&select=*&limit=1`,
        {},
        session.access_token,
      );
      if (!res.ok) {
        setFetchError(`Failed to load celebrity data (${res.status}). Please pull to refresh.`);
        setLoading(false);
        return;
      }
      const rows = await res.json() as Celebrity[];
      if (!rows || rows.length === 0) {
        setNotCeleb(true);
        setLoading(false);
        return;
      }
      const celeb = rows[0];
      setCelebrity(celeb);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setFetchError(`${msg}. Please pull to refresh.`);
    } finally {
      setLoading(false);
    }
  }, [user?.profileId, session?.access_token]);

  useEffect(() => { fetchCelebrity(); }, [fetchCelebrity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCelebrity();
    setRefreshKey(k => k + 1);
    setRefreshing(false);
  }, [fetchCelebrity]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#7B5CFA" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <Icon name="alert-circle" size={48} color="#EF4444" />
          <Text style={[styles.accessTitle, { color: colors.foreground }]}>Something went wrong</Text>
          <Text style={[styles.accessSub, { color: colors.mutedForeground }]}>{fetchError}</Text>
          <TouchableOpacity style={[styles.backBtn, { borderColor: colors.primary }]} onPress={() => { setFetchError(null); setLoading(true); fetchCelebrity(); }}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  if (notCeleb) {
    return (
      <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <Icon name="shield" size={48} color={colors.mutedForeground} />
          <Text style={[styles.accessTitle, { color: colors.foreground }]}>Access Restricted</Text>
          <Text style={[styles.accessSub, { color: colors.mutedForeground }]}>This dashboard is only available to approved celebrities.</Text>
          <TouchableOpacity style={[styles.backBtn, { borderColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  if (!celebrity) return null;

  const section = sectionByKey(activeTab);

  // Side bar badges: what is waiting, per section.
  const badges: Record<string, number> = { orders: data.ordersToDo, messages: data.unreadMessages };
  const descriptions: Record<string, string> = {
    followers: data.followers === 1 ? '1 subscriber' : `${data.followers.toLocaleString('en-IN')} subscribers`,
    wallet: `Balance ${fmtRupee(celebrity.available_balance ?? 0)}`,
  };
  const anyBadge = data.ordersToDo + data.unreadMessages > 0;

  const open = (key: string) => { setActiveTab(key); setMenuOpen(false); };
  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to use WishMe.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)' as never); } },
    ]);
  };

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Top bar: menu, where you are, refresh */}
      <View style={[bar.wrap, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={bar.btn} accessibilityRole="button" accessibilityLabel="Open menu">
          <Icon name="menu" size={24} color={colors.foreground} />
          {anyBadge ? <View style={bar.dot} /> : null}
        </TouchableOpacity>
        <Text style={[bar.title, { color: colors.foreground }]} numberOfLines={1}>{section.key === 'overview' ? 'Dashboard' : section.label}</Text>
        <TouchableOpacity onPress={onRefresh} style={bar.btn} accessibilityRole="button" accessibilityLabel="Refresh">
          {refreshing ? <ActivityIndicator size="small" color="#D23FE0" /> : <Icon name="refresh-cw" size={20} color={colors.foreground} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D23FE0" colors={['#D23FE0']} />}
      >
        {section.key === 'overview' ? (
          <OverviewScreen celebrity={celebrity} colors={colors} data={data} onOpen={open} userFirstName={user?.firstName ?? ''} />
        ) : (
          <>
            <View style={bar.sectionHead}>
              <View style={[bar.sectionIcon, { backgroundColor: section.accent + '29' }]}>
                <Icon name={section.icon} size={20} color={section.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[bar.sectionTitle, { color: colors.foreground }]}>{section.label}</Text>
                <Text style={[bar.sectionPurpose, { color: colors.mutedForeground }]}>{section.purpose}</Text>
              </View>
            </View>
            <View style={{ paddingBottom: bottomPad + 24 }}>
              {activeTab === 'orders' && <OrdersTab celebrity={celebrity} colors={colors} session={session} />}
              {activeTab === 'wallet' && <WalletTab celebrity={celebrity} colors={colors} session={session} user={user} onRefreshCeleb={fetchCelebrity} />}
              {activeTab === 'messages' && <MessagesTab celebrity={celebrity} colors={colors} session={session} user={user} />}
              {activeTab === 'reviews' && <ReviewsTab celebrity={celebrity} colors={colors} session={session} />}
              {activeTab === 'followers' && <FollowersTab celebrity={celebrity} colors={colors} session={session} />}
              {activeTab === 'content' && <ContentTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
              {activeTab === 'tds' && <TdsTab celebrity={celebrity} colors={colors} session={session} />}
              {activeTab === 'profile' && <ProfileTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
            </View>
          </>
        )}
        {section.key === 'overview' ? <View style={{ height: bottomPad + 24 }} /> : null}
      </ScrollView>

      <DashboardDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        celebrity={celebrity}
        activeKey={activeTab}
        onSelect={open}
        badges={badges}
        descriptions={descriptions}
        onSwitchToUser={() => { setMenuOpen(false); router.replace('/(tabs)'); }}
        onSignOut={() => { setMenuOpen(false); confirmSignOut(); }}
      />
    </View></AmbientBackground>
  );
}

const bar = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: '#D23FE0' },
  title: { flex: 1, fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sectionPurpose: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 1 },
});
