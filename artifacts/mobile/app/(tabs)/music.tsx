import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { useVoices } from '@/hooks/useVoices';
import { useWallet } from '@/hooks/useWallet';
import { MUSIC_TABS, s } from '@/components/music/shared';
import type { MusicCtx } from '@/components/music/shared';
import { WalletCard } from '@/components/music/FormControls';
import { GenerateSongTab } from '@/components/music/GenerateSongTab';
import { TTSTab } from '@/components/music/TTSTab';
import { VoiceConversionTab } from '@/components/music/VoiceConversionTab';
import { SFXTab } from '@/components/music/SFXTab';
import { CloneTab } from '@/components/music/CloneTab';
import { IsolateTab } from '@/components/music/IsolateTab';
import { ImageMusicTab } from '@/components/music/ImageMusicTab';

export default function MusicScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const agentPrefill = useAgentPrefill();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { voices, loading: voicesLoading, refetch: refetchVoices } = useVoices();
  const { balance: walletBalance, profileId, refetch: refetchWallet } = useWallet();

  useEffect(() => {
    if (typeof agentPrefill.musicTab === 'number') {
      setActiveTab(agentPrefill.musicTab);
    }
  }, [agentPrefill.musicTab]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false }).catch(() => {});
    refetchVoices();
    refetchWallet();
  }, [refetchVoices, refetchWallet]);

  const ctx: MusicCtx = {
    voices,
    voicesLoading,
    walletBalance,
    refreshWallet: refetchWallet,
    session,
    profileId,
    onVoiceCloned: refetchVoices,
  };

  const TABS: React.ReactElement[] = [
    <GenerateSongTab ctx={ctx} />,
    <TTSTab ctx={ctx} />,
    <VoiceConversionTab ctx={ctx} />,
    <SFXTab ctx={ctx} />,
    <CloneTab ctx={ctx} />,
    <IsolateTab ctx={ctx} />,
    <ImageMusicTab ctx={ctx} />,
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[{ flex: 1 }, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#7C3AED', '#1F7BFF', '#D23FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: topPad + 12 }]}>
          <Text style={s.headerTagline}><Text style={s.headerTaglineItalic}>Your Symphony,{'\n'}Powered by AI.</Text></Text>
        </LinearGradient>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <WalletCard balance={walletBalance} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar} style={[s.tabBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {MUSIC_TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab.label}
              style={[s.tabPill, activeTab === i && s.tabPillActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.8}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={13} color={activeTab === i ? '#fff' : 'rgba(255,255,255,0.5)'} />
              <Text style={[s.tabPillText, { color: activeTab === i ? '#fff' : 'rgba(255,255,255,0.5)' }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {TABS[activeTab]}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
