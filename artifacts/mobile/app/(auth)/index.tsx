import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, type CelebrityApplyData } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Icon, type IconName } from '@/components/Icon';

type Tab = 'signin' | 'signup' | 'celebrity';

const CATEGORIES = [
  'Actor/Actress', 'Comedian', 'Musician', 'Influencer',
  'Athlete', 'Model', 'YouTuber', 'Podcaster',
];

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  error,
  rightElement,
  leftElement,
  multiline,
  numberOfLines,
}: {
  icon?: IconName;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[
        styles.inputRow,
        multiline && { height: undefined, paddingVertical: 12, alignItems: 'flex-start' },
        { backgroundColor: colors.input, borderColor: error ? colors.destructive : colors.border, borderWidth: 1.5 },
      ]}>
        {leftElement || (icon ? <Icon name={icon} size={18} color={colors.mutedForeground} /> : null)}
        <TextInput
          style={[
            styles.input,
            { color: colors.foreground, fontFamily: 'Inter_400Regular' },
            multiline && { height: undefined, minHeight: 80, textAlignVertical: 'top' },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {rightElement}
      </View>
      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: IconName; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionHeaderRow, { borderBottomColor: colors.border }]}>
      <Icon name={icon} size={16} color={colors.primary} />
      <Text style={[styles.sectionHeaderText, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

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
  const barColors = ['#ccc', '#EF4444', '#F59E0B', '#F59E0B', '#22C55E', '#22C55E'];
  return { score, label: labels[score] || '', barColor: barColors[score] || '#ccc', checks };
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

function SignInTab({ onSwitchToCelebrity }: { onSwitchToCelebrity: () => void }) {
  const { login, forgotPasswordByEmail, forgotPasswordByPhone } = useAuth();
  const { colors } = useTheme();
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
    const { error: apiErr } = await login(email, password);
    setLoading(false);
    if (apiErr) { setError(apiErr); return; }
    router.replace('/(tabs)');
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
        <TouchableOpacity onPress={() => { setForgotMode(false); setForgotSent(false); setForgotError(''); }} style={styles.backRow}>
          <Icon name="arrow-left" size={18} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Icon name="key" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reset Password</Text>

        {forgotSent ? (
          <View style={[styles.successBox, { backgroundColor: '#22C55E20', borderRadius: 14, padding: 20, alignItems: 'center' }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#22C55E20', marginBottom: 12 }]}>
              <Icon name="check-circle" size={28} color="#22C55E" />
            </View>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#22C55E', marginBottom: 6 }}>Reset Link Sent!</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
              {forgotMethod === 'email'
                ? `We've sent a reset link to ${forgotEmail || 'your email'}`
                : `We've sent a reset OTP to +91 ${forgotPhone}`}
            </Text>
          </View>
        ) : (
          <>
            {forgotError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '20' }]}>
                <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{forgotError}</Text>
              </View>
            ) : null}

            <View style={[styles.methodToggleRow, { backgroundColor: colors.muted }]}>
              {(['email', 'phone'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodBtn, forgotMethod === m && { backgroundColor: colors.card }]}
                  onPress={() => { setForgotMethod(m); setForgotError(''); }}
                >
                  <Icon name={m === 'email' ? 'mail' : 'phone'} size={15} color={forgotMethod === m ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.methodBtnText, { color: forgotMethod === m ? colors.primary : colors.mutedForeground, fontFamily: forgotMethod === m ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                    {m === 'email' ? 'Email' : 'Phone'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {forgotMethod === 'email' ? (
              <InputField icon="mail" placeholder="Email address" value={forgotEmail} onChangeText={setForgotEmail} keyboardType="email-address" />
            ) : (
              <>
                <InputField icon="phone" placeholder="Mobile number (e.g. 9876543210)" value={forgotPhone} onChangeText={(t) => setForgotPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" />
                <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                  We'll look up your email from your registered mobile number
                </Text>
              </>
            )}

            <Pressable onPress={handleForgotSend} disabled={forgotLoading} style={({ pressed }) => [{ opacity: pressed || forgotLoading ? 0.7 : 1 }]}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
                {forgotLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.gradBtnText}>{forgotMethod === 'email' ? 'Send Reset Link' : 'Send OTP'}</Text>
                }
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <View>
      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '20' }]}>
          <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : null}
      <InputField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <InputField
        icon="lock"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        rightElement={
          <TouchableOpacity onPress={() => setShowPw(!showPw)}>
            <Icon name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        }
      />
      <TouchableOpacity onPress={() => setForgotMode(true)} style={{ alignSelf: 'flex-end', marginBottom: 20 }}>
        <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
      </TouchableOpacity>
      <Pressable onPress={handleLogin} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }]}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.gradBtnText}>Sign In</Text>}
        </LinearGradient>
      </Pressable>

      <TouchableOpacity onPress={onSwitchToCelebrity} style={styles.celebLink}>
        <Icon name="star" size={14} color={colors.primary} />
        <Text style={[styles.celebLinkText, { color: colors.primary }]}>
          Are you a celebrity? <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Register here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SignUpTab() {
  const { signup } = useAuth();
  const { colors } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!phone.trim() || !validateIndianPhone(phone)) e.phone = 'Enter a valid Indian mobile number (e.g. 9876543210)';
    if (!password || strength.score < 5) e.password = 'Password must pass all 5 strength checks';
    return e;
  };

  const handleSignup = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    setApiError('');
    const { error } = await signup(email, password, firstName, lastName, phone, referral);
    setLoading(false);
    if (error) { setApiError(error); return; }
    router.push('/(auth)/verify-otp');
  };

  return (
    <View>
      {apiError ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '20' }]}>
          <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{apiError}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <InputField icon="user" placeholder="First Name" value={firstName} onChangeText={setFirstName} error={errors.firstName} />
        </View>
        <View style={{ flex: 1 }}>
          <InputField icon="user" placeholder="Last Name" value={lastName} onChangeText={setLastName} />
        </View>
      </View>
      <InputField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} />
      <InputField
        icon="phone"
        placeholder="Mobile number (e.g. 9876543210)"
        value={phone}
        onChangeText={(t) => setPhone(t.replace(/[\s\-]/g, '').slice(0, 13))}
        keyboardType="number-pad"
        error={errors.phone}
      />
      <InputField
        icon="lock"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        error={errors.password}
        rightElement={
          <TouchableOpacity onPress={() => setShowPw(!showPw)}>
            <Icon name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        }
      />
      <TouchableOpacity onPress={() => setPassword(generatePassword())} style={[styles.genPwBtn, { borderColor: colors.border }]}>
        <Icon name="sparkles" size={14} color={colors.primary} />
        <Text style={[styles.genPwText, { color: colors.primary }]}>Generate Strong Password</Text>
      </TouchableOpacity>

      {password.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.strengthBars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength.score ? strength.barColor : colors.muted }]} />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.barColor }]}>{strength.label}</Text>
          <View style={styles.checks}>
            {Object.entries(strength.checks).map(([key, ok]) => (
              <View key={key} style={styles.checkRow}>
                <Icon name={ok ? 'check-circle' : 'circle'} size={12} color={ok ? '#22C55E' : colors.mutedForeground} />
                <Text style={[styles.checkText, { color: ok ? colors.foreground : colors.mutedForeground }]}>
                  {key === 'length' ? '12+ characters' : key === 'upper' ? 'Uppercase letter' : key === 'lower' ? 'Lowercase letter' : key === 'number' ? 'Number' : 'Special character'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <InputField icon="share-2" placeholder="Referral Code (optional)" value={referral} onChangeText={setReferral} />
      <Pressable onPress={handleSignup} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }]}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.gradBtnText}>Continue to Verification</Text>}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function CategoryPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Select Category</Text>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pickerItem, selected === cat && { backgroundColor: colors.primary + '15' }]}
              onPress={() => { onSelect(cat); onClose(); }}
            >
              <Text style={[styles.pickerItemText, { color: selected === cat ? colors.primary : colors.foreground }]}>{cat}</Text>
              {selected === cat && <Icon name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

type AppStatus = 'pending' | 'approved' | 'rejected' | null;

function CelebrityTab() {
  const { colors } = useTheme();
  const { applyCelebrity, checkCelebrityStatus } = useAuth();

  const [appStatus, setAppStatus] = useState<AppStatus>(null);
  const [statusChecking, setStatusChecking] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [stageName, setStageName] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [achievements, setAchievements] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [twitter, setTwitter] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [backgroundAgreed, setBackgroundAgreed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => router.replace('/(tabs)'), 2000);
    return () => clearTimeout(timer);
  }, [submitted]);

  useEffect(() => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) return;
    const timer = setTimeout(async () => {
      setStatusChecking(true);
      const { status } = await checkCelebrityStatus(email);
      setStatusChecking(false);
      if (status) setAppStatus(status as AppStatus);
    }, 800);
    return () => clearTimeout(timer);
  }, [email, checkCelebrityStatus]);

  if (submitted) {
    return (
      <View style={[styles.statusCard, { backgroundColor: '#22C55E20' }]}>
        <View style={[styles.iconCircle, { backgroundColor: '#22C55E30', marginBottom: 12 }]}>
          <Icon name="check-circle" size={32} color="#22C55E" />
        </View>
        <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#22C55E', marginBottom: 8 }}>Application Submitted!</Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>
          Your application is under review. We'll notify you within 3–5 business days.
        </Text>
      </View>
    );
  }

  if (appStatus) {
    const STATUS_MAP = {
      pending: { color: '#F59E0B', icon: 'clock' as const, label: 'Under Review', msg: "Your application is currently under review. We'll notify you once it's processed." },
      approved: { color: '#22C55E', icon: 'check-circle' as const, label: 'Application Approved!', msg: "Congratulations! Your celebrity account is active. Sign in to access your dashboard." },
      rejected: { color: '#EF4444', icon: 'alert-circle' as const, label: 'Application Rejected', msg: "Your application did not meet our current requirements. You may reapply after 30 days." },
    };
    const s = STATUS_MAP[appStatus];
    return (
      <View>
        <View style={[styles.statusCard, { backgroundColor: s.color + '15' }]}>
          <View style={[styles.iconCircle, { backgroundColor: s.color + '25', marginBottom: 12 }]}>
            <Icon name={s.icon} size={32} color={s.color} />
          </View>
          <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: s.color, marginBottom: 8 }}>{s.label}</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>{s.msg}</Text>
        </View>
        <TouchableOpacity onPress={() => setAppStatus(null)} style={{ alignSelf: 'center', marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="edit-2" size={13} color={colors.mutedForeground} />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>Use a different account to apply</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email required';
    if (!category) e.category = 'Select a category';
    if (!termsAgreed) e.terms = 'You must agree to Terms of Service';
    if (!backgroundAgreed) e.background = 'You must consent to background verification';
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSubmitLoading(true);
    setSubmitError('');
    const payload: CelebrityApplyData = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      dob,
      stage_name: stageName,
      category,
      bio,
      achievements,
      instagram,
      youtube,
      twitter,
      portfolio,
    };
    const { error } = await applyCelebrity(payload);
    setSubmitLoading(false);
    if (error) { setSubmitError(error); return; }
    setSubmitted(true);
  };

  return (
    <View>
      <View style={[styles.heroBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
        <Text style={[styles.heroBannerTitle, { color: colors.foreground }]}>Join WishMe as a Celebrity</Text>
        <Text style={[styles.heroBannerSub, { color: colors.mutedForeground }]}>Share your talent and connect with fans across India</Text>
        <View style={styles.benefitCards}>
          {[
            { icon: 'trending-up' as const, title: 'Earn Extra Income', desc: 'Set your own rates and get paid for every wish' },
            { icon: 'heart' as const, title: 'Connect with Fans', desc: 'Build deeper bonds with your fan community' },
            { icon: 'clock' as const, title: 'Flexible Schedule', desc: 'Work on your own time, at your convenience' },
          ].map((b) => (
            <View key={b.title} style={[styles.benefitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.benefitIcon, { backgroundColor: colors.primary + '15' }]}>
                <Icon name={b.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.benefitTitle, { color: colors.foreground }]}>{b.title}</Text>
              <Text style={[styles.benefitDesc, { color: colors.mutedForeground }]}>{b.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {submitError ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '20' }]}>
          <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{submitError}</Text>
        </View>
      ) : null}

      <SectionHeader icon="user" title="Personal Information" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <InputField icon="user" placeholder="First Name" value={firstName} onChangeText={setFirstName} error={errors.firstName} />
        </View>
        <View style={{ flex: 1 }}>
          <InputField icon="user" placeholder="Last Name" value={lastName} onChangeText={setLastName} />
        </View>
      </View>
      <View style={{ position: 'relative' }}>
        <InputField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} />
        {statusChecking && (
          <ActivityIndicator size="small" color={colors.primary} style={{ position: 'absolute', right: 14, top: 14 }} />
        )}
      </View>
      <InputField icon="phone" placeholder="Mobile number" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" />
      <InputField icon="calendar" placeholder="Date of Birth (DD/MM/YYYY)" value={dob} onChangeText={setDob} />

      <SectionHeader icon="briefcase" title="Professional Details" />
      <InputField icon="star" placeholder="Stage Name / Screen Name" value={stageName} onChangeText={setStageName} />

      <TouchableOpacity
        style={[styles.inputRow, { backgroundColor: colors.input, borderColor: errors.category ? colors.destructive : colors.border, borderWidth: 1.5, marginBottom: 4 }]}
        onPress={() => setShowPicker(true)}
      >
        <Icon name="briefcase" size={18} color={colors.mutedForeground} />
        <Text style={[styles.input, { color: category ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 48 }]}>
          {category || 'Select Category'}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
      {errors.category ? <Text style={[styles.errorText, { color: colors.destructive, marginBottom: 10 }]}>{errors.category}</Text> : <View style={{ height: 14 }} />}

      <InputField placeholder="Professional Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} icon="edit-2" />
      <InputField placeholder="Key Achievements" value={achievements} onChangeText={setAchievements} multiline numberOfLines={3} icon="award" />

      <SectionHeader icon="share-2" title="Social Media" />
      <InputField
        placeholder="Instagram handle (@username)"
        value={instagram}
        onChangeText={setInstagram}
        leftElement={<View style={{ marginRight: 10 }}><Icon name="instagram" size={18} color="#E1306C" /></View>}
      />
      <InputField
        placeholder="YouTube channel URL"
        value={youtube}
        onChangeText={setYoutube}
        leftElement={<View style={{ marginRight: 10 }}><Icon name="youtube" size={18} color="#FF0000" /></View>}
      />
      <InputField
        placeholder="Twitter/X handle (@username)"
        value={twitter}
        onChangeText={setTwitter}
        leftElement={<View style={{ marginRight: 10 }}><Icon name="twitter" size={18} color="#1DA1F2" /></View>}
      />

      <View style={[styles.pricingNote, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
        <Icon name="trending-up" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.pricingNoteTitle, { color: colors.foreground }]}>Your Earning Potential</Text>
          <Text style={[styles.pricingNoteText, { color: colors.mutedForeground }]}>
            Set your own pricing for video wishes, voice calls, and live sessions. Top celebrities on WishMe earn ₹50,000+ monthly. You keep 80% of every booking.
          </Text>
        </View>
      </View>

      <SectionHeader icon="shield" title="Verification" />
      <InputField icon="link" placeholder="Portfolio / Website URL" value={portfolio} onChangeText={setPortfolio} keyboardType="url" />
      <View style={[styles.uploadBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <Icon name="upload" size={24} color={colors.mutedForeground} />
        <Text style={[styles.uploadText, { color: colors.mutedForeground }]}>Tap to upload Government ID</Text>
        <Text style={[styles.uploadSub, { color: colors.mutedForeground }]}>Aadhaar / PAN / Passport (JPG, PNG, PDF)</Text>
      </View>

      <SectionHeader icon="check-circle" title="Terms & Consent" />
      <TouchableOpacity style={styles.checkboxRow} onPress={() => setTermsAgreed(!termsAgreed)}>
        <View style={[styles.checkbox, { borderColor: termsAgreed ? colors.primary : colors.border, backgroundColor: termsAgreed ? colors.primary : 'transparent' }]}>
          {termsAgreed && <Icon name="check" size={12} color="#fff" />}
        </View>
        <Text style={[styles.checkboxText, { color: colors.foreground }]}>
          I agree to the <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Terms of Service</Text> and <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Creator Guidelines</Text>
        </Text>
      </TouchableOpacity>
      {errors.terms ? <Text style={[styles.errorText, { color: colors.destructive, marginBottom: 8 }]}>{errors.terms}</Text> : null}

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setBackgroundAgreed(!backgroundAgreed)}>
        <View style={[styles.checkbox, { borderColor: backgroundAgreed ? colors.primary : colors.border, backgroundColor: backgroundAgreed ? colors.primary : 'transparent' }]}>
          {backgroundAgreed && <Icon name="check" size={12} color="#fff" />}
        </View>
        <Text style={[styles.checkboxText, { color: colors.foreground }]}>
          I consent to <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>background verification</Text> as part of the onboarding process
        </Text>
      </TouchableOpacity>
      {errors.background ? <Text style={[styles.errorText, { color: colors.destructive, marginBottom: 8 }]}>{errors.background}</Text> : null}

      <Pressable onPress={handleSubmit} disabled={submitLoading} style={({ pressed }) => [{ opacity: pressed || submitLoading ? 0.7 : 1, marginTop: 16 }]}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
          {submitLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.gradBtnText}>Submit Application</Text>}
        </LinearGradient>
      </Pressable>

      <CategoryPickerModal
        visible={showPicker}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'signin', label: 'Sign In' },
  { key: 'signup', label: 'Sign Up' },
  { key: 'celebrity', label: 'Celebrity' },
];

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('signin');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#FF6B33', '#E8527A', '#B44CFF']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.hero}>
        <Text style={styles.appName}>WishMe</Text>
        <Text style={styles.heroTagline}>Celebrity Wishes for Every Occasion</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={[styles.card, { backgroundColor: colors.background }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.tabSwitcher, { backgroundColor: colors.muted }]}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabItem,
                  activeTab === tab.key && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabLabel, {
                  color: activeTab === tab.key ? colors.primary : colors.mutedForeground,
                  fontFamily: activeTab === tab.key ? 'Inter_600SemiBold' : 'Inter_400Regular',
                }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formArea}>
            {activeTab === 'signin' && <SignInTab onSwitchToCelebrity={() => setActiveTab('celebrity')} />}
            {activeTab === 'signup' && <SignUpTab />}
            {activeTab === 'celebrity' && <CelebrityTab />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 28, paddingVertical: 24, alignItems: 'center' },
  appName: { fontSize: 42, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', letterSpacing: 1 },
  heroTagline: { fontSize: 15, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  card: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  tabSwitcher: { flexDirection: 'row', margin: 20, borderRadius: 12, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabLabel: { fontSize: 13 },
  formArea: { paddingHorizontal: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, height: 48 },
  errorText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, marginLeft: 4 },
  errorBanner: { padding: 12, borderRadius: 10, marginBottom: 14 },
  errorBannerText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  forgotText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  gradBtn: {
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  gradBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', gap: 10 },
  genPwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  genPwText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  strengthBars: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  checks: { gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 20 },
  successBox: {},
  methodToggleRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  methodBtnText: { fontSize: 14 },
  helperText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12, marginLeft: 4, lineHeight: 18 },
  celebLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, paddingVertical: 8 },
  celebLinkText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottomWidth: 1, marginBottom: 16, marginTop: 8 },
  sectionHeaderText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  heroBanner: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  heroBannerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  heroBannerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 14, lineHeight: 19 },
  benefitCards: { flexDirection: 'row', gap: 8 },
  benefitCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  benefitIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  benefitTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 4 },
  benefitDesc: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 14 },
  pricingNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20, marginTop: 4 },
  pricingNoteTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  pricingNoteText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  uploadBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8, marginBottom: 20 },
  uploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  uploadSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  pickerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  pickerItemText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  statusCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 8 },
});
