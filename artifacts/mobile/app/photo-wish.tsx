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
  'Retirement', 'Diwali', 'Holi', 'Eid', 'Christmas',
  'New Year', 'Valentine\'s Day', 'Mother\'s Day', 'Father\'s Day', 'Get Well Soon',
];

const TEXT_STYLES = [
  { id: 'elegant', label: 'Elegant', desc: 'Serif fonts with a refined, classic look' },
  { id: 'playful', label: 'Playful', desc: 'Fun, rounded letters with vibrant colours' },
  { id: 'modern', label: 'Modern', desc: 'Clean, minimal sans-serif typography' },
  { id: 'classic', label: 'Classic', desc: 'Timeless design with traditional elements' },
  { id: 'festive', label: 'Festive', desc: 'Bold, celebratory with decorative accents' },
];

const MOCK_HISTORY = [
  { id: 'pw1', occasion: 'Birthday', recipient: 'Rahul Kumar', date: '2025-01-15', status: 'Completed' },
  { id: 'pw2', occasion: 'Anniversary', recipient: 'Priya & Amit', date: '2025-01-08', status: 'Completed' },
  { id: 'pw3', occasion: 'Wedding', recipient: 'Sneha Sharma', date: '2024-12-28', status: 'Processing' },
  { id: 'pw4', occasion: 'Graduation', recipient: 'Aryan Mehta', date: '2024-12-10', status: 'Completed' },
];

const GRAD_COLORS: [string, string][] = [
  ['#FF6B33', '#E8527A'],
  ['#E8527A', '#B44CFF'],
  ['#4B83FF', '#7B2FFF'],
  ['#22C55E', '#4B83FF'],
];

const BASE_PRICE = 299;
const DISCOUNT_PCT = 20;
const FINAL_PRICE = Math.round(BASE_PRICE * (1 - DISCOUNT_PCT / 100));

