import { router, type Href } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');
const BTN_SIZE = 44;

interface QuickItem {
  icon: IconName;
  label: string;
  route: Href;
  color: string;
}

const QUICK_ITEMS: QuickItem[] = [
  { icon: 'home', label: 'Dashboard', route: '/(tabs)', color: '#FF6B33' },
  { icon: 'user', label: 'Profile', route: '/(tabs)/profile', color: '#E8527A' },
  { icon: 'briefcase', label: 'For Business', route: '/for-business', color: '#7C3AED' },
  { icon: 'mail', label: 'Greeting Cards', route: '/greeting-cards', color: '#B44CFF' },
  { icon: 'star', label: 'Browse Celebrities', route: '/(tabs)/celebrities', color: '#F59E0B' },
  { icon: 'share-2', label: 'Referrals', route: '/referrals', color: '#3B5BDB' },
  { icon: 'credit-card', label: 'Wallet', route: '/wallet', color: '#7C3AED' },
  { icon: 'image', label: 'Photo Wish', route: '/photo-wish', color: '#E8527A' },
  { icon: 'calendar', label: 'Bookings', route: '/bookings', color: '#B44CFF' },
];

export function DraggableMoreButton() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [quickMenuVisible, setQuickMenuVisible] = useState(false);

  const isWeb = Platform.OS === 'web';
  const TAB_CONTENT_H = isWeb ? 84 : 60;
  const tabBarH = TAB_CONTENT_H + (isWeb ? 0 : insets.bottom);

  const initialX = W - BTN_SIZE - 16;
  const initialY = H - tabBarH - BTN_SIZE - 16;

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const lastPos = useRef({ x: initialX, y: initialY });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
      onPanResponderGrant: () => {
        dragStartPos.current = { x: lastPos.current.x, y: lastPos.current.y };
        isDragging.current = false;
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gs);
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();

        const rawX = dragStartPos.current.x + gs.dx;
        const rawY = dragStartPos.current.y + gs.dy;

        const clampedX = Math.max(0, Math.min(W - BTN_SIZE, rawX));
        const clampedY = Math.max(insets.top + 8, Math.min(H - BTN_SIZE - 8, rawY));

        pan.setValue({ x: clampedX, y: clampedY });
        lastPos.current = { x: clampedX, y: clampedY };

        if (!isDragging.current) {
          setQuickMenuVisible(true);
        }
        isDragging.current = false;
      },
    }),
  ).current;

  const navigateQuick = (route: Href) => {
    setQuickMenuVisible(false);
    setTimeout(() => router.navigate(route), 80);
  };

  return (
    <>
      <Animated.View
        style={[
          styles.moreBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: isDark ? '#000' : '#666',
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Icon name="more-horizontal" size={20} color={colors.foreground} />
      </Animated.View>

      <Modal
        visible={quickMenuVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setQuickMenuVisible(false)}
        statusBarTranslucent
      >
        <View style={[styles.menuScreen, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.menuTitle, { color: colors.foreground }]}>Quick Menu</Text>
            <TouchableOpacity onPress={() => setQuickMenuVisible(false)} style={styles.closeBtn}>
              <Icon name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>
            Jump to any feature instantly
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.menuGrid}
          >
            {QUICK_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, { backgroundColor: colors.card }]}
                onPress={() => navigateQuick(item.route)}
                activeOpacity={0.75}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '22' }]}>
                  <Icon name={item.icon} size={26} color={item.color} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.foreground }]} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  moreBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 9999,
  },
  menuScreen: { flex: 1 },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuTitle: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold' },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menuSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    paddingBottom: 24,
  },
  menuItem: {
    width: (W - 56) / 3,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  menuLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 16,
  },
});
