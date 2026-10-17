/** Per-tab configuration: empty states, sidebar metadata and groups, loading skeleton, and the table/select each tab fetches. */
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { s } from './shared';
import type { Colors, BookingTab, TabDataKey } from './shared';

const EMPTY_CONFIG: Record<BookingTab, { icon: string; label: string; route: string; btnLabel: string }> = {
  Celebrity: { icon: 'star', label: 'No celebrity bookings yet', route: '/(tabs)', btnLabel: 'Book a Celebrity' },
  'Wish a Friend': { icon: 'video', label: 'No Wish a Friend orders yet', route: '/wish-friend', btnLabel: 'Wish a Friend' },
  Wishes: { icon: 'heart', label: 'No wishes yet', route: '/(tabs)', btnLabel: 'Send a Wish' },
  Cards: { icon: 'gift', label: 'No greeting cards yet', route: '/greeting-cards', btnLabel: 'Create a Card' },
  Photo: { icon: 'image', label: 'No photo wishes yet', route: '/photo-wish', btnLabel: 'Create Photo Wish' },
  Calls: { icon: 'phone', label: 'No celebrity calls yet', route: '/(tabs)', btnLabel: 'Book a Call' },
  Music: { icon: 'music', label: 'No music generated yet', route: '/(tabs)/music', btnLabel: 'Generate Music' },
  'Img+Music': { icon: 'image', label: 'No image+music yet', route: '/(tabs)/music', btnLabel: 'Create Img+Music' },
  TTS: { icon: 'volume-2', label: 'No text-to-speech yet', route: '/(tabs)/music', btnLabel: 'Create TTS' },
  SFX: { icon: 'zap', label: 'No sound effects yet', route: '/(tabs)/music', btnLabel: 'Generate SFX' },
  Convert: { icon: 'mic', label: 'No voice conversions yet', route: '/(tabs)/music', btnLabel: 'Convert Voice' },
  Isolate: { icon: 'volume-x', label: 'No audio isolations yet', route: '/(tabs)/music', btnLabel: 'Isolate Audio' },
};

export function EmptyState({ tab, colors }: { tab: BookingTab; colors: Colors }) {
  const cfg = EMPTY_CONFIG[tab];
  return (
    <View style={s.empty}>
      <Icon name={cfg.icon as any} size={52} color={colors.mutedForeground} />
      <Text style={[s.emptyTitle, { color: colors.foreground }]}>{cfg.label}</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={() => router.push(cfg.route as any)}>
        <Text style={s.emptyBtnText}>{cfg.btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const TAB_META: Record<BookingTab, { icon: IconName; label: string; title: string; description: string }> = {
  Celebrity: { icon: 'star', label: 'Celebrity', title: 'Celebrity bookings', description: 'Video messages from celebrities' },
  'Wish a Friend': { icon: 'heart', label: 'Wish a Friend', title: 'Wish a Friend orders', description: 'Video wishes and UGC videos' },
  Wishes: { icon: 'gift', label: 'Wishes', title: 'Celebrity wishes', description: 'Wish cards from celebrities' },
  Cards: { icon: 'mail', label: 'Greeting Cards', title: 'Greeting cards', description: 'Cards you created' },
  Photo: { icon: 'image', label: 'Photo Wishes', title: 'Photo wishes', description: 'Personalised photo wishes' },
  Calls: { icon: 'phone', label: 'Calls', title: 'Celebrity calls', description: 'Celebrity and AI voice calls' },
  Music: { icon: 'music', label: 'AI Music', title: 'AI music', description: 'Songs you generated' },
  'Img+Music': { icon: 'layers', label: 'Image + Music', title: 'Image + music', description: 'Image and music creations' },
  TTS: { icon: 'volume-2', label: 'Text to Speech', title: 'Text to speech', description: 'Voice from your text' },
  SFX: { icon: 'zap', label: 'Sound Effects', title: 'Sound effects', description: 'Generated sound effects' },
  Convert: { icon: 'mic', label: 'Voice Convert', title: 'Voice conversions', description: 'Voice changed to another' },
  Isolate: { icon: 'volume-x', label: 'Audio Isolate', title: 'Audio isolation', description: 'Clean voice from audio' },
};

export const SIDEBAR_GROUPS: { title: string; tabs: BookingTab[] }[] = [
  { title: 'Wishes & celebrities', tabs: ['Celebrity', 'Wish a Friend', 'Wishes', 'Calls'] },
  { title: 'Cards & photos', tabs: ['Cards', 'Photo'] },
  { title: 'AI music & audio', tabs: ['Music', 'Img+Music', 'TTS', 'SFX', 'Convert', 'Isolate'] },
];

export function SkeletonCards({ colors }: { colors: Colors }) {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <>
      {[0, 1, 2].map(i => (
        <Animated.View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: anim }]}>
          <View style={s.cardRow}>
            <View style={[s.thumb, { backgroundColor: colors.border }]} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ height: 12, width: '70%', borderRadius: 6, backgroundColor: colors.border }} />
              <View style={{ height: 10, width: '50%', borderRadius: 5, backgroundColor: colors.border }} />
              <View style={{ height: 10, width: '35%', borderRadius: 5, backgroundColor: colors.border }} />
            </View>
          </View>
        </Animated.View>
      ))}
    </>
  );
}

