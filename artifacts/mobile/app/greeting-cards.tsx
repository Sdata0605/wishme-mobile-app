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
import { useTheme } from '@/context/ThemeContext';

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Baby Shower',
  'Retirement', 'Diwali', 'Holi', 'Eid', 'Christmas', 'New Year', 'Farewell',
];

const MOCK_CARDS = [
  { id: 'gc1', occasion: 'Birthday', recipient: 'Rahul Kumar', date: '2025-01-20', status: 'Completed' },
  { id: 'gc2', occasion: 'Anniversary', recipient: 'Priya & Amit', date: '2025-01-12', status: 'Completed' },
  { id: 'gc3', occasion: 'Wedding', recipient: 'Sneha Sharma', date: '2024-12-30', status: 'Processing' },
  { id: 'gc4', occasion: 'Diwali', recipient: 'Family', date: '2024-11-01', status: 'Completed' },
];

const GRAD_COLORS: [string, string][] = [
  ['#FF6B33', '#E8527A'],
  ['#E8527A', '#B44CFF'],
  ['#4B83FF', '#7B2FFF'],
  ['#22C55E', '#4B83FF'],
];

const BASE_PRICE = 199;
const DISCOUNT_PCT = 25;
const FINAL_PRICE = Math.round(BASE_PRICE * (1 - DISCOUNT_PCT / 100));

type RefImgOpt = 'none' | 'upload' | 'url';

