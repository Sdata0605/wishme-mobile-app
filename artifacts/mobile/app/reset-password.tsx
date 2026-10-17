import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { AuthBanner, AuthButton, AuthCard, AuthField, AuthHeader, AuthPage } from '@/components/auth/AuthUI';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

// Params come from app/+native-intent.tsx, which moves the Supabase link's #fragment into the query.
type Params = { access_token?: string; type?: string; error_description?: string; error_code?: string };

export default function ResetPasswordScreen() {
  const { neon } = useTheme();
  const { resetPasswordWithRecoveryToken } = useAuth();
  const params = useLocalSearchParams<Params>();
  const accessToken = params.type === 'recovery' && params.access_token ? params.access_token : null;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!accessToken) return;
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    const { error: apiErr } = await resetPasswordWithRecoveryToken(accessToken, password);
    setLoading(false);
    if (apiErr) { setError(apiErr); return; }
    setDone(true);
  };

  if (done) {
    return (
      <AuthPage>
        <AuthHeader icon="check-circle" title="Password updated" subtitle="Sign in with your new password." />
        <AuthButton label="Go to sign in" onPress={() => router.replace('/(auth)')} />
      </AuthPage>
    );
  }

  if (!accessToken) {
    const described = params.error_description?.replace(/\+/g, ' ').trim();
    const reason = described
      ? (/[.!?]$/.test(described) ? described : `${described}.`)
      : 'This reset link is invalid or has expired.';
    return (
      <AuthPage>
        <AuthHeader icon="alert-circle" title="Link expired" subtitle={`${reason} Request a new one from the sign-in screen.`} />
        <AuthButton label="Back to sign in" onPress={() => router.replace('/(auth)')} />
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthHeader icon="key" title="Set a new password" subtitle="Choose a new password for your account." />
      <AuthCard>
        <AuthField
          icon="lock"
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          right={(
            <Pressable onPress={() => setShowPw(!showPw)} hitSlop={8} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
              <Icon name={showPw ? 'eye-off' : 'eye'} size={20} color={neon.textLo} />
            </Pressable>
          )}
        />
        <AuthField
          icon="lock"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPw}
        />
        {error ? <AuthBanner>{error}</AuthBanner> : null}
        <AuthButton label="Update password" onPress={handleSubmit} loading={loading} />
      </AuthCard>
    </AuthPage>
  );
}
