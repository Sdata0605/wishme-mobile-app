import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const PENDING = [
  { id: '1', from: 'Rahul Sharma', occasion: 'Birthday', message: 'Please wish my sister Priya on her 25th birthday...', price: 2499 },
  { id: '2', from: 'Anita Menon', occasion: 'Anniversary', message: 'My parents\' 30th wedding anniversary is next week...', price: 2499 },
];

export default function CelebrityDashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} style={styles.topCard}>
          <Text style={styles.welcome}>Welcome, {user?.firstName}</Text>
          <View style={styles.statsRow}>
            {[
              { label: 'Completed', value: '47' },
              { label: 'Pending', value: '3' },
              { label: 'Earned', value: '₹1.2L' },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statVal}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pending Requests ({PENDING.length})</Text>
          {PENDING.map((req) => (
            <View key={req.id} style={[styles.reqCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.reqHeader}>
                <View style={[styles.reqAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.reqAvatarText}>{req.from[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reqFrom, { color: colors.foreground }]}>{req.from}</Text>
                  <Text style={[styles.reqOccasion, { color: colors.primary }]}>{req.occasion}</Text>
                </View>
                <Text style={[styles.reqPrice, { color: colors.primary }]}>₹{req.price.toLocaleString('en-IN')}</Text>
              </View>
              <Text style={[styles.reqMessage, { color: colors.mutedForeground }]} numberOfLines={2}>{req.message}</Text>
              <View style={styles.reqActions}>
                <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}>
                  <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Accept & Record</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.declineBtn, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
                  <Text style={{ color: '#EF4444', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  topCard: { padding: 24 },
  welcome: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 20 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  reqCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  reqHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reqAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reqAvatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  reqFrom: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  reqOccasion: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  reqPrice: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  reqMessage: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 12 },
  reqActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, padding: 10, borderRadius: 9999, borderWidth: 1.5, alignItems: 'center' },
  declineBtn: { flex: 1, padding: 10, borderRadius: 9999, borderWidth: 1.5, alignItems: 'center' },
});
