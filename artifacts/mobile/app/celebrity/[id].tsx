import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_REVIEWS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrities } from '@/hooks/useCelebrities';

export default function CelebrityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isFav, setIsFav] = useState(false);

  const { celebrities, loading } = useCelebrities({ limit: 50 });
  const celebrity = celebrities.find((c) => c.id === id);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[{ marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>Loading...</Text>
      </View>
    );
  }

  if (!celebrity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Icon name="user-x" size={48} color={colors.mutedForeground} />
        <Text style={[{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }]}>Celebrity not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary }]}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header image */}
        <View style={{ height: 300, position: 'relative' }}>
          <Image source={{ uri: celebrity.imageUrl + '?w=800' }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 20 }]}
          >
            <View style={styles.nameBadgeRow}>
              <View>
                <Text style={styles.name}>{celebrity.name}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.categoryText}>{celebrity.category}</Text>
                  </View>
                  {celebrity.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: '#22C55E' }]}>
                      <Icon name="check" size={10} color="#fff" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>
          {/* Back btn */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 12 }]}
          >
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Fav btn */}
          <TouchableOpacity
            onPress={() => setIsFav(!isFav)}
            style={[styles.favBtn, { top: insets.top + 12 }]}
          >
            <Icon name="heart" size={22} color={isFav ? '#EF4444' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          {/* Rating + reviews */}
          <View style={styles.ratingRow}>
            <Icon name="star" size={16} color="#FFB347" />
            <Text style={[styles.rating, { color: colors.foreground }]}>{celebrity.rating}</Text>
            <Text style={[styles.reviews, { color: colors.mutedForeground }]}>({celebrity.reviewCount.toLocaleString('en-IN')} reviews)</Text>
          </View>

          {/* Location + Delivery */}
          {(celebrity.location || celebrity.deliveryTime) && (
            <View style={[styles.metaRow, { backgroundColor: colors.backgroundSecondary }]}>
              {celebrity.location && (
                <View style={styles.metaItem}>
                  <Icon name="map-pin" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{celebrity.location}</Text>
                </View>
              )}
              {celebrity.deliveryTime && (
                <View style={styles.metaItem}>
                  <Icon name="clock" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{celebrity.deliveryTime}</Text>
                </View>
              )}
            </View>
          )}

          {/* Pricing */}
          <View style={[styles.priceRow, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Per Wish</Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>₹{celebrity.pricePerWish.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.priceDivider, { backgroundColor: colors.border }]} />
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Voice Call</Text>
              <Text style={[styles.priceValue, { color: colors.secondary }]}>₹{celebrity.ratePerMinute}/min</Text>
            </View>
          </View>

          {/* Bio */}
          <Text style={[styles.bioTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.bio, { color: colors.mutedForeground }]}>{celebrity.bio}</Text>

          {/* Tags */}
          {celebrity.tags.length > 0 && (
            <>
              <Text style={[styles.bioTitle, { color: colors.foreground }]}>What I can do for you</Text>
              <View style={styles.tagsWrap}>
                {celebrity.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Reviews */}
          <Text style={[styles.bioTitle, { color: colors.foreground }]}>Reviews</Text>
          {MOCK_REVIEWS.map((review) => (
            <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.reviewHeader}>
                <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.reviewAvatarText}>{review.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewName, { color: colors.foreground }]}>{review.userName}</Text>
                  <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{review.date}</Text>
                </View>
                <View style={styles.starRow}>
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Icon key={i} name="star" size={12} color="#FFB347" />
                  ))}
                </View>
              </View>
              <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.voiceCallBtn, { borderColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/voice-call')}
        >
          <Icon name="phone" size={18} color={colors.primary} />
          <Text style={[styles.voiceCallText, { color: colors.primary }]}>Voice Call</Text>
        </TouchableOpacity>
        <Pressable
          onPress={() => router.push({ pathname: '/booking/[id]', params: { id: celebrity.id } })}
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookBtn}>
            <Text style={styles.bookBtnText}>Book a Wish</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  favBtn: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  nameBadgeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  name: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  categoryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  verifiedText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  infoSection: { padding: 20 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  rating: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  reviews: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', gap: 16, borderRadius: 12, padding: 12, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  priceRow: { flexDirection: 'row', borderRadius: 14, padding: 16, marginBottom: 20 },
  priceItem: { flex: 1, alignItems: 'center' },
  priceDivider: { width: 1, marginHorizontal: 8 },
  priceLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  priceValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  bioTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 8, marginTop: 8 },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, marginBottom: 16 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  tagText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  reviewCard: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  reviewName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reviewDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  starRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  voiceCallBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, borderWidth: 2 },
  voiceCallText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bookBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
