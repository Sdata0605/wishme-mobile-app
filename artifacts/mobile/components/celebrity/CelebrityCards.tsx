import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import type { Celebrity } from '@/hooks/useCelebrities';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function open(id: string) {
  router.push({ pathname: '/celebrity/[id]', params: { id } });
}

/** Spring down a little while pressed. */
function Press({ onPress, label, style, children }: { onPress: () => void; label: string; style?: object; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, speed: 40, bounciness: 0, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** "4.8 (23)" when there are real reviews, otherwise "New". Seeded numbers are never shown. */
function RatingChip({ celebrity }: { celebrity: Celebrity }) {
  const { colors } = useTheme();
  const hasReviews = celebrity.reviewCount > 0 && celebrity.rating > 0;
  return hasReviews ? (
    <View style={s.ratingChip}>
      <Icon name="star" size={11} color="#FFB347" />
      <Text style={s.ratingText}>{celebrity.rating.toFixed(1)} ({celebrity.reviewCount})</Text>
    </View>
  ) : (
    <View style={[s.ratingChip, { backgroundColor: colors.primary + '33' }]}>
      <Text style={[s.ratingText, { color: '#fff' }]}>New</Text>
    </View>
  );
}

function describe(c: Celebrity, subscribed: boolean): string {
  const rating = c.reviewCount > 0 && c.rating > 0 ? `rated ${c.rating.toFixed(1)} from ${c.reviewCount} reviews` : 'new, no reviews yet';
  const price = c.subscription?.price ? `${c.subscription.price} rupees one-time` : '';
  return `${c.name}, ${c.category}, ${rating}, ${price}, ${subscribed ? 'subscribed' : 'not subscribed'}`;
}

export function CelebHeroCard({ celebrity, subscribed }: { celebrity: Celebrity; subscribed: boolean }) {
  const price = celebrity.subscription?.price ?? 0;
  return (
    <Press onPress={() => open(celebrity.id)} label={describe(celebrity, subscribed)} style={s.hero}>
      <Image source={{ uri: celebrity.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} recyclingKey={celebrity.id} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} style={s.heroScrim} />
      <View style={s.heroTop}><RatingChip celebrity={celebrity} /></View>
      <View style={s.heroBottom}>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.heroName} numberOfLines={1}>{celebrity.name}</Text>
            {celebrity.isVerified && <Icon name="check-circle" size={16} color="#3B5BDB" />}
          </View>
          <Text style={s.heroSub} numberOfLines={1}>{[celebrity.category, celebrity.location].filter(Boolean).join(' · ')}</Text>
        </View>
        {subscribed ? (
          <View style={s.heroSubscribed}>
            <Icon name="check-circle" size={14} color="#fff" />
            <Text style={s.heroPillText}>Subscribed</Text>
          </View>
        ) : (
          <LinearGradient colors={['#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroPill}>
            <Text style={s.heroPillText}>Subscribe · {inr(price)}</Text>
          </LinearGradient>
        )}
      </View>
    </Press>
  );
}

export function CelebGridCard({ celebrity, subscribed, width, children }: { celebrity: Celebrity; subscribed: boolean; width: number; /** Extra row under the footer, e.g. service buttons. */ children?: React.ReactNode }) {
  const { colors } = useTheme();
  const price = celebrity.subscription?.price ?? 0;
  const photoH = Math.round((width * 4) / 3);
  return (
    <Press
      onPress={() => open(celebrity.id)}
      label={describe(celebrity, subscribed)}
      style={[s.card, { width, backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={{ height: photoH }}>
        <Image source={{ uri: celebrity.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} recyclingKey={celebrity.id} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} style={s.cardScrim} />
        <View style={s.cardTop}><RatingChip celebrity={celebrity} /></View>
        <View style={s.cardText}>
          <View style={s.nameRow}>
            <Text style={s.cardName} numberOfLines={1}>{celebrity.name}</Text>
            {celebrity.isVerified && <Icon name="check-circle" size={13} color="#3B5BDB" />}
          </View>
          <Text style={s.cardCategory} numberOfLines={1}>{celebrity.category}</Text>
        </View>
      </View>
      <View style={s.footer}>
        {subscribed ? (
          <View style={s.footRow}>
            <Icon name="check-circle" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold' }}>Subscribed</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_700Bold' }} numberOfLines={1}>{inr(price)} <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>one-time</Text></Text>
            {celebrity.deliveryTime ? (
              <View style={s.footRow}>
                <Icon name="clock" size={11} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>{celebrity.deliveryTime.replace(/ hours?/i, 'h')}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>
      {children}
    </Press>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 20, overflow: 'hidden', aspectRatio: 16 / 10, backgroundColor: '#1f2937' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  heroTop: { position: 'absolute', top: 12, left: 12 },
  heroBottom: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroName: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  heroPill: { paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroSubscribed: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroPillText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  cardTop: { position: 'absolute', top: 8, left: 8 },
  cardText: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  cardName: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  cardCategory: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  footer: { height: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  ratingText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
