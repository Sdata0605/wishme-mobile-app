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
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const OCCASIONS = ['Birthday', 'Anniversary', 'Graduation', 'Wedding', 'Motivation', 'Business'];

export default function WishCelebrityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedCeleb, setSelectedCeleb] = useState('');
  const [occasion, setOccasion] = useState('Birthday');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={[styles.successCircle, { backgroundColor: '#22C55E20' }]}>
          <Icon name="check-circle" size={64} color="#22C55E" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>Wish Request Sent!</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>Your celebrity will respond within 7 days. We'll notify you when it's ready!</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} style={{ marginTop: 24 }}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.homeBtn}>
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wish a Celebrity</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.foreground }]}>Select Celebrity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 20 }}>
            {CELEBRITIES.slice(0, 6).map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setSelectedCeleb(c.id)}
                style={[styles.celebChip, {
                  backgroundColor: selectedCeleb === c.id ? colors.primary : colors.muted,
                  borderColor: selectedCeleb === c.id ? colors.primary : colors.border,
                }]}
              >
                <Text style={[styles.celebChipText, { color: selectedCeleb === c.id ? '#fff' : colors.foreground }]}>{c.name}</Text>
                <Text style={[styles.celebChipPrice, { color: selectedCeleb === c.id ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>₹{c.pricePerWish}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.foreground }]}>Occasion</Text>
          <View style={styles.occasionsGrid}>
            {OCCASIONS.map((o) => (
              <TouchableOpacity
                key={o}
                onPress={() => setOccasion(o)}
                style={[styles.occasionChip, {
                  backgroundColor: occasion === o ? colors.primary + '20' : colors.muted,
                  borderColor: occasion === o ? colors.primary : colors.border,
                }]}
              >
                <Text style={[styles.occasionText, { color: occasion === o ? colors.primary : colors.foreground }]}>{o}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>Recipient Name</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Icon name="user" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Who is the wish for?"
              placeholderTextColor={colors.mutedForeground}
              value={recipientName}
              onChangeText={setRecipientName}
            />
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>Personal Message</Text>
          <TextInput
            style={[styles.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Tell the celebrity something personal about the recipient..."
            placeholderTextColor={colors.mutedForeground}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />

          <Pressable
            onPress={() => setSubmitted(true)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 8 }]}
          >
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
              <Icon name="send" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Send Wish Request</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 10, marginTop: 8 },
  celebChip: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minWidth: 100, alignItems: 'center' },
  celebChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  celebChipPrice: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  occasionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  occasionChip: { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8 },
  occasionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 20 },
  input: { flex: 1, fontSize: 15, height: 48 },
  textarea: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  submitBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  successCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 12, textAlign: 'center' },
  successSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  homeBtn: { height: 52, borderRadius: 9999, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
