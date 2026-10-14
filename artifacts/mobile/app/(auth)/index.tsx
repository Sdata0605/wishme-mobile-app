import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthBanner, AuthButton, AuthCard, AuthField, AuthHeader, AuthLink, AuthPage, AuthSegmented } from '@/components/auth/AuthUI';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/neon/Motion';
import { cardShadow, withAlpha } from '@/constants/neon';
import { supabaseFetch, warmUpBackend } from '@/constants/supabase';
import { useAuth, type Gender } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type Tab = 'signin' | 'signup' | 'celebrity';

function getPasswordStrength(pw: string) {
  const checks = {
    length: pw.length >= 12,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  return { score, label: labels[score] || '', checks };
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pw = '';
  for (let i = 0; i < 16; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function validateIndianPhone(raw: string) {
  const cleaned = raw.replace(/[\s\-]/g, '');
  return /^(\+91|91)?[6-9]\d{9}$/.test(cleaned);
}

function EyeToggle({ shown, onPress }: { shown: boolean; onPress: () => void }) {
  const { neon } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={shown ? 'Hide password' : 'Show password'}>
      <Icon name={shown ? 'eye-off' : 'eye'} size={20} color={neon.textLo} />
    </Pressable>
  );
}

function ConsentNote() {
  const { neon } = useTheme();
  return <Text style={[styles.consent, { color: neon.textDim }]}>By continuing you agree to WishMe’s Terms and Privacy Policy.</Text>;
}

function SignInTab({ onSwitchToCelebrity, onSwitchToSignUp }: { onSwitchToCelebrity: () => void; onSwitchToSignUp: () => void }) {
  const { login, forgotPasswordByEmail, forgotPasswordByPhone } = useAuth();
  const { neon } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'email' | 'phone'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    const { error: apiErr, role } = await login(email, password);
    setLoading(false);
    if (apiErr) { setError(apiErr); return; }
    if (role === 'celebrity') {
      router.replace('/celebrity-dashboard');
    } else {
      router.replace('/(tabs)/assistant' as never);
    }
  };

  const handleForgotSend = async () => {
    setForgotError('');
    if (forgotMethod === 'email') {
      if (!forgotEmail.trim() || !/\S+@\S+\.\S+/.test(forgotEmail)) {
        setForgotError('Enter a valid email address');
        return;
      }
      setForgotLoading(true);
      const { error: apiErr } = await forgotPasswordByEmail(forgotEmail.trim());
      setForgotLoading(false);
      if (apiErr) { setForgotError(apiErr); return; }
    } else {
      if (!forgotPhone || !validateIndianPhone(forgotPhone)) {
        setForgotError('Enter a valid Indian mobile number');
        return;
      }
      setForgotLoading(true);
      const { error: apiErr } = await forgotPasswordByPhone(forgotPhone);
      setForgotLoading(false);
      if (apiErr) { setForgotError(apiErr); return; }
    }
    setForgotSent(true);
  };

  if (forgotMode) {
    return (
      <View>
        <Pressable
          onPress={() => { setForgotMode(false); setForgotSent(false); setForgotError(''); }}
          style={styles.backRow}
          hitSlop={8}
        >
          <Icon name="arrow-left" size={18} color={neon.cyan} />
          <Text style={[styles.backText, { color: neon.cyan }]}>Back to sign in</Text>
        </Pressable>

        <AuthHeader icon="key" title="Reset your password" subtitle="We’ll send you a link or a code." />

        {forgotSent ? (
          <AuthCard style={{ backgroundColor: withAlpha(neon.success, 0.1), borderColor: withAlpha(neon.success, 0.3), alignItems: 'center', padding: 20 }}>
            <Icon name="check-circle" size={28} color={neon.success} />
            <Text style={[styles.sentTitle, { color: neon.success }]}>Reset link sent</Text>
            <Text style={[styles.sentBody, { color: neon.textLo }]}>
              {forgotMethod === 'email'
                ? `We’ve sent a reset link to ${forgotEmail || 'your email'}.`
                : `We’ve sent a reset OTP to +91 ${forgotPhone}.`}
            </Text>
          </AuthCard>
        ) : (
          <>
            <AuthSegmented
              value={forgotMethod}
              onChange={(m) => { setForgotMethod(m); setForgotError(''); }}
              options={[{ key: 'email', label: 'Email', icon: 'mail' }, { key: 'phone', label: 'Phone', icon: 'phone' }]}
            />

            {forgotMethod === 'email' ? (
              <AuthField icon="mail" placeholder="Email address" value={forgotEmail} onChangeText={setForgotEmail} keyboardType="email-address" />
            ) : (
              <>
                <AuthField
                  icon="phone"
                  placeholder="Mobile number (e.g. 9876543210)"
                  value={forgotPhone}
                  onChangeText={(t) => setForgotPhone(t.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                />
                <Text style={[styles.helper, { color: neon.textDim }]}>We’ll look up your email from your registered mobile number.</Text>
              </>
            )}

            {forgotError ? <AuthBanner>{forgotError}</AuthBanner> : null}
            <AuthButton label={forgotMethod === 'email' ? 'Send reset link' : 'Send OTP'} onPress={handleForgotSend} loading={forgotLoading} />
          </>
        )}
      </View>
    );
  }

  return (
    <View>
      <Reveal>
        <AuthHeader icon="sparkles" title="Welcome back" subtitle="Sign in to continue." />
      </Reveal>
      <Reveal delayMs={90}>
        <AuthField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <AuthField
          icon="lock"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          right={<EyeToggle shown={showPw} onPress={() => setShowPw(!showPw)} />}
        />
      </Reveal>
      <AuthLink align="right" onPress={() => setForgotMode(true)}>Forgot password?</AuthLink>
      {error ? <AuthBanner>{error}</AuthBanner> : null}
      <AuthButton label="Sign in" onPress={handleLogin} loading={loading} />
      <View style={{ height: 10 }} />
      <AuthLink onPress={onSwitchToSignUp}>New here? Create an account</AuthLink>
      <AuthLink tone="quiet" icon="star" onPress={onSwitchToCelebrity}>Are you a celebrity? Register here</AuthLink>
      <ConsentNote />
    </View>
  );
}

function SignUpTab({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const { signup } = useAuth();
  const { neon } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [referral, setReferral] = useState('');
  const [refState, setRefState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [refName, setRefName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const barColor = [neon.line, neon.error, neon.warning, neon.warning, neon.success, neon.success][strength.score];

  // Asks the server whether the referral code exists, so a typo is caught now and not silently ignored.
  const lookupReferral = useCallback(async (code: string): Promise<string | null> => {
    try {
      const res = await supabaseFetch('/rest/v1/rpc/validate_referral_code', { method: 'POST', body: JSON.stringify({ p_code: code }) });
      if (!res.ok) return null;
      const name = await res.json() as string | null;
      return name ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const code = referral.trim();
    if (code.length < 4) { setRefState('idle'); setRefName(''); return; }
    setRefState('checking');
    const t = setTimeout(async () => {
      const name = await lookupReferral(code);
      setRefName(name ?? '');
      setRefState(name ? 'valid' : 'invalid');
    }, 450);
    return () => clearTimeout(t);
  }, [referral, lookupReferral]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!gender) e.gender = 'Choose one so the assistant knows how to address you';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!phone.trim() || !validateIndianPhone(phone)) e.phone = 'Enter a valid Indian mobile number (e.g. 9876543210)';
    if (!password || strength.score < 5) e.password = 'Password must pass all 5 strength checks';
    if (referral.trim() && refState === 'invalid') e.referral = 'That referral code does not exist. Fix it or clear the box.';
    return e;
  };

  const handleSignup = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    setApiError('');
    const code = referral.trim().toUpperCase();
    if (code && refState !== 'valid') {
      // The check may not have finished yet; settle it before creating the account.
      const name = await lookupReferral(code);
      if (!name) {
        setLoading(false);
        setErrors({ referral: 'That referral code does not exist. Fix it or clear the box.' });
        return;
      }
    }
    const { error } = await signup(email, password, firstName, lastName, phone, code, gender ?? undefined);
    setLoading(false);
    if (error) { setApiError(error); return; }
    router.push({
      pathname: '/(auth)/verify-otp',
      params: { email, firstName, lastName, phone, referral: code },
    });
  };

  return (
    <View>
      <Reveal>
        <AuthHeader icon="sparkles" title="Create your account" subtitle="Celebrity wishes for every occasion." />
      </Reveal>

      <Reveal delayMs={90}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AuthField icon="user" placeholder="First name" value={firstName} onChangeText={setFirstName} error={errors.firstName} />
          </View>
          <View style={{ flex: 1 }}>
            <AuthField icon="user" placeholder="Last name" value={lastName} onChangeText={setLastName} />
          </View>
        </View>
        <Text style={[styles.genderLabel, { color: neon.textLo }]}>You are</Text>
        <AuthSegmented
          value={gender ?? ('' as Gender)}
          onChange={(g) => { setGender(g); setErrors((prev) => ({ ...prev, gender: '' })); }}
          options={[
            { key: 'male', label: 'Male' },
            { key: 'female', label: 'Female' },
            { key: 'other', label: 'Prefer not to say' },
          ]}
        />
        {errors.gender ? <Text style={[styles.genderError, { color: neon.error }]}>{errors.gender}</Text> : null}
        <Text style={[styles.genderHint, { color: neon.textDim }]}>Your assistant uses this to say “sir” or “ma’am”.</Text>
        <AuthField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} />
        <AuthField
          icon="phone"
          placeholder="Mobile number (e.g. 9876543210)"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[\s\-]/g, '').slice(0, 13))}
          keyboardType="number-pad"
          error={errors.phone}
        />
        <AuthField
          icon="lock"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          error={errors.password}
          right={<EyeToggle shown={showPw} onPress={() => setShowPw(!showPw)} />}
        />
      </Reveal>

      <Pressable
        onPress={() => setPassword(generatePassword())}
        style={[styles.chip, { backgroundColor: neon.surface, borderColor: neon.line }]}
      >
        <Icon name="sparkles" size={14} color={neon.cyan} />
        <Text style={[styles.chipText, { color: neon.cyan }]}>Generate strong password</Text>
      </Pressable>

      {password.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <View style={styles.strengthBars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength.score ? barColor : neon.surfaceHigh }]} />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: barColor }]}>{strength.label}</Text>
          <View style={styles.checks}>
            {Object.entries(strength.checks).map(([key, ok]) => (
              <View key={key} style={styles.checkRow}>
                <Icon name={ok ? 'check-circle' : 'circle'} size={13} color={ok ? neon.success : neon.textDim} />
                <Text style={[styles.checkText, { color: ok ? neon.success : neon.textLo }]}>
                  {key === 'length' ? '12+ characters' : key === 'upper' ? 'Uppercase letter' : key === 'lower' ? 'Lowercase letter' : key === 'number' ? 'Number' : 'Special character'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <AuthField
        icon="share-2"
        placeholder="Referral code (optional)"
        value={referral}
        onChangeText={t => { setReferral(t.toUpperCase().replace(/\s/g, '')); setErrors(prev => ({ ...prev, referral: '' })); }}
        error={errors.referral}
        right={refState === 'checking' ? <ActivityIndicator size="small" color={neon.cyan} /> : undefined}
      />
      {refState === 'valid' && !errors.referral ? (
        <Text style={{ color: neon.success, fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: -6, marginBottom: 10 }}>
          Code applied. You were invited by {refName}.
        </Text>
      ) : null}

      {apiError ? <AuthBanner>{apiError}</AuthBanner> : null}
      <AuthButton label="Continue to verification" onPress={handleSignup} loading={loading} />
      <View style={{ height: 10 }} />
      <AuthLink onPress={onSwitchToSignIn}>Already have an account? Sign in</AuthLink>
      <ConsentNote />
    </View>
  );
}

type StatusResult = 'pending' | 'approved' | 'rejected' | null;

function CelebrityTab({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const { neon, isDark } = useTheme();
  const { checkCelebrityStatus } = useAuth();

  const [showStatusCheck, setShowStatusCheck] = useState(false);
  const [statusEmail, setStatusEmail] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<StatusResult>(null);
  const [statusError, setStatusError] = useState('');

  const handleCheckStatus = async () => {
    if (!statusEmail.trim() || !/\S+@\S+\.\S+/.test(statusEmail)) {
      setStatusError('Please enter a valid email address');
      return;
    }
    setStatusError('');
    setStatusLoading(true);
    const { status } = await checkCelebrityStatus(statusEmail.trim());
    setStatusLoading(false);
    setStatusResult(status as StatusResult);
    if (!status) setStatusError('No application found for this email address.');
  };

  const STATUS_MAP: Record<string, { color: string; icon: 'clock' | 'check-circle' | 'alert-circle'; label: string; msg: string }> = {
    pending: { color: neon.warning, icon: 'clock', label: 'Under review', msg: 'Your application is currently under review. We’ll notify you once it’s processed.' },
    approved: { color: neon.success, icon: 'check-circle', label: 'Application approved', msg: 'Congratulations! Your celebrity account is active. Sign in to access your dashboard.' },
    rejected: { color: neon.error, icon: 'alert-circle', label: 'Application rejected', msg: 'Your application did not meet our current requirements. You may reapply after 30 days.' },
  };

  const benefits = [
    { icon: 'trending-up' as const, title: 'Earn extra income', desc: 'Set your own rates and get paid for every wish' },
    { icon: 'heart' as const, title: 'Connect with fans', desc: 'Build deeper bonds with your fan community' },
    { icon: 'clock' as const, title: 'Flexible schedule', desc: 'Work on your own time, at your convenience' },
  ];

  return (
    <View>
      <Reveal>
        <AuthHeader icon="star" title="Join as a celebrity" subtitle="Share your talent with fans across India." />
      </Reveal>

      <Reveal delayMs={90}>
        <View style={styles.benefitRow}>
          {benefits.map((b) => (
            <View key={b.title} style={[styles.benefitCard, { backgroundColor: neon.surface, borderColor: neon.line }, cardShadow(isDark)]}>
              <View style={[styles.benefitIcon, { backgroundColor: withAlpha(neon.violet, 0.15) }]}>
                <Icon name={b.icon} size={18} color={neon.violet} />
              </View>
              <Text style={[styles.benefitTitle, { color: neon.textHi }]}>{b.title}</Text>
              <Text style={[styles.benefitDesc, { color: neon.textLo }]}>{b.desc}</Text>
            </View>
          ))}
        </View>
      </Reveal>

      <AuthButton label="Register as celebrity" icon="star" onPress={() => router.push('/celebrity-signup' as never)} />

      <View style={{ height: 10 }} />
      <AuthLink
        tone="quiet"
        icon="search"
        onPress={() => { setShowStatusCheck(!showStatusCheck); setStatusResult(null); setStatusError(''); setStatusEmail(''); }}
      >
        Already applied? Check status
      </AuthLink>

      {showStatusCheck && (
        <AuthCard style={{ marginTop: 8 }}>
          <Text style={[styles.statusTitle, { color: neon.textHi }]}>Check application status</Text>
          <AuthField
            icon="mail"
            placeholder="Your application email"
            value={statusEmail}
            onChangeText={(t) => { setStatusEmail(t); setStatusResult(null); setStatusError(''); }}
            keyboardType="email-address"
            error={statusError && !statusResult ? statusError : undefined}
          />
          {statusResult ? (
            <View style={[styles.statusCard, { backgroundColor: withAlpha(STATUS_MAP[statusResult].color, 0.12) }]}>
              <Icon name={STATUS_MAP[statusResult].icon} size={24} color={STATUS_MAP[statusResult].color} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: STATUS_MAP[statusResult].color, marginBottom: 2 }}>
                  {STATUS_MAP[statusResult].label}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: neon.textLo, lineHeight: 17 }}>
                  {STATUS_MAP[statusResult].msg}
                </Text>
              </View>
            </View>
          ) : (
            <AuthButton label="Check status" onPress={handleCheckStatus} loading={statusLoading} style={{ marginTop: 6 }} />
          )}
        </AuthCard>
      )}

      <View style={{ height: 10 }} />
      <AuthLink onPress={onSwitchToSignIn}>Already have an account? Sign in</AuthLink>
    </View>
  );
}

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('signin');

  useEffect(() => { warmUpBackend(); }, []);

  return (
    <AuthPage>
      {activeTab === 'signin' && (
        <SignInTab onSwitchToCelebrity={() => setActiveTab('celebrity')} onSwitchToSignUp={() => setActiveTab('signup')} />
      )}
      {activeTab === 'signup' && <SignUpTab onSwitchToSignIn={() => setActiveTab('signin')} />}
      {activeTab === 'celebrity' && <CelebrityTab onSwitchToSignIn={() => setActiveTab('signin')} />}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  genderLabel: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', marginBottom: 8, marginLeft: 4 },
  genderError: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -8, marginBottom: 6, marginLeft: 4 },
  genderHint: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: -8, marginBottom: 14, marginLeft: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  helper: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -6, marginBottom: 4, marginLeft: 4, lineHeight: 18 },
  sentTitle: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 10, marginBottom: 6 },
  sentBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  consent: { fontSize: 11.5, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 18, lineHeight: 17 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 12 },
  chipText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  strengthBars: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  checks: { gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 11.5, fontFamily: 'Inter_400Regular' },
  benefitRow: { flexDirection: 'row', gap: 8 },
  benefitCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center' },
  benefitIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  benefitTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 4 },
  benefitDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 15 },
  statusTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, padding: 14, marginTop: 4 },
});
