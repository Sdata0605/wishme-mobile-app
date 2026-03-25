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
import { useAuth } from '@/context/AuthContext';
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
    const { error: apiErr, role } = await login(email, password);
    setLoading(false);
    if (apiErr) { setError(apiErr); return; }
    if (role === 'celebrity') {
      router.replace('/celebrity-dashboard');
    } else {
      router.replace('/(tabs)');
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
    router.push({
      pathname: '/(auth)/verify-otp',
      params: { email, firstName, lastName, phone, referral: referral || '' },
    });
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

type StatusResult = 'pending' | 'approved' | 'rejected' | null;

function CelebrityTab({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const { colors } = useTheme();
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
    pending: { color: '#F59E0B', icon: 'clock', label: 'Under Review', msg: "Your application is currently under review. We'll notify you once it's processed." },
    approved: { color: '#22C55E', icon: 'check-circle', label: 'Application Approved!', msg: 'Congratulations! Your celebrity account is active. Sign in to access your dashboard.' },
    rejected: { color: '#EF4444', icon: 'alert-circle', label: 'Application Rejected', msg: 'Your application did not meet our current requirements. You may reapply after 30 days.' },
  };

  return (
    <View>
      <LinearGradient
        colors={['#FF6B33', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.celebHero}
      >
        <Icon name="star" size={36} color="#fff" />
        <Text style={styles.celebHeroTitle}>Join WishMe as a Celebrity</Text>
        <Text style={styles.celebHeroSub}>Share your talent and connect with fans across India</Text>
      </LinearGradient>

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

      <Pressable
        onPress={() => router.push('/celebrity-signup' as never)}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginTop: 8 }]}
      >
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradBtn}
        >
          <Icon name="star" size={18} color="#fff" />
          <Text style={[styles.gradBtnText, { marginLeft: 8 }]}>Register as Celebrity</Text>
        </LinearGradient>
      </Pressable>

      <TouchableOpacity
        onPress={() => { setShowStatusCheck(!showStatusCheck); setStatusResult(null); setStatusError(''); setStatusEmail(''); }}
        style={[styles.celebLink, { marginTop: 12 }]}
      >
        <Icon name="search" size={14} color={colors.mutedForeground} />
        <Text style={[styles.celebLinkText, { color: colors.mutedForeground }]}>
          Already applied? <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Check status</Text>
        </Text>
      </TouchableOpacity>

      {showStatusCheck && (
        <View style={[styles.statusCheckBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 12 }]}>
            Check Application Status
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: statusError && !statusResult ? colors.destructive : colors.border, borderWidth: 1.5, marginBottom: 8 }]}>
            <Icon name="mail" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
              placeholder="Your application email"
              placeholderTextColor={colors.mutedForeground}
              value={statusEmail}
              onChangeText={(t) => { setStatusEmail(t); setStatusResult(null); setStatusError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {statusError ? (
            <Text style={[styles.errorText, { color: colors.destructive, marginBottom: 8 }]}>{statusError}</Text>
          ) : null}
          {statusResult ? (
            <View style={[styles.statusCard, { backgroundColor: STATUS_MAP[statusResult].color + '15', marginTop: 8 }]}>
              <Icon name={STATUS_MAP[statusResult].icon} size={24} color={STATUS_MAP[statusResult].color} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: STATUS_MAP[statusResult].color, marginBottom: 2 }}>
                  {STATUS_MAP[statusResult].label}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, lineHeight: 17 }}>
                  {STATUS_MAP[statusResult].msg}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={handleCheckStatus}
              disabled={statusLoading}
              style={({ pressed }) => [{ opacity: pressed || statusLoading ? 0.7 : 1 }]}
            >
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.gradBtn, { height: 44 }]}>
                {statusLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.gradBtnText}>Check Status</Text>
                }
              </LinearGradient>
            </Pressable>
          )}
        </View>
      )}

      <TouchableOpacity onPress={onSwitchToSignIn} style={[styles.celebLink, { marginTop: 16 }]}>
        <Icon name="arrow-left" size={14} color={colors.mutedForeground} />
        <Text style={[styles.celebLinkText, { color: colors.mutedForeground }]}>
          Already have an account? <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Sign In</Text>
        </Text>
      </TouchableOpacity>
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
            {activeTab === 'celebrity' && <CelebrityTab onSwitchToSignIn={() => setActiveTab('signin')} />}
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
  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, padding: 14, marginTop: 4 },
  celebHero: { borderRadius: 20, padding: 24, alignItems: 'center', gap: 10, marginBottom: 20 },
  celebHeroTitle: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  celebHeroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  statusCheckBox: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 8 },
});
