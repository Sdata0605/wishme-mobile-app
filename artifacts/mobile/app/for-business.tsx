import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const BUSINESS_FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'video', title: 'Celebrity Endorsements', desc: 'Get authentic video testimonials from top celebrities that resonate with your audience.' },
  { icon: 'target', title: 'Brand Activations', desc: 'Custom promotional campaigns that put your brand front and center.' },
  { icon: 'users', title: 'Social Media Campaigns', desc: 'Leverage celebrity influence across Instagram, YouTube, and more.' },
  { icon: 'trending-up', title: 'Product Launches', desc: 'Make your product launch memorable with star-powered momentum.' },
];

const HOW_IT_WORKS: { title: string; desc: string }[] = [
  { title: 'Submit Brief', desc: 'Tell us your brand goals, target audience, and campaign vision.' },
  { title: 'Choose Celebrity', desc: 'Browse our curated roster and pick the perfect celebrity match.' },
  { title: 'Approve Content', desc: 'Review and approve all content before it goes live.' },
  { title: 'Launch Campaign', desc: 'We publish across channels and track real-time performance.' },
];

const PRICING_TIERS: {
  name: string;
  price: string;
  desc: string;
  features: string[];
  popular: boolean;
}[] = [
  {
    name: 'Starter',
    price: '₹25,000',
    desc: 'Perfect for small businesses',
    popular: false,
    features: [
      '1 celebrity collaboration',
      'Single platform campaign',
      'Basic analytics report',
      '7-day support',
    ],
  },
  {
    name: 'Growth',
    price: '₹75,000',
    desc: 'Ideal for growing brands',
    popular: true,
    features: [
      '3 celebrity collaborations',
      'Multi-platform campaign',
      'Advanced analytics & insights',
      '30-day dedicated support',
      'Content approval workflow',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'For large-scale campaigns',
    popular: false,
    features: [
      'Unlimited celebrity access',
      'Omni-channel campaigns',
      'Real-time performance dashboard',
      'Dedicated account manager',
      'Custom contract & SLA',
    ],
  },
];

const TESTIMONIALS: { company: string; industry: string; quote: string }[] = [
  {
    company: 'TechStart Solutions',
    industry: 'Technology',
    quote: 'WishMe transformed our product launch. The celebrity endorsement drove 3× our expected reach within a week.',
  },
  {
    company: 'Fashion Forward',
    industry: 'Fashion',
    quote: 'Partnering with top celebrities through WishMe gave our brand an authentic voice and boosted awareness by 180%.',
  },
  {
    company: 'Fitness Pro',
    industry: 'Health & Fitness',
    quote: 'The process was seamless from celebrity selection to final approval. Best ROI on any marketing investment we\'ve made.',
  },
];

const SERVICE_OPTIONS = BUSINESS_FEATURES.map((f) => f.title);

export default function ForBusinessScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [service, setService] = useState(SERVICE_OPTIONS[0]);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);

  const scrollToContact = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>For Business</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

          <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>For Business</Text>
            </View>
            <Text style={styles.heroTitle}>Elevate Your Brand with Celebrity Power</Text>
            <Text style={styles.heroSub}>Partner with India's biggest celebrities for authentic marketing</Text>
            <Pressable onPress={scrollToContact} style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Text style={styles.heroBtnText}>Start Your Campaign</Text>
            </Pressable>
          </LinearGradient>

          <View style={[styles.section, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Why Choose Celebrity Marketing?</Text>
            <View style={styles.featuresGrid}>
              {BUSINESS_FEATURES.map((feat) => (
                <View key={feat.title} style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIconCircle}>
                    <Icon name={feat.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.featureCardTitle, { color: colors.foreground }]}>{feat.title}</Text>
                  <Text style={[styles.featureCardDesc, { color: colors.mutedForeground }]}>{feat.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Simple 4-Step Process</Text>
            {HOW_IT_WORKS.map((step, idx) => (
              <View key={idx} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepCircle}>
                    <Text style={styles.stepNumber}>{idx + 1}</Text>
                  </LinearGradient>
                  {idx < HOW_IT_WORKS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Flexible Pricing Plans</Text>
            {PRICING_TIERS.map((tier) => (
              <View
                key={tier.name}
                style={[
                  styles.pricingCard,
                  { backgroundColor: colors.card, borderColor: tier.popular ? '#1F7BFF' : colors.border },
                  tier.popular && styles.pricingCardPopular,
                ]}
              >
                {tier.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Most Popular</Text>
                  </View>
                )}
                <Text style={[styles.tierName, { color: colors.foreground }]}>{tier.name}</Text>
                <Text style={[styles.tierPrice, { color: colors.primary }]}>{tier.price}</Text>
                <Text style={[styles.tierDesc, { color: colors.mutedForeground }]}>{tier.desc}</Text>
                <View style={[styles.tierDivider, { backgroundColor: colors.border }]} />
                {tier.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Icon name="star" size={14} color="#7B5CFA" />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
                <Pressable onPress={scrollToContact} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, { marginTop: 16 }]}>
                  <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tierBtn}>
                    <Text style={styles.tierBtnText}>Get Started</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What Our Clients Say</Text>
            {TESTIMONIALS.map((t) => (
              <View key={t.company} style={[styles.testimonialCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.testimonialHeader}>
                  <Text style={[styles.testimonialCompany, { color: colors.foreground }]}>{t.company}</Text>
                  <View style={[styles.industryBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.industryText, { color: colors.primary }]}>{t.industry}</Text>
                  </View>
                </View>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Icon key={s} name="star" size={14} color="#F59E0B" />
                  ))}
                </View>
                <Text style={[styles.testimonialQuote, { color: colors.mutedForeground }]}>"{t.quote}"</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaCard}>
              <Text style={styles.ctaTitle}>Ready to Transform Your Marketing?</Text>
              <Text style={styles.ctaSub}>Join hundreds of brands already winning with celebrity power.</Text>
              <View style={styles.ctaBtns}>
                <Pressable onPress={scrollToContact} style={({ pressed }) => [styles.ctaBtnPrimary, { opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={styles.ctaBtnPrimaryText}>Start Your Campaign</Text>
                </Pressable>
                <Pressable onPress={scrollToContact} style={({ pressed }) => [styles.ctaBtnSecondary, { opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={styles.ctaBtnSecondaryText}>Schedule Consultation</Text>
                </Pressable>
              </View>
            </LinearGradient>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Get in Touch</Text>
              {!submitted ? (
                <>
                  <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <Icon name="user" size={18} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      placeholder="Your Name"
                      placeholderTextColor={colors.mutedForeground}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                  <View style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <Icon name="briefcase" size={18} color={colors.mutedForeground} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      placeholder="Company Name"
                      placeholderTextColor={colors.mutedForeground}
                      value={company}
                      onChangeText={setCompany}
                    />
                  </View>

                  <Pressable
                    onPress={() => setServiceOpen((o) => !o)}
                    style={[styles.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}
                  >
                    <Icon name="layers" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.input, { color: service ? colors.foreground : colors.mutedForeground }]}>{service || 'Select Service'}</Text>
                    <Icon name={serviceOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                  </Pressable>
                  {serviceOpen && (
                    <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {SERVICE_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt}
                          onPress={() => { setService(opt); setServiceOpen(false); }}
                          style={({ pressed }) => [
                            styles.dropdownItem,
                            { borderBottomColor: colors.border },
                            pressed && { backgroundColor: colors.primary + '15' },
                          ]}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.foreground }]}>{opt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <View style={[styles.inputRow, styles.messageRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, styles.messageInput, { color: colors.foreground }]}
                      placeholder="Your message..."
                      placeholderTextColor={colors.mutedForeground}
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <Pressable onPress={() => setSubmitted(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                    <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                      <Text style={styles.submitBtnText}>Submit</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : (
                <View style={[styles.successCard, { backgroundColor: '#22C55E20' }]}>
                  <Icon name="check-circle" size={28} color="#22C55E" />
                  <Text style={[styles.successText, { color: '#22C55E' }]}>
                    Our team will contact you within 24 hours.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View></AmbientBackground>
  );
}

const styles = StyleSheet.create({
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
  heroCard: { padding: 32, alignItems: 'center' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 18 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  heroTitle: { color: '#fff', fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center', marginBottom: 10, lineHeight: 34 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  heroBtn: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 32, paddingVertical: 14 },
  heroBtnText: { color: '#7B5CFA', fontSize: 15, fontFamily: 'Inter_700Bold' },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 18 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: { width: '47%', borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  featureIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  featureCardTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', lineHeight: 18 },
  featureCardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  stepRow: { flexDirection: 'row', marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 44, marginRight: 14 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  stepLine: { width: 2, flex: 1, minHeight: 32, marginTop: 4 },
  stepContent: { flex: 1, paddingBottom: 24 },
  stepTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  stepDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  pricingCard: { borderRadius: 18, borderWidth: 1.5, padding: 20, marginBottom: 16, position: 'relative' },
  pricingCardPopular: { shadowColor: '#1F7BFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  popularBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#1F7BFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  popularBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  tierName: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  tierPrice: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  tierDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  tierDivider: { height: 1, marginVertical: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  tierBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tierBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  testimonialCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  testimonialHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  testimonialCompany: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  industryBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  industryText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  starsRow: { flexDirection: 'row', gap: 3, marginBottom: 10 },
  testimonialQuote: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic' },
  ctaCard: { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
  ctaTitle: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center', marginBottom: 10, lineHeight: 30 },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 22, lineHeight: 20 },
  ctaBtns: { gap: 12, width: '100%' },
  ctaBtnPrimary: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaBtnPrimaryText: { color: '#7B5CFA', fontSize: 15, fontFamily: 'Inter_700Bold' },
  ctaBtnSecondary: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  ctaBtnSecondaryText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  formCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  formTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 14 },
  messageRow: { height: 100, alignItems: 'flex-start', paddingTop: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  messageInput: { height: '100%' },
  dropdown: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: -10, marginBottom: 14 },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  submitBtn: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  successCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12 },
  successText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 21 },
});
