import { router } from 'expo-router';
import React from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrity } from '@/hooks/useCelebrity';
import { Icon, type IconName } from './Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;
const SLIDE_AMOUNT = DRAWER_WIDTH * 0.8;

interface NavItem {
  icon: IconName;
  label: string;
  route: string;
  highlight?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'home', label: 'Dashboard', route: '/(tabs)' },
  { icon: 'layers', label: 'All Services', route: '/(tabs)/all-services', highlight: true },
  { icon: 'calendar', label: 'Hub', route: '/hub', highlight: true },
  { icon: 'copy', label: 'Documents', route: '/documents' },
  { icon: 'layers', label: 'Library', route: '/library', highlight: true },
  { icon: 'phone', label: 'Celebrity Call', route: '/(tabs)/voice-call' },
  { icon: 'credit-card', label: 'Wallet', route: '/wallet' },
  { icon: 'calendar', label: 'Bookings', route: '/bookings' },
  { icon: 'heart', label: 'Favorites', route: '/favorites' },
  { icon: 'shopping-bag', label: 'Wish Orders', route: '/wish-orders' },
  { icon: 'message-circle', label: 'Messages', route: '/messages' },
  { icon: 'users', label: 'Loved Ones', route: '/loved-ones' },
  { icon: 'music-2', label: 'AI Music', route: '/(tabs)/music' },
  { icon: 'image', label: 'Photo Wish', route: '/photo-wish' },
  { icon: 'star', label: 'Wish a Celebrity', route: '/wish-celebrity' },
  { icon: 'video', label: 'Wish a Friend', route: '/wish-friend' },
  { icon: 'mail', label: 'Greeting Cards', route: '/greeting-cards' },
  { icon: 'zap', label: 'Image Promotions', route: '/image-promotions' },
  { icon: 'video', label: 'UGC Videos', route: '/ugc-videos' },
  { icon: 'play-circle', label: 'UGC Ads', route: '/ugc-ads' },
  { icon: 'search', label: 'Browse Celebrities', route: '/(tabs)/celebrities' },
  { icon: 'share-2', label: 'Referrals', route: '/referrals' },
  { icon: 'bell', label: 'Occasion Alerts', route: '/occasion-alerts' },
  { icon: 'award', label: 'My Plan', route: '/select-plan' },
];

function NavRow({ item, onPress }: { item: NavItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={styles.navRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.highlight ? colors.primary + '30' : colors.sidebarAccent }]}>
        <Icon
          name={item.icon}
          size={18}
          color={item.highlight ? colors.primary : colors.foreground}
        />
      </View>
      <Text style={[styles.navLabel, { color: item.highlight ? colors.primary : colors.foreground, fontFamily: 'Inter_500Medium' }]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

export function DrawerMenu({ children }: { children: React.ReactNode }) {
  const { animValue, isOpen, close } = useDrawer();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const { isCelebrity, loading: celebrityLoading } = useCelebrity();
  const insets = useSafeAreaInsets();

  const contentTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SLIDE_AMOUNT],
  });

  const contentScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
  });

  const contentBorderRadius = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const drawerTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'WM';

  const navigate = (route: string) => {
    close();
    setTimeout(() => router.push(route as any), 50);
  };

  const handleLogout = async () => {
    close();
    await logout();
    setTimeout(() => router.replace('/(auth)'), 50);
  };

  const navItems = !celebrityLoading && isCelebrity
    ? [...NAV_ITEMS, { icon: 'sparkles' as IconName, label: 'Celebrity Dashboard', route: '/celebrity-dashboard', highlight: true }]
    : NAV_ITEMS;

  return (
    <View style={styles.root}>
      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            backgroundColor: colors.sidebarBackground,
            transform: [{ translateX: drawerTranslateX }],
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerUserInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.drawerName, { color: colors.foreground }]} numberOfLines={1}>
                {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
              </Text>
              <Text style={[styles.drawerEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                {user?.email || 'Sign in to continue'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={close} style={styles.closeBtn}>
            <Icon name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {navItems.map((item) => (
            <NavRow key={item.route + item.label} item={item} onPress={() => navigate(item.route)} />
          ))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <NavRow
            item={{ icon: 'settings', label: 'Settings', route: '/settings' }}
            onPress={() => navigate('/settings')}
          />
          <TouchableOpacity style={styles.navRow} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.iconContainer, { backgroundColor: '#EF444420' }]}>
              <Icon name="log-out" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.navLabel, { color: '#EF4444', fontFamily: 'Inter_500Medium' }]}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Main Content */}
      <Animated.View
        style={[
          styles.content,
          {
            backgroundColor: colors.background,
            transform: [
              { translateX: contentTranslateX },
              { scale: contentScale },
            ],
            borderRadius: contentBorderRadius,
            overflow: 'hidden',
          },
        ]}
      >
        {children}
        {isOpen && (
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  drawerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  drawerName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  drawerEmail: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navList: { flex: 1, paddingHorizontal: 12 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
