import { Stack } from 'expo-router';
import React from 'react';

/** Settings is a list screen; each option opens its own screen on top of it. */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
