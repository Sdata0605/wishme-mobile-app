import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import type { CelebrityFormData } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface Category {
  id: string;
  name: string;
}

function getPasswordStrength(pw: string) {
  const checks = [
    pw.length >= 12,
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  return { checks, score: checks.filter(Boolean).length };
}

const CHECK_LABELS = ['Min. 12 characters', 'Uppercase letter', 'Lowercase letter', 'Number', 'Special character'];
const STRENGTH_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#22C55E'];

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#!$%&*';
  const all = upper + lower + digits + special;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = rand(upper) + rand(lower) + rand(digits) + rand(special);
  for (let i = 0; i < 12; i++) pw += rand(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

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
  autoCapitalize,
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
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={[
          cs.inputRow,
          multiline && { height: undefined, paddingVertical: 12, alignItems: 'flex-start' },
          { backgroundColor: colors.input, borderColor: error ? colors.destructive : colors.border, borderWidth: 1.5 },
        ]}
      >
        {leftElement || (icon ? <Icon name={icon} size={18} color={colors.mutedForeground} /> : null)}
        <TextInput
          style={[
            cs.input,
            { color: colors.foreground, fontFamily: 'Inter_400Regular' },
            multiline && { height: undefined, minHeight: 80, textAlignVertical: 'top' },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {rightElement}
      </View>
      {error ? <Text style={[cs.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: IconName; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[cs.sectionRow, { borderBottomColor: colors.border }]}>
      <Icon name={icon} size={16} color={colors.primary} />
      <Text style={[cs.sectionText, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

function CategoryModal({
  visible,
  selected,
  categories,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  categories: Category[];
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={cs.modalOverlay} onPress={onClose}>
        <View style={[cs.pickerSheet, { backgroundColor: colors.card }]}>
          <Text style={[cs.pickerTitle, { color: colors.foreground }]}>Select Category</Text>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[cs.pickerItem, selected === cat.name && { backgroundColor: colors.primary + '15' }]}
                onPress={() => { onSelect(cat.name); onClose(); }}
              >
                <Text style={[cs.pickerItemText, { color: selected === cat.name ? colors.primary : colors.foreground }]}>
                  {cat.name}
                </Text>
                {selected === cat.name && <Icon name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function CelebritySignupScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const scrollRef = useRef<ScrollView>(null);
  const { sendCelebOtp, applyCelebrityWithAuth, checkCelebrityStatus } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  const [step, setStep] = useState<'form' | 'otp'>('form');
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
  const [portfolioLink, setPortfolioLink] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [backgroundAgreed, setBackgroundAgreed] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [otp, setOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const strength = getPasswordStrength(password);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/celebrity_categories?select=id,name&is_active=eq.true&order=name.asc',
        {},
        null,
      );
      if (res.ok) {
        const data = await res.json() as Category[];
        setCategories(data);
      }
    } catch {}
    setCatLoading(false);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email is required';
    if (!phone.trim()) e.phone = 'Phone number is required';
    if (!stageName.trim()) e.stageName = 'Stage name is required';
    if (!category) e.category = 'Please select a category';
    if (!bio.trim()) e.bio = 'Professional bio is required';
    if (!password) e.password = 'Password is required';
    else if (strength.score < 5) e.password = 'Password must pass all 5 strength checks';
    if (password !== confirmPw) e.confirmPw = 'Passwords do not match';
    if (!termsAgreed) e.terms = 'You must agree to the Terms of Service';
    if (!backgroundAgreed) e.background = 'You must consent to background verification';
    return e;
  };

  const handleContinue = async () => {
    setSubmitError('');
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});
    setLoading(true);

    const { status: existingStatus } = await checkCelebrityStatus(email.trim().toLowerCase());
    if (existingStatus) {
      setLoading(false);
      const msgs: Record<string, string> = {
        pending: 'You already have a pending application under review. Our team will contact you within 3–5 business days.',
        approved: 'An account already exists for this email. Please sign in to access your celebrity dashboard.',
        rejected: 'A previous application for this email was rejected. Please contact support to appeal.',
      };
      setSubmitError(msgs[existingStatus] ?? 'An application already exists for this email address.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const { error } = await sendCelebOtp(email.trim().toLowerCase());
    setLoading(false);
    if (error) {
      setSubmitError(error);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setOtp('');
    setResendCountdown(30);
    setStep('otp');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setSubmitError('');
    setLoading(true);
    const { error } = await sendCelebOtp(email.trim().toLowerCase());
    setLoading(false);
    if (error) { setSubmitError(error); return; }
    setResendCountdown(30);
  };

  const handleVerify = async () => {
    setSubmitError('');
    if (otp.length < 6) { setSubmitError('Please enter the 6-digit code.'); return; }
    setLoading(true);

    const formData: CelebrityFormData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      date_of_birth: dob.trim() || null,
      stage_name: stageName.trim(),
      category,
      bio: bio.trim(),
      achievements: achievements.trim(),
      portfolio_link: portfolioLink.trim() || null,
      social_media: {
        instagram: instagram.trim(),
        youtube: youtube.trim(),
        twitter: twitter.trim(),
        tiktok: '',
        facebook: '',
        linkedin: '',
        website: '',
        other: '',
      },
    };

    const { error } = await applyCelebrityWithAuth(formData, password, otp.trim());
    setLoading(false);
    if (error) { setSubmitError(error); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={[cs.container, { backgroundColor: colors.background }]}>
        <View style={[cs.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <View style={{ width: 22 }} />
          <Text style={[cs.headerTitle, { color: colors.foreground }]}>Celebrity Registration</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20 }}>
          <LinearGradient
            colors={['#22C55E20', '#22C55E10']}
            style={[cs.successCard, { borderColor: '#22C55E40' }]}
          >
            <View style={[cs.successIconCircle, { backgroundColor: '#22C55E25' }]}>
              <Icon name="check-circle" size={48} color="#22C55E" />
            </View>
            <Text style={[cs.successTitle, { color: '#22C55E' }]}>Application Submitted!</Text>
            <Text style={[cs.successSub, { color: colors.mutedForeground }]}>
              Your account has been created and your application is under review. Our team will verify your details within 3–5 business days.
            </Text>
          </LinearGradient>
          <TouchableOpacity
            style={[cs.backBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)' as never)}
          >
            <Text style={cs.backBtnText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'otp') {
    return (
      <View style={[cs.container, { backgroundColor: colors.background }]}>
        <View style={[cs.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { setStep('form'); setSubmitError(''); }}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[cs.headerTitle, { color: colors.foreground }]}>Verify Email</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 12 }}>
            <LinearGradient
              colors={['#B026FF', '#FF5F1F']}
              style={[cs.otpIconCircle]}
            >
              <Icon name="mail" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[cs.otpTitle, { color: colors.foreground }]}>Check Your Email</Text>
            <Text style={[cs.otpSub, { color: colors.mutedForeground }]}>
              We sent a 6-digit verification code to{'\n'}
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>{email}</Text>
            </Text>
            <TouchableOpacity onPress={() => { setStep('form'); setSubmitError(''); }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', textDecorationLine: 'underline' }}>
                Change email address
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[cs.otpBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[cs.otpLabel, { color: colors.foreground }]}>Enter 6-digit code</Text>
            <TextInput
              style={[cs.otpInput, { backgroundColor: colors.input, borderColor: submitError ? colors.destructive : colors.border, color: colors.foreground }]}
              value={otp}
              onChangeText={(t) => { setOtp(t.replace(/\D/g, '').slice(0, 6)); setSubmitError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
            />
            {submitError ? (
              <View style={[cs.errorBannerSmall, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive + '40' }]}>
                <Icon name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[cs.errorBannerText, { color: colors.destructive }]}>{submitError}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleVerify}
              disabled={loading || otp.length < 6}
              style={({ pressed }) => [{ opacity: pressed || loading || otp.length < 6 ? 0.7 : 1, marginTop: 16 }]}
            >
              <LinearGradient
                colors={['#B026FF', '#FF5F1F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={cs.gradBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={cs.gradBtnText}>Verify & Create Account</Text>
                )}
              </LinearGradient>
            </Pressable>

            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCountdown > 0 || loading}
              style={[cs.resendBtn, { opacity: resendCountdown > 0 ? 0.5 : 1 }]}
            >
              <Icon name="refresh-cw" size={14} color={colors.mutedForeground} />
              <Text style={[cs.resendText, { color: colors.mutedForeground }]}>
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[cs.note, { color: colors.mutedForeground, marginTop: 24 }]}>
            After verification, your Supabase account will be created with the role celebrity_pending. Our team will approve your application within 3–5 business days.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[cs.container, { backgroundColor: colors.background }]}>
      <View style={[cs.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[cs.headerTitle, { color: colors.foreground }]}>Celebrity Registration</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#B026FF', '#FF5F1F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cs.heroBanner}
        >
          <Icon name="star" size={32} color="#fff" />
          <Text style={cs.heroTitle}>Join WishMe as a Celebrity</Text>
          <Text style={cs.heroSub}>Share your talent and connect with fans across India</Text>
          <View style={cs.benefitRow}>
            {[
              { icon: 'trending-up' as const, label: 'Earn Income' },
              { icon: 'heart' as const, label: 'Connect with Fans' },
              { icon: 'clock' as const, label: 'Flexible Schedule' },
            ].map((b) => (
              <View key={b.label} style={cs.benefitPill}>
                <Icon name={b.icon} size={12} color="#fff" />
                <Text style={cs.benefitLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {submitError ? (
          <View style={[cs.errorBanner, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive + '40' }]}>
            <Icon name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[cs.errorBannerText, { color: colors.destructive }]}>{submitError}</Text>
          </View>
        ) : null}

        <SectionHeader icon="user" title="Personal Information" />

        <View style={cs.row}>
          <View style={{ flex: 1 }}>
            <InputField icon="user" placeholder="First Name" value={firstName} onChangeText={setFirstName} error={errors.firstName} autoCapitalize="words" />
          </View>
          <View style={{ flex: 1 }}>
            <InputField icon="user" placeholder="Last Name" value={lastName} onChangeText={setLastName} error={errors.lastName} autoCapitalize="words" />
          </View>
        </View>
        <InputField icon="mail" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" error={errors.email} />
        <InputField
          icon="phone"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^\d\s\+\-]/g, '').slice(0, 15))}
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <InputField icon="calendar" placeholder="Date of Birth (DD/MM/YYYY)" value={dob} onChangeText={setDob} />

        <SectionHeader icon="lock" title="Create Password" />

        <InputField
          icon="lock"
          placeholder="Create Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          error={errors.password}
          rightElement={
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Icon name={showPw ? 'eye' : 'eye-off'} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          }
        />

        {password.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <View style={cs.strengthBars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    cs.strengthBar,
                    { backgroundColor: i < strength.score ? STRENGTH_COLORS[strength.score - 1] : colors.muted },
                  ]}
                />
              ))}
            </View>
            <Text style={[cs.strengthLabel, { color: strength.score < 3 ? colors.destructive : strength.score < 5 ? '#F59E0B' : '#22C55E' }]}>
              {['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][strength.score]}
            </Text>
            <View style={cs.checks}>
              {CHECK_LABELS.map((label, i) => (
                <View key={label} style={cs.checkRow}>
                  <Icon name={strength.checks[i] ? 'check-circle' : 'circle'} size={13} color={strength.checks[i] ? '#22C55E' : colors.mutedForeground} />
                  <Text style={[cs.checkText, { color: strength.checks[i] ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[cs.genPwBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
          onPress={() => { const p = generatePassword(); setPassword(p); setConfirmPw(p); }}
        >
          <Icon name="sparkles" size={14} color={colors.primary} />
          <Text style={[cs.genPwText, { color: colors.primary }]}>Generate Strong Password</Text>
        </TouchableOpacity>

        <InputField
          icon="lock"
          placeholder="Confirm Password"
          value={confirmPw}
          onChangeText={setConfirmPw}
          secureTextEntry={!showConfirmPw}
          error={errors.confirmPw}
          rightElement={
            <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)}>
              <Icon name={showConfirmPw ? 'eye' : 'eye-off'} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          }
        />

        <SectionHeader icon="briefcase" title="Professional Details" />

        <InputField icon="star" placeholder="Stage Name / Screen Name" value={stageName} onChangeText={setStageName} error={errors.stageName} autoCapitalize="words" />

        {catLoading ? (
          <View style={[cs.inputRow, { backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1.5, marginBottom: 14 }]}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={[cs.input, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Loading categories...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[cs.inputRow, { backgroundColor: colors.input, borderColor: errors.category ? colors.destructive : colors.border, borderWidth: 1.5, marginBottom: errors.category ? 4 : 14 }]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Icon name="briefcase" size={18} color={colors.mutedForeground} />
              <Text style={[cs.input, { color: category ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 48 }]}>
                {category || 'Select Category'}
              </Text>
              <Icon name="chevron-down" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            {errors.category ? <Text style={[cs.errorText, { color: colors.destructive, marginBottom: 10 }]}>{errors.category}</Text> : null}
          </>
        )}

        <InputField placeholder="Professional Bio — tell us about your career and what makes you unique..." value={bio} onChangeText={setBio} multiline numberOfLines={4} icon="edit-2" error={errors.bio} autoCapitalize="sentences" />
        <InputField placeholder="Key Achievements (awards, recognitions) — optional" value={achievements} onChangeText={setAchievements} multiline numberOfLines={3} icon="award" autoCapitalize="sentences" />

        <View style={[cs.earningNote, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Icon name="trending-up" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[cs.earningTitle, { color: colors.foreground }]}>Your Earning Potential</Text>
            <Text style={[cs.earningText, { color: colors.mutedForeground }]}>
              Set your own pricing for video wishes. Top celebrities on WishMe earn ₹50,000+ monthly. You keep 80% of every booking.
            </Text>
          </View>
        </View>

        <SectionHeader icon="share-2" title="Social Media (Optional)" />

        <InputField
          placeholder="Instagram @username"
          value={instagram}
          onChangeText={setInstagram}
          leftElement={<View style={{ marginRight: 10 }}><Icon name="instagram" size={18} color="#E1306C" /></View>}
        />
        <InputField
          placeholder="YouTube channel URL or name"
          value={youtube}
          onChangeText={setYoutube}
          leftElement={<View style={{ marginRight: 10 }}><Icon name="youtube" size={18} color="#FF0000" /></View>}
        />
        <InputField
          placeholder="Twitter/X @username"
          value={twitter}
          onChangeText={setTwitter}
          leftElement={<View style={{ marginRight: 10 }}><Icon name="twitter" size={18} color="#1DA1F2" /></View>}
        />

        <SectionHeader icon="shield" title="Verification" />

        <InputField icon="link" placeholder="Portfolio / Website URL (optional)" value={portfolioLink} onChangeText={setPortfolioLink} keyboardType="url" />

        <View style={[cs.uploadBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Icon name="upload" size={24} color={colors.mutedForeground} />
          <Text style={[cs.uploadText, { color: colors.mutedForeground }]}>Government ID Upload</Text>
          <Text style={[cs.uploadSub, { color: colors.mutedForeground }]}>Aadhaar / PAN / Passport — optional for now</Text>
        </View>

        <SectionHeader icon="check-circle" title="Terms & Consent" />

        <TouchableOpacity style={cs.checkboxRow} onPress={() => setTermsAgreed(!termsAgreed)}>
          <View style={[cs.checkbox, { borderColor: termsAgreed ? colors.primary : errors.terms ? colors.destructive : colors.border, backgroundColor: termsAgreed ? colors.primary : 'transparent' }]}>
            {termsAgreed && <Icon name="check" size={12} color="#fff" />}
          </View>
          <Text style={[cs.checkboxText, { color: colors.foreground }]}>
            I agree to the{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Creator Guidelines</Text>
          </Text>
        </TouchableOpacity>
        {errors.terms ? <Text style={[cs.errorText, { color: colors.destructive, marginBottom: 8 }]}>{errors.terms}</Text> : null}

        <TouchableOpacity style={cs.checkboxRow} onPress={() => setBackgroundAgreed(!backgroundAgreed)}>
          <View style={[cs.checkbox, { borderColor: backgroundAgreed ? colors.primary : errors.background ? colors.destructive : colors.border, backgroundColor: backgroundAgreed ? colors.primary : 'transparent' }]}>
            {backgroundAgreed && <Icon name="check" size={12} color="#fff" />}
          </View>
          <Text style={[cs.checkboxText, { color: colors.foreground }]}>
            I consent to{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>background verification</Text>
            {' '}as part of the onboarding process
          </Text>
        </TouchableOpacity>
        {errors.background ? <Text style={[cs.errorText, { color: colors.destructive, marginBottom: 8 }]}>{errors.background}</Text> : null}

        <Pressable
          onPress={handleContinue}
          disabled={loading}
          style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1, marginTop: 20 }]}
        >
          <LinearGradient
            colors={['#B026FF', '#FF5F1F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={cs.gradBtn}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="mail" size={16} color="#fff" />
                <Text style={[cs.gradBtnText, { marginLeft: 8 }]}>Continue to Verification</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={[cs.note, { color: colors.mutedForeground }]}>
          We'll send a verification code to your email to confirm your identity before creating your account.
        </Text>
      </ScrollView>

      <CategoryModal
        visible={showCategoryPicker}
        selected={category}
        categories={categories}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  heroBanner: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  benefitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  benefitLabel: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBannerSmall: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  row: { flexDirection: 'row', gap: 10 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontSize: 14, height: 52 },
  errorText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  strengthBars: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  checks: { gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  genPwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  genPwText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  earningNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  earningTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  earningText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  uploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  uploadSub: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  gradBtn: {
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  gradBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  note: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  pickerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerItemText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  successCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  successSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  backBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 9999 },
  backBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  otpIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  otpSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  otpBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 0,
  },
  otpLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 12, textAlign: 'center' },
  otpInput: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    letterSpacing: 12,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
  },
  resendText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
