import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { TabPropsWithRefresh } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { uploadPhoto } from '@/services/uploadPhoto';
import { uploadVideo } from '@/services/uploadVideo';

interface MediaItem {
  id: string;
  title: string | null;
  media_type: string;
  file_url: string;
  created_at: string;
}

const MAX_PHOTOS_AT_ONCE = 5;

/**
 * The celebrity's profile photo and promo media. The photos uploaded here are what the AI looks at when a fan
 * generates a promotional image with this celebrity, so clear, well-lit photos of the face give the best likeness.
 */
export function ContentTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'avatar' | 'photo' | 'video'>(null);
  const token = session?.access_token ?? null;

  const fetchMedia = useCallback(async () => {
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_media?celebrity_id=eq.${celebrity.id}&select=id,title,media_type,file_url,created_at&order=created_at.desc&limit=60`,
        {},
        token,
      );
      if (res.ok) setMedia(((await res.json()) as MediaItem[]) ?? []);
    } catch { /* keep what is shown */ }
    setLoading(false);
  }, [celebrity.id, token]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const saveMediaRow = async (type: 'photo' | 'video', url: string, title: string) => {
    const res = await supabaseFetch(
      '/rest/v1/celebrity_media',
      {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({
          celebrity_id: celebrity.id,
          title,
          media_type: type,
          file_url: url,
          is_promotional: true,
          // Photos feed the AI that draws this celebrity in promotional images.
          is_avatar_content: type === 'photo',
          is_public: false,
        }),
      },
      token,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `Could not save the file (${res.status}).`);
    }
  };

  const changeAvatar = async () => {
    if (!token) { Alert.alert('Not signed in', 'Please sign in again.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;
    setBusy('avatar');
    try {
      const url = await uploadPhoto({ uri: result.assets[0].uri, bucket: 'celebrity-avatars', folder: celebrity.id, token });
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ image_url: url }) },
        token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Could not update the photo (${res.status}).`);
      }
      Alert.alert('Profile photo updated');
      onRefresh();
    } catch (err) {
      Alert.alert('Could not update the photo', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusy(null);
  };

  const uploadPhotos = async () => {
    if (!token) { Alert.alert('Not signed in', 'Please sign in again.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS_AT_ONCE,
    });
    if (result.canceled || result.assets.length === 0) return;
    setBusy('photo');
    let done = 0;
    let firstError = '';
    for (const asset of result.assets.slice(0, MAX_PHOTOS_AT_ONCE)) {
      try {
        const url = await uploadPhoto({ uri: asset.uri, bucket: 'promotional-content', folder: `${celebrity.id}/promotional`, token });
        await saveMediaRow('photo', url, asset.fileName ?? 'Promo photo');
        done += 1;
      } catch (err) {
        firstError = firstError || (err instanceof Error ? err.message : 'Upload failed.');
      }
    }
    setBusy(null);
    await fetchMedia();
    if (done > 0 && !firstError) Alert.alert(done === 1 ? 'Photo uploaded' : `${done} photos uploaded`, 'These now help create promotional images with you.');
    else if (done > 0) Alert.alert(`${done} uploaded, some failed`, firstError);
    else Alert.alert('Could not upload', firstError || 'Please try again.');
  };

  const uploadVideoFile = async () => {
    if (!token) { Alert.alert('Not signed in', 'Please sign in again.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7, videoMaxDuration: 60 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy('video');
    try {
      const url = await uploadVideo({ uri: asset.uri, bucket: 'promotional-content', folder: `${celebrity.id}/promotional`, token, sizeBytes: asset.fileSize, mimeType: asset.mimeType ?? 'video/mp4' });
      await saveMediaRow('video', url, asset.fileName ?? 'Promo video');
      await fetchMedia();
      Alert.alert('Video uploaded');
    } catch (err) {
      Alert.alert('Could not upload the video', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusy(null);
  };

  const remove = (item: MediaItem) => {
    Alert.alert('Remove this file?', 'It will no longer be used for your promotional images.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const res = await supabaseFetch(`/rest/v1/celebrity_media?id=eq.${item.id}`, { method: 'DELETE' }, token);
          if (res.ok) setMedia(prev => prev.filter(m => m.id !== item.id));
          else Alert.alert('Could not remove it', 'Please try again.');
        },
      },
    ]);
  };

  const avatarUri = celebrity.image_url
    ? celebrity.image_url.startsWith('http')
      ? celebrity.image_url
      : `https://f005.backblazeb2.com/file/wishmetoday/${celebrity.image_url}`
    : null;

  const photos = media.filter(m => m.media_type === 'photo');
  const videos = media.filter(m => m.media_type === 'video');

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="Profile Photo" colors={colors} />
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarLg} contentFit="cover" />
          ) : (
            <View style={[styles.avatarLg, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
              <Icon name="user" size={40} color={colors.mutedForeground} />
            </View>
          )}
          <TouchableOpacity onPress={changeAvatar} disabled={busy !== null} style={[styles.changePhotoBtn, { borderColor: '#FF6B33' }]}>
            {busy === 'avatar' ? <ActivityIndicator size="small" color="#FF6B33" /> : <Text style={{ color: '#FF6B33', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Change Photo</Text>}
          </TouchableOpacity>
        </View>
      </Card>

      <SectionTitle text="Promo Media" colors={colors} />
      <Card colors={colors}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Photos that make your promo images look like you</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          When a fan creates a promotional image with you, the AI looks at your photos here. Upload 3 to 5 clear photos of your face: good light, looking at the camera, no sunglasses or heavy filters.
        </Text>
        <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 }}>
          {photos.length === 0 ? 'No promo photos yet' : `${photos.length} promo ${photos.length === 1 ? 'photo' : 'photos'} in use`}
        </Text>
      </Card>

      <View style={[styles.rowBetween, { gap: 8 }]}>
        <TouchableOpacity onPress={uploadPhotos} disabled={busy !== null} style={[styles.uploadBtn, { borderColor: '#FF6B33', flex: 1, minHeight: 48, opacity: busy && busy !== 'photo' ? 0.5 : 1 }]}>
          {busy === 'photo' ? <ActivityIndicator size="small" color="#FF6B33" /> : <Icon name="image" size={16} color="#FF6B33" />}
          <Text style={{ color: '#FF6B33', fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 6 }}>{busy === 'photo' ? 'Uploading…' : 'Upload photos'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={uploadVideoFile} disabled={busy !== null} style={[styles.uploadBtn, { borderColor: colors.border, flex: 1, minHeight: 48, opacity: busy && busy !== 'video' ? 0.5 : 1 }]}>
          {busy === 'video' ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : <Icon name="video" size={16} color={colors.mutedForeground} />}
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 6 }}>{busy === 'video' ? 'Uploading…' : 'Upload video'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, marginBottom: 12 }}>
        Photos: up to {MAX_PHOTOS_AT_ONCE} at a time. Videos: up to 60 seconds and 50 MB.
      </Text>

      {loading ? <LoadingBox /> : media.length === 0 ? (
        <SectionEmpty icon="image" text="No promo media yet" colors={colors} />
      ) : (
        <>
          <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 8 }]}>{photos.length} photos · {videos.length} videos</Text>
          <View style={styles.mediaGrid}>
            {media.map(m => (
              <View key={m.id} style={[styles.mediaThumb, { backgroundColor: colors.card }]}>
                {m.media_type === 'video' ? (
                  <View style={{ flex: 1, backgroundColor: '#00000055', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="play-circle" size={28} color="#fff" />
                  </View>
                ) : (
                  <Image source={{ uri: m.file_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                )}
                <TouchableOpacity
                  onPress={() => remove(m)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this file"
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="x" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
