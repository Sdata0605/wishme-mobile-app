import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'user' | 'celebrity';
  walletBalance: number;
  memberSince: string;
  referralCode: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string, phone: string, referral?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_USER: User = {
  id: 'usr_001',
  firstName: 'Arjun',
  lastName: 'Mehta',
  email: 'arjun@example.com',
  phone: '9876543210',
  role: 'user',
  walletBalance: 2500,
  memberSince: '2024-01-15',
  referralCode: 'ARJUN2025',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then((val) => {
      if (val) setUser(JSON.parse(val));
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (_email: string, _password: string) => {
    const u = { ...MOCK_USER, email: _email };
    setUser(u);
    await AsyncStorage.setItem('user', JSON.stringify(u));
  }, []);

  const signup = useCallback(async (email: string, _password: string, firstName: string, lastName: string, phone: string) => {
    const u: User = {
      ...MOCK_USER,
      id: 'usr_' + Date.now(),
      email,
      firstName,
      lastName,
      phone,
      walletBalance: 0,
      memberSince: new Date().toISOString().split('T')[0],
      referralCode: (firstName.toUpperCase() + '2025').slice(0, 10),
    };
    setUser(u);
    await AsyncStorage.setItem('user', JSON.stringify(u));
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem('user');
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
