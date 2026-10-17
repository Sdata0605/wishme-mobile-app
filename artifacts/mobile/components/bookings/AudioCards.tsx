/** Cards for the AI Music Studio outputs: songs, image+music, TTS, SFX, voice conversion and audio isolation. */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { fmtDate, SmallStatusBadge, s } from './shared';
import type { Colors, MusicGen, ImgMusicGen, TtsGen, SfxGen, VoiceConversion, AudioIsolation } from './shared';
import { BookingAudioPlayer, DownloadLink, ImagePreviewModal } from './MediaBlocks';

export function MusicCard({ item, colors }: { item: MusicGen; colors: Colors }) {
  const audioUrl = item.audio_url ?? null;
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="music" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title || 'Song'}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.genre}{item.mood ? ` · ${item.mood}` : ''}</Text>
          {item.has_vocals && (
            <View style={[s.vocBadge, { borderColor: '#B026FF' }]}>
              <Text style={{ color: '#B026FF', fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>🎤 Vocals</Text>
            </View>
          )}
          {item.lyrics ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.lyrics}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.credits_used}</Text>}
          {item.error_message ? <Text style={{ color: '#EF4444', fontSize: 11, fontFamily: 'Inter_400Regular' }}>{item.error_message}</Text> : null}
          {item.status === 'completed' && audioUrl ? (
            <>
              <BookingAudioPlayer audioUrl={audioUrl} colors={colors} />
              <DownloadLink url={audioUrl} colors={colors} />
            </>
          ) : item.status === 'processing' ? (
            <View style={s.processingRow}>
              <ActivityIndicator size="small" color="#B026FF" />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>Processing...</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ImgMusicCard({ item, colors }: { item: ImgMusicGen; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {item.image_url && (
        <TouchableOpacity onPress={() => setPreview(item.image_url!)}>
          <Image source={{ uri: item.image_url }} style={s.fullCardImg} resizeMode="cover" />
        </TouchableOpacity>
      )}
      <View style={{ padding: item.image_url ? 12 : 0 }}>
        <View style={!item.image_url ? s.cardRow : undefined}>
          {!item.image_url && (
            <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
              <Icon name="image" size={28} color={colors.mutedForeground} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={s.cardTop}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.genre} · {item.mood}</Text>
              <SmallStatusBadge status={item.status} colors={colors} />
            </View>
            {item.has_vocals && (
              <View style={[s.vocBadge, { borderColor: '#B026FF' }]}>
                <Text style={{ color: '#B026FF', fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>🎤 Vocals</Text>
              </View>
            )}
            {item.description ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text> : null}
            <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
            {item.amount_charged > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.amount_charged.toLocaleString('en-IN')}</Text>}
            {item.status === 'completed' && item.audio_url ? (
              <>
                <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
                <DownloadLink url={item.audio_url} colors={colors} />
              </>
            ) : null}
          </View>
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

export function TtsCard({ item, colors }: { item: TtsGen; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="volume-2" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.voice_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          {item.text ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={3}>{item.text}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function SfxCard({ item, colors }: { item: SfxGen; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="zap" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.description}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          {item.duration_seconds != null && (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>Duration: {item.duration_seconds}s</Text>
          )}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ConvertCard({ item, colors }: { item: VoiceConversion; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="mic" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.target_voice_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>File: {item.original_file_name}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function IsolateCard({ item, colors }: { item: AudioIsolation; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="volume-x" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.original_file_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}
