import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { loadSavedVideoIds, markVideoSaved, saveVideoToLibrary, type SaveVideoInput } from '@/services/library';

/** Saves a delivered video into the Library. Once saved, the same button opens the Library. */
export function SaveToLibraryButton({ video }: { video: SaveVideoInput }) {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const profileId = user?.profileId ?? '';
  const token = session?.access_token ?? null;
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profileId || !token) return;
    let cancelled = false;
    loadSavedVideoIds(profileId, token).then(ids => { if (!cancelled) setSaved(ids.has(video.sourceId)); });
    return () => { cancelled = true; };
  }, [profileId, token, video.sourceId]);

  const onPress = async () => {
    if (saved) {
      router.push('/library' as never);
      return;
    }
    if (!profileId || !token || saving) return;
    setSaving(true);
    try {
      await saveVideoToLibrary(profileId, token, video);
      await markVideoSaved(video.sourceId);
      setSaved(true);
    } catch {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const tint = saved ? '#22C55E' : '#F59E0B';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.btn, { borderColor: tint, backgroundColor: tint + '18' }]}
    >
      {saving ? <ActivityIndicator size="small" color={tint} /> : <Icon name={saved ? 'check-circle' : 'star-outline'} size={16} color={tint} />}
      <Text style={[s.text, { color: saved ? '#22C55E' : colors.foreground }]}>
        {saved ? 'Saved to Library · View' : 'Save to Library'}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginTop: 10 },
  text: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
