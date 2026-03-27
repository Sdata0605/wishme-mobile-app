import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerMenu } from '@/components/DrawerMenu';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const TAB_CONTENT_H = isWeb ? 84 : 60;
  const tabBarH = TAB_CONTENT_H + (isWeb ? 0 : insets.bottom);

  return (
    <View style={styles.root}>
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
              height: tabBarH,
              paddingBottom: isWeb ? 0 : insets.bottom,
            },
            tabBarBackground: () =>
              isIOS ? (
                <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? colors.card : '#fff' }]} />
              ),
            tabBarShowLabel: true,
            tabBarLabelStyle: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 4 },
            tabBarIconStyle: { marginTop: 6 },
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
                  <Icon name="home" size={size} color={color} />
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
                  <Icon name="star" size={size} color={color} />
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
                  <Icon name="music" size={size} color={color} />
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
                  <Icon name="phone" size={size} color={color} />
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
                  <Icon name="user" size={size} color={color} />
                ),
            }}
          />
        </Tabs>
      </DrawerMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
