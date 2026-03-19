import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const STYLES = ['Product Feature', 'Brand Story', 'Social Media Ad', 'OOH Billboard', 'Email Campaign'];

export default function ImagePromotionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedCeleb, setSelectedCeleb] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Product Feature');
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const generate = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setGenerated(true); }, 2000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Image Promotions</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.hero}>
          <Feather name="zap" size={32} color="#fff" />
          <Text style={styles.heroTitle}>AI-Powered Celebrity Promotions</Text>
          <Text style={styles.heroSub}>Generate stunning promotional visuals with celebrity power</Text>
        </LinearGradient>

        <Text style={[styles.label, { color: colors.foreground }]}>Select Celebrity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {CELEBRITIES.slice(0, 5).map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedCeleb(c.id)}
              style={[styles.chip, { backgroundColor: selectedCeleb === c.id ? colors.primary : colors.muted, borderColor: selectedCeleb === c.id ? colors.primary : colors.border }]}
            >
              <Text style={[styles.chipText, { color: selectedCeleb === c.id ? '#fff' : colors.foreground }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: colors.foreground }]}>Promotion Style</Text>
        <View style={styles.stylesGrid}>
          {STYLES.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSelectedStyle(s)}
              style={[styles.styleChip, {
                backgroundColor: selectedStyle === s ? colors.primary + '20' : colors.muted,
                borderColor: selectedStyle === s ? colors.primary : colors.border,
              }]}
            >
              <Text style={[styles.styleText, { color: selectedStyle === s ? colors.primary : colors.foreground }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {generated && (
          <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.previewCard}>
            <Text style={styles.previewTitle}>✨ Your Promo Visual</Text>
            <Text style={styles.previewSub}>Generated successfully! Download & share.</Text>
            <TouchableOpacity style={styles.downloadBtn}>
              <Feather name="download" size={16} color="#FF6B33" />
              <Text style={styles.downloadBtnText}>Download</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        <Pressable onPress={generate} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1, marginTop: 8 }]}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateBtn}>
            <Feather name="image" size={18} color="#fff" />
            <Text style={styles.generateBtnText}>{loading ? 'Generating...' : 'Generate Promotion'}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  hero: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, marginBottom: 24 },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  chip: { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  styleChip: { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8 },
  styleText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  previewCard: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, marginBottom: 20 },
  previewTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  previewSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  downloadBtn: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999, marginTop: 8 },
  downloadBtnText: { color: '#FF6B33', fontSize: 13, fontFamily: 'Inter_700Bold' },
  generateBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  generateBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
