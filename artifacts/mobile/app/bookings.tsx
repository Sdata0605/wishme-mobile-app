import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SlideSidebar } from '@/components/SlideSidebar';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { BOOKING_TABS, s } from '@/components/bookings/shared';
import type { BookingTab, TabData } from '@/components/bookings/shared';
import { CelebCard } from '@/components/bookings/CelebCard';
import { WishFriendCard } from '@/components/bookings/WishFriendCard';
import { WishCard, CardCard, PhotoCard, CallCard } from '@/components/bookings/ServiceCards';
import { MusicCard, ImgMusicCard, TtsCard, SfxCard, ConvertCard, IsolateCard } from '@/components/bookings/AudioCards';
import { EmptyState, TAB_META, SIDEBAR_GROUPS, SkeletonCards, TAB_TO_TABLES, TABLE_TO_TAB } from '@/components/bookings/TabConfig';
import { useRealtimeBookings } from '@/components/bookings/useRealtimeBookings';

export default function BookingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user, getValidSession } = useAuth();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<BookingTab>(
    (BOOKING_TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as BookingTab) : 'Celebrity',
  );
  const [tabLoading, setTabLoading] = useState<Partial<Record<BookingTab, boolean>>>({});
  const [fetchError, setFetchError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Partial<Record<BookingTab, boolean>>>({});
  const [data, setData] = useState<TabData>({
    celeb: [], wishFriend: [], wishes: [], cards: [], photo: [],
    calls: [], music: [], imgMusic: [], tts: [],
    sfx: [], convert: [], isolate: [],
  });
  const loadedTabsRef = useRef<Set<BookingTab>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeToken, setRealtimeToken] = useState<string | null>(null);

  useEffect(() => {
    getValidSession().then(s => setRealtimeToken(s?.access_token ?? null));
  }, [getValidSession]);

  const fetchTab = useCallback(async (tab: BookingTab, force = false) => {
    if (!user?.profileId) return;
    if (!force && loadedTabsRef.current.has(tab)) return;

    const validSession = await getValidSession();
    if (!validSession?.access_token) return;

    const pid = user.profileId;
    const tok = validSession.access_token;
    setTabLoading(prev => ({ ...prev, [tab]: true }));

    const configs = TAB_TO_TABLES[tab];
    try {
      for (const cfg of configs) {
        const res = await supabaseFetch(
          `/rest/v1/${cfg.table}?select=${encodeURIComponent(cfg.select)}&user_id=eq.${pid}&order=created_at.desc&limit=20`,
          {},
          tok,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        setData(prev => ({ ...prev, [cfg.dataKey]: rows }));
      }
      loadedTabsRef.current.add(tab);
      setLoadedTabs(prev => ({ ...prev, [tab]: true }));
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [user?.profileId, getValidSession]);

  const handleRefreshButton = useCallback(async () => {
    setRefreshing(true);
    loadedTabsRef.current.delete(activeTab);
    await fetchTab(activeTab, true);
    setRefreshing(false);
  }, [activeTab, fetchTab]);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  const handleRealtimeUpdate = useCallback((table: string) => {
    const tab = TABLE_TO_TAB[table];
    if (tab) {
      loadedTabsRef.current.delete(tab);
      if (tab === activeTab) {
        fetchTab(tab, true);
      }
    }
  }, [activeTab, fetchTab]);

  useRealtimeBookings(
    user?.profileId ?? null,
    realtimeToken,
    handleRealtimeUpdate,
  );

  function renderTabItems(tab: BookingTab) {
    if (!loadedTabs[tab] && !fetchError) {
      return <SkeletonCards colors={colors} />;
    }
    const showEmpty = !fetchError;
    switch (tab) {
      case 'Celebrity':
        return data.celeb.length === 0 ? (showEmpty ? <EmptyState tab="Celebrity" colors={colors} /> : null) :
          data.celeb.map(item => <CelebCard key={item.id} item={item} colors={colors} accessToken={realtimeToken} />);
      case 'Wish a Friend':
        return data.wishFriend.length === 0 ? (showEmpty ? <EmptyState tab="Wish a Friend" colors={colors} /> : null) :
          data.wishFriend.map(item => <WishFriendCard key={item.id} item={item} colors={colors} accessToken={realtimeToken} />);
      case 'Wishes':
        return data.wishes.length === 0 ? (showEmpty ? <EmptyState tab="Wishes" colors={colors} /> : null) :
          data.wishes.map(item => <WishCard key={item.id} item={item} colors={colors} />);
      case 'Cards':
        return data.cards.length === 0 ? (showEmpty ? <EmptyState tab="Cards" colors={colors} /> : null) :
          data.cards.map(item => <CardCard key={item.id} item={item} colors={colors} />);
      case 'Photo':
        return data.photo.length === 0 ? (showEmpty ? <EmptyState tab="Photo" colors={colors} /> : null) :
          data.photo.map(item => <PhotoCard key={item.id} item={item} colors={colors} />);
      case 'Calls':
        return data.calls.length === 0 ? (showEmpty ? <EmptyState tab="Calls" colors={colors} /> : null) :
          data.calls.map(item => <CallCard key={item.id} item={item} colors={colors} />);
      case 'Music':
        return data.music.length === 0 ? (showEmpty ? <EmptyState tab="Music" colors={colors} /> : null) :
          data.music.map(item => <MusicCard key={item.id} item={item} colors={colors} />);
      case 'Img+Music':
        return data.imgMusic.length === 0 ? (showEmpty ? <EmptyState tab="Img+Music" colors={colors} /> : null) :
          data.imgMusic.map(item => <ImgMusicCard key={item.id} item={item} colors={colors} />);
      case 'TTS':
        return data.tts.length === 0 ? (showEmpty ? <EmptyState tab="TTS" colors={colors} /> : null) :
          data.tts.map(item => <TtsCard key={item.id} item={item} colors={colors} />);
      case 'SFX':
        return data.sfx.length === 0 ? (showEmpty ? <EmptyState tab="SFX" colors={colors} /> : null) :
          data.sfx.map(item => <SfxCard key={item.id} item={item} colors={colors} />);
      case 'Convert':
        return data.convert.length === 0 ? (showEmpty ? <EmptyState tab="Convert" colors={colors} /> : null) :
          data.convert.map(item => <ConvertCard key={item.id} item={item} colors={colors} />);
      case 'Isolate':
        return data.isolate.length === 0 ? (showEmpty ? <EmptyState tab="Isolate" colors={colors} /> : null) :
          data.isolate.map(item => <IsolateCard key={item.id} item={item} colors={colors} />);
    }
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSidebarOpen(true)}
            hitSlop={8}
            accessibilityLabel="Open menu"
            style={[s.menuBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Icon name="menu" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>My Bookings</Text>
        <TouchableOpacity onPress={handleRefreshButton} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#7B5CFA" />
          ) : (
            <Icon name="refresh-cw" size={18} color={colors.foreground} />
          )}
        </TouchableOpacity>
      </View>

      <View style={s.body}>
      <View style={{ flex: 1 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSidebarOpen(true)}
        style={[s.sectionBar, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={s.sectionBarIcon}>
          <Icon name={TAB_META[activeTab].icon} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionBarTitle, { color: colors.foreground }]} numberOfLines={1}>{TAB_META[activeTab].title}</Text>
          <Text style={[s.sectionBarHint, { color: colors.mutedForeground }]}>Tap to switch section</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {fetchError && (
        <TouchableOpacity
          style={s.errorBanner}
          onPress={() => {
            loadedTabsRef.current.delete(activeTab);
            fetchTab(activeTab, true);
          }}
          activeOpacity={0.8}
        >
          <Icon name="alert-circle" size={16} color="#fff" />
          <Text style={s.errorBannerText}>Couldn't load bookings — tap to retry</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderTabItems(activeTab)}
      </ScrollView>
      </View>
      </View>

      <SlideSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="My Bookings"
        subtitle="Choose what to view"
        activeKey={activeTab}
        onSelect={key => { setActiveTab(key as BookingTab); setSidebarOpen(false); }}
        groups={SIDEBAR_GROUPS.map(g => ({
          title: g.title,
          items: g.tabs.map(tab => ({
            key: tab,
            label: TAB_META[tab].label,
            description: TAB_META[tab].description,
            icon: TAB_META[tab].icon,
            count: loadedTabs[tab] ? data[TAB_TO_TABLES[tab][0].dataKey].length : null,
          })),
        }))}
        footer={[
          { label: 'Library', icon: 'layers', onPress: () => { setSidebarOpen(false); router.push('/library' as never); } },
          { label: 'Wish a Friend', icon: 'heart', onPress: () => { setSidebarOpen(false); router.push('/wish-friend' as never); } },
        ]}
      />
    </View></AmbientBackground>
  );
}
