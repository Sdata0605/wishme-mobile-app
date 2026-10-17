import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useOrderConfirm } from '@/context/OrderConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallet } from '@/hooks/useWallet';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const CALL_PRICE = 100;

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Graduation', 'New Year', 'Diwali', 'Christmas',
  'Eid', 'Holi', 'Promotion', 'Wedding', 'Thank You', 'Congratulations', 'Other',
];

const LANGUAGES: Array<{ label: string; value: string }> = [
  { label: 'English', value: 'english' },
  { label: 'Hindi', value: 'hindi' },
  { label: 'Tamil', value: 'tamil' },
  { label: 'Telugu', value: 'telugu' },
  { label: 'Kannada', value: 'kannada' },
  { label: 'Malayalam', value: 'malayalam' },
  { label: 'Marathi', value: 'marathi' },
  { label: 'Bengali', value: 'bengali' },
  { label: 'Gujarati', value: 'gujarati' },
  { label: 'Punjabi', value: 'punjabi' },
];

interface VapiVoice { id: string; name: string; provider?: string }
interface UserVoice { id: string; vapi_voice_id: string; voice_name: string; created_at: string }

function formatInPhone(raw: string): { ok: true; e164: string } | { ok: false } {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  const digits = cleaned.replace(/^\+?(91)?/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return { ok: false };
  return { ok: true, e164: `+91${digits}` };
}

export default function VoiceCallWishScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, getValidSession } = useAuth();
  const wallet = useWallet();
  const { confirmOrder } = useOrderConfirm();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [tab, setTab] = useState<'call' | 'upload'>('call');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [occasion, setOccasion] = useState('Birthday');
  const [language, setLanguage] = useState('english');
  const [selectedVoice, setSelectedVoice] = useState<{ id: string; name: string; provider: string } | null>(null);

  const [vapiVoices, setVapiVoices] = useState<VapiVoice[]>([]);
  const [userVoices, setUserVoices] = useState<UserVoice[]>([]);
  const [fetchingVoices, setFetchingVoices] = useState(true);

  const [voiceName, setVoiceName] = useState('');
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = async () => {
    const valid = await getValidSession();
    return valid?.access_token ?? session?.access_token ?? null;
  };

  const fetchVoices = useCallback(async () => {
    setFetchingVoices(true);
    try {
      const access = await token();
      const res = await supabaseFetch('/functions/v1/vapi-get-voices', { method: 'POST', body: '{}' }, access);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to load voices');
      setVapiVoices(json.vapiVoices || []);
      setUserVoices(json.userVoices || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setFetchingVoices(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setError('Please upload an audio file under 10MB');
        return;
      }
      const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setAudioBase64(raw);
      setAudioFileName(asset.name ?? 'audio.wav');
      setError(null);
    } catch {
      setError('Could not read the audio file');
    }
  };

  const handleUploadVoice = async () => {
    if (!voiceName.trim() || !audioBase64) {
      setError('Please provide a voice name and audio file');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const access = await token();
      const res = await supabaseFetch(
        '/functions/v1/vapi-upload-voice',
        { method: 'POST', body: JSON.stringify({ voiceName: voiceName.trim(), audioBase64 }) },
        access,
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Upload failed');
      setSuccess(`"${voiceName.trim()}" has been added to your voices.`);
      setVoiceName('');
      setAudioFileName(null);
      setAudioBase64(null);
      fetchVoices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload voice');
    } finally {
      setUploading(false);
    }
  };

  const handleMakeCall = async () => {
    if (!recipientName.trim() || !recipientPhone.trim() || !occasion.trim() || !selectedVoice) {
      setError('Please fill in all fields and select a voice');
      return;
    }
    const phone = formatInPhone(recipientPhone);
    if (!phone.ok) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    if (wallet.balance < CALL_PRICE) {
      setError(`Insufficient wallet balance. You need ₹${CALL_PRICE}.`);
      router.push('/wallet' as never);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const access = await token();
      const res = await supabaseFetch(
        '/functions/v1/vapi-make-call',
        {
          method: 'POST',
          body: JSON.stringify({
            recipientName: recipientName.trim(),
            recipientPhone: phone.e164,
            occasion,
            voiceId: selectedVoice.id,
            voiceName: selectedVoice.name,
            voiceProvider: selectedVoice.provider,
            language,
          }),
        },
        access,
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? json.message ?? 'Failed to initiate call');
      wallet.refetch();
      setSuccess(json.message || `Calling ${recipientName.trim()} to wish them on their ${occasion}!`);
      confirmOrder({
        item: `an AI voice call to ${recipientName.trim()}`,
        orderId: json.callId,
        viewRoute: { pathname: '/bookings', params: { tab: 'Calls' } },
      });
      setRecipientName('');
      setRecipientPhone('');
      setOccasion('Birthday');
      setSelectedVoice(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate call');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <LinearGradient
        colors={['#FF6B33', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Icon name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Voice Call Wishes</Text>
          <Text style={styles.headerSub}>VAPI dials the recipient — you never join the call</Text>
        </View>
      </LinearGradient>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(['call', 'upload'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => { setTab(t); setError(null); setSuccess(null); }} style={styles.tabBtn}>
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground, fontFamily: tab === t ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
              {t === 'call' ? 'Make a Call' : 'Upload Voice'}
            </Text>
            {tab === t && <View style={[styles.tabLine, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.bannerErr}>
            <Icon name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.bannerErrText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.bannerOk}>
            <Icon name="check" size={16} color="#16A34A" />
            <Text style={styles.bannerOkText}>{success}</Text>
          </View>
        ) : null}

        {tab === 'call' ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Friend's Name</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Icon name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Enter their name"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>

            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>Phone Number</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Icon name="phone" size={16} color={colors.mutedForeground} />
              <TextInput
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="10-digit Indian mobile"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>

            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>Occasion</Text>
            <View style={styles.chipRow}>
              {OCCASIONS.map((o) => (
                <TouchableOpacity
                  key={o}
                  onPress={() => setOccasion(o)}
                  style={[styles.chip, { borderColor: occasion === o ? colors.primary : colors.border, backgroundColor: occasion === o ? colors.primary + '18' : 'transparent' }]}
                >
                  <Text style={[styles.chipText, { color: occasion === o ? colors.primary : colors.mutedForeground }]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>Language</Text>
            <View style={styles.chipRow}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.value}
                  onPress={() => setLanguage(l.value)}
                  style={[styles.chip, { borderColor: language === l.value ? colors.primary : colors.border, backgroundColor: language === l.value ? colors.primary + '18' : 'transparent' }]}
                >
                  <Text style={[styles.chipText, { color: language === l.value ? colors.primary : colors.mutedForeground }]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>Select Voice</Text>
            {fetchingVoices ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Loading voices...</Text>
              </View>
            ) : (
              <>
                {userVoices.length > 0 && (
                  <>
                    <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Your custom voices</Text>
                    {userVoices.map((v) => {
                      const active = selectedVoice?.id === v.vapi_voice_id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          onPress={() => setSelectedVoice({ id: v.vapi_voice_id, name: v.voice_name, provider: '11labs' })}
                          style={[styles.voiceRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.background }]}
                        >
                          <Icon name="volume-2" size={16} color={active ? colors.primary : colors.mutedForeground} />
                          <Text style={[styles.voiceName, { color: colors.foreground }]}>{v.voice_name} (Custom)</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
                {vapiVoices.length > 0 && (
                  <>
                    <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Available voices</Text>
                    {vapiVoices.map((v) => {
                      const active = selectedVoice?.id === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          onPress={() => setSelectedVoice({ id: v.id, name: v.name, provider: v.provider || '11labs' })}
                          style={[styles.voiceRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.background }]}
                        >
                          <Icon name="volume-2" size={16} color={active ? colors.primary : colors.mutedForeground} />
                          <Text style={[styles.voiceName, { color: colors.foreground }]}>{v.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
                {vapiVoices.length === 0 && userVoices.length === 0 && (
                  <Text style={[styles.helper, { color: colors.mutedForeground }]}>No voices available. Upload a custom voice to get started.</Text>
                )}
              </>
            )}

            <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Cost <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>₹{CALL_PRICE}</Text></Text>
              <Text style={[styles.priceLabel, { color: wallet.balance >= CALL_PRICE ? '#22C55E' : '#EF4444' }]}>
                Wallet ₹{wallet.balance.toLocaleString('en-IN')}
              </Text>
            </View>

            <TouchableOpacity onPress={handleMakeCall} disabled={submitting || !selectedVoice} activeOpacity={0.85} style={submitting && { opacity: 0.7 }}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Icon name="phone" size={18} color="#fff" />}
                <Text style={styles.ctaText}>{submitting ? 'Initiating Call...' : `Make Wish Call (₹${CALL_PRICE})`}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Voice Name</Text>
            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Icon name="mic" size={16} color={colors.mutedForeground} />
              <TextInput
                value={voiceName}
                onChangeText={setVoiceName}
                placeholder="Give your voice a name"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>

            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>Audio Sample</Text>
            <TouchableOpacity onPress={pickAudio} style={[styles.uploadBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Icon name="upload" size={28} color={colors.mutedForeground} />
              <Text style={[styles.uploadTitle, { color: colors.foreground }]}>
                {audioFileName ?? 'Tap to upload audio file'}
              </Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>MP3, WAV, or M4A (max 10MB). Best: 30s–2min clear sample.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleUploadVoice}
              disabled={uploading || !voiceName.trim() || !audioBase64}
              activeOpacity={0.85}
              style={(uploading || !voiceName.trim() || !audioBase64) && { opacity: 0.6 }}
            >
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                {uploading ? <ActivityIndicator color="#fff" /> : <Icon name="upload" size={18} color="#fff" />}
                <Text style={styles.ctaText}>{uploading ? 'Uploading Voice...' : 'Upload Voice'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {userVoices.length > 0 && (
              <View style={{ marginTop: 18, gap: 8 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>Your Custom Voices</Text>
                {userVoices.map((v) => (
                  <View key={v.id} style={[styles.voiceRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Icon name="volume-2" size={16} color={colors.primary} />
                    <Text style={[styles.voiceName, { color: colors.foreground }]}>{v.voice_name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View></AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingTop: 14 },
  tabText: { fontSize: 14, marginBottom: 10 },
  tabLine: { height: 2, width: '70%', borderRadius: 1 },
  scroll: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  groupLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  voiceName: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  helper: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18, textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  priceLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  cta: { marginTop: 16, height: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  uploadBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', gap: 8, marginBottom: 8 },
  uploadTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bannerErr: { flexDirection: 'row', gap: 8, backgroundColor: '#EF444420', borderColor: '#EF4444', borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  bannerErrText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  bannerOk: { flexDirection: 'row', gap: 8, backgroundColor: '#16A34A20', borderColor: '#16A34A', borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  bannerOkText: { color: '#15803D', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
});
