import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const BOOKING_TABS = [
  'Video Bookings',
  'Greeting Cards',
  'Music',
  'Image+Music',
  'Occasions',
  'Wishes',
  'Photo Wishes',
  'Calls',
  'Text-to-Speech',
  'Sound Effects',
  'Voice Conversion',
  'Audio Isolation',
] as const;
type BookingTab = (typeof BOOKING_TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Cancelled: '#EF4444',
  Processing: '#3B82F6',
  Ready: '#8B5CF6',
};

interface BookingItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  status: string;
  price: number;
  image: string;
  isAudio?: boolean;
}

const MOCK_BY_TAB: Record<BookingTab, BookingItem[]> = {
  'Video Bookings': [
    { id: 'v1', title: 'Ranveer Singh', subtitle: 'Birthday wish for Rahul', date: '2024-12-15', status: 'Completed', price: 2499, image: 'https://picsum.photos/seed/ranveer/300/300' },
    { id: 'v2', title: 'Shreya Ghoshal', subtitle: 'Anniversary message for Priya', date: '2025-01-10', status: 'Pending', price: 1999, image: 'https://picsum.photos/seed/shreya/300/300' },
    { id: 'v3', title: 'Kapil Sharma', subtitle: 'Birthday roast for Amit', date: '2024-11-20', status: 'Cancelled', price: 1499, image: 'https://picsum.photos/seed/kapil/300/300' },
    { id: 'v4', title: 'Alia Bhatt', subtitle: 'Graduation wish for Sneha', date: '2025-02-05', status: 'Processing', price: 3499, image: 'https://picsum.photos/seed/alia/300/300' },
  ],
  'Greeting Cards': [
    { id: 'gc1', title: 'Birthday E-Card', subtitle: 'For Meera — Floral theme', date: '2025-01-12', status: 'Completed', price: 299, image: 'https://picsum.photos/seed/card1/300/300' },
    { id: 'gc2', title: 'Anniversary Card', subtitle: 'For Parents — Gold theme', date: '2025-01-20', status: 'Pending', price: 349, image: 'https://picsum.photos/seed/card2/300/300' },
    { id: 'gc3', title: 'Festival E-Card', subtitle: 'Diwali wishes — Festive theme', date: '2024-10-30', status: 'Completed', price: 199, image: 'https://picsum.photos/seed/card3/300/300' },
  ],
  'Music': [
    { id: 'mu1', title: 'AI Birthday Song', subtitle: 'Happy Birthday Ravi — Pop style', date: '2025-01-05', status: 'Ready', price: 799, image: 'https://picsum.photos/seed/music1/300/300', isAudio: true },
    { id: 'mu2', title: 'Romantic Song', subtitle: 'Anniversary special — Classical', date: '2024-12-22', status: 'Completed', price: 999, image: 'https://picsum.photos/seed/music2/300/300', isAudio: true },
    { id: 'mu3', title: 'Custom Jingle', subtitle: 'Corporate event — Upbeat style', date: '2025-02-01', status: 'Processing', price: 1499, image: 'https://picsum.photos/seed/music3/300/300', isAudio: true },
  ],
  'Image+Music': [
    { id: 'im1', title: 'Birthday Slideshow', subtitle: '12 photos + custom BGM', date: '2025-01-18', status: 'Completed', price: 1299, image: 'https://picsum.photos/seed/imgmusic1/300/300' },
    { id: 'im2', title: 'Anniversary Reel', subtitle: '20 photos + romantic song', date: '2024-12-28', status: 'Pending', price: 1599, image: 'https://picsum.photos/seed/imgmusic2/300/300' },
  ],
  'Occasions': [
    { id: 'oc1', title: "Rahul's Birthday", subtitle: '15 Mar 2025 — 5 days left', date: '2025-03-15', status: 'Pending', price: 0, image: 'https://picsum.photos/seed/occ1/300/300' },
    { id: 'oc2', title: "Parents' Anniversary", subtitle: '20 Apr 2025 — 40 days left', date: '2025-04-20', status: 'Pending', price: 0, image: 'https://picsum.photos/seed/occ2/300/300' },
    { id: 'oc3', title: "Priya's Birthday", subtitle: '22 Jul 2025 — 125 days left', date: '2025-07-22', status: 'Completed', price: 0, image: 'https://picsum.photos/seed/occ3/300/300' },
  ],
  'Wishes': [
    { id: 'wi1', title: 'Virat Kohli', subtitle: 'Motivation wish for Cricket Club', date: '2024-10-05', status: 'Completed', price: 4999, image: 'https://picsum.photos/seed/virat/300/300' },
    { id: 'wi2', title: 'Nora Fatehi', subtitle: 'Dance class inauguration wish', date: '2025-01-25', status: 'Pending', price: 1799, image: 'https://picsum.photos/seed/nora/300/300' },
  ],
  'Photo Wishes': [
    { id: 'pw1', title: 'Birthday Photo Wish', subtitle: 'Celebrity photo with Rahul', date: '2025-01-08', status: 'Completed', price: 599, image: 'https://picsum.photos/seed/photo1/300/300' },
    { id: 'pw2', title: 'Anniversary Photo', subtitle: 'Couple photo wish for Parents', date: '2025-02-10', status: 'Processing', price: 699, image: 'https://picsum.photos/seed/photo2/300/300' },
  ],
  'Calls': [
    { id: 'ca1', title: 'Kapil Sharma', subtitle: 'Live voice call — 5 min', date: '2024-12-01', status: 'Completed', price: 1499, image: 'https://picsum.photos/seed/kapil/300/300' },
    { id: 'ca2', title: 'Shreya Ghoshal', subtitle: 'Live voice call — 10 min', date: '2025-01-30', status: 'Pending', price: 3990, image: 'https://picsum.photos/seed/shreya/300/300' },
  ],
  'Text-to-Speech': [
    { id: 'tts1', title: 'Corporate Announcement', subtitle: 'Ranveer Singh voice — 2 min', date: '2025-01-14', status: 'Ready', price: 899, image: 'https://picsum.photos/seed/tts1/300/300', isAudio: true },
    { id: 'tts2', title: 'Birthday Poem', subtitle: 'Shreya Ghoshal voice — 1 min', date: '2025-02-02', status: 'Processing', price: 649, image: 'https://picsum.photos/seed/tts2/300/300', isAudio: true },
  ],
  'Sound Effects': [
    { id: 'se1', title: 'Crowd Cheer Pack', subtitle: '5 custom crowd sounds', date: '2024-11-15', status: 'Completed', price: 499, image: 'https://picsum.photos/seed/sfx1/300/300', isAudio: true },
    { id: 'se2', title: 'Festival Sound Pack', subtitle: 'Diwali & Holi effects', date: '2024-10-20', status: 'Completed', price: 399, image: 'https://picsum.photos/seed/sfx2/300/300', isAudio: true },
  ],
  'Voice Conversion': [
    { id: 'vc1', title: 'Celebrity Voice Clone', subtitle: 'Kapil Sharma style — 3 clips', date: '2025-01-22', status: 'Ready', price: 1199, image: 'https://picsum.photos/seed/voice1/300/300', isAudio: true },
    { id: 'vc2', title: 'Birthday Message', subtitle: 'Ranveer Singh tone — 1 clip', date: '2025-02-08', status: 'Processing', price: 799, image: 'https://picsum.photos/seed/voice2/300/300', isAudio: true },
  ],
  'Audio Isolation': [
    { id: 'ai1', title: 'Vocal Isolation', subtitle: 'Background removed — Song 1', date: '2025-01-17', status: 'Completed', price: 349, image: 'https://picsum.photos/seed/audio1/300/300', isAudio: true },
    { id: 'ai2', title: 'Instrument Track', subtitle: 'Vocals removed — Song 2', date: '2025-02-03', status: 'Pending', price: 349, image: 'https://picsum.photos/seed/audio2/300/300', isAudio: true },
  ],
};

