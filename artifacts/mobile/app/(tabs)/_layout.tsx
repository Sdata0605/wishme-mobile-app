import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NeonTabBar } from '@/components/neon/NeonTabBar';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { TourProvider } from '@/context/TourContext';
import { DrawerMenu } from '@/components/DrawerMenu';

export const unstable_settings = { initialRouteName: 'assistant' };

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarH = 66 + insets.bottom;

  return (
    <TourProvider>
    <View style={styles.root}>
      <DrawerMenu>
        <Tabs
          initialRouteName="assistant"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tabBar={(props: any) => <NeonTabBar {...props} />}
          screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#1B0829' } }}
        >
          {/* The app opens on the AI home (the centre mic); Home is the WishMe home. */}
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="all-services" options={{ title: 'Services' }} />
          <Tabs.Screen name="assistant" options={{ title: 'Assistant' }} />
          <Tabs.Screen name="hub" options={{ title: 'Hub' }} />
          <Tabs.Screen name="profile" options={{ title: 'You' }} />

          {/* Still reachable from Home, the menu and the assistant, just not in the tab bar */}
          <Tabs.Screen name="scan-pay" options={{ href: null, tabBarStyle: { display: 'none' } }} />
          <Tabs.Screen name="wallet" options={{ href: null }} />
          <Tabs.Screen name="celebrities" options={{ href: null }} />
          <Tabs.Screen name="music" options={{ href: null }} />
          <Tabs.Screen name="voice-call" options={{ href: null }} />
        </Tabs>
      </DrawerMenu>
      <TourOverlay tabBarHeight={tabBarH} />
    </View>
    </TourProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
