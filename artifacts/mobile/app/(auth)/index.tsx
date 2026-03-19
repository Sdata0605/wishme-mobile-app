import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { Icon } from '@/components/Icon';

type Tab = 'signin' | 'signup' | 'celebrity';

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  error,
  rightElement,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  error?: string;
  rightElement?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[styles.inputRow, {
        backgroundColor: colors.input,
        borderColor: error ? colors.destructive : colors.border,
        borderWidth: 1.5,
      }]}>
        <Icon name={icon as any} size={18} color={colors.mutedForeground} />
        <TextInput
          style={[styles.input, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
        {rightElement}
      </View>
      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

function getPasswordStrength(pw: string) {
  let score = 0;
  const checks = {
    length: pw.length >= 12,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  score = Object.values(checks).filter(Boolean).length;
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

function SignInTab() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    await login(email, password);
    setLoading(false);
    router.replace('/(tabs)');
  };

  if (forgotMode) {
    return (
      <View>
        <TouchableOpacity onPress={() => setForgotMode(false)} style={styles.backRow}>
          <Icon name="arrow-left" size={18} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back to Sign In</Text>
        </TouchableOpacity>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Icon name="key" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reset Password</Text>
        {forgotSent ? (
          <View style={[styles.successBox, { backgroundColor: '#22C55E20' }]}>
            <Icon name="check-circle" size={22} color="#22C55E" />
            <Text style={[styles.successText, { color: '#22C55E' }]}>Reset Link Sent!</Text>
          </View>
        ) : (
          <>
            <InputField icon="mail" placeholder="Email address" value={forgotEmail} onChangeText={setForgotEmail} />
            <Pressable onPress={() => setForgotSent(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
                <Text style={styles.gradBtnText}>Send Reset Link</Text>
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
          <Text style={styles.gradBtnText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
        </LinearGradient>
      </Pressable>
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
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName) e.firstName = 'Required';
    if (!email || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email required';
    if (!phone || phone.length !== 10) e.phone = 'Enter 10-digit mobile number';
    if (!password || strength.score < 2) e.password = 'Password too weak';
    return e;
  };

  const handleSignup = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setLoading(true);
    await signup(email, password, firstName, lastName, phone, referral);
    setLoading(false);
    router.push('/(auth)/verify-otp');
  };

  return (
    <View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <InputField icon="users" placeholder="First Name" value={firstName} onChangeText={setFirstName} error={errors.firstName} />
        </View>
        <View style={{ flex: 1 }}>
          <InputField icon="users" placeholder="Last Name" value={lastName} onChangeText={setLastName} />
        </View>
      </View>
      <InputField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} />
      <InputField icon="phone" placeholder="10-digit mobile number" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" error={errors.phone} />
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
      {/* Generate password */}
      <TouchableOpacity onPress={() => setPassword(generatePassword())} style={[styles.genPwBtn, { borderColor: colors.border }]}>
        <Icon name="sparkles" size={14} color={colors.primary} />
        <Text style={[styles.genPwText, { color: colors.primary }]}>Generate Strong Password</Text>
      </TouchableOpacity>

      {/* Strength meter */}
      {password.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.strengthBars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[styles.strengthBar, {
                  backgroundColor: i <= strength.score ? strength.barColor : colors.muted,
                }]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.barColor }]}>{strength.label}</Text>
          <View style={styles.checks}>
            {Object.entries(strength.checks).map(([key, ok]) => (
              <View key={key} style={styles.checkRow}>
                <Icon name={ok ? 'check-circle' : 'circle'} size={12} color={ok ? '#22C55E' : colors.mutedForeground} />
                <Text style={[styles.checkText, { color: ok ? colors.foreground : colors.mutedForeground }]}>
                  {key === 'length' ? '12+ chars' : key === 'upper' ? 'Uppercase' : key === 'lower' ? 'Lowercase' : key === 'number' ? 'Number' : 'Special char'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <InputField icon="share-2" placeholder="Referral Code (optional)" value={referral} onChangeText={setReferral} />
      <Pressable onPress={handleSignup} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }]}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
          <Text style={styles.gradBtnText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function CelebrityTab() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');

  return (
    <View>
      <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15' }]}>
        <Icon name="sparkles" size={16} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.primary }]}>Join as a celebrity and earn by sharing your love</Text>
      </View>
      <InputField icon="users" placeholder="Full Name" value={name} onChangeText={setName} />
      <InputField icon="briefcase" placeholder="Category (Actor, Singer, Athlete...)" value={category} onChangeText={setCategory} />
      <View style={[styles.bioContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          style={[styles.bio, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
          placeholder="Your bio..."
          placeholderTextColor={colors.mutedForeground}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
        />
      </View>
      <InputField icon="share-2" placeholder="Instagram handle" value={instagram} onChangeText={setInstagram} />
      <Pressable onPress={() => {}} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
          <Text style={styles.gradBtnText}>Apply to Join</Text>
        </LinearGradient>
      </Pressable>
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#FF6B33', '#E8527A', '#B44CFF']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.appName}>WishMe</Text>
        <Text style={styles.heroTagline}>Celebrity Wishes for Every Occasion</Text>
      </View>

      {/* Card */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={[styles.card, { backgroundColor: colors.background }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tab switcher */}
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
            {activeTab === 'signin' && <SignInTab />}
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
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  infoText: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  bioContainer: { borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 14 },
  bio: { fontSize: 15, minHeight: 80 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 20 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12 },
  successText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
