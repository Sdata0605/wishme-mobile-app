import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="select-plan" />
      <Stack.Screen name="celebrity-signup" />
    </Stack>
  );
}
