import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { Celebrity } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

interface CelebCardProps {
  celebrity: Celebrity;
  width?: number;
  compact?: boolean;
}

export function CelebCard({ celebrity, width = 130, compact = false }: CelebCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/celebrity/[id]', params: { id: celebrity.id } })}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: celebrity.imageUrl }}
          style={[styles.image, { width: width - 0, height: compact ? 100 : 130 }]}
        />
        {celebrity.isVerified && (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
            <Icon name="check" size={8} color="#fff" />
          </View>
        )}
        {celebrity.isAvailable && (
          <View style={styles.availableDot} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{celebrity.name}</Text>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>{celebrity.category}</Text>
        <View style={styles.ratingRow}>
          <Icon name="star" size={10} color="#FFB347" />
          <Text style={[styles.rating, { color: colors.mutedForeground }]}>{celebrity.rating}</Text>
        </View>
        <Text style={[styles.price, { color: colors.primary }]}>₹{celebrity.pricePerWish.toLocaleString('en-IN')}</Text>
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
  info: { padding: 8 },
  name: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 1 },
  category: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 2 },
  rating: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  price: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});
