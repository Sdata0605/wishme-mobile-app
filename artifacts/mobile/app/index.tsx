import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarded').then((val) => {
      setOnboarded(val === 'true');
    });
  }, []);

  if (isLoading || onboarded === null) return null;

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/(auth)" />;
  return <Redirect href="/(tabs)" />;
}
