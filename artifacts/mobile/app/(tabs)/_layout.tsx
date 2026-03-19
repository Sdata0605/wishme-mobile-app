import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DrawerMenu } from '@/components/DrawerMenu';
import { useTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <DrawerMenu>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: isIOS ? 'transparent' : isDark ? colors.card : '#fff',
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: colors.border,
            elevation: 0,
            height: isWeb ? 84 : 60,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? colors.card : '#fff' }]} />
            ),
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) =>
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={size} />
              ) : (
                <Feather name="home" size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="celebrities"
          options={{
            title: 'Stars',
            tabBarIcon: ({ color, size }) =>
              isIOS ? (
                <SymbolView name="star" tintColor={color} size={size} />
              ) : (
                <Feather name="star" size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="music"
          options={{
            title: 'Music',
            tabBarIcon: ({ color, size }) =>
              isIOS ? (
                <SymbolView name="music.note" tintColor={color} size={size} />
              ) : (
                <Feather name="music" size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="voice-call"
          options={{
            title: 'Calls',
            tabBarIcon: ({ color, size }) =>
              isIOS ? (
                <SymbolView name="phone" tintColor={color} size={size} />
              ) : (
                <Feather name="phone" size={size} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) =>
              isIOS ? (
                <SymbolView name="person" tintColor={color} size={size} />
              ) : (
                <Feather name="user" size={size} color={color} />
              ),
          }}
        />
      </Tabs>
    </DrawerMenu>
  );
}
