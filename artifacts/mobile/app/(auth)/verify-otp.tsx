import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const RESEND_DELAY = 30;

export default function VerifyOtpScreen() {
  const { colors } = useTheme();
  const { verifyOtp, resendOtp, pendingSignup } = useAuth();
  const params = useLocalSearchParams<{ email?: string; firstName?: string }>();
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(RESEND_DELAY);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpError(null);
    setResendSuccess(false);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const allFilled = otp.every((d) => d !== '');

  const handleVerify = async () => {
    if (!allFilled) return;
    setVerifying(true);
    setOtpError(null);
    const { error } = await verifyOtp(otp.join(''));
    setVerifying(false);
    if (error) {
      setOtpError(error);
      return;
    }
    setVerified(true);
    setTimeout(() => router.replace('/(tabs)'), 1200);
  };

  const handleResend = async () => {
    if (countdown > 0 || resendLoading) return;
    setResendLoading(true);
    setOtpError(null);
    setResendSuccess(false);
    const { error } = await resendOtp();
    setResendLoading(false);
    if (error) {
      setOtpError(error);
      return;
    }
    setOtp(['', '', '', '', '', '']);
    setCountdown(RESEND_DELAY);
    setResendSuccess(true);
    inputRefs.current[0]?.focus();
  };

  const rawEmail = pendingSignup?.email || params.email || '';
  const maskedEmail = rawEmail
    ? (() => {
        const [local, domain] = rawEmail.split('@');
        const visible = local.length > 3 ? local.slice(0, 3) + '***' : local.slice(0, 1) + '***';
        return `${visible}@${domain}`;
      })()
    : 'your email address';

  return (
    <View style={[styles.container, {
      backgroundColor: colors.background,
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 20,
    }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Icon name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
        <Icon name="mail" size={32} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>Verify Your Email</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{maskedEmail}</Text>
      </Text>

      {verified && (
        <View style={[styles.successBanner, { backgroundColor: '#22C55E20' }]}>
          <Icon name="check-circle" size={18} color="#22C55E" />
          <Text style={[styles.successText, { color: '#22C55E' }]}>Email verified! Redirecting...</Text>
        </View>
      )}

      {resendSuccess && !verified && (
        <View style={[styles.successBanner, { backgroundColor: '#22C55E20' }]}>
          <Icon name="check-circle" size={18} color="#22C55E" />
          <Text style={[styles.successText, { color: '#22C55E' }]}>New code sent! Check your inbox.</Text>
        </View>
      )}

      {otpError && (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '20' }]}>
          <Icon name="alert-circle" size={18} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{otpError}</Text>
        </View>
      )}

      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { if (ref) inputRefs.current[i] = ref; }}
            style={[
              styles.otpBox,
              {
                backgroundColor: colors.input,
                borderColor: otpError ? colors.destructive : digit ? colors.primary : colors.border,
                color: colors.foreground,
                fontFamily: 'Inter_700Bold',
              },
            ]}
            value={digit}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            autoFocus={i === 0}
          />
        ))}
      </View>

      <Pressable
        onPress={handleVerify}
        disabled={!allFilled || verifying || verified}
        style={({ pressed }) => [{ opacity: pressed || !allFilled || verifying || verified ? 0.6 : 1, marginTop: 8, paddingHorizontal: 24, alignSelf: 'stretch' }]}
      >
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.verifyBtn}
        >
          {verifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify Email</Text>
          )}
        </LinearGradient>
      </Pressable>

      <TouchableOpacity
        onPress={handleResend}
        disabled={countdown > 0 || resendLoading || verified}
        style={[styles.resendBtn, { opacity: countdown > 0 || resendLoading || verified ? 0.5 : 1 }]}
      >
        {resendLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="refresh-cw" size={14} color={countdown > 0 ? colors.mutedForeground : colors.primary} />
        )}
        <Text style={[styles.resendText, { color: countdown > 0 ? colors.mutedForeground : colors.primary }]}>
          {resendLoading
            ? 'Sending...'
            : countdown > 0
            ? `Resend code in ${countdown}s`
            : 'Resend Code'}
        </Text>
      </TouchableOpacity>

      <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
        <Icon name="info" size={14} color={colors.mutedForeground} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Check your spam folder if you don't see the email. The code expires in 10 minutes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  otpBox: { width: 44, height: 52, borderRadius: 12, borderWidth: 2, fontSize: 22 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  resendText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  verifyBtn: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  verifyBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16, alignSelf: 'stretch' },
  successText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16, alignSelf: 'stretch' },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, marginTop: 20, alignSelf: 'stretch' },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 18 },
});
