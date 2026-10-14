import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { AllServicesScreen } from '@/components/all-services/AllServicesScreen';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

export default function AllServicesTab() {
  const insets = useSafeAreaInsets();

  const open = (start: string) => {
    router.push({ pathname: '/services', params: { start } } as Href);
  };

  return (
    <AmbientBackground>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AllServicesScreen
          onOpenTravel={() => open('travel')}
          onOpenBills={() => open('bills')}
          onOpenRecharge={() => open('recharge')}
          onOpenFinance={() => open('finance')}
          onOpenWallet={() => router.push('/wallet')}
        />
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
