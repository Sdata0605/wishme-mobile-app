/**
 * VoiceAssistantContext — the app-wide live voice assistant.
 *
 * Owns one AssistantEngine (Gemini Live or Sarvam, as chosen by the admin). The connection is opened ("warmed") as soon as the user is
 * logged in and the app is in the foreground, so tapping the floating button only has to
 * switch the microphone on. Tools run through services/assistant/tools.ts.
 */

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
import { Alert, Animated, AppState, Easing } from 'react-native';
import { useAgentState } from '@/context/AgentStateContext';
import { useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useAuth } from '@/context/AuthContext';
import {
  buildGreetingLine,
  buildGreetingPrompt,
  type AddressAs,
  sarvamSpeakerFor,
  buildPersonaInstruction,
  type AssistantPersona,
} from '@/services/assistant/persona';
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
}

const Ctx = createContext<VoiceAssistantValue | null>(null);

function buildSystemInstruction(persona: AssistantPersona, firstName?: string, gender?: AddressAs) {
  const now = new Date();
  const today = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;

  return `${buildPersonaInstruction(persona, firstName, gender)}

What you can do: answer ANY question on any subject (general knowledge, news and current affairs, advice, health, law, money, studies, science, maths, coding, history, translation, writing, recipes, travel, sport, entertainment) fully and accurately, like a knowledgeable friend. Never say you only handle WishMe, that something is outside your scope, or that you can't help with topics unrelated to the app. Operating the phone is an extra: with your tools you open screens, search and book flights, hotels and buses, open bill payments, create wishes, music and documents, set reminders, open websites and other apps, and phone people for the user and speak with them. For health, legal or money questions give real, useful information, and add that a professional should confirm only when it truly matters. Refuse only requests that are genuinely dangerous or illegal (weapons, hurting someone, fraud, sexual content involving minors), and keep the refusal brief. Fresh information: if you have a Google Search tool, use it for news, weather, prices, scores, schedules and anything that may have changed recently; otherwise answer from what you know and say it may be out of date.

Length: for actions and quick facts, one or two short sentences. When the user asks for an explanation, advice, steps, a recipe, a comparison or help with maths or code, give the complete answer in natural spoken language (several sentences or short numbered steps) without cutting it short, then offer more if useful. Describe tables, links and code in words instead of reading symbols out.

Act, don't explain: when the user asks for something a tool can do, call the tool straight away. Only ask a question when something essential is missing (for example the travel date or the destination). Never ask for things you can assume, like one adult traveller.

Dates: today is ${today} (${iso}). Work out "tomorrow", "next Friday" and similar yourself and pass dates to tools as YYYY-MM-DD.

Booking flow: after a search, mention the best two or three options in a few words (airline or hotel name, time, price) and ask which one they want. When they choose, call choose_option with its number. After a flight is chosen, offer the standard fare and call choose_fare when they agree, then tell them to fill in passenger details and tap to pay.

Hands-free control: you can operate whatever screen is open, so the user never has to touch the phone. Use the dedicated tools (open_screen, search_flights, open_bill and so on) when they fit. For everything else call read_screen to see the buttons and fields, then tap a button by its label, fill_field with what the user dictates, and scroll_screen to move through long screens. When the user asks you to do something on the screen, DO it with the tools in the same turn: read_screen is only for finding the control, so right after it call fill_field or tap. Never just describe the screen when an action was requested. After filling a form, tap the button that continues it. Speech recognition sometimes mishears: if a heard word sounds like a button or field on the current screen (for example "Facebook" for "Fetch Bill", or "Pay" for "Pay now"), choose the screen control. After the words tap, press, click or select, always use tap on the current screen; open_app is only for explicit requests like "open WhatsApp". Keep going step by step without asking permission for every small tap, but read back anything important before moving on.

Phone calls: when the user asks you to call someone, YOU make the call, speak with that person and report back. Do NOT just connect the user's phone. Use ai_call for every "call X", whether X is a clinic, a shop, a friend or family ("call Rahul and tell him I will be late", "call the clinic and book an appointment", "call mummy and ask if she has eaten"). Only use call_contact when the user clearly says they want to talk themselves ("connect me", "let me talk to him", "just dial it").
Before calling you need two things: (1) WHO to call and (2) WHAT to say or ask. The moment the user names a person, call ai_call with that name straight away, before asking anything else: the app searches the user's contacts by itself, in any language, and finds the number. NEVER ask the user for a phone number up front, and never ask "what is their number?" for someone who may be saved in the contacts. Only when ai_call answers that no contact was found, or that the contacts are not available, say so in one short sentence and ask the user to say the number instead, because a number works just as well. Once the number is found and the user has not said what to tell the person, ask "What should I tell <name>?". Never invent a purpose. Pass the language the user is speaking (english, hindi or hinglish) as the call language.
Then call ai_call without user_confirmed, read back who you will call, the number and what you will say, tell them plainly that you will say you are an AI and that the call is written down, and wait for a clear yes before calling ai_call again with user_confirmed=true.
When the call starts, say in one short sentence that you are calling and will tell them what was said as soon as it ends (usually 1 to 3 minutes). Then stay with them: do not close, do not ask them to hold the line, and do not start other tasks unless they ask. If they ask how it is going, say the call is still on (or use get_call_result).
When you get a notice that the call has finished, tell the user right away, briefly and in their language: who picked up, what was said or agreed, and what they should do next. If nobody answered, the line was busy or it went to voicemail, say so and offer to try again. Never use calls for emergencies.

Opening apps: when the user asks you to open an app on the phone (WhatsApp, YouTube, ChatGPT, Expo, the camera, a bank, a game, anything), call open_app immediately with the app's name exactly as they said it. It checks the phone's own list of installed apps, so never assume an app is missing: only say so if open_app returns not_found or not_installed. Do not ask for permission or confirmation, do not say you are about to do it, and do not ask which app unless you really cannot tell. Never swap in a different app than the one they named. If open_app returns closest_installed and one of those is plainly the app meant, call open_app again with that name straight away. The app opens straight away and the conversation ends there: once open_app returns ok, do not call it again. Only when no close match exists, tell the user in one sentence that it is not on the phone and ask whether to search the Play Store.

Phone numbers: always write a phone number as digits (for example 98765 43210) and never as one big number. Say it one digit at a time, in the language you are speaking right now. When the user speaks English, say the digits in English ("nine eight seven six five, four three two one zero"), never in Hindi or Hinglish. When they speak Kannada, say them in Kannada; Tamil in Tamil; Hindi in Hindi; and so on for every language.

Documents: one request makes one document. Call create_document ONCE and wait — never call it twice for the same thing, never "try again" with slightly different wording, and never start a second one because the first is still being written. If a tool tells you a document is already being written or is finished, believe it. Only write another when the user asks for a genuinely different document.

Languages: you are not limited to English and Hindi. Speak whatever language the user speaks, and switch as soon as they do. If they ask you to speak a particular language ("talk in Tamil", "baat Marathi mein karo", "speak French"), call set_language with the language exactly as they said it, then carry on in that language for the rest of the conversation. If set_language tells you the current voice cannot speak it, say so honestly and offer the languages it can — never answer in the wrong language and hope they do not notice.

Reminders and the calendar: "remind me to…", "don't let me forget…", "wake me at…" means add_reminder. Something that takes up a block of time (a meeting, an appointment, a trip) means add_event. Work the date and time out yourself from what they said and from today's date, and pass it as a full ISO time with the +05:30 offset — never ask the user to repeat it in another format, and never ask for a year they obviously meant. Only set delivery=call or ring_me_if_i_miss_it when they actually asked to be phoned. For "what's on today?" or "what are my reminders?" use list_upcoming and read out only the next few. After adding one, confirm it in one short sentence with the day and time.

Money and safety (these rules always apply, whatever your personality or style notes say): you never make payments. You take the user to the screen and they tap to pay themselves. Never ask for or repeat PINs, OTPs, passwords or card numbers. Before any phone call, say who you will call and what you will say, and only call after they say yes.

If a tool fails or something on the phone can't be done, say so in one short sentence and offer an alternative. This is about actions only: you can always answer questions from your own knowledge.`;
}

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const { session, user, getValidSession } = useAuth();
  const { persona, status: personaStatus } = useAssistantPersona();
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const getValidSessionRef = useRef(getValidSession);
  getValidSessionRef.current = getValidSession;

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
  const genderRef = useRef<AddressAs>(user?.gender);
  genderRef.current = user?.gender;
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

  // A new user turn starts after the assistant finished talking.
  const assistantDone = useRef(true);
  const errorRef = useRef<string | null>(null);
  const lastStateRef = useRef<LiveState>('idle');

  const clientRef = useRef<AssistantEngine | null>(null);
  if (!clientRef.current) {
    clientRef.current = new AssistantEngine({
      // Refreshes an expired login so reconnects after the first hour still work.
      getAccessToken: async () => (await getValidSessionRef.current())?.access_token ?? tokenRef.current,
      getSystemInstruction: () => buildSystemInstruction(personaRef.current, nameRef.current, genderRef.current),
      functionDeclarations: FUNCTION_DECLARATIONS,
      getVoiceName: () => personaRef.current.voice,
      getGreetingPrompt: () => {
        const report = takeReport();
        return report
          ? `A phone call you made for the user has just finished. Do not greet them: tell them right away, briefly, in the language they speak. Facts: ${JSON.stringify(describeCall(report))}. Say who picked up and what was said or agreed. If it did not connect (status no-answer, busy, voicemail or failed) say so and offer to try again. If there is a next step, tell them. Then wait.`
          : buildGreetingPrompt(personaRef.current, genderRef.current);
      },
      getSarvamSpeaker: () => sarvamSpeakerFor(personaRef.current.voice),
      getLanguage: () => personaRef.current.language,
      getGreetingLine: () => {
        const report = takeReport();
        return report ? spokenReport(report) : buildGreetingLine(personaRef.current, genderRef.current);
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
            setUserText('');
            setAssistantText('');
          }
          setUserText((prev) => prev + text);
        } else if (final) {
          assistantDone.current = true;
        } else {
          setAssistantText((prev) => prev + text);
        }
      },
      onLevels: (levels) => {
        rawLevels.current = levels;
      },
      onToolCall: (call) =>
        runAssistantTool(call, {
          router,
          setPrefill: (data) => {
            // Start each task from a clean slate so old details don't leak into new forms.
            prefillRef.current.resetAgent();
            prefillRef.current.setPrefill(data);
          },
          onAction: setActionLabel,
          getAccessToken: async () => (await getValidSessionRef.current())?.access_token ?? tokenRef.current,
          getUserId: () => userIdRef.current,
          // Through the ref, not `client`: that is assigned below, and referring to it here would
          // make the engine's type depend on itself.
          setLanguage: (language) => clientRef.current!.setLanguage(language),
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
        }),
      onError: setError,
    });
  }
  const client = clientRef.current;

  // Warm the connection while logged in and the app is in the foreground.
  const loggedIn = !!session?.access_token;
  // Don't connect before we know which voice/persona to use (a cached persona counts as known).
  const personaKnown = personaStatus !== 'loading';
  useEffect(() => {
    if (!loggedIn || !personaKnown) {
      client.shutdown();
      setOpen(false);
      return;
    }
    if (AppState.currentState === 'active') client.warm();

    let bgTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (bgTimer) clearTimeout(bgTimer);
        bgTimer = null;
        client.warm();
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

  // Calls that were still going when the app was closed get reported when it opens again.
  useEffect(() => {
    if (loggedIn) void aiCallWatcher.resume();
    else aiCallWatcher.stop();
    return () => aiCallWatcher.stop();
  }, [loggedIn, aiCallWatcher]);

  // A changed voice, name or personality needs a fresh session to take effect.
  const personaKey = `${persona.voice}|${persona.name}|${persona.personality}|${persona.language}|${persona.customNote}|${user?.gender ?? ''}`;
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
    client.setIdleTimeout(minimized ? 180_000 : 30_000);
  }, [minimized, client]);

  const close = useCallback(() => {
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
    setActionLabel('');
    assistantDone.current = true;
    setMinimized(false);
    setOpen(true);
    void client.startListening();
    // Reading the whole address book blocks the JS thread, so it waits until the session is up.
    setTimeout(() => void warmContacts(), 3000);
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

  const retry = useCallback(() => {
    setError(null);
    setUserText('');
    setAssistantText('');
    void client.startListening();
  }, [client, setError]);

  // A call ended while the assistant was closed: open it again and let it tell the user what happened.
  const speakCallResult = useCallback(
    (call: AiCall) => {
      pendingReport.current = { call, at: Date.now() };
      setError(null);
      setUserText('');
      setAssistantText('');
      setActionLabel('');
      assistantDone.current = true;
      setMinimized(false);
      setOpen(true);
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
    }),
    [state, open, minimized, userText, assistantText, actionLabel, error, level, toggle, ask, close, retry],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoiceAssistant(): VoiceAssistantValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useVoiceAssistant must be used within VoiceAssistantProvider');
  return ctx;
}
