import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBadge, Card, SectionTitle, PrimaryBtn, uploadToStorage, styles } from './shared';
import type { TabPropsWithRefresh } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';

export function ConsentTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [uploading, setUploading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    if (!result.canceled && result.assets[0]) setVideoUri(result.assets[0].uri);
  };

  const submitConsent = async () => {
    if (!photoUri || !videoUri) { Alert.alert('Please pick both a consent photo and video'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setUploading(true);
    try {
      const ts = Date.now();
      const photoPath = `${celebrity.id}/consent-photo-${ts}.jpg`;
      const videoPath = `${celebrity.id}/consent-video-${ts}.webm`;

      const [photoUrl, videoUrl] = await Promise.all([
        uploadToStorage('verification-docs', photoPath, photoUri, 'image/jpeg', session.access_token),
        uploadToStorage('verification-docs', videoPath, videoUri, 'video/webm', session.access_token),
      ]);

      if (!photoUrl || !videoUrl) { Alert.alert('Upload failed. Please try again.'); setUploading(false); return; }

      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ consent_photo_url: photoUrl, consent_video_url: videoUrl, consent_status: 'submitted', consent_given_at: new Date().toISOString() }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to submit consent (${res.status})`);
      } else {
        Alert.alert('Success', 'Consent submitted for review!');
        onRefresh();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit consent');
    }
    setUploading(false);
  };

  const status = celebrity.consent_status;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="Consent & Verification" colors={colors} />

      <Card colors={colors}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Consent Status</Text>
          <StatusBadge status={status || 'not_submitted'} />
        </View>
        {celebrity.consent_photo_url ? (
          <Image source={{ uri: celebrity.consent_photo_url }} style={styles.consentThumb} resizeMode="cover" />
        ) : null}
      </Card>

      {status !== 'submitted' && status !== 'approved' && (
        <Card colors={colors}>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Submit Consent</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
            By submitting this consent, I confirm that I am the person named in my celebrity profile, I agree to the WishMe terms of service, and I authorise WishMe to display my profile and facilitate bookings on my behalf.
          </Text>

          <TouchableOpacity onPress={pickPhoto} style={[styles.mediaPickBtn, { borderColor: photoUri ? '#22C55E' : colors.border }]}>
            <Icon name="camera" size={18} color={photoUri ? '#22C55E' : colors.mutedForeground} />
            <Text style={{ color: photoUri ? '#22C55E' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13, marginLeft: 8 }}>
              {photoUri ? 'Consent photo selected' : 'Pick Consent Photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={pickVideo} style={[styles.mediaPickBtn, { borderColor: videoUri ? '#22C55E' : colors.border, marginTop: 8 }]}>
            <Icon name="video" size={18} color={videoUri ? '#22C55E' : colors.mutedForeground} />
            <Text style={{ color: videoUri ? '#22C55E' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13, marginLeft: 8 }}>
              {videoUri ? 'Consent video selected' : 'Pick Consent Video'}
            </Text>
          </TouchableOpacity>

          <View style={{ marginTop: 16 }}>
            <PrimaryBtn label="Submit Consent" onPress={submitConsent} loading={uploading} colors={colors} />
          </View>
        </Card>
      )}
    </View>
  );
}
