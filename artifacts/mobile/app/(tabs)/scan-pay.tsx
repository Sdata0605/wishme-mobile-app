import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ScanPayScreen } from '@/components/scan-pay/ScanPayScreen';

export default function ScanPayTab() {
  const { payeeId, payeeName } = useLocalSearchParams<{ payeeId?: string; payeeName?: string }>();
  const [focused, setFocused] = useState(false);
  const [payee, setPayee] = useState<{ id: string; name: string } | undefined>();

  // Take the payee handed over by the pay-to screens once, then clear it from the route.
  useEffect(() => {
    if (payeeId) {
      setPayee({ id: payeeId, name: payeeName || payeeId });
      router.setParams({ payeeId: '', payeeName: '' });
    }
  }, [payeeId, payeeName]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setPayee(undefined);
      };
    }, []),
  );

  // Unmount while the tab is not showing, so reopening Scan & Pay always starts on the scanner (and the camera is released).
  return (
    <View style={styles.root}>
      {focused ? (
        <ScanPayScreen
          initialPayee={payee}
          onClose={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
