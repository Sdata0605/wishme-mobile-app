import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ScanPayScreen } from '@/components/scan-pay/ScanPayScreen';

export default function ScanPayTab() {
  return (
    <View style={styles.root}>
      <ScanPayScreen
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
