import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export default function AuthLayout() {
  const { neon } = useTheme();
  return (
    // The page colour behind the cards, so nothing light flashes while a screen fades or slides in.
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: neon.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}
