/** Small form controls shared by the studio tabs: voice picker, chips, language dropdown, duration slider, buttons, labels, message boxes and the wallet card. */
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { type VoiceItem, type VoiceList } from '@/hooks/useVoices';
import { SONG_LANGUAGES, COSTS, s } from './shared';

export function VoiceSelect({ value, onChange, voices, voicesLoading }: {
  value: VoiceItem | null;
  onChange: (v: VoiceItem) => void;
  voices: VoiceList;
  voicesLoading: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { previewSoundRef.current?.unloadAsync().catch(() => {}); }, []);

  const playPreview = async (voice: VoiceItem) => {
    if (!voice.preview_url) return;
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync().catch(() => {});
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
      if (playingId === voice.voice_id) { setPlayingId(null); return; }
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri: voice.preview_url }, { shouldPlay: true });
      previewSoundRef.current = sound;
      setPlayingId(voice.voice_id);
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) { setPlayingId(null); previewSoundRef.current = null; }
      });
    } catch {}
  };

  const allVoices = [...voices.clonedVoices, ...voices.premadeVoices];
  const displayName = value?.name ?? (voicesLoading ? 'Loading voices...' : allVoices.length === 0 ? 'No voices available' : 'Select a voice');

  const renderVoiceItem = (v: VoiceItem) => (
    <TouchableOpacity
      key={v.voice_id}
      style={[s.dropdownItem, value?.voice_id === v.voice_id && { backgroundColor: '#1F7BFF20' }]}
      onPress={() => { onChange(v); setOpen(false); }}
    >
      <Text style={[s.dropdownItemText, { color: value?.voice_id === v.voice_id ? '#1F7BFF' : colors.foreground, flex: 1 }]} numberOfLines={1}>{v.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {v.preview_url ? (
          <TouchableOpacity onPress={() => playPreview(v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name={playingId === v.voice_id ? 'pause' : 'play'} size={14} color="#1F7BFF" />
          </TouchableOpacity>
        ) : null}
        {value?.voice_id === v.voice_id && <Icon name="check" size={14} color="#1F7BFF" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View>
      <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setOpen(o => !o)}>
        <Text style={[s.dropdownText, { color: value ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>{displayName}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && (
        <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {voices.clonedVoices.length > 0 && (
            <>
              <View style={[s.voiceGroupHeader, { borderBottomColor: colors.border }]}>
                <Text style={[s.voiceGroupLabel, { color: '#1F7BFF' }]}>Your Cloned Voices</Text>
              </View>
              {voices.clonedVoices.map(renderVoiceItem)}
              <View style={[s.voiceGroupDivider, { backgroundColor: colors.border }]} />
            </>
          )}
          {voices.premadeVoices.length > 0 && (
            <>
              <View style={[s.voiceGroupHeader, { borderBottomColor: colors.border }]}>
                <Text style={[s.voiceGroupLabel, { color: colors.mutedForeground }]}>Premade Voices</Text>
              </View>
              {voices.premadeVoices.map(renderVoiceItem)}
            </>
          )}
          {allVoices.length === 0 && (
            <Text style={[s.dropdownItemText, { color: colors.mutedForeground, padding: 14 }]}>
              {voicesLoading ? 'Loading...' : 'No voices available'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function ChipSelect({ options, value, onChange, activeColor = '#1F7BFF' }: { options: string[]; value: string; onChange: (v: string) => void; activeColor?: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[s.chip, { backgroundColor: value === o ? activeColor : colors.muted }]} onPress={() => onChange(o)}>
          <Text style={[s.chipText, { color: value === o ? '#fff' : colors.foreground }]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export function LanguageDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setOpen(o => !o)}>
        <Text style={[s.dropdownText, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && (
        <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {SONG_LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang}
              style={[s.dropdownItem, value === lang && { backgroundColor: '#7B5CFA20' }]}
              onPress={() => { onChange(lang); setOpen(false); }}
            >
              <Text style={[s.dropdownItemText, { color: value === lang ? '#7B5CFA' : colors.foreground, flex: 1 }]}>{lang}</Text>
              {value === lang && <Icon name="check" size={14} color="#7B5CFA" />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function DurationSlider({ value, onChange, min = 1, max = 30, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const { colors } = useTheme();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View>
      <View style={s.sliderRow}>
        <TouchableOpacity style={[s.sliderBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => onChange(Math.max(min, value - step))}>
          <Icon name="minus" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[s.sliderTrack, { backgroundColor: colors.muted }]}>
          <View style={[s.sliderFill, { width: `${pct}%` }]} />
        </View>
        <TouchableOpacity style={[s.sliderBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => onChange(Math.min(max, value + step))}>
          <Icon name="plus" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <Text style={[s.sliderLabel, { color: colors.mutedForeground }]}>{value}s</Text>
    </View>
  );
}

export function GenBtn({ label, onPress, generating, disabled }: { label: string; onPress: () => void; generating: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={generating || disabled} style={{ marginTop: 16, opacity: (generating || disabled) ? 0.6 : 1 }} activeOpacity={0.85}>
      <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
        <Icon name="zap" size={18} color="#fff" />
        <Text style={s.genBtnText}>{generating ? 'Generating...' : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function SL({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[s.sectionLabel, { color: colors.foreground }]}>{text}</Text>;
}

export function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View style={s.errBox}>
      <Icon name="alert-circle" size={14} color="#ef4444" />
      <Text style={s.errorText}>{msg}</Text>
    </View>
  );
}

export function InfoBox({ msg, color = '#1F7BFF' }: { msg: string; color?: string }) {
  return (
    <View style={[s.infoBox, { backgroundColor: color + '15', borderColor: color + '40' }]}>
      <Icon name="info" size={14} color={color} />
      <Text style={[s.infoText, { color }]}>{msg}</Text>
    </View>
  );
}

export function WalletCard({ balance }: { balance: number }) {
  const { colors } = useTheme();
  const prices = [
    ['TTS', `₹${COSTS.tts}`],
    ['Voice Conversion', `₹${COSTS.voiceConversion}`],
    ['SFX', `₹${COSTS.sfx}`],
    ['Audio Isolation', `₹${COSTS.audioIsolation}`],
    ['Instrumental', `₹${COSTS.instrumental}`],
    ['Full Song', `₹${COSTS.fullSong}`],
    ['Voice Clone', `₹${COSTS.voiceClone}`],
    ['Img+Music', `₹${COSTS.imgInstrumental}/₹${COSTS.imgVocals}`],
  ];
  return (
    <View style={[s.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.walletRow}>
        <Icon name="wallet" size={20} color="#1F7BFF" />
        <Text style={[s.walletLabel, { color: colors.mutedForeground }]}>Wallet Balance</Text>
        <Text style={s.walletBalance}>₹{balance.toLocaleString('en-IN')}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.priceRow}>
        {prices.map(([name, price]) => (
          <View key={name} style={[s.priceChip, { backgroundColor: colors.muted }]}>
            <Text style={[s.priceChipName, { color: colors.mutedForeground }]}>{name}</Text>
            <Text style={[s.priceChipVal, { color: colors.foreground }]}>{price}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
