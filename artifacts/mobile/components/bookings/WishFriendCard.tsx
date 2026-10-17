/** The Wish a Friend order card (video wish / UGC video) with signed-URL playback and library save. */
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
import type { Colors, WishFriendOrder } from './shared';
import { DownloadLink, ImagePreviewModal, InlineCelebVideoPlayer } from './MediaBlocks';

const WISH_FRIEND_STATUS: Record<WishFriendOrder['status'], { label: string; color: string }> = {
  pending: { label: 'Request received', color: '#F59E0B' },
  processing: { label: 'Being made', color: '#FF5F1F' },
  completed: { label: 'Delivered', color: '#22C55E' },
  rejected: { label: 'Rejected', color: '#EF4444' },
};

export function WishFriendCard({ item, colors, accessToken }: { item: WishFriendOrder; colors: Colors; accessToken: string | null }) {
  const status = WISH_FRIEND_STATUS[item.status] ?? WISH_FRIEND_STATUS.pending;
  const delivered = item.status === 'completed' && (item.video_file_key || item.video_url);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const typeLabel = item.order_type === 'ugc_video' ? 'UGC Video' : 'Video Wish + Card';
  const card = item.status === 'completed' && item.card_url ? item.card_url : null;

  // Prefer a signed URL (works whether or not the bucket is public); fall back to the stored URL.
  useEffect(() => {
    if (!delivered) { setVideoUri(null); return; }
    let cancelled = false;
    const fallback = item.video_url;
    if (!item.video_file_key || !accessToken) { setVideoUri(fallback); return; }
    supabaseFetch(
      '/functions/v1/b2-get-signed-url',
      { method: 'POST', body: JSON.stringify({ fileKey: item.video_file_key }) },
      accessToken,
    )
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setVideoUri(d?.signedUrl ?? d?.url ?? fallback); })
      .catch(() => { if (!cancelled) setVideoUri(fallback); });
    return () => { cancelled = true; };
  }, [delivered, item.video_file_key, item.video_url, accessToken]);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="video" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {typeLabel} · {item.celebrities?.name ?? 'Celebrity'}
            </Text>
            <View style={[s.statusBadge, { backgroundColor: status.color + '22' }]}>
              <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>For {item.recipient_name} · {item.occasion}</Text>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.prompt}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.price_paid > 0 && <Text style={[s.cardPrice, { color: '#B026FF' }]}>₹{item.price_paid.toLocaleString('en-IN')}</Text>}
          <Text style={[s.orderId, { color: colors.mutedForeground }]}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {(item.status === 'pending' || item.status === 'processing') && (
        <View style={[s.infoBox, { backgroundColor: colors.border + '44', borderColor: colors.border }]}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={[s.infoBoxText, { color: colors.mutedForeground }]}>
            {item.order_type === 'ugc_video'
              ? 'Our team is making your video. It will appear here when it is ready.'
              : 'Our team is making your video and signed card. Both will appear here when they are ready.'}
          </Text>
        </View>
      )}
      {item.status === 'rejected' && (
        <View style={[s.infoBox, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#EF4444' }]}>
          <Icon name="x" size={14} color="#991B1B" />
          <Text style={[s.infoBoxText, { color: '#991B1B' }]}>{item.admin_notes || 'We could not make this video. Please contact support for a refund.'}</Text>
        </View>
      )}
      {card ? (
        <View style={{ marginTop: 10 }}>
          <Text style={[s.cardSub, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>Signed card from {item.celebrities?.name ?? 'the celebrity'}</Text>
          <TouchableOpacity onPress={() => setPreview(card)} accessibilityRole="imagebutton" accessibilityLabel="Open the signed card">
            <Image source={{ uri: card }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, marginTop: 6, backgroundColor: colors.border }} resizeMode="cover" />
          </TouchableOpacity>
          <DownloadLink url={card} colors={colors} />
        </View>
      ) : null}
      {delivered && card ? (
        <Text style={[s.cardSub, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 10 }]}>Video message</Text>
      ) : null}
      {delivered && videoUri && Platform.OS !== 'web' && <InlineCelebVideoPlayer videoUri={videoUri} colors={colors} />}
      {delivered && videoUri && Platform.OS === 'web' && (
        <View style={[s.videoWrapper, { borderColor: colors.border }]}>
          <video src={videoUri} controls style={{ width: '100%', borderRadius: 10 }} />
        </View>
      )}
      {delivered && item.video_url ? <DownloadLink url={item.video_url} colors={colors} /> : null}
      {delivered && (
        <SaveToLibraryButton
          video={{
            sourceType: 'wish_friend',
            sourceId: item.id,
            title: `${typeLabel}${item.celebrities?.name ? ` · ${item.celebrities.name}` : ''}`,
            subtitle: `For ${item.recipient_name}`,
            mediaUrl: item.video_url,
            fileKey: item.video_file_key,
            thumbnailUrl: card ?? item.celebrities?.image_url ?? null,
          }}
        />
      )}
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}
