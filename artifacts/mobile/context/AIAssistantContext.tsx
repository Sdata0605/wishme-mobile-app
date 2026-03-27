import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';

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
}

interface AIAssistantContextValue {
  messages: AIMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isTyping: boolean;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (content: string, isVoice?: boolean) => Promise<string>;
  clearMessages: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextValue | null>(null);

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef<AIMessage[]>([]);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
  }, []);

  const sendMessage = useCallback(async (content: string, isVoice = false): Promise<string> => {
    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      isVoiceInput: isVoice,
    };

    const next = [...messagesRef.current, userMsg];
    messagesRef.current = next;
    setMessages([...next]);
    setIsLoading(true);
    setIsTyping(true);

    const fallback = "Sorry, I'm having trouble connecting right now. Please try again.";

    try {
      const history = messagesRef.current
        .slice(-9, -1)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await supabaseFetch(
        '/functions/v1/ai-assistant',
        {
          method: 'POST',
          body: JSON.stringify({
            query: content,
            conversationHistory: history,
            context: {
              currentRoute: '/',
              userRole: user?.role ?? 'user',
              userId: user?.id ?? null,
              isVoiceInput: isVoice,
            },
            model: 'google/gemini-2.5-flash',
          }),
        },
        session?.access_token,
      );

      let data: { message?: string; actions?: AIAction[]; suggestions?: string[] } = {};
      if (res.ok) {
        data = await res.json();
      }

      const responseText = data.message || fallback;
      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        actions: data.actions,
        suggestions: data.suggestions,
        isError: !res.ok,
      };

      const withReply = [...messagesRef.current, assistantMsg];
      messagesRef.current = withReply;
      setMessages([...withReply]);
      return responseText;
    } catch {
      const errMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
        isError: true,
      };
      const withErr = [...messagesRef.current, errMsg];
      messagesRef.current = withErr;
      setMessages([...withErr]);
      return fallback;
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [user, session]);

  return (
    <AIAssistantContext.Provider value={{
      messages,
      isOpen,
      isLoading,
      isTyping,
      openChat,
      closeChat,
      sendMessage,
      clearMessages,
    }}>
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) throw new Error('useAIAssistant must be used within AIAssistantProvider');
  return ctx;
}