export default function PhotoWishScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [occasion, setOccasion] = useState('Birthday');
  const [showOccasions, setShowOccasions] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [message, setMessage] = useState('');
  const [textStyle, setTextStyle] = useState('elegant');
  const [hasImage, setHasImage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const generate = () => {
    setGenerating(true);
    setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2200);
  };

  const statusColor = (s: string) => s === 'Completed' ? '#22c55e' : s === 'Processing' ? '#FF6B33' : '#6b7280';

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Photo Wish</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { label: 'Wallet Balance', value: '₹2,450', icon: 'credit-card' as const, color: '#4B83FF' },
            { label: "Today's Generations", value: '3', icon: 'zap' as const, color: '#FF6B33' },
            { label: 'Total Created', value: '47', icon: 'image' as const, color: '#B44CFF' },
          ].map(st => (
            <View key={st.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: st.color + '20' }]}>
                <Icon name={st.icon} size={16} color={st.color} />
              </View>
              <Text style={[s.statValue, { color: colors.foreground }]}>{st.value}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Tab pills */}
        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          {(['create', 'history'] as const).map(t => (
            <TouchableOpacity key={t} style={s.tabPill} onPress={() => setTab(t)}>
              <Text style={[s.tabText, { color: tab === t ? '#FF6B33' : colors.mutedForeground }]}>
                {t === 'create' ? 'Create' : 'History'}
              </Text>
              {tab === t && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'create' ? (
          <View style={s.formWrap}>
            {/* Image upload */}
            {hasImage ? (
              <View style={[s.uploadedPreview, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}>
                <Icon name="image" size={32} color="#FF6B33" />
                <Text style={[s.uploadedText, { color: colors.foreground }]}>photo_wish.jpg</Text>
                <TouchableOpacity onPress={() => setHasImage(false)}>
                  <Icon name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.uploadZone, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={() => setHasImage(true)} activeOpacity={0.8}>
                <Icon name="upload" size={32} color="#FF6B33" />
                <Text style={[s.uploadTitle, { color: colors.foreground }]}>Upload Your Photo</Text>
                <Text style={[s.uploadSub, { color: colors.mutedForeground }]}>Tap to choose from gallery or camera</Text>
                <View style={[s.uploadBtn, { backgroundColor: '#FF6B33' }]}>
                  <Icon name="camera" size={15} color="#fff" />
                  <Text style={s.uploadBtnText}>Choose Photo</Text>
                </View>
              </TouchableOpacity>
            )}

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
                    <TouchableOpacity key={o} style={[s.dropdownItem, o === occasion && { backgroundColor: '#FF6B3315' }]} onPress={() => { setOccasion(o); setShowOccasions(false); }}>
                      <Text style={[s.dropdownItemText, { color: o === occasion ? '#FF6B33' : colors.foreground }]}>{o}</Text>
                      {o === occasion && <Icon name="check" size={14} color="#FF6B33" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Names */}
            <Text style={[s.label, { color: colors.foreground }]}>Recipient Name</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Who is this for?" placeholderTextColor={colors.mutedForeground} value={recipient} onChangeText={setRecipient} />

            <Text style={[s.label, { color: colors.foreground }]}>Sender Name</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Your name" placeholderTextColor={colors.mutedForeground} value={sender} onChangeText={setSender} />

            {/* Message */}
            <Text style={[s.label, { color: colors.foreground }]}>Wish Message</Text>
            <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} placeholder="Write a heartfelt message..." placeholderTextColor={colors.mutedForeground} value={message} onChangeText={setMessage} multiline numberOfLines={4} />

            {/* Text Style */}
            <Text style={[s.label, { color: colors.foreground }]}>Text Style</Text>
            <View style={s.styleGrid}>
              {TEXT_STYLES.map(ts => (
                <TouchableOpacity key={ts.id} style={[s.styleCard, { backgroundColor: colors.card, borderColor: textStyle === ts.id ? '#FF6B33' : colors.border, borderWidth: textStyle === ts.id ? 2 : 1 }]} onPress={() => setTextStyle(ts.id)}>
                  <Text style={[s.styleLabel, { color: textStyle === ts.id ? '#FF6B33' : colors.foreground }]}>{ts.label}</Text>
                  <Text style={[s.styleDesc, { color: colors.mutedForeground }]}>{ts.desc}</Text>
                </TouchableOpacity>
              ))}
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
                <LinearGradient colors={['#FF6B33', '#B44CFF']} style={s.previewImg}>
                  <Text style={s.previewEmoji}>✨</Text>
                  <Text style={s.previewMsg}>Your Photo Wish</Text>
                  <Text style={s.previewSub}>{occasion} · {recipient || 'Recipient'}</Text>
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
            <TouchableOpacity onPress={generate} disabled={generating} activeOpacity={0.85} style={{ opacity: generating ? 0.7 : 1 }}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
                <Icon name="image" size={18} color="#fff" />
                <Text style={s.genBtnText}>{generating ? 'Generating...' : 'Generate Photo Wish'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.historyWrap}>
            <Text style={[s.histCount, { color: colors.mutedForeground }]}>{MOCK_HISTORY.length} photo wishes created</Text>
            <View style={s.histGrid}>
              {MOCK_HISTORY.map((item, idx) => (
                <View key={item.id} style={[s.histCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <LinearGradient colors={GRAD_COLORS[idx % GRAD_COLORS.length]} style={s.histThumb}>
                    <Icon name="image" size={24} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                  <View style={s.histInfo}>
                    <View style={s.histBadgeRow}>
                      <View style={[s.badge, { backgroundColor: '#FF6B3320' }]}>
                        <Text style={[s.badgeText, { color: '#FF6B33' }]}>{item.occasion}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                        <Text style={[s.badgeText, { color: statusColor(item.status) }]}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={[s.histRecipient, { color: colors.foreground }]}>{item.recipient}</Text>
                    <View style={s.histFooter}>
                      <Text style={[s.histDate, { color: colors.mutedForeground }]}>{item.date}</Text>
                      {item.status === 'Completed' && (
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
  statsRow: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 0 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20, marginTop: 16 },
  tabPill: { paddingHorizontal: 4, paddingVertical: 10, marginRight: 24, position: 'relative' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6B33', borderRadius: 1 },
  formWrap: { padding: 20, gap: 4 },
  uploadZone: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, padding: 32, alignItems: 'center', gap: 10, marginBottom: 8 },
  uploadTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  uploadSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9999, marginTop: 4 },
  uploadBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  uploadedPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 8 },
  uploadedText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  dropdown: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  styleGrid: { gap: 8 },
  styleCard: { borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  styleLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', width: 70 },
  styleDesc: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  pricingCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 16 },
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
  previewImg: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 6 },
  previewEmoji: { fontSize: 28 },
  previewMsg: { color: '#fff', fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold' },
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
  histRecipient: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  histFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dlText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FF6B33' },
});
