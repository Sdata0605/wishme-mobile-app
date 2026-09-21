/**
 * AIAssistantContext — upgraded with full agentic mode.
 *
 * Handles:
 *  - Chat mode (general Q&A)
 *  - Agent mode (intent → slot filling → action plan → execution)
 *  - In-app agent reasoning engine (fast, zero network failure)
 *  - Connecting ActionExecutor to AgentStateContext
 *  - Confirm / cancel flows
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAgentState } from '@/context/AgentStateContext';
import { executeActionPlan } from '@/context/ActionExecutor';
import { processAgentMessage } from '@/services/agentEngine';

import { voiceService } from '@/services/voiceService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIAction {
  type: 'navigate' | 'fillForm' | 'search' | 'showInfo';
  label: string;
  data: { route?: string };
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AIAction[];
  suggestions?: string[];
  isVoiceInput?: boolean;
  isError?: boolean;
  /** Mode this message was produced in */
  mode?: 'chat' | 'agent';
}

interface AIAssistantContextValue {
  messages: AIMessage[];
  isLoading: boolean;
  isTyping: boolean;
  sendMessage: (content: string, isVoice?: boolean) => Promise<string>;
  clearMessages: () => void;
  /** Currently pending confirmation message (agent waiting for pay/confirm) */
  pendingConfirm: string | null;
  /** User confirmed the agent step */
  confirmAgentStep: () => void;
  /** User cancelled the agent */
  cancelAgent: () => void;
  /** Whether the agent is currently executing steps */
  isAgentExecuting: boolean;
  /** Current execution step label */
  agentStepLabel: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AIAssistantContext = createContext<AIAssistantContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const INITIAL_GREETING = "Hello! How can I help you today?";

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const agentState = useAgentState();

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'init-greeting',
      role: 'assistant',
      content: INITIAL_GREETING,
      timestamp: new Date(),
      suggestions: ['✈️ Book a Flight', '🏨 Book a Hotel', '🎬 Celebrity Wish', '💡 Pay Bill'],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const [agentStepLabel, setAgentStepLabel] = useState('');

  const messagesRef = useRef<AIMessage[]>([
    {
      id: 'init-greeting',
      role: 'assistant',
      content: INITIAL_GREETING,
      timestamp: new Date(),
      suggestions: ['✈️ Book a Flight', '🏨 Book a Hotel', '🎬 Celebrity Wish', '💡 Pay Bill'],
    },
  ]);
  const intentRef = useRef<string | null>(null);
  const slotsRef = useRef<Record<string, unknown>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const confirmResolveRef = useRef<(() => void) | null>(null);
  const confirmCancelRef = useRef<(() => void) | null>(null);

  const clearMessages = useCallback(() => {
    const greetingMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: INITIAL_GREETING,
      timestamp: new Date(),
      suggestions: ['✈️ Book a Flight', '🏨 Book a Hotel', '🎬 Celebrity Wish', '💡 Pay Bill'],
    };
    messagesRef.current = [greetingMsg];
    intentRef.current = null;
    slotsRef.current = {};
    setMessages([greetingMsg]);
    agentState.resetAgent();
    voiceService.speak(INITIAL_GREETING);
  }, [agentState]);

  const addMessage = useCallback((msg: AIMessage) => {
    const next = [...messagesRef.current, msg];
    messagesRef.current = next;
    setMessages([...next]);
  }, []);

  const cancelAgent = useCallback(() => {
    abortControllerRef.current?.abort();
    agentState.setStatus('cancelled');
    setIsAgentExecuting(false);
    setAgentStepLabel('');
    setPendingConfirm(null);
    intentRef.current = null;
    slotsRef.current = {};
    if (confirmCancelRef.current) confirmCancelRef.current();
    const cancelMsg = "I've stopped the task. Let me know if you'd like to do anything else!";
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: cancelMsg,
      timestamp: new Date(),
      mode: 'agent',
    });
    voiceService.speak(cancelMsg);
  }, [agentState, addMessage]);

  const confirmAgentStep = useCallback(() => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current();
      setPendingConfirm(null);
    }
  }, []);

  const sendMessage = useCallback(async (content: string, isVoice = false): Promise<string> => {
    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      isVoiceInput: isVoice,
    };

    addMessage(userMsg);
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Zero typing delay for voice turns for instant sub-second response
      if (!isVoice) {
        await new Promise((r) => setTimeout(r, 200));
      }

      // Process query with in-app Agent Engine
      const result = processAgentMessage(content, intentRef.current, slotsRef.current);

      // Update state tracking
      if (result.mode === 'agent') {
        intentRef.current = result.intent;
        slotsRef.current = result.slots;
        agentState.setCurrentIntent(result.intent);
        agentState.setStatus('collecting');
      }

      const formattedActions: AIAction[] | undefined = result.actions?.map((a) => ({
        type: a.type,
        label: a.label,
        data: { route: a.route },
      }));

      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
        actions: formattedActions,
        suggestions: result.suggestions?.length ? result.suggestions : undefined,
        mode: result.mode,
      };

      addMessage(assistantMsg);

      // Speak assistant message aloud — only for text chat, not voice (voice path speaks itself)
      if (!isVoice) {
        voiceService.speak(result.message);
      }

      // ── Execute Action Plan if available ───────────────────────────────────
      if (result.actionPlan && result.actionPlan.length > 0) {
        const steps = result.actionPlan;

        // Reset in-progress slot collection
        intentRef.current = null;
        slotsRef.current = {};

        const executeDelay = isVoice ? 0 : 50;
        setTimeout(async () => {
          abortControllerRef.current = new AbortController();
          setIsAgentExecuting(true);
          agentState.setStatus('executing');

          await executeActionPlan(
            steps,
            {
              setPrefill: agentState.setPrefill,
              setPrefillKey: agentState.setPrefillKey,
              setStatus: agentState.setStatus,
              setCurrentStepLabel: agentState.setCurrentStepLabel,
              addCompletedStep: agentState.addCompletedStep,
              resetAgent: agentState.resetAgent,
            },
            // onStatus
            (label, stepNum, total) => {
              setAgentStepLabel(`Step ${stepNum}/${total}: ${label}`);
            },
            // onConfirmNeeded
            (message, onConfirm, onCancel) => {
              setPendingConfirm(message);
              confirmResolveRef.current = onConfirm;
              confirmCancelRef.current = onCancel;
            },
            // onDone
            (success, message) => {
              setIsAgentExecuting(false);
              setAgentStepLabel('');
              setPendingConfirm(null);
              addMessage({
                id: Date.now().toString(),
                role: 'assistant',
                content: message,
                timestamp: new Date(),
                mode: 'agent',
              });
            },
            abortControllerRef.current.signal,
          );
        }, executeDelay);
      }

      return result.message;
    } catch {
      const fallbackMsg = "I can help you with celebrity bookings, flights, hotels, bills, music, and more. What would you like to do?";
      const errMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackMsg,
        timestamp: new Date(),
        suggestions: ['🎬 Celebrity Wish', '✈️ Book Flight', '💡 Pay Bill', '🎵 Make a Song'],
      };
      addMessage(errMsg);
      return fallbackMsg;
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [agentState, addMessage]);

  return (
    <AIAssistantContext.Provider
      value={{
        messages,
        isLoading,
        isTyping,
        sendMessage,
        clearMessages,
        pendingConfirm,
        confirmAgentStep,
        cancelAgent,
        isAgentExecuting,
        agentStepLabel,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) throw new Error('useAIAssistant must be used within AIAssistantProvider');
  return ctx;
}
