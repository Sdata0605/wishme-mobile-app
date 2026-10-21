import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bike, Car, MessageCircle, ShieldCheck } from 'lucide-react-native';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { useTheme } from '@/context/ThemeContext';

const PLATE_RE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
const clean = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();

/** First step of a car / bike insurance quote: the registration number (or the vehicle type, for a new vehicle). */
export default function VehicleNumberScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ plate?: string }>();
  const [plate, setPlate] = useState(clean(params.plate ?? ''));
  const [touched, setTouched] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [newKind, setNewKind] = useState<'car' | 'bike' | null>(null);

  const valid = isNew ? !!newKind : PLATE_RE.test(clean(plate));
  const showErr = !isNew && touched && plate.length > 0 && !valid;

  const next = () => {
    if (!valid) {
      setTouched(true);
      return;
    }
    router.push({
      pathname: '/vehicle-quote',
      params: isNew ? { kind: newKind! } : { plate: clean(plate) },
    } as Href);
  };

  const hi = { color: colors.foreground };
  const lo = { color: colors.mutedForeground };

  return (
    <AmbientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[st.hero, { paddingTop: insets.top + 8, backgroundColor: colors.primary + '1F', borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={{ alignSelf: 'flex-start' }}>
            <ArrowLeft size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[st.heroIcon, { backgroundColor: colors.primary }]}>
            <ShieldCheck size={30} color="#fff" />
          </View>
          <Text style={[st.heroTitle, hi]}>Car & bike insurance</Text>
          <Text style={[st.heroSub, lo]}>Compare plans in a few taps</Text>
        </View>

        <View style={st.body}>
          {isNew ? (
            <>
              <Text style={[st.h, hi]}>What are you insuring?</Text>
              <Text style={[st.sub, lo]}>Pick your new vehicle type</Text>
              <View style={st.kinds}>
                {([['car', 'Car', Car], ['bike', 'Bike', Bike]] as const).map(([k, label, Icon]) => {
                  const on = newKind === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[st.kind, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '26' : colors.card }]}
                      onPress={() => setNewKind(k)}
                      activeOpacity={0.85}
                    >
                      <Icon size={28} color={on ? colors.primary : colors.foreground} />
                      <Text style={[st.kindText, hi]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={[st.h, hi]}>Enter your car / bike number</Text>
              <Text style={[st.sub, lo]}>For example, MH99AB1234</Text>
              <View style={[st.plate, { backgroundColor: colors.input, borderColor: showErr ? '#EF4444' : colors.border }]}>
                <View style={[st.ind, { backgroundColor: colors.primary }]}>
                  <View style={st.indDot} />
                  <Text style={st.indText}>IND</Text>
                </View>
                <TextInput
                  style={[st.input, hi]}
                  value={plate}
                  onChangeText={(t) => setPlate(t.toUpperCase())}
                  onBlur={() => setTouched(true)}
                  onSubmitEditing={next}
                  placeholder="Vehicle number plate"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  maxLength={13}
                  returnKeyType="go"
                />
              </View>
              {showErr && <Text style={st.err}>Enter a valid vehicle number, like MH12AB1234</Text>}
            </>
          )}
        </View>

        <View style={[st.foot, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity onPress={() => { setIsNew((v) => !v); setTouched(false); }} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <Text style={[st.link, hi]}>{isNew ? 'I have a registration number' : 'Got a new vehicle?'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.cta, { backgroundColor: colors.primary, opacity: valid ? 1 : 0.45 }]}
            onPress={next}
            activeOpacity={0.85}
          >
            <Text style={st.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[st.help, { backgroundColor: colors.primary, bottom: insets.bottom + 150 }]}
          onPress={() => router.push('/support' as Href)}
          accessibilityLabel="Get help"
        >
          <MessageCircle size={22} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </AmbientBackground>
  );
}

const R = 12;
const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 28, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, borderWidth: 1, borderTopWidth: 0 },
  heroIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  heroTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 14 },
  heroSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 32 },
  h: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 },
  plate: { flexDirection: 'row', height: 54, borderRadius: R, borderWidth: 1, overflow: 'hidden', marginTop: 22 },
  ind: { width: 50, alignItems: 'center', justifyContent: 'center', gap: 4 },
  indDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#fff' },
  indText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  input: { flex: 1, paddingHorizontal: 14, fontSize: 17, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  err: { color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 8 },
  kinds: { flexDirection: 'row', gap: 12, marginTop: 22 },
  kind: { flex: 1, height: 96, borderRadius: R, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 8 },
  kindText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  foot: { paddingHorizontal: 16, gap: 18 },
  link: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  cta: { height: 54, borderRadius: R, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  help: { position: 'absolute', right: 16, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
