import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

const STORAGE_ONBOARDING = '@wishme/onboarding_seen';
const STORAGE_USER = '@wishme/user';

export default function Index() {
  useEffect(() => {
    const resolve = async () => {
      try {
        const [seenStr, userStr] = await AsyncStorage.multiGet([
          STORAGE_ONBOARDING,
          STORAGE_USER,
        ]).then((pairs) => [pairs[0][1], pairs[1][1]]);

        if (userStr) {
          try {
            const user = JSON.parse(userStr) as { role?: string };
            if (user?.role === 'celebrity') {
              router.replace('/celebrity-dashboard');
            } else {
              router.replace('/(tabs)');
            }
            return;
          } catch {}
        }

        if (seenStr === '1') {
          router.replace('/(auth)');
        } else {
          router.replace('/onboarding');
        }
      } catch {
        router.replace('/onboarding');
      }
    };
    resolve();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0D14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#FF6B33" />
    </View>
  );
}
