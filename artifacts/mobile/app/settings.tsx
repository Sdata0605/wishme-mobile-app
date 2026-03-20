import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

type Tab = 'Profile' | 'Security';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [tab, setTab] = useState<Tab>('Profile');

  const [firstName, setFirstName] = useState('Rahul');
  const [lastName, setLastName] = useState('Kumar');
  const [email] = useState('rahul.kumar@gmail.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [profileSaved, setProfileSaved] = useState(false);
  const [photoToast, setPhotoToast] = useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const saveProfile = () => {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const changePassword = () => {
    setPwdSuccess(true);
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    setTimeout(() => setPwdSuccess(false), 3000);
  };

  const showPhotoToast = () => {
    setPhotoToast(true);
    setTimeout(() => setPhotoToast(false), 2000);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['Profile', 'Security'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)}>
            <Text style={[s.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>{t}</Text>
            {tab === t && <View style={[s.tabIndicator, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {tab === 'Profile' ? (
          <>
            {/* Avatar */}
            <View style={s.avatarSection}>
              <View style={[s.avatarCircle, { backgroundColor: colors.primary + '25' }]}>
                <Text style={[s.avatarInitials, { color: colors.primary }]}>{firstName[0]}{lastName[0]}</Text>
                <TouchableOpacity style={[s.cameraBtn, { backgroundColor: colors.primary }]} onPress={showPhotoToast}>
                  <Icon name="camera" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={[s.avatarHint, { color: colors.mutedForeground }]}>Tap camera to change photo</Text>
            </View>

            {/* First + Last name row */}
            <View style={s.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>First Name</Text>
                <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={firstName} onChangeText={setFirstName} placeholder="First" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>Last Name</Text>
                <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={lastName} onChangeText={setLastName} placeholder="Last" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>

            <Text style={[s.fieldLabel, { color: colors.foreground }]}>Email</Text>
            <View style={[s.input, s.disabledInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[s.disabledText, { color: colors.mutedForeground }]}>{email}</Text>
            </View>
            <Text style={[s.fieldHint, { color: colors.mutedForeground }]}>Email cannot be changed</Text>

            <Text style={[s.fieldLabel, { color: colors.foreground }]}>Phone</Text>
            <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]} value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />

            <TouchableOpacity onPress={saveProfile} style={{ marginTop: 8 }}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
                {profileSaved ? (
                  <Icon name="check-circle" size={20} color="#fff" />
                ) : null}
                <Text style={s.saveBtnText}>{profileSaved ? 'Saved!' : 'Save Changes'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {pwdSuccess ? (
              <View style={[s.successCard, { backgroundColor: '#22C55E15', borderColor: '#22C55E' }]}>
                <Icon name="check-circle" size={40} color="#22C55E" />
                <Text style={[s.successTitle, { color: '#22C55E' }]}>Password Changed!</Text>
                <Text style={[s.successSub, { color: colors.mutedForeground }]}>Your password has been updated successfully.</Text>
              </View>
            ) : (
              <>
                <Text style={[s.fieldLabel, { color: colors.foreground }]}>Current Password</Text>
                <View style={[s.pwdRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.pwdInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                    value={currentPwd}
                    onChangeText={setCurrentPwd}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showCurrent}
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(v => !v)}>
                    <Icon name={showCurrent ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <Text style={[s.fieldLabel, { color: colors.foreground }]}>New Password</Text>
                <View style={[s.pwdRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.pwdInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                    value={newPwd}
                    onChangeText={setNewPwd}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showNew}
                  />
                  <TouchableOpacity onPress={() => setShowNew(v => !v)}>
                    <Icon name={showNew ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <Text style={[s.fieldLabel, { color: colors.foreground }]}>Confirm Password</Text>
                <View style={[s.pwdRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.pwdInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
                    value={confirmPwd}
                    onChangeText={setConfirmPwd}
                    placeholder="Re-enter new password"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                    <Icon name={showConfirm ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={changePassword} style={{ marginTop: 8 }}>
                  <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
                    <Icon name="lock" size={18} color="#fff" />
                    <Text style={s.saveBtnText}>Change Password</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>

      {photoToast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>Photo upload coming soon</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabIndicator: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, borderRadius: 9999 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarInitials: { fontSize: 30, fontFamily: 'Inter_700Bold' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 8 },
  nameRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 6 },
  fieldHint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, marginBottom: 4 },
  input: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, height: 48, fontSize: 14, justifyContent: 'center' },
  disabledInput: { justifyContent: 'center' },
  disabledText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  saveBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  pwdRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, height: 48, gap: 8 },
  pwdInput: { flex: 1, fontSize: 14, height: 48 },
  successCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 32, gap: 12, marginTop: 20 },
  successTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  successSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  toast: { position: 'absolute', bottom: 80, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