export default function GreetingCardsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [occasion, setOccasion] = useState('Birthday');
  const [showOccasions, setShowOccasions] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [prompt, setPrompt] = useState('');
  const [refineAI, setRefineAI] = useState(false);
  const [refImgOpt, setRefImgOpt] = useState<RefImgOpt>('none');
  const [refUrl, setRefUrl] = useState('');
  const [hasRefUpload, setHasRefUpload] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const generate = () => {
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2200);
  };

  const statusColor = (st: string) => st === 'Completed' ? '#22c55e' : st === 'Processing' ? '#FF6B33' : '#6b7280';

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Greeting Cards</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Tab bar */}
        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          {(['create', 'history'] as const).map(t => (
            <TouchableOpacity key={t} style={s.tabPill} onPress={() => setTab(t)}>
              <Text style={[s.tabText, { color: tab === t ? '#E8527A' : colors.mutedForeground }]}>
                {t === 'create' ? 'Create Card' : 'My Cards'}
              </Text>
              {tab === t && <View style={[s.tabUnderline, { backgroundColor: '#E8527A' }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'create' ? (
          <View style={s.formWrap}>
            {/* Occasion */}
            <Text style={[s.label, { color: colors.foreground }]}>Occasion</Text>
            <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowOccasions(o => !o)}>
              <Text style={[s.dropdownText, { color: colors.foreground }]}>{occasion}</Text>
              <Icon name={showOccasions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showOccasions && (
              <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {OCCASIONS.map(o => (
                    <TouchableOpacity key={o} style={[s.dropdownItem, o === occasion && { backgroundColor: '#E8527A15' }]} onPress={() => { setOccasion(o); setShowOccasions(false); }}>
                      <Text style={[s.dropdownItemText, { color: o === occasion ? '#E8527A' : colors.foreground }]}>{o}</Text>
                      {o === occasion && <Icon name="check" size={14} color="#E8527A" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Names */}
            <Text style={[s.label, { color: colors.foreground }]}>Recipient Name</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Who is this card for?" placeholderTextColor={colors.mutedForeground} value={recipient} onChangeText={setRecipient} />

            <Text style={[s.label, { color: colors.foreground }]}>Sender Name</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Your name" placeholderTextColor={colors.mutedForeground} value={sender} onChangeText={setSender} />

            {/* Prompt */}
            <Text style={[s.label, { color: colors.foreground }]}>Prompt / Description</Text>
            <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Describe the card style, theme, colours, message tone..." placeholderTextColor={colors.mutedForeground} value={prompt} onChangeText={setPrompt} multiline numberOfLines={4} />

            {/* AI Refine checkbox */}
            <TouchableOpacity style={s.checkRow} onPress={() => setRefineAI(r => !r)}>
              <View style={[s.checkbox, { borderColor: '#E8527A', backgroundColor: refineAI ? '#E8527A' : 'transparent' }]}>
                {refineAI && <Icon name="check" size={12} color="#fff" />}
              </View>
              <View>
                <Text style={[s.checkLabel, { color: colors.foreground }]}>Refine with AI</Text>
                <Text style={[s.checkSub, { color: colors.mutedForeground }]}>AI will enhance your prompt for better results</Text>
              </View>
            </TouchableOpacity>

            {/* Reference image section */}
            <Text style={[s.label, { color: colors.foreground }]}>Reference Image</Text>
            <View style={[s.refImgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(['none', 'upload', 'url'] as RefImgOpt[]).map(opt => (
                <TouchableOpacity key={opt} style={s.radioRow} onPress={() => setRefImgOpt(opt)}>
                  <View style={[s.radioOuter, { borderColor: refImgOpt === opt ? '#E8527A' : colors.border }]}>
                    {refImgOpt === opt && <View style={[s.radioInner, { backgroundColor: '#E8527A' }]} />}
                  </View>
                  <Text style={[s.radioText, { color: colors.foreground }]}>
                    {opt === 'none' ? 'None' : opt === 'upload' ? 'Upload Image' : 'Enter URL'}
                  </Text>
                </TouchableOpacity>
              ))}
              {refImgOpt === 'upload' && (
                hasRefUpload ? (
                  <View style={[s.uploadedRow, { backgroundColor: '#E8527A15', borderColor: '#E8527A40' }]}>
                    <Icon name="image" size={16} color="#E8527A" />
                    <Text style={[s.uploadedName, { color: colors.foreground }]}>reference.jpg</Text>
                    <TouchableOpacity onPress={() => setHasRefUpload(false)}>
                      <Icon name="x" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[s.uploadZoneSm, { borderColor: '#E8527A', backgroundColor: '#E8527A10' }]} onPress={() => setHasRefUpload(true)}>
                    <Icon name="upload" size={18} color="#E8527A" />
                    <Text style={[s.uploadZoneSmText, { color: '#E8527A' }]}>Choose Image</Text>
                  </TouchableOpacity>
                )
              )}
              {refImgOpt === 'url' && (
                <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="https://example.com/image.jpg" placeholderTextColor={colors.mutedForeground} value={refUrl} onChangeText={setRefUrl} autoCapitalize="none" />
              )}
            </View>

            {/* Wallet balance */}
            <View style={[s.walletRow, { backgroundColor: '#4B83FF15', borderColor: '#4B83FF40' }]}>
              <Icon name="credit-card" size={16} color="#4B83FF" />
              <Text style={[s.walletText, { color: colors.foreground }]}>Wallet Balance: <Text style={{ color: '#4B83FF', fontFamily: 'Inter_700Bold' }}>₹2,450</Text></Text>
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
            {generated && (
              <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <LinearGradient colors={['#E8527A', '#B44CFF']} style={s.previewImg}>
                  <Icon name="image" size={36} color="rgba(255,255,255,0.9)" />
                  <Text style={s.previewTitle}>{occasion} Card</Text>
                  <Text style={s.previewSub}>For {recipient || 'Recipient'}</Text>
                </LinearGradient>
                <View style={s.previewActions}>
                  <TouchableOpacity style={[s.dlFullBtn, { borderColor: '#E8527A' }]}>
                    <Icon name="download" size={16} color="#E8527A" />
                    <Text style={[s.dlFullText, { color: '#E8527A' }]}>Download Card</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity onPress={generate} disabled={generating} activeOpacity={0.85} style={{ opacity: generating ? 0.7 : 1 }}>
              <LinearGradient colors={['#E8527A', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
                <Icon name="zap" size={18} color="#fff" />
                <Text style={s.genBtnText}>{generating ? 'Generating...' : 'Generate Card'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.historyWrap}>
            <Text style={[s.histCount, { color: colors.mutedForeground }]}>{MOCK_CARDS.length} greeting cards created</Text>
            <View style={s.histGrid}>
              {MOCK_CARDS.map((card, idx) => (
                <View key={card.id} style={[s.histCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <LinearGradient colors={GRAD_COLORS[idx % GRAD_COLORS.length]} style={s.histThumb}>
                    <Icon name="image" size={22} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                  <View style={s.histInfo}>
                    <View style={s.histBadgeRow}>
                      <View style={[s.badge, { backgroundColor: '#E8527A20' }]}>
                        <Text style={[s.badgeText, { color: '#E8527A' }]}>{card.occasion}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: statusColor(card.status) + '20' }]}>
                        <Text style={[s.badgeText, { color: statusColor(card.status) }]}>{card.status}</Text>
                      </View>
                    </View>
                    <Text style={[s.histRecipient, { color: colors.foreground }]}>{card.recipient}</Text>
                    <View style={s.histFooter}>
                      <Text style={[s.histDate, { color: colors.mutedForeground }]}>{card.date}</Text>
                      {card.status === 'Completed' && (
                        <TouchableOpacity style={s.dlBtn}>
                          <Icon name="download" size={13} color="#E8527A" />
                          <Text style={[s.dlText, { color: '#E8527A' }]}>Download</Text>
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
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },
  formWrap: { padding: 20, gap: 4 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  dropdown: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  checkSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  refImgCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  uploadZoneSm: { borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadZoneSmText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  uploadedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
  uploadedName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4 },
  walletText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
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
  pricingFinal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#E8527A' },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 16 },
  previewImg: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewTitle: { color: '#fff', fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold' },
  previewSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  previewActions: { padding: 12 },
  dlFullBtn: { borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  dlFullText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
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
  histRecipient: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  histFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