function AudioPlayer({ colors }: { colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'] }) {
  const [playing, setPlaying] = useState(false);
  return (
    <View style={[styles.audioPlayer, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => setPlaying((p) => !p)} style={[styles.playBtn, { backgroundColor: '#FF6B33' }]}>
        <Icon name={playing ? 'pause' : 'play'} size={14} color="#fff" />
      </TouchableOpacity>
      <View style={styles.audioBar}>
        <View style={[styles.audioProgress, { backgroundColor: '#FF6B33' }]} />
      </View>
      <Text style={[styles.audioDuration, { color: colors.mutedForeground }]}>0:42</Text>
    </View>
  );
}

function BookingCard({ item, colors }: { item: BookingItem; colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'] }) {
  const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Image source={{ uri: item.image }} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.subtitle}</Text>
        <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{item.date}</Text>
        {item.price > 0 && (
          <Text style={[styles.cardPrice, { color: '#FF6B33' }]}>₹{item.price.toLocaleString('en-IN')}</Text>
        )}
        {item.isAudio ? (
          <AudioPlayer colors={colors} />
        ) : (
          <View style={styles.actionRow}>
            {item.status === 'Completed' && (
              <TouchableOpacity style={[styles.actionBtn, { borderColor: '#22C55E' }]}>
                <Icon name="download" size={13} color="#22C55E" />
                <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Download</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })}
              style={[styles.actionBtn, { borderColor: '#FF6B33' }]}
            >
              <Icon name="eye" size={13} color="#FF6B33" />
              <Text style={[styles.actionBtnText, { color: '#FF6B33' }]}>View</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [activeTab, setActiveTab] = useState<BookingTab>('Video Bookings');
  const tabScrollRef = useRef<ScrollView>(null);

  const items = MOCK_BY_TAB[activeTab];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Bookings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {BOOKING_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabPill, active && { backgroundColor: '#FF6B33' }]}
            >
              <Text style={[styles.tabPillText, { color: active ? '#fff' : colors.mutedForeground },
                active && styles.tabPillTextActive]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="calendar" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookings yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Your {activeTab.toLowerCase()} will appear here
            </Text>
          </View>
        ) : (
          items.map((item) => <BookingCard key={item.id} item={item} colors={colors} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: { borderBottomWidth: 1, maxHeight: 56 },
  tabBarContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8, paddingVertical: 10 },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999,
    backgroundColor: 'transparent',
  },
  tabPillText: { fontSize: 13, fontFamily: 'Inter_500Medium', whiteSpace: 'nowrap' } as never,
  tabPillTextActive: { fontFamily: 'Inter_700Bold' },
  listContent: { padding: 16, gap: 14 },
  card: {
    flexDirection: 'row', gap: 14, borderRadius: 16, padding: 14,
    borderWidth: 1, alignItems: 'flex-start',
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  cardPrice: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1.5 },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 9999, padding: 8, borderWidth: 1, marginTop: 4 },
  playBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  audioBar: { flex: 1, height: 3, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' },
  audioProgress: { width: '35%', height: '100%' },
  audioDuration: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
