import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

export default function VerifyOtpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(30);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otp.every((d) => d !== '')) {
      setVerified(true);
      setTimeout(() => router.replace('/(tabs)'), 1000);
    }
  }, [otp]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Icon name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
        <Icon name="mail-check" size={32} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>Verify your number</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Enter the 6-digit OTP sent to your mobile number
      </Text>

      {verified && (
        <View style={[styles.successBanner, { backgroundColor: '#22C55E20' }]}>
          <Icon name="check-circle" size={18} color="#22C55E" />
          <Text style={[styles.successText, { color: '#22C55E' }]}>Verified! Redirecting...</Text>
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
                borderColor: digit ? colors.primary : colors.border,
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
        onPress={() => {}}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        disabled={countdown > 0}
      >
        <Text style={[styles.resendText, { color: countdown > 0 ? colors.mutedForeground : colors.primary }]}>
          {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setVerified(true);
          setTimeout(() => router.replace('/(tabs)'), 1000);
        }}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 32, paddingHorizontal: 24 }]}
      >
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.verifyBtn}>
          <Text style={styles.verifyBtnText}>Verify & Continue</Text>
        </LinearGradient>
      </Pressable>
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
  resendText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  verifyBtn: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 },
  verifyBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16, alignSelf: 'stretch' },
  successText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
