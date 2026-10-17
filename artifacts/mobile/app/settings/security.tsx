import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const MIN_LENGTH = 8;

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[s.field, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.input, { color: colors.foreground }]}
          accessibilityLabel={label}
        />
        <TouchableOpacity onPress={onToggle} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
          <Icon name={show ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SecurityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!user?.email) return setError('Please log in again to change your password.');
    if (!current) return setError('Enter your current password.');
    if (next.length < MIN_LENGTH) return setError(`Your new password must be at least ${MIN_LENGTH} characters.`);
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('Choose a password different from your current one.');

    setBusy(true);
    try {
      // Supabase doesn't check the old password when updating, so verify it by signing in first.
      const check = await supabaseFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: user.email, password: current }),
      });
      if (!check.ok) {
        setError('Your current password is incorrect.');
        return;
      }
      const { access_token } = (await check.json()) as { access_token: string };

      const update = await supabaseFetch('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: next }) }, access_token);
      if (!update.ok) {
        setError(await parseApiError(update));
        return;
      }
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <SettingsHeader title="Password & security" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {done ? (
            <View style={[s.success, { backgroundColor: '#22C55E15', borderColor: '#22C55E' }]}>
              <Icon name="check-circle" size={40} color="#22C55E" />
              <Text style={[s.successTitle, { color: '#22C55E' }]}>Password changed</Text>
              <Text style={[s.successSub, { color: colors.mutedForeground }]}>Use your new password the next time you log in.</Text>
              <TouchableOpacity onPress={() => setDone(false)} style={{ marginTop: 14 }}>
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Change it again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[s.intro, { color: colors.mutedForeground }]}>
                Choose a strong password you don't use anywhere else. It must be at least {MIN_LENGTH} characters.
              </Text>
              <PasswordField label="Current password" value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} placeholder="Enter current password" />
              <PasswordField label="New password" value={next} onChange={setNext} show={showNext} onToggle={() => setShowNext((v) => !v)} placeholder="Enter new password" />
              <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} placeholder="Re-enter new password" />

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity onPress={submit} disabled={busy} activeOpacity={0.85} style={{ marginTop: 8 }}>
                <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
                  {busy ? <ActivityIndicator color="#fff" /> : null}
                  <Text style={s.btnText}>{busy ? 'Changing…' : 'Change password'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  intro: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 20 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, fontSize: 15.5, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  error: { color: '#EF4444', fontSize: 13.5, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  btn: { height: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16.5, fontFamily: 'Inter_700Bold' },
  success: { alignItems: 'center', padding: 28, borderRadius: 20, borderWidth: 1, gap: 8 },
  successTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  successSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
