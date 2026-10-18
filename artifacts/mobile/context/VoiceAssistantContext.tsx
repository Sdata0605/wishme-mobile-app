/**
 * VoiceAssistantContext — the app-wide live voice assistant.
 *
 * Owns one AssistantEngine (Gemini Live or Sarvam, as chosen by the admin). The connection is opened ("warmed") as soon as the user is
 * logged in and the app is in the foreground, so tapping the floating button only has to
 * switch the microphone on. Tools run through services/assistant/tools.ts.
 */

import { bootLog } from '@/services/bootLog';
import { router } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Animated, AppState, Easing, InteractionManager, Linking } from 'react-native';
import type { Story } from '@/services/home/news';
import { clearMemoryCache, refreshMemories } from '@/services/assistant/memory';
import { missedTool } from '@/services/assistant/claimCheck';
import { useAgentState } from '@/context/AgentStateContext';
import { useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useAuth } from '@/context/AuthContext';
import {
  buildGreetingLine,
  buildGreetingPrompt,
  type AddressAs,
  type AddressTitle,
  sarvamSpeakerFor,
} from '@/services/assistant/persona';
import { buildSystemInstruction } from '@/services/assistant/systemPrompt';
import type { LiveState } from '@/services/geminiLive/client';
import { AssistantEngine } from '@/services/voice/engine';
import { createAiCallWatcher, describeCall, spokenReport, whoLabel, type AiCall } from '@/services/assistant/aiCalls';
import { isPermissionDialogOpen, warmContacts } from '@/services/assistant/phone';
import { FUNCTION_DECLARATIONS, runAssistantTool } from '@/services/assistant/tools';
import { syncScheduledReminders } from '@/services/hub/notifications';

interface VoiceAssistantValue {
  state: LiveState;
  /** The assistant is active (the user tapped the button). */
  open: boolean;
  /** Collapsed to a small floating orb so the user can use the screen underneath. */
  minimized: boolean;
  setMinimized: (value: boolean) => void;
  userText: string;
  assistantText: string;
  /** What the assistant is doing right now, e.g. "Searching flights Mumbai → Goa". */
  actionLabel: string;
  error: string | null;
  /** Smoothed 0..1 loudness of whoever is talking, for animation (no re-renders). */
  level: Animated.Value;
  toggle: () => void;
  /** Opens the assistant (if it is closed) and puts a typed question to it once it is ready. */
  ask: (prompt: string) => void;
  close: () => void;
  /** Try again after an error (reconnects and starts listening). */
  retry: () => void;
  /** The headlines pop-up shown over the assistant, or null. */
  news: { topic: string; stories: Story[] } | null;
  clearNews: () => void;
  /** Opens one story on its own screen and tucks the assistant away. */
  openStory: (story: Story) => void;
}

