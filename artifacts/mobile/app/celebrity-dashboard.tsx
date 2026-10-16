import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { supabaseFetch } from '@/constants/supabase';
import type { User } from '@/context/AuthContext';
import { fmtRupee, TABS, styles } from '@/components/celebrity-dashboard/shared';
import type { Celebrity } from '@/components/celebrity-dashboard/shared';
import { BookingsTab } from '@/components/celebrity-dashboard/BookingsTab';
import { WalletTab } from '@/components/celebrity-dashboard/WalletTab';
import { MessagesTab } from '@/components/celebrity-dashboard/MessagesTab';
import { EventsTab } from '@/components/celebrity-dashboard/EventsTab';
import { ConsentTab } from '@/components/celebrity-dashboard/ConsentTab';
import { ReviewsTab } from '@/components/celebrity-dashboard/ReviewsTab';
import { FollowersTab } from '@/components/celebrity-dashboard/FollowersTab';
import { ContentTab } from '@/components/celebrity-dashboard/ContentTab';
import { TdsTab } from '@/components/celebrity-dashboard/TdsTab';
import { ProfileTab } from '@/components/celebrity-dashboard/ProfileTab';

export default function CelebrityDashboardScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;

  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [notCeleb, setNotCeleb] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('bookings');
  const [stats, setStats] = useState({ totalEarnings: 0, pendingEarnings: 0, totalBookings: 0 });
  const [refreshing, setRefreshing] = useState(false);

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

      // Earnings come from the celebrity's own balance (every credited order moves it). The order count
      // covers bookings plus Wish a Friend, UGC and image promotion orders.
      const countOf = async (table: string): Promise<number> => {
        const r = await supabaseFetch(`/rest/v1/${table}?celebrity_id=eq.${celeb.id}&select=id&limit=1000`, {}, session.access_token);
        return r.ok ? ((await r.json()) as unknown[]).length : 0;
      };
      const bkRes = await supabaseFetch(
        `/rest/v1/bookings?celebrity_id=eq.${celeb.id}&select=status,celebrity_commission`,
        {},
        session.access_token,
      );
      const bks = bkRes.ok ? await bkRes.json() as Array<{ status: string; celebrity_commission: number }> : [];
      const [wf, ua, ip] = await Promise.all([countOf('wish_friend_orders'), countOf('ugc_ads'), countOf('image_promotions')]);
      const pendingEarnings = bks.filter(b => ['pending', 'in_progress', 'accepted'].includes(b.status)).reduce((s, b) => s + (b.celebrity_commission ?? 0), 0);
      setStats({
        totalEarnings: Number(celeb.total_earnings ?? 0),
        pendingEarnings,
        totalBookings: bks.length + wf + ua + ip,
      });
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

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
          style={styles.headerDashBtn}
        >
          <Icon name="home" size={14} color="#fff" />
          <Text style={styles.headerDashBtnText}>User Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B5CFA" />}
      >
        {celebrity.consent_status !== 'submitted' && celebrity.consent_status !== 'approved' && (
          <View style={styles.consentBanner}>
            <Icon name="alert-circle" size={16} color="#fff" />
            <Text style={styles.consentBannerText}>
              Your consent is pending. Please submit your consent documents to activate your profile.
            </Text>
          </View>
        )}
        <LinearGradient colors={['#7B5CFA', '#D23FE0', '#1F7BFF']} style={styles.heroBg}>
          <Text style={styles.heroName}>{celebrity.name}</Text>
          <Text style={styles.heroCategory}>{celebrity.category}</Text>
        </LinearGradient>
        <View style={[styles.statsGrid, { backgroundColor: colors.background }]}>
          {[
            { label: 'Total Earnings', value: fmtRupee(stats.totalEarnings), icon: 'trending-up' as IconName, color: '#22C55E' },
            { label: 'Pending', value: fmtRupee(stats.pendingEarnings), icon: 'clock' as IconName, color: '#F59E0B' },
            { label: 'Bookings', value: String(stats.totalBookings), icon: 'credit-card' as IconName, color: '#3B82F6' },
            { label: 'Rating', value: (celebrity.rating ?? 0).toFixed(1), icon: 'star' as IconName, color: '#EAB308' },
            { label: 'Reviews', value: String(celebrity.review_count ?? 0), icon: 'message-circle' as IconName, color: '#7B5CFA' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statCardIcon, { backgroundColor: s.color + '22' }]}>
                <Icon name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={[styles.statCardVal, { color: colors.foreground }]} numberOfLines={1}>{s.value}</Text>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.tabBarWrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, activeTab === tab.key && { borderBottomColor: '#7B5CFA', borderBottomWidth: 2 }]}
              >
                <Icon name={tab.icon} size={15} color={activeTab === tab.key ? '#7B5CFA' : colors.mutedForeground} />
                <Text style={[styles.tabLabel, { color: activeTab === tab.key ? '#7B5CFA' : colors.mutedForeground }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingBottom: bottomPad + 24 }}>
          {activeTab === 'bookings' && <BookingsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'wallet' && <WalletTab celebrity={celebrity} colors={colors} session={session} user={user} onRefreshCeleb={fetchCelebrity} />}
          {activeTab === 'messages' && <MessagesTab celebrity={celebrity} colors={colors} session={session} user={user} />}
          {activeTab === 'events' && <EventsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'consent' && <ConsentTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
          {activeTab === 'reviews' && <ReviewsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'followers' && <FollowersTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'content' && <ContentTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
          {activeTab === 'tds' && <TdsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'profile' && <ProfileTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
        </View>
      </ScrollView>

    </View></AmbientBackground>
  );
}
