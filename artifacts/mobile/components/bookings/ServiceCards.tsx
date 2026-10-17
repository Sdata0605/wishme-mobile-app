/** Cards for celebrity wishes, greeting cards, photo wishes and voice calls. */
import React, { useState } from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { fmtDate, fmtDateLong, fmtTime, fmtDuration, SmallStatusBadge, s } from './shared';
import type { Colors, WishOrder, GreetingCard, PhotoWish, VoiceCall } from './shared';
import { DownloadLink, ImagePreviewModal } from './MediaBlocks';

export function WishCard({ item, colors }: { item: WishOrder; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  const imgUrl = item.generated_card_image_url ?? item.card_url;
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="heart" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.celebrities?.name ?? 'Celebrity Wish'}
            </Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.occasion_type} for {item.recipient_name}</Text>
          {item.message ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.message}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.amount_paid > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.amount_paid.toLocaleString('en-IN')}</Text>}
          {imgUrl ? (
            <TouchableOpacity onPress={() => setPreview(imgUrl)}>
              <Image source={{ uri: imgUrl }} style={s.cardImg} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

export function CardCard({ item, colors }: { item: GreetingCard; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  const cardTitle = [item.occasion_name, item.original_prompt].filter(Boolean).join(' - ');
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="gift" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{cardTitle || item.occasion_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>For {item.recipient_name}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.amount_charged > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.amount_charged.toLocaleString('en-IN')}</Text>}
          {item.generated_image_url ? (
            <TouchableOpacity onPress={() => setPreview(item.generated_image_url!)}>
              <Image source={{ uri: item.generated_image_url }} style={s.cardImg} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
          {item.status === 'completed' && item.generated_image_url ? (
            <DownloadLink url={item.generated_image_url} colors={colors} />
          ) : null}
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

export function PhotoCard({ item, colors }: { item: PhotoWish; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  const photoTitle = item.occasion_type ? `${item.occasion_type} Photo Wish` : 'Photo Wish';
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="image" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{photoTitle}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>For {item.recipient_name}</Text>
          {item.message ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.message}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.output_url ? (
            <TouchableOpacity onPress={() => setPreview(item.output_url!)}>
              <Image source={{ uri: item.output_url }} style={s.cardImg} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

export function CallCard({ item, colors }: { item: VoiceCall; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="phone" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.celebrities?.name ?? item.vapi_voice_name ?? 'AI Voice Call'}
            </Text>
            <SmallStatusBadge status={item.call_status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.occasion} for {item.recipient_name}</Text>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>From: {item.sender_name} → {item.recipient_phone}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.price_paid > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.price_paid.toLocaleString('en-IN')}</Text>}
        </View>
      </View>
      {item.scheduled_at && (
        <View style={[s.infoBox, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: '#3B82F6' }]}>
          <Icon name="calendar" size={14} color="#1D4ED8" />
          <Text style={[s.infoBoxText, { color: '#1D4ED8' }]}>
            Scheduled: {fmtDateLong(item.scheduled_at)} at {fmtTime(item.scheduled_at)}
          </Text>
        </View>
      )}
      {item.call_status === 'completed' && item.call_duration_seconds != null && (
        <Text style={[s.cardSub, { color: '#22C55E', marginTop: 6 }]}>Duration: {fmtDuration(item.call_duration_seconds)}</Text>
      )}
    </View>
  );
}
