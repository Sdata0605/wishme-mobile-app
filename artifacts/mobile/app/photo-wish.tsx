import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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
import { useTheme } from '@/context/ThemeContext';

const TEMPLATES = [
  { id: '1', label: 'Birthday Card', emoji: '🎂', gradient: ['#FF6B33', '#E8527A'] as const },
  { id: '2', label: 'Anniversary', emoji: '💕', gradient: ['#E8527A', '#B44CFF'] as const },
  { id: '3', label: 'Graduation', emoji: '🎓', gradient: ['#4B83FF', '#7B2FFF'] as const },
  { id: '4', label: 'Wedding', emoji: '💍', gradient: ['#FFB347', '#FF6B33'] as const },
];

export default function PhotoWishScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedTemplate, setSelectedTemplate] = useState('1');
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Photo Wish</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.uploadArea, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="upload" size={40} color={colors.mutedForeground} />
          <Text style={[styles.uploadTitle, { color: colors.foreground }]}>Upload Your Photo</Text>
          <Text style={[styles.uploadSub, { color: colors.mutedForeground }]}>Upload a photo to customize your wish</Text>
          <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]}>
            <Feather name="camera" size={16} color="#fff" />
            <Text style={styles.uploadBtnText}>Choose Photo</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Choose Template</Text>
        <View style={styles.templatesGrid}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setSelectedTemplate(t.id)}
              style={[styles.templateItem, selectedTemplate === t.id && { borderColor: colors.primary, borderWidth: 2 }]}
            >
              <LinearGradient colors={t.gradient as [string, string]} style={styles.templateGrad}>
                <Text style={styles.templateEmoji}>{t.emoji}</Text>
              </LinearGradient>
              <Text style={[styles.templateLabel, { color: colors.foreground }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {generated && (
          <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.previewImage}>
              <Text style={styles.previewText}>✨ Your Photo Wish ✨</Text>
            </LinearGradient>
            <View style={styles.previewActions}>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: colors.muted }]}>
                <Feather name="download" size={16} color={colors.foreground} />
                <Text style={[styles.previewBtnText, { color: colors.foreground }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: colors.muted }]}>
                <Feather name="share-2" size={16} color={colors.foreground} />
                <Text style={[styles.previewBtnText, { color: colors.foreground }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Pressable onPress={generate} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }]}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateBtn}>
            <Feather name="image" size={18} color="#fff" />
            <Text style={styles.generateBtnText}>{loading ? 'Generating...' : 'Generate Photo Wish'}</Text>
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
  uploadArea: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, padding: 32, alignItems: 'center', gap: 10, marginBottom: 24 },
  uploadTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  uploadSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9999, marginTop: 8 },
  uploadBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  templatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  templateItem: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', width: '47%' },
  templateGrad: { height: 90, alignItems: 'center', justifyContent: 'center' },
  templateEmoji: { fontSize: 36 },
  templateLabel: { textAlign: 'center', padding: 8, fontSize: 13, fontFamily: 'Inter_500Medium' },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  previewImage: { height: 180, alignItems: 'center', justifyContent: 'center' },
  previewText: { color: '#fff', fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold' },
  previewActions: { flexDirection: 'row', gap: 10, padding: 12 },
  previewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10 },
  previewBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  generateBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  generateBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
