import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthBanner, AuthButton, AuthCard, AuthHeader, AuthPage } from '@/components/auth/AuthUI';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/neon/Motion';
import { withAlpha } from '@/constants/neon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const RESEND_DELAY = 30;

export default function VerifyOtpScreen() {
  const { neon, isDark } = useTheme();
  const { verifyOtp, resendOtp, pendingSignup } = useAuth();
  const params = useLocalSearchParams<{ email?: string; firstName?: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(RESEND_DELAY);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
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
      if (error.toLowerCase().includes('expired') || error.toLowerCase().includes('start sign-up')) {
        setTimeout(() => router.back(), 2500);
      }
      return;
    }
    setVerified(true);
    setTimeout(() => router.replace('/select-plan?source=signup'), 1200);
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

  const resendWait = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  return (
    <AuthPage>
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}
        hitSlop={10}
        accessibilityLabel="Back"
      >
        <Icon name="arrow-left" size={20} color={neon.textHi} />
      </Pressable>

      <Reveal>
        <AuthHeader
          icon="mail"
          title="Verify your email"
          subtitle={
            <>
              Enter the 6-digit code we sent to{' '}
              <Text style={{ color: neon.textHi, fontFamily: 'Inter_600SemiBold' }}>{maskedEmail}</Text>.
            </>
          }
        />
      </Reveal>

      <Reveal delayMs={80}>
        <AuthCard>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { if (ref) inputRefs.current[i] = ref; }}
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: focusIdx === i && !otpError ? withAlpha(neon.cyan, 0.08) : isDark ? withAlpha(neon.bg, 0.6) : neon.surfaceHigh,
                    borderColor: otpError ? neon.error : focusIdx === i ? neon.cyan : digit ? neon.lineBright : neon.line,
                    borderWidth: (focusIdx === i && !otpError) || otpError ? 1.5 : 1,
                    color: neon.textHi,
                  },
                ]}
                value={digit}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                onFocus={() => setFocusIdx(i)}
                onBlur={() => setFocusIdx((f) => (f === i ? -1 : f))}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={i === 0}
                accessibilityLabel={`Digit ${i + 1} of 6`}
              />
            ))}
          </View>

          {verified && <AuthBanner tone="success">Email verified! Redirecting...</AuthBanner>}
          {resendSuccess && !verified && <AuthBanner tone="success">New code sent! Check your inbox.</AuthBanner>}
          {otpError && <AuthBanner>{otpError}</AuthBanner>}

          <AuthButton label="Verify email" onPress={handleVerify} loading={verifying} disabled={!allFilled || verified} style={{ marginTop: 18 }} />

          <Pressable
            onPress={handleResend}
            disabled={countdown > 0 || resendLoading || verified}
            style={styles.resendBtn}
            hitSlop={6}
          >
            {resendLoading ? <ActivityIndicator size="small" color={neon.cyan} /> : null}
            <Text style={[styles.resendText, { color: countdown > 0 || verified ? neon.textDim : neon.cyan }]}>
              {resendLoading ? 'Sending...' : countdown > 0 ? `Resend in ${resendWait}` : 'Resend code'}
            </Text>
          </Pressable>
        </AuthCard>
      </Reveal>

      <Reveal delayMs={160}>
        <Text style={[styles.note, { color: neon.textDim }]}>
          Check your spam folder if you don’t see the email. The code expires in 10 minutes.
        </Text>
      </Reveal>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: { flex: 1, minWidth: 0, height: 58, borderRadius: 14, fontSize: 24, fontFamily: 'Inter_700Bold', paddingHorizontal: 0 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 16, paddingBottom: 2 },
  resendText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  note: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 16, lineHeight: 18, textAlign: 'center' },
});
