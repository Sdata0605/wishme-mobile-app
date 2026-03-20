import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const SUBSCRIBED_IDS = new Set(['1', '2', '3']);

export default function WishCelebrityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filtered = CELEBRITIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const pairs: (typeof CELEBRITIES[0] | null)[][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    pairs.push([filtered[i] ?? null, filtered[i + 1] ?? null]);
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Celebrity</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Icon name="star" size={28} color="#fff" />
          <Text style={s.heroTitle}>Wish Your Favorite Celebrity</Text>
          <Text style={s.heroSub}>Send a heartfelt message to your favourite star</Text>
        </LinearGradient>

        {/* Search */}
        <View style={[s.searchWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Search celebrities..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Grid */}
        <View style={s.grid}>
          {pairs.map((pair, ri) => (
            <View key={ri} style={s.gridRow}>
              {pair.map((celeb, ci) => {
                if (!celeb) return <View key={ci} style={s.gridCell} />;
                const subscribed = SUBSCRIBED_IDS.has(celeb.id);
                return (
                  <View key={celeb.id} style={[s.gridCell, s.celebCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.imgWrap}>
                      <Image source={{ uri: celeb.imageUrl }} style={s.celebImg} contentFit="cover" />
                      {!subscribed && (
                        <View style={s.lockOverlay}>
                          <Icon name="lock" size={22} color="#fff" />
                        </View>
                      )}
                      {celeb.isVerified && (
                        <View style={s.verifiedBadge}>
                          <Icon name="check" size={10} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text style={[s.celebName, { color: colors.foreground }]} numberOfLines={1}>{celeb.name}</Text>
                    <Text style={[s.celebCat, { color: colors.mutedForeground }]} numberOfLines={1}>{celeb.category}</Text>
                    <View style={s.starsRow}>
                      <Icon name="star" size={12} color="#F59E0B" />
                      <Text style={[s.rating, { color: colors.mutedForeground }]}>{celeb.rating}</Text>
                    </View>
                    {subscribed ? (
                      <TouchableOpacity
                        style={s.sendWishBtn}
                        onPress={() => router.push({ pathname: '/wish-booking', params: { id: celeb.id } } as never)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sendWishGrad}>
                          <Text style={s.sendWishText}>Send Wish</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[s.subscribeBtn, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={() => showToast(`Subscribe to ${celeb.name} to send wishes`)}>
                        <Icon name="lock" size={12} color={colors.mutedForeground} />
                        <Text style={[s.subscribeBtnText, { color: colors.mutedForeground }]}>Subscribe First</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Toast */}
      {toast.length > 0 && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  hero: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  heroTitle: { color: '#fff', fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 46, margin: 16 },
  searchInput: { flex: 1, fontSize: 14, height: 46 },
  grid: { paddingHorizontal: 12, gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  gridCell: { flex: 1 },
  celebCard: { borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 6 },
  imgWrap: { position: 'relative', width: 96, height: 96, borderRadius: 48, overflow: 'hidden' },
  celebImg: { width: 96, height: 96, borderRadius: 48 },
  lockOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#4B83FF', alignItems: 'center', justifyContent: 'center' },
  celebName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  celebCat: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  sendWishBtn: { width: '100%', borderRadius: 9999, overflow: 'hidden', marginTop: 4 },
  sendWishGrad: { paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  sendWishText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', borderRadius: 9999, borderWidth: 1, paddingVertical: 8, marginTop: 4 },
  subscribeBtnText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  toast: { position: 'absolute', bottom: 90, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