export const TAB_TO_TABLES: Record<BookingTab, { table: string; select: string; dataKey: TabDataKey }[]> = {
  Celebrity: [{ table: 'bookings', select: 'id,user_id,celebrity_id,service_type,status,generation_status,video_status,video_file_key,video_url,message,final_price,created_at,generation_error,celebrities:celebrity_id(name,image_url,category)', dataKey: 'celeb' }],
  'Wish a Friend': [{ table: 'wish_friend_orders', select: 'id,order_type,status,recipient_name,occasion,prompt,price_paid,video_url,video_file_key,card_url,card_text,admin_notes,created_at,celebrities:celebrity_id(name,image_url)', dataKey: 'wishFriend' }],
  Wishes: [{ table: 'wish_celebrity_orders', select: 'id,celebrity_id,occasion_type,recipient_name,message,amount_paid,status,generated_card_image_url,card_url,created_at,celebrities:celebrity_id(name,image_url)', dataKey: 'wishes' }],
  Cards: [{ table: 'greeting_card_generations', select: 'id,occasion_name,recipient_name,original_prompt,generated_image_url,amount_charged,status,created_at', dataKey: 'cards' }],
  Photo: [{ table: 'photo_wishes', select: 'id,occasion_type,recipient_name,message,output_url,credits_used,status,created_at', dataKey: 'photo' }],
  Calls: [{ table: 'voice_call_wishes', select: 'id,celebrity_id,recipient_name,recipient_phone,occasion,sender_name,call_status,scheduled_at,call_duration_seconds,price_paid,vapi_voice_name,created_at,celebrities:celebrity_id(name,image_url)', dataKey: 'calls' }],
  Music: [{ table: 'music_generations', select: 'id,title,genre,mood,lyrics,audio_url,credits_used,has_vocals,status,error_message,created_at', dataKey: 'music' }],
  'Img+Music': [{ table: 'image_music_generations', select: 'id,genre,mood,has_vocals,description,image_url,audio_url,amount_charged,status,created_at', dataKey: 'imgMusic' }],
  TTS: [{ table: 'tts_generations', select: 'id,text,voice_name,audio_url,credits_used,status,created_at', dataKey: 'tts' }],
  SFX: [{ table: 'sound_effect_generations', select: 'id,description,duration_seconds,audio_url,credits_used,status,created_at', dataKey: 'sfx' }],
  Convert: [{ table: 'voice_conversion_generations', select: 'id,target_voice_name,original_file_name,audio_url,credits_used,status,created_at', dataKey: 'convert' }],
  Isolate: [{ table: 'audio_isolation_generations', select: 'id,original_file_name,audio_url,credits_used,status,created_at', dataKey: 'isolate' }],
};

export const TABLE_TO_TAB: Record<string, BookingTab> = {
  bookings: 'Celebrity',
  wish_friend_orders: 'Wish a Friend',
  music_generations: 'Music',
};
