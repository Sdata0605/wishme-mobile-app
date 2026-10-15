import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SectionEmpty, LoadingBox, Card, SectionTitle, uploadToStorage, styles } from './shared';
import type { TabPropsWithRefresh } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';

interface MediaItem {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

export function ContentTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchMedia = useCallback(async () => {
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_media?celebrity_id=eq.${celebrity.id}&order=created_at.desc&limit=20`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as MediaItem[]; setMedia(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const changeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setUploading(true);
    try {
      const safeName = celebrity.name.replace(/\s+/g, '_').toLowerCase();
      const path = `${safeName}/avatar/${Date.now()}-avatar.jpg`;
      const url = await uploadToStorage('celebrity-avatars', path, result.assets[0].uri, 'image/jpeg', session.access_token);
      if (!url) { Alert.alert('Upload failed'); setUploading(false); return; }
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ image_url: url }) },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to update photo (${res.status})`);
      } else {
        Alert.alert('Profile photo updated!');
        onRefresh();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update photo');
    }
    setUploading(false);
  };

  const uploadPromo = async (mediaType: 'Images' | 'Videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'Images' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setUploading(true);
    try {
      const safeName = celebrity.name.replace(/\s+/g, '_').toLowerCase();
      const isVideo = mediaType === 'Videos';
      const path = `${safeName}/promotional/${isVideo ? 'video' : 'photo'}/${Date.now()}-promo.${isVideo ? 'mp4' : 'jpg'}`;
      const mime = isVideo ? 'video/mp4' : 'image/jpeg';
      const url = await uploadToStorage('promotional-content', path, result.assets[0].uri, mime, session.access_token);
      if (!url) { Alert.alert('Upload failed'); setUploading(false); return; }
      const res = await supabaseFetch(
        '/rest/v1/celebrity_media',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ celebrity_id: celebrity.id, media_url: url, media_type: isVideo ? 'video' : 'photo' }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to save media (${res.status})`);
      } else {
        Alert.alert('Promo media uploaded!');
        fetchMedia();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload media');
    }
    setUploading(false);
  };

  const avatarUri = celebrity.image_url
    ? celebrity.image_url.startsWith('http')
      ? celebrity.image_url
      : `https://f005.backblazeb2.com/file/wishmetoday/${celebrity.image_url}`
    : null;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="Profile Photo" colors={colors} />
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarLg} />
          ) : (
            <View style={[styles.avatarLg, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
              <Icon name="user" size={40} color={colors.mutedForeground} />
            </View>
          )}
          <TouchableOpacity onPress={changeAvatar} disabled={uploading} style={[styles.changePhotoBtn, { borderColor: '#7B5CFA' }]}>
            {uploading ? <ActivityIndicator size="small" color="#7B5CFA" /> : <Text style={{ color: '#7B5CFA', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Change Photo</Text>}
          </TouchableOpacity>
        </View>
      </Card>

      <SectionTitle text="Promo Media" colors={colors} />
      <View style={styles.rowBetween}>
        <TouchableOpacity onPress={() => uploadPromo('Images')} disabled={uploading} style={[styles.uploadBtn, { borderColor: colors.border, flex: 1, marginRight: 8 }]}>
          <Icon name="image" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6 }}>Upload Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => uploadPromo('Videos')} disabled={uploading} style={[styles.uploadBtn, { borderColor: colors.border, flex: 1 }]}>
          <Icon name="video" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6 }}>Upload Video</Text>
        </TouchableOpacity>
      </View>

      {loading ? <LoadingBox /> : media.length === 0 ? (
        <SectionEmpty icon="image" text="No promo media yet" colors={colors} />
      ) : (
        <View style={styles.mediaGrid}>
          {media.map(m => (
            <View key={m.id} style={[styles.mediaThumb, { backgroundColor: colors.card }]}>
              {m.media_type === 'video' ? (
                <View style={[{ flex: 1, backgroundColor: '#00000040', alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="play-circle" size={28} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: m.media_url }} style={styles.mediaThumb} resizeMode="cover" />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
