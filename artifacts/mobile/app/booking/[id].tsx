import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const celebrity = CELEBRITIES.find((c) => c.id === id) ?? CELEBRITIES[0];
  const [rating, setRating] = useState(0);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Booking Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={[styles.statusCard, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}>
          <Icon name="check-circle" size={20} color="#22C55E" />
          <Text style={[styles.statusText, { color: '#22C55E' }]}>Booking Confirmed</Text>
        </View>

        {/* Celebrity info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Celebrity</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{celebrity.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Occasion</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>Birthday</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Recipient</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>Rahul Kumar</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Order Date</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>Dec 15, 2024</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Amount Paid</Text>
            <Text style={[styles.infoValue, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>₹{celebrity.pricePerWish.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Video player mock */}
        <View style={[styles.videoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.videoThumb}>
            <TouchableOpacity style={styles.playBtn}>
              <Icon name="play" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.videoLabel}>Your Wish Video</Text>
          </LinearGradient>
        </View>

        {/* Rating form */}
        <View style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.ratingTitle, { color: colors.foreground }]}>Rate your experience</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Icon name={rating >= s ? 'star' : 'star-outline'} size={36} color="#FFB347" />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Submit Review</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  statusText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  infoCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  videoCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  videoThumb: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  videoLabel: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  ratingCard: { borderRadius: 14, borderWidth: 1, padding: 18 },
  ratingTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 14 },
  starsRow: { flexDirection: 'row', gap: 8 },
  submitBtn: { height: 48, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
