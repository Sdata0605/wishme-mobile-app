import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { AllServicesScreen } from '@/components/all-services/AllServicesScreen';
import { serviceColors } from '@/components/all-services/serviceColors';
import { useTheme } from '@/context/ThemeContext';

export default function AllServicesTab() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const open = (start: string) => {
    router.push({ pathname: '/services', params: { start } } as Href);
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: isDark ? colors.background : serviceColors.pageBg,
          paddingTop: insets.top,
        },
      ]}
    >
      <AllServicesScreen
        onOpenTravel={() => open('travel')}
        onOpenBills={() => open('bills')}
        onOpenRecharge={() => open('recharge')}
        onOpenFinance={() => open('finance')}
        onOpenWallet={() => router.push('/wallet')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
