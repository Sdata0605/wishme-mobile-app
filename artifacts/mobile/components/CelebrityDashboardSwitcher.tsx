import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname, type Href } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useCelebrity } from '@/hooks/useCelebrity';

const FAB_HEIGHT = 40;
const TAB_BAR_H_WEB = 84;
const TAB_BAR_H_NATIVE = 60;
const MARGIN = 16;

export function CelebrityDashboardSwitcher() {
  const { isCelebrity, loading } = useCelebrity();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (loading || !isCelebrity) return null;

  const isWeb = Platform.OS === 'web';
  const tabBarH = isWeb ? TAB_BAR_H_WEB : TAB_BAR_H_NATIVE + insets.bottom;
  const bottomOffset = tabBarH + MARGIN;

  const onCelebrityDashboard = pathname.startsWith('/celebrity-dashboard');

  const destination: Href = onCelebrityDashboard ? '/(tabs)' : '/celebrity-dashboard';
  const label = onCelebrityDashboard ? 'User Dashboard' : 'Celebrity Dashboard';
  const iconName = onCelebrityDashboard ? 'home' : 'star';

  const handlePress = () => {
    router.push(destination);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: bottomOffset, left: MARGIN }]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.touchable}>
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fab}
        >
          <Icon name={iconName} size={16} color="#fff" />
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9998,
    alignItems: 'flex-start',
  },
  touchable: {
    borderRadius: FAB_HEIGHT / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fab: {
    height: FAB_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: FAB_HEIGHT / 2,
    gap: 6,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
