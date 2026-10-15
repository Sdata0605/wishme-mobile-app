/** The celebrity booking card: status pipeline, signed video URL, parsed request message, order timeline. */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { SaveToLibraryButton } from '@/components/SaveToLibraryButton';
import { supabaseFetch } from '@/constants/supabase';
import { fmtDate, s } from './shared';
import type { Colors, CelebBooking } from './shared';
import { PulseStatusBadge, InlineCelebVideoPlayer } from './MediaBlocks';

function getCelebStatus(row: CelebBooking): { label: string; color: string; pulse: boolean } {
  if (row.status === 'cancelled') return { label: '❌ Cancelled', color: '#EF4444', pulse: false };
  if (row.video_status === 'failed' || row.generation_status === 'failed')
    return { label: '⚠️ Failed', color: '#EF4444', pulse: false };
  if (row.generation_status === 'timeout') return { label: '⚠️ Timed Out', color: '#F97316', pulse: false };
  if (row.status === 'completed') return { label: '✅ Completed', color: '#22C55E', pulse: false };
  if (row.status === 'video_sent' || row.status === 'sent')
    return { label: '📤 Delivered to You', color: '#22C55E', pulse: false };
  if (row.generation_status === 'completed' && row.video_status === 'ready')
    return { label: '🎥 Video Ready — Pending Admin Review', color: '#8B5CF6', pulse: false };
  if (row.generation_status === 'uploading')
    return { label: '⬆️ Uploading Video', color: '#3B82F6', pulse: true };
  if (row.generation_status === 'downloading')
    return { label: '⬇️ Processing Video', color: '#3B82F6', pulse: true };
  if (row.generation_status === 'video_generating')
    return { label: '🎬 Creating Video...', color: '#F59E0B', pulse: true };
  if (row.generation_status === 'script_generating')
    return { label: '🤖 Writing Script...', color: '#F59E0B', pulse: true };
  if (row.status === 'confirmed') return { label: '✅ Confirmed — In Queue', color: '#22C55E', pulse: false };
  return { label: '⏳ Awaiting Confirmation', color: '#F59E0B', pulse: false };
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  video_wish: 'Video Wish',
  voice_message: 'Voice Message',
  live_call: 'Live Call',
  personalized_song: 'Personalized Song',
  shoutout: 'Shoutout',
};

function useCelebSignedVideoUrl(row: CelebBooking, accessToken: string | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  useEffect(() => {
    const canShow =
      (row.status === 'video_sent' || row.status === 'sent' || row.status === 'completed') &&
      row.video_file_key;

    if (!canShow || !accessToken) {
      setSignedUrl(null);
      return;
    }

    let cancelled = false;
    setLoadingVideo(true);

    supabaseFetch(
      '/functions/v1/b2-get-signed-url',
      {
        method: 'POST',
        body: JSON.stringify({ fileKey: row.video_file_key }),
      },
      accessToken,
    )
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (!cancelled) setSignedUrl(data?.signedUrl ?? data?.url ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingVideo(false); });

    return () => { cancelled = true; };
  }, [row.id, row.status, row.video_file_key, accessToken]);

  return { signedUrl, loadingVideo };
}

function parseCelebMessage(msg: string | null): { recipientName?: string; occasion?: string; message?: string } {
  if (!msg) return {};
  try {
    const parsed = JSON.parse(msg);
    const rd = parsed?.requestDetails || parsed?.step1 || {};
    return {
      recipientName: rd.recipientName,
      occasion: rd.occasion,
      message: rd.message,
    };
  } catch {
    return { message: msg };
  }
}

