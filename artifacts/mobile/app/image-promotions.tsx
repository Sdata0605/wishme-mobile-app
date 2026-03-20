import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
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

const MOCK_SUBSCRIBED = ['1', '2', '4'];

const MOCK_PROMOS = [
  { id: 'pr1', celeb: 'Ranveer Singh', date: '2025-01-18', status: 'Completed' },
  { id: 'pr2', celeb: 'Shreya Ghoshal', date: '2025-01-05', status: 'Completed' },
  { id: 'pr3', celeb: 'Alia Bhatt', date: '2024-12-22', status: 'Processing' },
];

const GRAD_COLORS: [string, string][] = [
  ['#FF6B33', '#B44CFF'],
  ['#B44CFF', '#4B83FF'],
  ['#4B83FF', '#22C55E'],
];

const BASE_PRICE = 499;
const DISCOUNT_PCT = 15;
const FINAL_PRICE = Math.round(BASE_PRICE * (1 - DISCOUNT_PCT / 100));

type RefImgOpt = 'none' | 'upload' | 'url';

export default function ImagePromotionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [selectedCeleb, setSelectedCeleb] = useState('');
  const [concept, setConcept] = useState('');
  const [branding, setBranding] = useState('');
  const [refImgOpt, setRefImgOpt] = useState<RefImgOpt>('none');
  const [refUrl, setRefUrl] = useState('');
  const [hasRefUpload, setHasRefUpload] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const subscribedCelebs = CELEBRITIES.filter(c => MOCK_SUBSCRIBED.includes(c.id));
  const noSubscriptions = subscribedCelebs.length === 0;

  const generate = () => {
    if (!selectedCeleb) return;
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2500);
  };

  const statusColor = (st: string) => st === 'Completed' ? '#22c55e' : st === 'Processing' ? '#FF6B33' : '#6b7280';

  const selectedCelebData = CELEBRITIES.find(c => c.id === selectedCeleb);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Image Promotions</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Tab bar */}
        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          {(['create', 'history'] as const).map(t => (
            <TouchableOpacity key={t} style={s.tabPill} onPress={() => setTab(t)}>
              <Text style={[s.tabText, { color: tab === t ? '#FF6B33' : colors.mutedForeground }]}>
                {t === 'create' ? 'Create Promotion' : 'My Promotions'}
              </Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'create' ? (
          <View style={s.formWrap}>
            {/* No subscriptions banner */}
            {noSubscriptions && (
              <View style={[s.alertBanner, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}>
                <Icon name="alert-circle" size={18} color="#FF6B33" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: '#FF6B33' }]}>No celebrities subscribed</Text>
                  <Text style={[s.alertSub, { color: colors.mutedForeground }]}>Subscribe to a celebrity first to create promotions</Text>
                </View>
              </View>
            )}

            {/* Celebrity select */}
            <Text style={[s.label, { color: colors.foreground }]}>Select Celebrity</Text>
            {noSubscriptions ? (
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>No subscribed celebrities yet. Go to Favorites to subscribe.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.celebChips}>
                {subscribedCelebs.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.celebChip, { backgroundColor: selectedCeleb === c.id ? '#FF6B33' : colors.muted, borderColor: selectedCeleb === c.id ? '#FF6B33' : colors.border }]}
                    onPress={() => setSelectedCeleb(selectedCeleb === c.id ? '' : c.id)}
                  >
                    <Text style={[s.celebChipText, { color: selectedCeleb === c.id ? '#fff' : colors.foreground }]}>{c.name}</Text>
                    {selectedCeleb === c.id && <Icon name="check" size={13} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Concept */}
            <Text style={[s.label, { color: colors.foreground }]}>Concept / Idea</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Describe the promotion concept, product, or campaign idea..."
              placeholderTextColor={colors.mutedForeground}
              value={concept}
              onChangeText={setConcept}
              multiline
              numberOfLines={4}
            />

            {/* Branding */}
            <Text style={[s.label, { color: colors.foreground }]}>Branding Details</Text>
            <TextInput
              style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Brand name, colours, logo description, tagline, style guidelines..."
              placeholderTextColor={colors.mutedForeground}
              value={branding}
              onChangeText={setBranding}
              multiline
              numberOfLines={3}
            />

            {/* Reference image section */}
            <Text style={[s.label, { color: colors.foreground }]}>Reference Image</Text>
            <View style={[s.refImgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(['none', 'upload', 'url'] as RefImgOpt[]).map(opt => (
                <TouchableOpacity key={opt} style={s.radioRow} onPress={() => setRefImgOpt(opt)}>
                  <View style={[s.radioOuter, { borderColor: refImgOpt === opt ? '#FF6B33' : colors.border }]}>
                    {refImgOpt === opt && <View style={s.radioInner} />}
                  </View>
                  <Text style={[s.radioText, { color: colors.foreground }]}>
                    {opt === 'none' ? 'None' : opt === 'upload' ? 'Upload Image' : 'Enter URL'}
                  </Text>
                </TouchableOpacity>
              ))}
              {refImgOpt === 'upload' && (
                hasRefUpload ? (
                  <View style={[s.uploadedRow, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}>
                    <Icon name="image" size={16} color="#FF6B33" />
                    <Text style={[s.uploadedName, { color: colors.foreground }]}>reference.jpg</Text>
                    <TouchableOpacity onPress={() => setHasRefUpload(false)}>
                      <Icon name="x" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[s.uploadZoneSm, { borderColor: '#FF6B33', backgroundColor: '#FF6B3310' }]} onPress={() => setHasRefUpload(true)}>
                    <Icon name="upload" size={18} color="#FF6B33" />
                    <Text style={[s.uploadZoneSmText, { color: '#FF6B33' }]}>Choose Image</Text>
                  </TouchableOpacity>
                )
              )}
              {refImgOpt === 'url' && (
                <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="https://example.com/image.jpg" placeholderTextColor={colors.mutedForeground} value={refUrl} onChangeText={setRefUrl} autoCapitalize="none" />
              )}
            </View>

            {/* Pricing */}
            <View style={[s.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.pricingTitle, { color: colors.foreground }]}>Pricing</Text>
              <View style={s.pricingRow}>
                <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Base Price</Text>
                <Text style={[s.pricingBase, { color: colors.mutedForeground }]}>₹{BASE_PRICE}</Text>
              </View>
              <View style={s.pricingRow}>
                <View style={s.discountBadge}><Text style={s.discountText}>{DISCOUNT_PCT}% OFF</Text></View>
                <Text style={[s.pricingDiscount, { color: '#22c55e' }]}>−₹{BASE_PRICE - FINAL_PRICE}</Text>
              </View>
              <View style={[s.pricingDivider, { backgroundColor: colors.border }]} />
              <View style={s.pricingRow}>
                <Text style={[s.pricingFinalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={s.pricingFinal}>₹{FINAL_PRICE}</Text>
              </View>
            </View>

            {/* Generated preview */}
            {generated && selectedCelebData && (
              <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <LinearGradient colors={['#FF6B33', '#B44CFF']} style={s.previewImg}>
                  <Icon name="zap" size={32} color="rgba(255,255,255,0.9)" />
                  <Text style={s.previewTitle}>Promo Visual Ready</Text>
                  <Text style={s.previewSub}>feat. {selectedCelebData.name}</Text>
                </LinearGradient>
                <View style={s.previewActions}>
                  <TouchableOpacity style={[s.previewBtn, { backgroundColor: colors.muted }]}>
                    <Icon name="download" size={15} color={colors.foreground} />
                    <Text style={[s.previewBtnText, { color: colors.foreground }]}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.previewBtn, { backgroundColor: colors.muted }]}>
                    <Icon name="share-2" size={15} color={colors.foreground} />
                    <Text style={[s.previewBtnText, { color: colors.foreground }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity onPress={generate} disabled={generating || !selectedCeleb} activeOpacity={0.85} style={{ opacity: generating || !selectedCeleb ? 0.55 : 1 }}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
                <Icon name="image" size={18} color="#fff" />
                <Text style={s.genBtnText}>{generating ? 'Generating...' : 'Generate Promotion'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.historyWrap}>
            <Text style={[s.histCount, { color: colors.mutedForeground }]}>{MOCK_PROMOS.length} promotions created</Text>
            <View style={s.histGrid}>
              {MOCK_PROMOS.map((promo, idx) => (
                <View key={promo.id} style={[s.histCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <LinearGradient colors={GRAD_COLORS[idx % GRAD_COLORS.length]} style={s.histThumb}>
                    <Icon name="zap" size={22} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                  <View style={s.histInfo}>
                    <View style={s.histBadgeRow}>
                      <View style={[s.badge, { backgroundColor: statusColor(promo.status) + '20' }]}>
                        <Text style={[s.badgeText, { color: statusColor(promo.status) }]}>{promo.status}</Text>
                      </View>
                    </View>
                    <Text style={[s.histCeleb, { color: colors.foreground }]}>feat. {promo.celeb}</Text>
                    <View style={s.histFooter}>
                      <Text style={[s.histDate, { color: colors.mutedForeground }]}>{promo.date}</Text>
                      {promo.status === 'Completed' && (
                        <TouchableOpacity style={s.dlBtn}>
                          <Icon name="download" size={13} color="#FF6B33" />
                          <Text style={s.dlText}>Download</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
  tabPill: { paddingHorizontal: 4, paddingVertical: 10, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6B33', borderRadius: 1 },
  formWrap: { padding: 20, gap: 4 },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  alertTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  alertSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  celebChips: { gap: 8, paddingBottom: 4 },
  celebChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 9 },
  celebChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  refImgCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B33' },
  radioText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  uploadZoneSm: { borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadZoneSmText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  uploadedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  uploadedName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  pricingCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 4 },
  pricingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingBase: { fontSize: 13, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#22c55e20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#22c55e' },
  pricingDiscount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  pricingDivider: { height: 1 },
  pricingFinalLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pricingFinal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FF6B33' },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 16 },
  previewImg: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  previewSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  previewActions: { flexDirection: 'row', gap: 10, padding: 12 },
  previewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 10 },
  previewBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  genBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 },
  genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  historyWrap: { padding: 20 },
  histCount: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 14 },
  histGrid: { gap: 12 },
  histCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  histThumb: { width: 90, alignItems: 'center', justifyContent: 'center' },
  histInfo: { flex: 1, padding: 12, gap: 6 },
  histBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  histCeleb: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  histFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FF6B33' },
});
