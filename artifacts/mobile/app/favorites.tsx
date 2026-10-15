import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebGridCard } from '@/components/celebrity/CelebrityCards';
import { openCelebrityService, SERVICE_KEYS, SERVICES } from '@/components/celebrity/services';
import { Icon, type IconName } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrities, type Celebrity } from '@/hooks/useCelebrities';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { useLovedCelebrities } from '@/hooks/useLovedCelebrities';

const PAD = 16;
const GAP = 12;

type Tab = 'browse' | 'favorites';

function StateView({ icon, title, body, button, onPress }: { icon: IconName; title: string; body: string; button: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={s.state}>
      <Icon name={icon} size={44} color={colors.mutedForeground} />
      <Text style={[s.stateTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[s.stateBody, { color: colors.mutedForeground }]}>{body}</Text>
      <TouchableOpacity onPress={onPress} style={[s.stateBtn, { backgroundColor: colors.primary }]}>
        <Text style={s.stateBtnText}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Order buttons for a subscribed celebrity. Each opens the matching sidebar screen with them already chosen. */
function ServiceButtons({ celebrityId }: { celebrityId: string }) {
  const { colors } = useTheme();
  return (
    <View style={s.actions}>
      {SERVICE_KEYS.map(key => (
        <TouchableOpacity
          key={key}
          onPress={() => openCelebrityService(key, celebrityId)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={SERVICES[key].title}
          style={[s.actionBtn, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}
        >
          <Icon name={SERVICES[key].icon} size={12} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{SERVICES[key].compact}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;
  const { width } = useWindowDimensions();
  const cardW = (width - PAD * 2 - GAP) / 2;

  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState('');

  // Same list as Browse Celebrities: only celebrities a user can actually subscribe to.
  const { celebrities, loading, error, refetch } = useCelebrities({ limit: 50 });
  const { hasFavorite, refetch: refetchSubscriptions } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });
  const { lovedIds, ready: lovedReady } = useLovedCelebrities();

  useFocusEffect(
    useCallback(() => {
      if (user?.profileId && session?.access_token) refetchSubscriptions();
    }, [user?.profileId, session?.access_token, refetchSubscriptions]),
  );

  const refresh = useCallback(() => {
    void refetch();
    void refetchSubscriptions();
  }, [refetch, refetchSubscriptions]);

  const browseList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? celebrities.filter(c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)) : celebrities;
  }, [celebrities, search]);

  // My Favorites keeps only the celebrities marked with the heart on their profile.
  const lovedList = useMemo(() => celebrities.filter(c => lovedIds.has(c.id)), [celebrities, lovedIds]);

  const data = tab === 'browse' ? browseList : lovedList;
  const waiting = (loading && celebrities.length === 0) || (tab === 'favorites' && !lovedReady);

  const emptyState = () => {
    if (waiting) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
    if (error && celebrities.length === 0) {
      return <StateView icon="alert-circle" title="Couldn't load celebrities" body={error} button="Retry" onPress={refresh} />;
    }
    if (tab === 'favorites') {
      return user ? (
        <StateView
          icon="heart"
          title="No favorites yet"
          body="Open a celebrity's profile and tap the heart to keep them here."
          button="Browse celebrities"
          onPress={() => setTab('browse')}
        />
      ) : (
        <StateView
          icon="heart"
          title="Sign in to save favorites"
          body="Tap the heart on a celebrity's profile to keep them here."
          button="Sign in"
          onPress={() => router.push('/(auth)' as never)}
        />
      );
    }
    if (search.trim()) {
      return <StateView icon="search" title={`No results for "${search.trim()}"`} body="Try a different name or category." button="Clear search" onPress={() => setSearch('')} />;
    }
    return <StateView icon="star" title="No celebrities available yet" body="Verified stars open for subscription will show up here." button="Refresh" onPress={refresh} />;
  };

  const tabs: { key: Tab; label: string; icon: IconName }[] = [
    { key: 'browse', label: 'Browse', icon: 'search' },
    { key: 'favorites', label: `My Favorites (${lovedList.length})`, icon: 'heart' },
  ];

  const searchBar = tab === 'browse' ? (
    <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Icon name="search" size={16} color={colors.mutedForeground} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search celebrities..."
        placeholderTextColor={colors.mutedForeground}
        style={[s.searchInput, { color: colors.foreground }]}
        returnKeyType="search"
      />
      {search.length > 0 && (
        <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
          <Icon name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Celebrity Favorites</Text>
          <Text style={[s.headerSubtitle, { color: colors.mutedForeground }]}>Subscribe for lifetime access</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={[s.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {tabs.map(t => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={s.tabItem} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <View style={s.tabInner}>
                <Icon name={t.icon} size={15} color={on ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: on ? colors.primary : colors.mutedForeground, fontSize: 13, fontFamily: on ? 'Inter_700Bold' : 'Inter_500Medium' }}>{t.label}</Text>
              </View>
              {on && <View style={[s.tabUnderline, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={waiting ? [] : data}
        keyExtractor={c => c.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
        contentContainerStyle={{ gap: GAP, paddingTop: 12, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={searchBar}
        ListEmptyComponent={emptyState()}
        refreshControl={<RefreshControl refreshing={loading && celebrities.length > 0} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }: { item: Celebrity }) => {
          const subscribed = hasFavorite(item.id);
          return (
            <CelebGridCard celebrity={item} subscribed={subscribed} width={cardW}>
              {tab === 'favorites' && subscribed ? <ServiceButtons celebrityId={item.id} /> : null}
            </CelebGridCard>
          );
        }}
      />
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  headerSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabUnderline: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 2, borderRadius: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: PAD, marginBottom: GAP, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, height: 44, fontSize: 15, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 2 },
  state: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 10 },
  stateTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 6 },
  stateBody: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  stateBtn: { paddingHorizontal: 24, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  stateBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
