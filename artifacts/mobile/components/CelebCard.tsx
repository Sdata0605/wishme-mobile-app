import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { Celebrity } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

interface CelebCardProps {
  celebrity: Celebrity;
  width?: number;
  compact?: boolean;
  isSubscribed?: boolean;
  isLoggedIn?: boolean;
}

export function CelebCard({
  celebrity,
  width = 130,
  compact = false,
  isSubscribed,
  isLoggedIn,
}: CelebCardProps) {
  const { colors } = useTheme();
  const showLock = isLoggedIn === true && isSubscribed === false;

  const handlePress = () => {
    router.push({ pathname: '/celebrity/[id]', params: { id: celebrity.id } });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: celebrity.imageUrl }}
          style={[styles.image, { width: width - 0, height: compact ? 100 : 130 }]}
          blurRadius={showLock ? 12 : 0}
        />
        {celebrity.isVerified && !showLock && (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
            <Icon name="check" size={8} color="#fff" />
          </View>
        )}
        {celebrity.isAvailable && !showLock && (
          <View style={styles.availableDot} />
        )}
        {showLock && (
          <View style={styles.lockOverlay}>
            <View style={styles.lockCircle}>
              <Icon name="lock" size={24} color="#FF6B33" />
            </View>
            <Text style={styles.lockText}>Subscription{'\n'}Required</Text>
            <TouchableOpacity onPress={handlePress} style={styles.unlockPill}>
              <Text style={styles.unlockPillText}>Unlock Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{celebrity.name}</Text>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>{celebrity.category}</Text>
        <View style={styles.ratingRow}>
          <Icon name="star" size={10} color="#FFB347" />
          <Text style={[styles.rating, { color: colors.mutedForeground }]}>{celebrity.rating}</Text>
        </View>
        {!!celebrity.subscription?.price && (
          <Text style={[styles.price, { color: colors.primary }]}>₹{celebrity.subscription.price.toLocaleString('en-IN')}/mo</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: { position: 'relative' },
  image: { resizeMode: 'cover' },
  verifiedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  availableDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 15,
  },
  unlockPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    marginTop: 2,
  },
  unlockPillText: {
    color: '#FF6B33',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  info: { padding: 8 },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 1 },
  category: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 2 },
  rating: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  price: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});
