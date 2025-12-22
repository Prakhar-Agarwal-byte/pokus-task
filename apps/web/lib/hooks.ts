'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for persisting state to localStorage.
 * Provides automatic save/restore of state across page refreshes.
 * 
 * Uses a two-phase approach to avoid hydration mismatches:
 * 1. Initial render uses initialValue (matches server)
 * 2. After mount, reads from localStorage and updates state
 * 
 * @param key - The localStorage key to use
 * @param initialValue - The initial value if nothing is stored
 * @returns [value, setValue, clearValue] - Similar to useState but persisted
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Always start with initialValue to match server-side render
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // After hydration, load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(parsed);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key]);

  // Persist to localStorage whenever state changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, state, isHydrated]);

  // Clear the stored value
  const clearValue = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    setState(initialValue);
  }, [key, initialValue]);

  return [state, setState, clearValue];
}

/**
 * Custom hook for managing conversation history with persistence.
 */
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useConversationHistory(taskKey: string) {
  const [messages, setMessages, clearMessages] = usePersistedState<ConversationMessage[]>(
    `pokus_conversation_${taskKey}`,
    []
  );

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const message: ConversationMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  }, [setMessages]);

  const getRecentMessages = useCallback((limit: number = 10) => {
    return messages.slice(-limit);
  }, [messages]);

  return {
    messages,
    addMessage,
    clearMessages,
    getRecentMessages,
    messageCount: messages.length,
  };
}

/**
 * Hook for session tracking - useful for analytics and debugging
 */
export function useSessionTracking() {
  const [sessionId] = usePersistedState<string>(
    'pokus_session_id',
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const [sessionStart] = usePersistedState<number>(
    'pokus_session_start',
    Date.now()
  );

  return {
    sessionId,
    sessionStart,
    sessionDuration: Date.now() - sessionStart,
  };
}