function OrderTimeline({ row, colors }: { row: CelebBooking; colors: Colors }) {
  const gs = row.generation_status;
  const vs = row.video_status;
  const steps = [
    { label: 'Booking Placed', done: true },
    { label: 'Confirmed by Team', done: row.status !== 'pending' },
    { label: 'Script Generated', done: ['video_generating', 'downloading', 'uploading', 'completed'].includes(gs ?? '') },
    { label: 'Video Being Created', done: ['downloading', 'uploading', 'completed'].includes(gs ?? '') },
    { label: 'Video Ready', done: vs === 'ready' },
    { label: 'Delivered', done: ['video_sent', 'sent', 'completed'].includes(row.status) },
  ];
  return (
    <View style={s.timeline}>
      {steps.map((step, i) => (
        <View key={i} style={s.timelineStep}>
          <View style={s.timelineLeft}>
            <View style={[s.timelineDot, { backgroundColor: step.done ? '#22C55E' : colors.border }]}>
              {step.done && <Icon name="check" size={10} color="#fff" />}
            </View>
            {i < steps.length - 1 && (
              <View style={[s.timelineLine, { backgroundColor: steps[i + 1].done ? '#22C55E' : colors.border }]} />
            )}
          </View>
          <Text style={[s.timelineLabel, { color: step.done ? colors.foreground : colors.mutedForeground }]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function CelebCard({ item, colors, accessToken }: { item: CelebBooking; colors: Colors; accessToken: string | null }) {
  const { label, color, pulse } = getCelebStatus(item);
  const parsed = parseCelebMessage(item.message);
  const [showTimeline, setShowTimeline] = useState(false);
  const { signedUrl, loadingVideo } = useCelebSignedVideoUrl(item, accessToken);

  const serviceLabel = SERVICE_TYPE_LABELS[item.service_type] ?? item.service_type ?? null;

  const isVideoReady =
    (item.status === 'video_sent' || item.status === 'sent' || item.status === 'completed') &&
    item.video_file_key != null;

  const isUnderReview =
    item.status === 'confirmed' &&
    item.video_file_key != null &&
    item.video_status === 'ready';

  const isBeingCreated =
    item.status === 'confirmed' &&
    !isUnderReview;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="star" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.celebrities?.name ?? 'Celebrity'}
            </Text>
            <PulseStatusBadge label={label} color={color} pulse={pulse} />
          </View>
          {item.celebrities?.category ? (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.celebrities.category}</Text>
          ) : null}
          {serviceLabel ? (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{serviceLabel}</Text>
          ) : null}
          {parsed.occasion || parsed.recipientName ? (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {parsed.occasion}{parsed.recipientName ? ` for ${parsed.recipientName}` : ''}
            </Text>
          ) : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.final_price > 0 && (
            <Text style={[s.cardPrice, { color: '#7B5CFA' }]}>₹{item.final_price.toLocaleString('en-IN')}</Text>
          )}
          <Text style={[s.orderId, { color: colors.mutedForeground }]}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {isUnderReview && (
        <View style={[s.infoBox, { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: '#F59E0B' }]}>
          <Icon name="clock" size={14} color="#92400E" />
          <Text style={[s.infoBoxText, { color: '#92400E' }]}>Video Under Review — our team will send it to you shortly.</Text>
        </View>
      )}

      {isBeingCreated && (
        <View style={[s.infoBox, { backgroundColor: colors.border + '44', borderColor: colors.border }]}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={[s.infoBoxText, { color: colors.mutedForeground }]}>Video Being Created...</Text>
        </View>
      )}

      {isVideoReady && loadingVideo && (
        <View style={s.videoLoadingRow}>
          <ActivityIndicator size="small" color="#7B5CFA" />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>Loading video...</Text>
        </View>
      )}

      {isVideoReady && signedUrl && Platform.OS !== 'web' && (
        <InlineCelebVideoPlayer videoUri={signedUrl} colors={colors} />
      )}
      {isVideoReady && signedUrl && Platform.OS === 'web' && (
        <View style={[s.videoWrapper, { borderColor: colors.border }]}>
          <video src={signedUrl} controls style={{ width: '100%', borderRadius: 10 }} />
        </View>
      )}
      {isVideoReady && (
        <SaveToLibraryButton
          video={{
            sourceType: 'booking',
            sourceId: item.id,
            title: `${SERVICE_TYPE_LABELS[item.service_type] ?? 'Video'}${item.celebrities?.name ? ` · ${item.celebrities.name}` : ''}`,
            subtitle: parsed.recipientName ? `For ${parsed.recipientName}` : null,
            mediaUrl: item.video_url,
            fileKey: item.video_file_key,
            thumbnailUrl: item.celebrities?.image_url ?? null,
          }}
        />
      )}

      {item.status !== 'pending' && (
        <TouchableOpacity onPress={() => setShowTimeline(t => !t)} style={s.timelineToggle}>
          <Text style={{ color: '#7B5CFA', fontSize: 12, fontFamily: 'Inter_500Medium' }}>
            {showTimeline ? 'Hide Timeline' : 'Order Timeline'}
          </Text>
          <Icon name={showTimeline ? 'chevron-up' : 'chevron-down'} size={14} color="#7B5CFA" />
        </TouchableOpacity>
      )}
      {showTimeline && item.status !== 'pending' && <OrderTimeline row={item} colors={colors} />}
    </View>
  );
}