const Ctx = createContext<VoiceAssistantValue | null>(null);

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const { session, user, getValidSession, verifySession } = useAuth();
  const { persona, status: personaStatus } = useAssistantPersona();
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const getValidSessionRef = useRef(getValidSession);
  getValidSessionRef.current = getValidSession;
  const verifySessionRef = useRef(verifySession);
  verifySessionRef.current = verifySession;

  // Follows phone calls the assistant made for the user, and reports the result when they end.
  // While one is going on the assistant stays open, and when it ends the assistant speaks the result,
  // reopening itself first if it had been closed.
  const watcherRef = useRef<ReturnType<typeof createAiCallWatcher> | null>(null);
  const speakCallResultRef = useRef<(call: AiCall) => void>(() => {});
  const setActionLabelRef = useRef<(label: string) => void>(() => {});
  if (!watcherRef.current) {
    watcherRef.current = createAiCallWatcher({
      getAccessToken: async () => (await getValidSessionRef.current())?.access_token ?? tokenRef.current,
      onLiveChange: (live) => clientRef.current?.setHoldOpen(live),
      onStalled: (call: AiCall) => {
        const engine = clientRef.current;
        if (!engine?.isConversing()) return;
        engine.notify(
          `The phone call to ${whoLabel(call)} has still not started ringing after more than a minute, so it is probably not going through. Tell the user honestly and briefly, in the language they are speaking, that the call is not connecting. Do NOT say it is still ringing or ask them to keep waiting. Offer to try again, or to connect their own phone so they can call ${whoLabel(call)} themselves.`,
        );
      },
      onProgress: (call: AiCall) => {
        if (call.status === 'in-progress') setActionLabelRef.current(`${whoLabel(call)} picked up. Talking with them…`);
        else if (call.status === 'ringing') setActionLabelRef.current(`Ringing ${whoLabel(call)}…`);
      },
      onFinished: (call: AiCall) => {
        setActionLabelRef.current('');
        const engine = clientRef.current;
        if (engine?.isConversing()) {
          // The assistant is open: have it tell the user out loud.
          engine.notify(
            `The phone call you made for the user has finished. Tell them right away, briefly, in the language they are speaking. Facts: ${JSON.stringify(describeCall(call))}. Say who picked up and what was said or agreed. If it did not connect (status no-answer, busy, voicemail or failed) say so and offer to try again. If there is a next step, tell them.`,
          );
          return;
        }
        if (AppState.currentState === 'active') {
          // The assistant had closed itself: open it again and let it speak the result.
          speakCallResultRef.current(call);
          return;
        }
        Alert.alert('AI call finished', `${whoLabel(call)}

${call.summary ?? 'The call has ended.'}`, [
          { text: 'Close', style: 'cancel' },
          { text: 'View details', onPress: () => router.push('/ai-calls' as never) },
        ]);
      },
    });
  }
  const aiCallWatcher = watcherRef.current;
  /** A finished call the assistant is about to announce when it next opens (expires if never used). */
  const pendingReport = useRef<{ call: AiCall; at: number } | null>(null);
  /** Hands over the finished call to announce (once), or null if there is none or it is stale. */
  const takeReport = () => {
    const pending = pendingReport.current;
    pendingReport.current = null;
    return pending && Date.now() - pending.at < 60_000 ? pending.call : null;
  };
  const { setPrefill, resetAgent } = useAgentState();

  const [state, setState] = useState<LiveState>('idle');
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [userText, setUserText] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [news, setNews] = useState<{ topic: string; stories: Story[] } | null>(null);
  // Set when the assistant is about to leave the app on purpose (pictures in the browser): the app resumes the conversation on return.
  const awayRef = useRef<{ subject: string; at: number; note?: string } | null>(null);
  const resumeNoteRef = useRef<string | null>(null);
  // What was said and which tools ran in the turn in progress: if the assistant claims it did something and called no tool, it is told.
  const turnRef = useRef({ heard: '', said: '', tools: 0, nudged: false });
  const [error, setErrorState] = useState<string | null>(null);

  // Raw loudness comes in at the mic/speaker event rate; a ticker turns it into one smoothed
  // value (fast attack, slow release) so the animation glides instead of jittering.
  const level = useRef(new Animated.Value(0)).current;
  const rawLevels = useRef({ input: 0, output: 0 });

  // Latest values for the long-lived client callbacks.
  const tokenRef = useRef(session?.access_token);
  tokenRef.current = session?.access_token;
  const nameRef = useRef(user?.firstName);
  nameRef.current = user?.firstName;
  // How to address the user: the saved choice, plus (in 'decide by voice' mode) the title picked for the conversation in
  // progress. The pick is forgotten at the start of every conversation, so each one begins with a plain "Hello.".
  const addressModeRef = useRef(user?.addressMode);
  addressModeRef.current = user?.addressMode;
  const sessionTitleRef = useRef<AddressTitle | null>(null);
  const addressRef = (): AddressAs => ({ mode: addressModeRef.current, title: sessionTitleRef.current });
  // Reminders and calendar rows belong to the auth user, not the profile.
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const setError = useCallback((message: string | null) => {
    errorRef.current = message;
    setErrorState(message);
  }, []);
  const openRef = useRef(open);
  openRef.current = open;
  const prefillRef = useRef({ setPrefill, resetAgent });
  prefillRef.current = { setPrefill, resetAgent };

  // Words arrive many times a second; they are put on screen at most every 150 ms so the whole app is not re-rendered
  // for each one (that stole time from the microphone and speaker on slower phones).
  const textBuffer = useRef({ user: '', assistant: '' });
  const textFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushText = () => {
    if (textFlushTimer.current) clearTimeout(textFlushTimer.current);
    textFlushTimer.current = null;
    const { user: u, assistant: a } = textBuffer.current;
    textBuffer.current = { user: '', assistant: '' };
    if (u) setUserText((prev) => prev + u);
    if (a) setAssistantText((prev) => prev + a);
  };
  const queueTextFlush = () => {
    if (!textFlushTimer.current) textFlushTimer.current = setTimeout(flushText, 150);
  };

  // A new user turn starts after the assistant finished talking.
  const assistantDone = useRef(true);
  const errorRef = useRef<string | null>(null);
  const lastStateRef = useRef<LiveState>('idle');

  const clientRef = useRef<AssistantEngine | null>(null);
  if (!clientRef.current) {
    clientRef.current = new AssistantEngine({
      // Refreshes an expired login so reconnects after the first hour still work.
      getAccessToken: async () => (await getValidSessionRef.current())?.access_token ?? tokenRef.current,
      onAuthRejected: () => { void verifySessionRef.current(); },
      getSystemInstruction: () => buildSystemInstruction(personaRef.current, nameRef.current, addressRef(), clientRef.current?.activeEngine ?? 'gemini'),
      functionDeclarations: FUNCTION_DECLARATIONS,
      getVoiceName: () => personaRef.current.voice,
      getGreetingPrompt: () => {
        const resume = resumeNoteRef.current;
        resumeNoteRef.current = null;
        if (resume) return resume;
        const report = takeReport();
        return report
          ? `A phone call you made for the user has just finished. Do not greet them: tell them right away, briefly, in the language they speak. Facts: ${JSON.stringify(describeCall(report))}. Say who picked up and what was said or agreed. If it did not connect (status no-answer, busy, voicemail or failed) say so and offer to try again. If there is a next step, tell them. Then wait.`
          : buildGreetingPrompt(personaRef.current, addressRef());
      },
      getSarvamSpeaker: () => sarvamSpeakerFor(personaRef.current.voice),
      getLanguage: () => personaRef.current.language,
      getGreetingLine: () => {
        if (resumeNoteRef.current) {
          resumeNoteRef.current = null;
          return 'Welcome back. Would you like more pictures, maybe from Instagram?';
        }
        const report = takeReport();
        return report ? spokenReport(report) : buildGreetingLine(personaRef.current, addressRef());
      },
      onState: (s) => {
        const before = lastStateRef.current;
        lastStateRef.current = s;
        setState(s);
        // Idle timeout or stop: the panel goes away, the connection stays warm.
        // (An error keeps the panel up so the user can read it.) Only a conversation that was actually running can end
        // this way: a warm-up finishing in the background (idle -> ready) must not close a panel that is still opening.
        if (s === 'ready' && openRef.current && !errorRef.current && (before === 'listening' || before === 'speaking')) {
          setOpen(false);
          setMinimized(false);
        }
      },
      onTranscript: (role, text, final) => {
        if (role === 'user') {
          if (assistantDone.current) {
            // First words of a new turn: clear the previous exchange.
            assistantDone.current = false;
            turnRef.current = { heard: '', said: '', tools: 0, nudged: false };
            textBuffer.current = { user: '', assistant: '' };
            setUserText('');
            setAssistantText('');
          }
          textBuffer.current.user += text;
          turnRef.current.heard += text;
          queueTextFlush();
        } else if (final) {
          assistantDone.current = true;
          flushText();
          // The answer is finished: did it claim something it never did?
          const t = turnRef.current;
          const missed = t.nudged ? null : missedTool(t.said, t.heard, t.tools);
          if (missed) {
            t.nudged = true;
            console.warn(`[assistant] said it was done but never called ${missed.tool}: telling it`);
            clientRef.current?.sendText(missed.nudge);
          }
        } else {
          textBuffer.current.assistant += text;
          turnRef.current.said += text;
          queueTextFlush();
        }
      },
      onLevels: (levels) => {
        rawLevels.current = levels;
      },
      onToolCall: (call) => {
        turnRef.current.tools++;
        return runAssistantTool(call, {
          router,
          setPrefill: (data) => {
            // Start each task from a clean slate so old details don't leak into new forms.
            prefillRef.current.resetAgent();
            prefillRef.current.setPrefill(data);
          },
          onAction: setActionLabel,
          getAccessToken: async () => (await getValidSessionRef.current())?.access_token ?? tokenRef.current,
          onAuthRejected: () => { void verifySessionRef.current(); },
          getUserId: () => userIdRef.current,
          // Through the ref, not `client`: that is assigned below, and referring to it here would
          // make the engine's type depend on itself.
          setLanguage: (language) => clientRef.current!.setLanguage(language),
          showNews: (panel) => setNews(panel),
          showCapabilities: (category) => {
            setNews(null);
            setMinimized(true);
            router.push({ pathname: '/features', params: category ? { category } : {} } as never);
          },
          // Let the assistant finish its sentence IN the app, then open the browser; coming back resumes the conversation.
          openAfterReply: (url, subject, backNote) => {
            awayRef.current = { subject, at: Date.now(), note: backNote };
            let waited = 0;
            let spoke = false;
            const timer = setInterval(() => {
              waited += 200;
              const st = clientRef.current?.getState();
              if (st === 'speaking') spoke = true;
              if (!((spoke && st !== 'speaking') || waited >= (spoke ? 9000 : 3500))) return;
              clearInterval(timer);
              Linking.openURL(url).catch(() => { awayRef.current = null; });
            }, 200);
          },
          setUserTitle: (title) => {
            const mode = addressModeRef.current;
            if (mode === 'sir' || mode === 'madam') return { ok: false, error: "The user chose how to be addressed in Settings: keep using that." };
            if (clientRef.current?.activeEngine === 'sarvam') return { ok: false, error: 'You cannot hear the voice in this mode: use no title unless the user tells you what to call them.' };
            sessionTitleRef.current = title;
            return { ok: true };
          },
          // A reminder created by voice has to reach the phone's own scheduler straight away,
          // otherwise it would not fire until the next time the app was opened.
          onRemindersChanged: () => {
            void (async () => {
              const token = (await getValidSessionRef.current())?.access_token ?? tokenRef.current;
              if (token) await syncScheduledReminders(token, { ask: true });
            })();
          },
          watchAiCall: (id, scheduled) => void aiCallWatcher.watch(id, { scheduled }),
          // Release the audio engine before the phone/browser/another app takes over, so
          // coming back never has to re-grab audio focus from a stale engine.
          onLeaveApp: () => {
            setOpen(false);
            client.stopListening();
          },
        });
      },
      onError: setError,
    });
  }
  const client = clientRef.current;

  // Warm the connection while logged in and the app is in the foreground.
  // The saved login counts at once: the app restores the user from the phone in a moment, while renewing an expired token
  // can take seconds on a slow network. The connection's own token request waits for that renewal, so warming starts
  // during the splash instead of after it.
  const loggedIn = !!(session?.access_token || user?.id);
  // What the assistant remembers is read ahead of the next conversation (and forgotten when the user logs out).
  useEffect(() => {
    if (loggedIn) void refreshMemories(tokenRef.current);
    else clearMemoryCache();
  }, [loggedIn]);
  // Don't connect before we know which voice/persona to use (a cached persona counts as known).
  const personaKnown = personaStatus !== 'loading';
  useEffect(() => {
    bootLog('assistant: start-up check | logged in =', loggedIn, '| persona known =', personaKnown, '| app state =', AppState.currentState);
    if (!loggedIn || !personaKnown) {
      client.shutdown();
      setOpen(false);
      return;
    }
    bootLog(`assistant: WARMING NOW (app is ${AppState.currentState})`);
    if (AppState.currentState === 'active') client.warm();

    let bgTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (next) => {
      if (__DEV__) console.log(`[app] state -> ${next}`);
      if (next === 'active') {
        if (bgTimer) clearTimeout(bgTimer);
        bgTimer = null;
        client.warm();
        // Back from the pictures the assistant opened: pick the conversation up again with one short line.
        const away = awayRef.current;
        awayRef.current = null;
        if (away && Date.now() - away.at < 90_000 && !openRef.current) {
          resumeNoteRef.current = away.note ?? `[The user is back from looking at pictures of ${away.subject}. This is the same conversation, so do not greet them. In one short sentence ask if they want more, for example from Instagram or Facebook. Then wait.]`;
          setOpen(true);
          setMinimized(false);
          void client.startListening();
        }
        return;
      }
      // 'inactive' is just a blip, and the system permission dialogs (microphone, contacts, phone) also make
      // the app look backgrounded for a moment. Only shut down after a real departure.
      if (next !== 'background' || client.isRequestingPermission() || isPermissionDialogOpen()) return;
      // Let go of the mic and the speaker at once (another app is taking over); the connection stays warm for a minute,
      // so coming back from WhatsApp finds it ready.
      if (openRef.current) {
        setOpen(false);
        setMinimized(false);
        client.stopListening();
      }
      client.releaseAudio();
      bgTimer = setTimeout(() => {
        bgTimer = null;
        if (client.isRequestingPermission() || isPermissionDialogOpen()) return;
        client.shutdown();
        setOpen(false);
        setMinimized(false);
      }, 60_000);
    });
    return () => {
      sub.remove();
      if (bgTimer) clearTimeout(bgTimer);
    };
  }, [loggedIn, personaKnown, client]);

  // Reading the whole address book blocks the JS thread for a moment, so it is done once, a while after login when
  // nothing else is going on, instead of during the user's first sentence (that made the mic stutter).
  useEffect(() => {
    if (!loggedIn) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => void warmContacts(), 10_000);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [loggedIn]);

  // Calls that were still going when the app was closed get reported when it opens again.
  useEffect(() => {
    if (loggedIn) void aiCallWatcher.resume();
    else aiCallWatcher.stop();
    return () => aiCallWatcher.stop();
  }, [loggedIn, aiCallWatcher]);

  // A changed voice, name or personality needs a fresh session to take effect.
  const personaKey = `${persona.voice}|${persona.name}|${persona.personality}|${persona.language}|${persona.customNote}|${user?.addressMode ?? ''}`;
  const lastPersonaKey = useRef(personaKey);
  useEffect(() => {
    if (lastPersonaKey.current === personaKey) return;
    lastPersonaKey.current = personaKey;
    client.refresh();
  }, [personaKey, client]);

  // Drives the shared animation level while the assistant is up.
  useEffect(() => {
    if (!open) {
      level.setValue(0);
      return;
    }
    let current = 0;
    const timer = setInterval(() => {
      const { input, output } = rawLevels.current;
      const target = Math.min(1, Math.max(output * 1.6, input * 1.3));
      current += (target - current) * (target > current ? 0.55 : 0.2);
      Animated.timing(level, {
        toValue: current,
        duration: 90,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }, 50);
    return () => clearInterval(timer);
  }, [open, level]);

  // While the orb is minimised the user is working on screen, so be patient with silence.
  useEffect(() => {
    client.setIdleTimeout(minimized ? 180_000 : 90_000);
    client.setNudges(!minimized);
  }, [minimized, client]);

  const close = useCallback(() => {
    setNews(null);
    setOpen(false);
    setMinimized(false);
    setActionLabel('');
    client.stopListening();
  }, [client]);

  const toggle = useCallback(() => {
    if (openRef.current) {
      close();
      return;
    }
    setError(null);
    setUserText('');
    setAssistantText('');
    textBuffer.current = { user: '', assistant: '' };
    setActionLabel('');
    assistantDone.current = true;
    setMinimized(false);
    setOpen(true);
    sessionTitleRef.current = null;
    if (__DEV__) console.log(`[tap] mic button pressed at ${new Date().toISOString()} | engine ${client.activeEngine}`);
    void client.startListening();
  }, [client, close]);

  const ask = useCallback((prompt: string) => {
    if (!openRef.current) toggle();
    // Wait (up to ~12s) for the connection, then put the question to it.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const s = client.getState();
      if (s === 'listening' || s === 'speaking') {
        clearInterval(timer);
        client.sendText(prompt);
      } else if (tries > 48 || s === 'error') {
        clearInterval(timer);
      }
    }, 250);
  }, [client, toggle]);

  const clearNews = useCallback(() => setNews(null), []);

  // Whenever the assistant goes away (closed, idle, left the app) the headlines go with it.
  useEffect(() => {
    if (!open) setNews(null);
  }, [open]);

  const openStory = useCallback((story: Story) => {
    setNews(null);
    setMinimized(true);
    router.push({ pathname: '/news-story', params: { title: story.title, source: story.source, url: story.url, at: story.at } } as never);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setUserText('');
    setAssistantText('');
    textBuffer.current = { user: '', assistant: '' };
    sessionTitleRef.current = null;
    void client.startListening();
  }, [client, setError]);

  // A call ended while the assistant was closed: open it again and let it tell the user what happened.
  const speakCallResult = useCallback(
    (call: AiCall) => {
      pendingReport.current = { call, at: Date.now() };
      setError(null);
      setUserText('');
      setAssistantText('');
      textBuffer.current = { user: '', assistant: '' };
      setActionLabel('');
      assistantDone.current = true;
      setMinimized(false);
      setOpen(true);
      sessionTitleRef.current = null;
    void client.startListening();
    },
    [client, setError],
  );
  speakCallResultRef.current = speakCallResult;
  setActionLabelRef.current = setActionLabel;

  const value = useMemo<VoiceAssistantValue>(
    () => ({
      state,
      open,
      minimized,
      setMinimized,
      userText,
      assistantText,
      actionLabel,
      error,
      level,
      toggle,
      ask,
      close,
      retry,
      news,
      clearNews,
      openStory,
    }),
    [state, open, minimized, userText, assistantText, actionLabel, error, level, toggle, ask, close, retry, news, clearNews, openStory],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoiceAssistant(): VoiceAssistantValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVoiceAssistant must be used within VoiceAssistantProvider');
  return ctx;
}
