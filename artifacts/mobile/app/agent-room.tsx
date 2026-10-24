import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initials, seatColour, seatLabel } from '@/components/council/shared';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale, Reveal } from '@/components/neon/Motion';
import { useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { VOICES } from '@/services/assistant/persona';
import { getCurrentCouncil, setCurrentCouncil } from '@/services/council/current';
import { CouncilEngine } from '@/services/council/engine';
import { MAX_AGENTS, MIN_AGENTS, PRESETS, ROOM_LANGUAGES, type CouncilPreset } from '@/services/council/presets';
import type { CouncilPlan, CouncilScenario } from '@/services/council/types';

const MAX_SCENARIO = 1500;

const ease = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/**
 * Set up an agent room. The page opens calm: pick a template, say what the situation is, see who will be in the room,
 * and build. Roles and the finer settings (your assistant's part, your part, language, voices, room sound) sit folded
 * behind one summary line each, so nothing has to be read that does not need changing.
 */
export default function AgentRoomSetupScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, getValidSession } = useAuth();
  const { persona } = useAssistantPersona();

  const [preset, setPreset] = useState<CouncilPreset>(PRESETS[0]);
  const [scenario, setScenario] = useState(PRESETS[0].scenario);
  const [count, setCount] = useState(PRESETS[0].agentCount);
  const [roles, setRoles] = useState<string[]>(PRESETS[0].roles);
  const [directorRole, setDirectorRole] = useState(PRESETS[0].directorRole);
  const [userPart, setUserPart] = useState(PRESETS[0].userPart);
  const [language, setLanguage] = useState(ROOM_LANGUAGES[0]);
  const [spatial, setSpatial] = useState(true);
  const [voiceMode, setVoiceMode] = useState<'phone' | 'studio'>('phone');
  const [showRoles, setShowRoles] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<CouncilPlan | null>(null);
  const engine = useRef<CouncilEngine | null>(null);
  const scroll = useRef<ScrollView>(null);

  // Leaving this screen with a room built but never entered lets it go.
  useEffect(() => () => { if (engine.current && getCurrentCouncil() === engine.current) setCurrentCouncil(null); }, []);

  // Back from the room: it has closed, so the cast is shown again only once it is rebuilt.
  useFocusEffect(useCallback(() => {
    if (engine.current && getCurrentCouncil() !== engine.current) { engine.current = null; setPlan(null); }
  }, []));

  const touch = () => { if (plan) { ease(); setPlan(null); } };

  const applyPreset = (p: CouncilPreset) => {
    ease();
    setPreset(p);
    setScenario(p.scenario);
    setCount(p.agentCount);
    setRoles(p.roles);
    setDirectorRole(p.directorRole);
    setUserPart(p.userPart);
    setPlan(null);
    if (p.id === 'custom') setShowRoles(true);
  };

  const setCountClamped = (n: number) => {
    const c = Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, n));
    ease();
    setCount(c);
    setRoles((r) => r.slice(0, c));
    setPlan(null);
  };

  const setRole = (i: number, v: string) => {
    setRoles((r) => {
      const next = [...r];
      while (next.length <= i) next.push('');
      next[i] = v;
      return next;
    });
    touch();
  };

  const build = async () => {
    const text = scenario.trim();
    if (text.length < 20) { Alert.alert('Tell the room a little more', 'A sentence or two about the situation is enough for the agents to work on.'); return; }
    const session = await getValidSession();
    if (!session) { Alert.alert('Sign in', 'Sign in to open an agent room.'); return; }
    setBusy(true);
    setPlan(null);
    const spec: CouncilScenario = {
      scenario: text,
      agentCount: count,
      roles: roles.slice(0, count).map((r) => r.trim()).filter(Boolean),
      directorRole: directorRole.trim() || PRESETS[PRESETS.length - 1].directorRole,
      userPart: userPart.trim() || 'Observer who may ask questions',
      language,
      spatial,
      voiceMode,
    };
    const e = new CouncilEngine({
      getAccessToken: async () => (await getValidSession())?.access_token,
      identity: {
        name: persona.name,
        voice: persona.voice,
        gender: VOICES.find((v) => v.id === persona.voice)?.gender ?? 'female',
        userName: user?.firstName?.trim() || 'the user',
      },
      scenario: spec,
    });
    setCurrentCouncil(e);
    engine.current = e;
    try {
      const p = await e.prepare();
      ease();
      setPlan(p);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 120);
    } catch (err) {
      setCurrentCouncil(null);
      engine.current = null;
      Alert.alert('Could not build the room', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const enter = () => {
    if (!plan || !engine.current) return;
    router.push('/agent-room-live' as never);
  };

  const inputStyle = [styles.input, { color: neon.textHi, borderColor: neon.cardBorder, backgroundColor: neon.surface }];
  const filledRoles = roles.slice(0, count).map((r) => r.trim()).filter(Boolean);
  const rolesSummary = filledRoles.length === 0
    ? `${persona.name} chooses the roles`
    : filledRoles.length < count
      ? `${filledRoles.join(' · ')} · ${count - filledRoles.length} chosen by ${persona.name}`
      : filledRoles.join(' · ');
  const detailsSummary = `${language} · ${voiceMode === 'phone' ? 'Phone voices' : 'Studio voices'} · Room sound ${spatial ? 'on' : 'off'}`;
  const canBuild = scenario.trim().length >= 20 && !busy;

  return (
    <AmbientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Icon name="chevron-left" size={22} color={neon.textHi} />
            </Pressable>
            <Text style={[styles.title, { color: neon.textHi }]}>Agent room</Text>
          </View>

          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Reveal>
              <Text style={[styles.lead, { color: neon.textLo }]}>
                Describe a situation. {persona.name} gathers the right people, seats them around a table and runs the discussion. You listen in, or speak up whenever you like.
              </Text>
            </Reveal>

            {/* 1. Start from */}
            <Reveal delayMs={40}>
              <Text style={[styles.section, { color: neon.textHi }]}>Start from</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
                {PRESETS.map((p) => {
                  const on = preset.id === p.id;
                  return (
                    <PressScale key={p.id} onPress={() => applyPreset(p)} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <View style={[styles.card, { backgroundColor: on ? neon.violet : neon.glass, borderColor: on ? neon.violet : neon.cardBorder }]}>
                        <View style={[styles.cardIcon, { backgroundColor: on ? 'rgba(255,255,255,0.18)' : neon.surfaceHigh }]}>
                          <Icon name={p.icon} size={18} color={on ? '#FFFFFF' : neon.cyan} />
                        </View>
                        <Text style={[styles.cardTitle, { color: on ? '#FFFFFF' : neon.textHi }]}>{p.title}</Text>
                        <Text style={[styles.cardBlurb, { color: on ? 'rgba(255,255,255,0.82)' : neon.textLo }]} numberOfLines={2}>{p.blurb}</Text>
                      </View>
                    </PressScale>
                  );
                })}
              </ScrollView>
            </Reveal>

            {/* 2. The situation */}
            <Reveal delayMs={80} style={styles.block}>
              <Text style={[styles.section, { color: neon.textHi, marginLeft: 0 }]}>What is the situation?</Text>
              <TextInput
                value={scenario}
                onChangeText={(t) => { setScenario(t.slice(0, MAX_SCENARIO)); touch(); }}
                placeholder="The case, the patient, the decision, the question… in your own words."
                placeholderTextColor={neon.textDim}
                multiline
                editable={!busy}
                style={[...inputStyle, styles.multiline]}
              />
              <Text style={[styles.hint, { color: neon.textDim }]}>{scenario.trim().length < 20 ? 'A sentence or two is enough.' : 'Good. The agents will work on exactly this.'}</Text>
            </Reveal>

            {/* 3. People in the room */}
            <Reveal delayMs={120} style={styles.block}>
              <Text style={[styles.section, { color: neon.textHi, marginLeft: 0 }]}>Who is in the room?</Text>
              <View style={[styles.panel, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.panelTitle, { color: neon.textHi }]}>{count} agents</Text>
                    <View style={styles.dots}>
                      {Array.from({ length: count }).map((_, i) => <View key={i} style={[styles.dot, { backgroundColor: seatColour(i) }]} />)}
                      <View style={[styles.dot, styles.dotDirector, { borderColor: neon.violet }]} />
                      <Text style={[styles.dotsText, { color: neon.textDim }]}>+ {persona.name}</Text>
                    </View>
                  </View>
                  <View style={[styles.stepper, { borderColor: neon.cardBorder }]}>
                    <Pressable onPress={() => setCountClamped(count - 1)} disabled={busy || count <= MIN_AGENTS} hitSlop={6} accessibilityRole="button" accessibilityLabel="Fewer agents" style={styles.stepBtn}>
                      <Icon name="minus" size={18} color={count <= MIN_AGENTS ? neon.textDim : neon.textHi} />
                    </Pressable>
                    <Pressable onPress={() => setCountClamped(count + 1)} disabled={busy || count >= MAX_AGENTS} hitSlop={6} accessibilityRole="button" accessibilityLabel="More agents" style={styles.stepBtn}>
                      <Icon name="plus" size={18} color={count >= MAX_AGENTS ? neon.textDim : neon.textHi} />
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={() => { ease(); setShowRoles((v) => !v); }} accessibilityRole="button" accessibilityState={{ expanded: showRoles }} style={[styles.fold, { borderTopColor: neon.line }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.foldLabel, { color: neon.textLo }]}>Roles</Text>
                    {!showRoles ? <Text style={[styles.foldValue, { color: neon.textHi }]} numberOfLines={2}>{rolesSummary}</Text> : null}
                  </View>
                  <Icon name={showRoles ? 'chevron-up' : 'chevron-down'} size={18} color={neon.textLo} />
                </Pressable>
                {showRoles ? (
                  <View style={{ gap: 8, paddingBottom: 4 }}>
                    {Array.from({ length: count }).map((_, i) => (
                      <View key={i} style={styles.roleRow}>
                        <View style={[styles.dot, { backgroundColor: seatColour(i) }]} />
                        <TextInput
                          value={roles[i] ?? ''}
                          onChangeText={(t) => setRole(i, t)}
                          placeholder={`Agent ${i + 1}: leave blank and ${persona.name} decides`}
                          placeholderTextColor={neon.textDim}
                          editable={!busy}
                          style={[...inputStyle, { flex: 1, minHeight: 44 }]}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Reveal>

            {/* 4. Details, folded */}
            <Reveal delayMs={160} style={styles.block}>
              <View style={[styles.panel, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                <Pressable onPress={() => { ease(); setShowDetails((v) => !v); }} accessibilityRole="button" accessibilityState={{ expanded: showDetails }} style={styles.foldHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.panelTitle, { color: neon.textHi }]}>Details</Text>
                    {!showDetails ? <Text style={[styles.foldValue, { color: neon.textLo }]} numberOfLines={1}>{detailsSummary}</Text> : null}
                  </View>
                  <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color={neon.textLo} />
                </Pressable>

                {showDetails ? (
                  <View style={{ gap: 18, paddingTop: 6 }}>
                    <View>
                      <Text style={[styles.foldLabel, { color: neon.textLo, marginBottom: 6 }]}>{persona.name}'s part</Text>
                      <TextInput value={directorRole} onChangeText={(t) => { setDirectorRole(t); touch(); }} placeholder="Moderator, court clerk, host…" placeholderTextColor={neon.textDim} editable={!busy} style={inputStyle} />
                    </View>
                    <View>
                      <Text style={[styles.foldLabel, { color: neon.textLo, marginBottom: 6 }]}>Your part</Text>
                      <TextInput value={userPart} onChangeText={(t) => { setUserPart(t); touch(); }} placeholder="Observer, the client, a student who may ask questions…" placeholderTextColor={neon.textDim} editable={!busy} style={inputStyle} />
                    </View>
                    <View>
                      <Text style={[styles.foldLabel, { color: neon.textLo, marginBottom: 8 }]}>Language</Text>
                      <View style={styles.wrap}>
                        {ROOM_LANGUAGES.map((l) => {
                          const on = language === l;
                          return (
                            <Pressable key={l} onPress={() => { setLanguage(l); touch(); }} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, { backgroundColor: on ? neon.violet : neon.surface, borderColor: on ? neon.violet : neon.cardBorder }]}>
                              <Text style={[styles.chipText, { color: on ? '#FFFFFF' : neon.textHi }]}>{l}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View>
                      <Text style={[styles.foldLabel, { color: neon.textLo, marginBottom: 8 }]}>Voices</Text>
                      <View style={[styles.segment, { backgroundColor: neon.surface, borderColor: neon.cardBorder }]}>
                        {(['phone', 'studio'] as const).map((m) => {
                          const on = voiceMode === m;
                          return (
                            <Pressable key={m} onPress={() => { setVoiceMode(m); touch(); }} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.segmentBtn, on && { backgroundColor: neon.violet }]}>
                              <Text style={[styles.segmentText, { color: on ? '#FFFFFF' : neon.textHi }]}>{m === 'phone' ? 'Phone voices' : 'Studio voices'}</Text>
                              <Text style={[styles.segmentSub, { color: on ? 'rgba(255,255,255,0.8)' : neon.textDim }]}>{m === 'phone' ? 'free' : 'Gemini · costs more'}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.hint, { color: neon.textDim }]}>
                        {voiceMode === 'phone'
                          ? `The phone's own Indian voices speak the lines. ${Platform.OS === 'android' ? 'Room sound works.' : 'Room sound needs Android.'}`
                          : 'Every agent gets a Gemini voice. The best voices, at many times the cost.'}
                      </Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[styles.foldLabel, { color: neon.textLo }]}>Room sound</Text>
                        <Text style={[styles.hint, { color: neon.textDim, marginTop: 2 }]}>Each voice from its own seat. Best with earphones.</Text>
                      </View>
                      <Switch value={spatial} onValueChange={(v) => { setSpatial(v); touch(); }} disabled={busy} trackColor={{ true: neon.violet, false: neon.cardBorder }} thumbColor="#FFFFFF" />
                    </View>
                  </View>
                ) : null}
              </View>
            </Reveal>

            {/* 5. The cast, once built */}
            {plan ? (
              <Reveal style={styles.block}>
                <Text style={[styles.section, { color: neon.textHi, marginLeft: 0 }]}>{plan.title}</Text>
                <Text style={[styles.hint, { color: neon.textLo, marginTop: -4, marginBottom: 12 }]}>{plan.setting}</Text>
                <View style={{ gap: 10 }}>
                  <View style={[styles.castCard, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                    <View style={[styles.avatar, { borderColor: neon.violet, backgroundColor: neon.surfaceHigh }]}>
                      <Icon name="sparkles" size={20} color={neon.violet} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.castName, { color: neon.textHi }]}>{persona.name}</Text>
                      <Text style={[styles.castRole, { color: neon.textLo }]}>{directorRole.trim() || 'Moderator'}</Text>
                    </View>
                  </View>
                  {plan.cast.map((m, i) => {
                    const colour = seatColour(i);
                    return (
                      <View key={m.id} style={[styles.castCard, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                        <View style={[styles.avatar, { borderColor: colour, backgroundColor: neon.surfaceHigh }]}>
                          <Text style={[styles.initials, { color: colour }]}>{initials(m.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.castName, { color: neon.textHi }]}>{m.name}{plan.decisionBy === m.id ? '  ·  decides' : ''}</Text>
                          <Text style={[styles.castRole, { color: neon.textLo }]}>{m.role}</Text>
                          <Text style={[styles.castGoal, { color: neon.textDim }]}>{m.goal}</Text>
                          <Text style={[styles.castGoal, { color: neon.textDim }]}>Seat: {seatLabel(m.seat.pan)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.hint, { color: neon.textDim, textAlign: 'center', marginTop: 12 }]}>{plan.turns.length} turns planned. Speak up any time; ask for more when it ends.</Text>
              </Reveal>
            ) : null}
          </ScrollView>

          {/* The one action, always within reach */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <LinearGradient colors={['transparent', neon.bg]} style={styles.footerFade} pointerEvents="none" />
            {plan ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => void build()} disabled={busy} accessibilityRole="button" accessibilityLabel="Recast the room" style={[styles.bigBtn, { width: 56, backgroundColor: neon.glass, borderWidth: 1.2, borderColor: neon.cardBorder }]}>
                  <Icon name="refresh-cw" size={18} color={neon.textHi} />
                </Pressable>
                <PressScale onPress={enter} accessibilityRole="button" accessibilityLabel="Enter the room" style={{ flex: 1 }}>
                  <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
                    <Icon name="play" size={18} color="#FFFFFF" />
                    <Text style={styles.bigBtnText}>Enter the room</Text>
                  </LinearGradient>
                </PressScale>
              </View>
            ) : (
              <PressScale onPress={() => void build()} disabled={!canBuild} accessibilityRole="button" accessibilityLabel="Build the room">
                <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.bigBtn, !canBuild && { opacity: 0.55 }]}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="users" size={20} color="#FFFFFF" />}
                  <Text style={styles.bigBtnText}>{busy ? `${persona.name} is casting the room…` : 'Build the room'}</Text>
                </LinearGradient>
              </PressScale>
            )}
            {busy ? <Text style={[styles.hint, { color: neon.textDim, textAlign: 'center', marginTop: 8 }]}>About ten to twenty seconds.</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  lead: { fontSize: 15.5, lineHeight: 23, fontFamily: 'Inter_400Regular', paddingHorizontal: 20, marginBottom: 22 },
  section: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginLeft: 20, marginBottom: 12 },
  block: { paddingHorizontal: 20, marginTop: 26 },
  hint: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 8 },
  card: { width: 150, borderRadius: 20, borderWidth: 1.2, padding: 14, gap: 8, minHeight: 124 },
  cardIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardBlurb: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, minHeight: 48, fontSize: 15, fontFamily: 'Inter_500Medium' },
  multiline: { minHeight: 128, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top', lineHeight: 22 },
  panel: { borderWidth: 1.2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  panelTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotDirector: { backgroundColor: 'transparent', borderWidth: 2, marginLeft: 4 },
  dotsText: { fontSize: 12, fontFamily: 'Inter_500Medium', marginLeft: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderRadius: 22, height: 44 },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fold: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1 },
  foldHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  foldValue: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 3 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13.5, fontFamily: 'Inter_500Medium' },
  segment: { flexDirection: 'row', borderWidth: 1.2, borderRadius: 18, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, borderRadius: 14, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  segmentSub: { fontSize: 11.5, fontFamily: 'Inter_500Medium', marginTop: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 28 },
  footerFade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bigBtn: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  bigBtnText: { color: '#FFFFFF', fontSize: 15.5, fontFamily: 'Inter_600SemiBold' },
  castCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.2 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  castName: { fontSize: 15.5, fontFamily: 'Inter_600SemiBold' },
  castRole: { fontSize: 13.5, fontFamily: 'Inter_500Medium', marginTop: 1 },
  castGoal: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 3 },
});
