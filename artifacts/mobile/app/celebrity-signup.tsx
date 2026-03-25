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
import { supabaseFetch, parseApiError } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';

interface Category {
  id: string;
  name: string;
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);

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

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

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
    if (!termsAgreed) e.terms = 'You must agree to the Terms of Service';
    if (!backgroundAgreed) e.background = 'You must consent to background verification';
    return e;
  };

  const handleSubmit = async () => {
    setApiError('');
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const checkRes = await supabaseFetch(
        `/rest/v1/celebrity_applications?select=id,status&email=eq.${encodeURIComponent(email.trim())}&limit=1`,
        {},
        null,
      );
      if (checkRes.ok) {
        const existing = await checkRes.json() as Array<{ id: string; status: string }>;
        if (existing && existing.length > 0) {
          const status = existing[0].status;
          const msgs: Record<string, string> = {
            pending: 'You already have a pending application under review.',
            approved: 'You already have an approved account. Please sign in.',
            rejected: 'Your application was previously rejected. Please contact support.',
          };
          setApiError(msgs[status] ?? 'An application already exists for this email.');
          setLoading(false);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          return;
        }
      }

      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        date_of_birth: dob.trim() || null,
        stage_name: stageName.trim(),
        category,
        bio: bio.trim(),
        portfolio_link: portfolioLink.trim() || null,
        social_media: {
          instagram: instagram.trim() || '',
          youtube: youtube.trim() || '',
          twitter: twitter.trim() || '',
          tiktok: '',
          facebook: '',
          linkedin: '',
          website: '',
          other: '',
        },
      };

      const res = await supabaseFetch(
        '/rest/v1/celebrity_applications',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify(payload),
        },
        null,
      );

      if (res.status === 201 || res.ok) {
        setSubmitted(true);
      } else {
        const msg = await parseApiError(res);
        setApiError(msg || 'Failed to submit application. Please try again.');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    } catch {
      setApiError('Network error. Please check your connection and try again.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <View style={[cs.container, { backgroundColor: colors.background }]}>
        <View style={[cs.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
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
              Thank you {firstName}! Your application is under review. Our team will verify your details and get back to you within 3–5 business days.
            </Text>
          </LinearGradient>
          <TouchableOpacity
            style={[cs.backBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)' as never)}
          >
            <Text style={cs.backBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
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
          colors={['#FF6B33', '#B44CFF']}
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

        {apiError ? (
          <View style={[cs.errorBanner, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive + '40' }]}>
            <Icon name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[cs.errorBannerText, { color: colors.destructive }]}>{apiError}</Text>
          </View>
        ) : null}

        <SectionHeader icon="user" title="Personal Information" />

        <View style={cs.row}>
          <View style={{ flex: 1 }}>
            <InputField
              icon="user"
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              error={errors.firstName}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <InputField
              icon="user"
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
              error={errors.lastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <InputField
          icon="mail"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          error={errors.email}
        />
        <InputField
          icon="phone"
          placeholder="+91 98765 43210"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^\d\s\+\-]/g, '').slice(0, 15))}
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <InputField
          icon="calendar"
          placeholder="Date of Birth (DD/MM/YYYY)"
          value={dob}
          onChangeText={setDob}
        />

        <SectionHeader icon="briefcase" title="Professional Details" />

        <InputField
          icon="star"
          placeholder="Stage Name / Screen Name"
          value={stageName}
          onChangeText={setStageName}
          error={errors.stageName}
          autoCapitalize="words"
        />

        {catLoading ? (
          <View style={[cs.inputRow, { backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1.5, marginBottom: 14 }]}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={[cs.input, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Loading categories...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[
                cs.inputRow,
                { backgroundColor: colors.input, borderColor: errors.category ? colors.destructive : colors.border, borderWidth: 1.5, marginBottom: errors.category ? 4 : 14 },
              ]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Icon name="briefcase" size={18} color={colors.mutedForeground} />
              <Text
                style={[
                  cs.input,
                  { color: category ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 48 },
                ]}
              >
                {category || 'Select Category'}
              </Text>
              <Icon name="chevron-down" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            {errors.category ? (
              <Text style={[cs.errorText, { color: colors.destructive, marginBottom: 10 }]}>{errors.category}</Text>
            ) : null}
          </>
        )}

        <InputField
          placeholder="Professional Bio — tell us about your career, experience, and what makes you unique..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          icon="edit-2"
          error={errors.bio}
          autoCapitalize="sentences"
        />
        <InputField
          placeholder="Key Achievements (awards, recognitions, milestones) — optional"
          value={achievements}
          onChangeText={setAchievements}
          multiline
          numberOfLines={3}
          icon="award"
          autoCapitalize="sentences"
        />

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
          leftElement={
            <View style={{ marginRight: 10 }}>
              <Icon name="instagram" size={18} color="#E1306C" />
            </View>
          }
        />
        <InputField
          placeholder="YouTube channel URL or name"
          value={youtube}
          onChangeText={setYoutube}
          leftElement={
            <View style={{ marginRight: 10 }}>
              <Icon name="youtube" size={18} color="#FF0000" />
            </View>
          }
        />
        <InputField
          placeholder="Twitter/X @username"
          value={twitter}
          onChangeText={setTwitter}
          leftElement={
            <View style={{ marginRight: 10 }}>
              <Icon name="twitter" size={18} color="#1DA1F2" />
            </View>
          }
        />

        <SectionHeader icon="shield" title="Verification" />

        <InputField
          icon="link"
          placeholder="Portfolio / Website URL (optional)"
          value={portfolioLink}
          onChangeText={setPortfolioLink}
          keyboardType="url"
        />

        <View style={[cs.uploadBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Icon name="upload" size={24} color={colors.mutedForeground} />
          <Text style={[cs.uploadText, { color: colors.mutedForeground }]}>Government ID Upload</Text>
          <Text style={[cs.uploadSub, { color: colors.mutedForeground }]}>Aadhaar / PAN / Passport (JPG, PNG, PDF) — optional for now</Text>
        </View>

        <SectionHeader icon="check-circle" title="Terms & Consent" />

        <TouchableOpacity style={cs.checkboxRow} onPress={() => setTermsAgreed(!termsAgreed)}>
          <View
            style={[
              cs.checkbox,
              { borderColor: termsAgreed ? colors.primary : errors.terms ? colors.destructive : colors.border, backgroundColor: termsAgreed ? colors.primary : 'transparent' },
            ]}
          >
            {termsAgreed && <Icon name="check" size={12} color="#fff" />}
          </View>
          <Text style={[cs.checkboxText, { color: colors.foreground }]}>
            I agree to the{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Creator Guidelines</Text>
          </Text>
        </TouchableOpacity>
        {errors.terms ? (
          <Text style={[cs.errorText, { color: colors.destructive, marginBottom: 8 }]}>{errors.terms}</Text>
        ) : null}

        <TouchableOpacity style={cs.checkboxRow} onPress={() => setBackgroundAgreed(!backgroundAgreed)}>
          <View
            style={[
              cs.checkbox,
              { borderColor: backgroundAgreed ? colors.primary : errors.background ? colors.destructive : colors.border, backgroundColor: backgroundAgreed ? colors.primary : 'transparent' },
            ]}
          >
            {backgroundAgreed && <Icon name="check" size={12} color="#fff" />}
          </View>
          <Text style={[cs.checkboxText, { color: colors.foreground }]}>
            I consent to{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>background verification</Text>
            {' '}as part of the onboarding process
          </Text>
        </TouchableOpacity>
        {errors.background ? (
          <Text style={[cs.errorText, { color: colors.destructive, marginBottom: 8 }]}>{errors.background}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1, marginTop: 20 }]}
        >
          <LinearGradient
            colors={['#FF6B33', '#B44CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={cs.gradBtn}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={cs.gradBtnText}>Submit Application</Text>
            )}
          </LinearGradient>
        </Pressable>

        {apiError ? (
          <View style={[cs.errorBanner, { backgroundColor: colors.destructive + '20', borderColor: colors.destructive + '40', marginTop: 12 }]}>
            <Icon name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[cs.errorBannerText, { color: colors.destructive }]}>{apiError}</Text>
          </View>
        ) : null}

        <Text style={[cs.note, { color: colors.mutedForeground }]}>
          After submission, our team will review your application within 3–5 business days. You'll receive an email notification when your account is approved.
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
});
