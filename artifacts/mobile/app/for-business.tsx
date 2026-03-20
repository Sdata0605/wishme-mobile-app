import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const SERVICES: { id: string; icon: IconName; title: string; desc: string; price: string }[] = [
  { id: '1', icon: 'video', title: 'Corporate Wishes', desc: 'Personalized videos for employees & clients', price: '₹4,999+' },
  { id: '2', icon: 'star', title: 'Brand Endorsements', desc: 'Celebrity-driven campaigns', price: '₹24,999+' },
  { id: '3', icon: 'trending-up', title: 'Product Launch', desc: 'Hype your launch with celebrity power', price: '₹14,999+' },
  { id: '4', icon: 'zap', title: 'UGC Videos', desc: 'Authentic user-generated content', price: '₹9,999+' },
];

export default function ForBusinessScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>For Business</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <LinearGradient colors={['#4B83FF', '#7B2FFF']} style={styles.heroCard}>
            <Text style={styles.heroTitle}>Elevate Your Business</Text>
            <Text style={styles.heroSub}>Partner with celebrities to grow your brand</Text>
          </LinearGradient>

          <View style={{ padding: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Our Services</Text>
            {SERVICES.map((s) => (
              <View key={s.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.serviceIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Icon name={s.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{s.title}</Text>
                  <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
                </View>
                <Text style={[styles.servicePrice, { color: colors.primary }]}>{s.price}</Text>
              </View>
            ))}

            {!submitted ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Get a Quote</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Icon name="user" size={18} color={colors.mutedForeground} />
                  <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Your Name" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
                </View>
                <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Icon name="briefcase" size={18} color={colors.mutedForeground} />
                  <TextInput style={[styles.input, { color: colors.foreground }]} placeholder="Company Name" placeholderTextColor={colors.mutedForeground} value={company} onChangeText={setCompany} />
                </View>
                <Pressable onPress={() => setSubmitted(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                    <Text style={styles.submitBtnText}>Request a Callback</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <View style={[styles.successCard, { backgroundColor: '#22C55E20' }]}>
                <Icon name="check-circle" size={28} color="#22C55E" />
                <Text style={[styles.successText, { color: '#22C55E' }]}>Request Submitted! Our team will contact you within 24 hours.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  heroCard: { padding: 28, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 8 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 14, marginTop: 4 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  serviceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  serviceDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  servicePrice: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 14 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  submitBtn: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  successCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12 },
  successText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 21 },
});
