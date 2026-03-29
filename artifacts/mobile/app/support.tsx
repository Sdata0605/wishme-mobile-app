import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const FAQS = [
  {
    q: 'How long does celebrity video delivery take?',
    a: 'Celebrity videos are typically delivered within 7–14 business days after the celebrity accepts your request. You will be notified via the app when your video is ready.',
  },
  {
    q: 'What happens if a celebrity declines my request?',
    a: 'If a celebrity declines your request, you will receive a full refund to your WishMe wallet within 24 hours. You can then use the balance to book another celebrity.',
  },
  {
    q: 'Can I request revisions on my video?',
    a: 'Minor revisions can be requested within 48 hours of delivery. Please note that celebrities may not always be able to accommodate revision requests, but we will do our best to help.',
  },
  {
    q: 'How does AI music generation work?',
    a: 'Our AI music generation uses advanced machine learning models to create personalised music based on your inputs — occasion, mood, genre, and lyrics. The generated music is unique to your request.',
  },
  {
    q: 'What is the difference between real and AI-generated celebrity videos?',
    a: 'Real celebrity videos are personally recorded by the celebrity just for you. AI-generated videos use approved celebrity likeness and voice to create a personalised message. Both are clearly labelled on the platform.',
  },
  {
    q: 'How can I become a celebrity on WishMe?',
    a: 'If you are a celebrity, influencer, or public figure interested in joining WishMe, please use the "For Celebrities" section in the app or visit our website. Our team will review your application.',
  },
];

const CONTACT_CHANNELS = [
  {
    icon: 'mail' as const,
    title: 'Email Support',
    contact: 'support@wishme.today',
    responseTime: 'Within 24 hours',
    color: '#FF6B33',
    onPress: () => Linking.openURL('mailto:support@wishme.today'),
  },
  {
    icon: 'phone' as const,
    title: 'Phone Support',
    contact: '+91 98765 43210',
    responseTime: 'Mon–Fri, 9 AM – 6 PM IST',
    color: '#B44CFF',
    onPress: () => Linking.openURL('tel:+919876543210'),
  },
  {
    icon: 'message-circle' as const,
    title: 'Live Chat',
    contact: 'Available in app',
    responseTime: 'Instant',
    color: '#22C55E',
    onPress: () => {},
  },
];

const QUICK_LINKS: Array<{ label: string; route: string }> = [
  { label: 'Privacy Policy', route: '/privacy-policy' },
  { label: 'Terms & Conditions', route: '/terms' },
  { label: 'Refund Policy', route: '/refund-policy' },
  { label: 'How It Works', route: '/how-it-works' },
];

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={toastStyles.container} pointerEvents="none">
      <View style={toastStyles.toast}>
        <Icon name="check-circle" size={18} color="#fff" />
        <Text style={toastStyles.text}>{message}</Text>
      </View>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    backgroundColor: '#1E283E',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
});

export default function SupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const filteredFaqs = FAQS.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleSearchChange(text: string) {
    setSearchQuery(text);
    setOpenFaqIndex(null);
  }

  function toggleFaq(index: number) {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  }

  function handleSubmit() {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setFormError('Please fill in all fields before submitting.');
      return;
    }
    setFormError('');
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setToastVisible(true);
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.headerBar, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Help & Support</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Gradient Sub-banner */}
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.banner}
        >
          <Icon name="help-circle" size={28} color="#fff" />
          <Text style={styles.bannerText}>How Can We Help You?</Text>
        </LinearGradient>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Search FAQs..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')} activeOpacity={0.7}>
              <Icon name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Contact Channels */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contact Us</Text>
        <View style={styles.channelsContainer}>
          {CONTACT_CHANNELS.map((channel) => (
            <TouchableOpacity
              key={channel.title}
              style={[styles.channelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={channel.onPress}
              activeOpacity={0.75}
            >
              <View style={[styles.channelIconCircle, { backgroundColor: channel.color + '20' }]}>
                <Icon name={channel.icon} size={22} color={channel.color} />
              </View>
              <View style={styles.channelInfo}>
                <Text style={[styles.channelTitle, { color: colors.foreground }]}>{channel.title}</Text>
                <Text style={[styles.channelContact, { color: colors.primary }]}>{channel.contact}</Text>
                <View style={styles.channelResponseRow}>
                  <Icon name="clock" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.channelResponseTime, { color: colors.mutedForeground }]}>{channel.responseTime}</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ Accordion */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Frequently Asked Questions</Text>
        <View style={[styles.faqContainer, { borderColor: colors.border }]}>
          {filteredFaqs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="search" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No results found. Try a different search term.
              </Text>
            </View>
          ) : (
            filteredFaqs.map((faq, i) => {
              const isOpen = openFaqIndex === i;
              return (
                <View
                  key={i}
                  style={[
                    styles.faqItem,
                    { borderBottomColor: colors.border, backgroundColor: isOpen ? colors.muted : colors.card },
                    i === 0 && styles.faqItemFirst,
                    i === filteredFaqs.length - 1 && styles.faqItemLast,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => toggleFaq(i)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.faqQuestionText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                      {faq.q}
                    </Text>
                    <Icon
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <Text style={[styles.faqAnswer, { color: colors.mutedForeground }]}>
                      {faq.a}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Contact Form */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Send Us a Message</Text>
        <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.input ?? colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Your full name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Email</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.input ?? colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="your@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Subject</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.input ?? colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="What is your issue about?"
              placeholderTextColor={colors.mutedForeground}
              value={subject}
              onChangeText={setSubject}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Message</Text>
            <TextInput
              style={[styles.formTextarea, { backgroundColor: colors.input ?? colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Describe your issue in detail..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
          </View>
          {formError !== '' && (
            <View style={styles.formErrorRow}>
              <Icon name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.85} style={styles.submitBtnWrapper}>
            <LinearGradient
              colors={['#FF6B33', '#B44CFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              <Icon name="send" size={16} color="#fff" />
              <Text style={styles.submitBtnText}>Send Message</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Links */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Links</Text>
        <View style={[styles.quickLinksContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {QUICK_LINKS.map((link, i) => (
            <TouchableOpacity
              key={link.label}
              style={[
                styles.quickLinkItem,
                { borderBottomColor: colors.border },
                i === QUICK_LINKS.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => router.push(link.route as Parameters<typeof router.push>[0])}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickLinkLabel, { color: colors.foreground }]}>{link.label}</Text>
              <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            support@wishme.today  |  wishme.today
          </Text>
        </View>
      </ScrollView>

      <Toast
        message="Support request submitted! We'll get back to you within 24 hours."
        visible={toastVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  bannerText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  channelsContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  channelIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: { flex: 1 },
  channelTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  channelContact: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  channelResponseRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  channelResponseTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  faqContainer: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: 1,
  },
  faqItemFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  faqItemLast: { borderBottomWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  faqAnswer: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  formContainer: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  formField: { gap: 6 },
  formLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  formTextarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 110,
  },
  formErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  submitBtnWrapper: { marginTop: 4 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  quickLinksContainer: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  quickLinkLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
