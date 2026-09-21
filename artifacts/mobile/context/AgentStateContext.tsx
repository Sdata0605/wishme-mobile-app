/**
 * AgentStateContext
 *
 * Global store that the AI Action Executor writes to and individual screens
 * read from to auto-populate their form fields.
 *
 * Flow:
 *   ActionExecutor.prefill({ occasion: 'Birthday', recipientName: 'Sunita' })
 *   → AgentStateContext stores this
 *   → WishBookingScreen reads agentState.prefill.occasion and pre-fills the form
 *   → ActionExecutor marks step done, moves to next step
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentPrefill {
  // Celebrity wish
  celebrity?: string;
  occasion?: string;
  recipientName?: string;
  message?: string;
  language?: string;
  tone?: string;
  friendName?: string;
  concept?: string;
  brandingDetails?: string;

  // Greeting card / photo wish
  textStyle?: string;

  // Flights
  fromCity?: string;
  toCity?: string;
  travelDate?: string;
  travellers?: string;
  cabin?: string;

  // Hotels
  hotelCity?: string;
  checkIn?: string;
  checkOut?: string;
  rooms?: number;
  adults?: number;

  // Bus
  busFrom?: string;
  busTo?: string;
  busDate?: string;

  // Bills
  billKind?: string;
  billConsumerNumber?: string;
  billOperator?: string;

  // Music
  songTitle?: string;
  songDescription?: string;
  songGenre?: string;
  songMood?: string;
  songLanguage?: string;
  ttsText?: string;
  ttsLanguage?: string;
  sfxPrompt?: string;
  musicTab?: number; // index of the MUSIC_TABS array to auto-select

  // Wallet
  addAmount?: number;

  // Occasions
  occasionPersonName?: string;
  occasionType?: string;
  occasionDate?: string;

  // Generic search
  search?: string;
}

export type AgentStatus =
  | 'idle'
  | 'collecting' // AI is asking follow-up questions
  | 'ready'      // All slots filled, about to execute
  | 'executing'  // Running action steps
  | 'waiting_confirm' // Waiting for user to confirm payment
  | 'done'
  | 'cancelled';

export interface AgentStep {
  type: 'navigate' | 'prefill' | 'confirm' | 'complete' | 'message';
  label: string;
  route?: string;
  serviceView?: string;
  billKind?: string;
  fields?: Partial<AgentPrefill>;
  key?: string;
  value?: unknown;
  message?: string;
}

interface AgentStateContextValue {
  /** Current prefill bag — screens read this */
  prefill: AgentPrefill;
  /** Current agent execution status */
  status: AgentStatus;
  /** Label for the current step being executed */
  currentStepLabel: string;
  /** Steps already completed */
  completedSteps: string[];
  /** Intent currently being processed */
  currentIntent: string | null;

  /** Called by ActionExecutor to update prefill data */
  setPrefill: (data: Partial<AgentPrefill>) => void;
  /** Called by ActionExecutor to set a single prefill key */
  setPrefillKey: <K extends keyof AgentPrefill>(key: K, value: AgentPrefill[K]) => void;
  /** Set the agent status */
  setStatus: (status: AgentStatus) => void;
  /** Set the current step label */
  setCurrentStepLabel: (label: string) => void;
  /** Add a completed step */
  addCompletedStep: (label: string) => void;
  /** Set the current intent */
  setCurrentIntent: (intent: string | null) => void;
  /** Clear everything — called after agent finishes or user cancels */
  resetAgent: () => void;
  /** Check if a prefill key has been set */
  hasPrefill: (key: keyof AgentPrefill) => boolean;
  /** Consume (read + clear) a prefill key — so it's only used once */
  consumePrefill: <K extends keyof AgentPrefill>(key: K) => AgentPrefill[K] | undefined;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AgentStateContext = createContext<AgentStateContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AgentStateProvider({ children }: { children: React.ReactNode }) {
  const [prefill, setPrefillState] = useState<AgentPrefill>({});
  const [status, setStatusState] = useState<AgentStatus>('idle');
  const [currentStepLabel, setCurrentStepLabelState] = useState('');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentIntent, setCurrentIntentState] = useState<string | null>(null);

  const prefillRef = useRef<AgentPrefill>({});

  const setPrefill = useCallback((data: Partial<AgentPrefill>) => {
    prefillRef.current = { ...prefillRef.current, ...data };
    setPrefillState({ ...prefillRef.current });
  }, []);

  const setPrefillKey = useCallback(<K extends keyof AgentPrefill>(
    key: K,
    value: AgentPrefill[K],
  ) => {
    prefillRef.current = { ...prefillRef.current, [key]: value };
    setPrefillState({ ...prefillRef.current });
  }, []);

  const setStatus = useCallback((s: AgentStatus) => {
    setStatusState(s);
  }, []);

  const setCurrentStepLabel = useCallback((label: string) => {
    setCurrentStepLabelState(label);
  }, []);

  const addCompletedStep = useCallback((label: string) => {
    setCompletedSteps((prev) => [...prev, label]);
  }, []);

  const setCurrentIntent = useCallback((intent: string | null) => {
    setCurrentIntentState(intent);
  }, []);

  const resetAgent = useCallback(() => {
    prefillRef.current = {};
    setPrefillState({});
    setStatusState('idle');
    setCurrentStepLabelState('');
    setCompletedSteps([]);
    setCurrentIntentState(null);
  }, []);

  const hasPrefill = useCallback((key: keyof AgentPrefill) => {
    return prefillRef.current[key] !== undefined && prefillRef.current[key] !== '';
  }, []);

  const consumePrefill = useCallback(<K extends keyof AgentPrefill>(
    key: K,
  ): AgentPrefill[K] | undefined => {
    const val = prefillRef.current[key];
    if (val !== undefined) {
      const next = { ...prefillRef.current };
      delete next[key];
      prefillRef.current = next;
      setPrefillState({ ...next });
    }
    return val as AgentPrefill[K] | undefined;
  }, []);

  return (
    <AgentStateContext.Provider
      value={{
        prefill,
        status,
        currentStepLabel,
        completedSteps,
        currentIntent,
        setPrefill,
        setPrefillKey,
        setStatus,
        setCurrentStepLabel,
        addCompletedStep,
        setCurrentIntent,
        resetAgent,
        hasPrefill,
        consumePrefill,
      }}
    >
      {children}
    </AgentStateContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAgentState(): AgentStateContextValue {
  const ctx = useContext(AgentStateContext);
  if (!ctx) throw new Error('useAgentState must be used within AgentStateProvider');
  return ctx;
}

/** Convenience hook for screens that only need to read prefill data */
export function useAgentPrefill(): AgentPrefill {
  return useAgentState().prefill;
}

/** Convenience hook: returns true when the agent is currently active */
export function useIsAgentActive(): boolean {
  const { status } = useAgentState();
  return status !== 'idle' && status !== 'done' && status !== 'cancelled';
}
