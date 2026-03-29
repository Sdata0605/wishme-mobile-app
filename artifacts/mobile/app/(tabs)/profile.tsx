import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrity } from '@/hooks/useCelebrity';
import { useWallet } from '@/hooks/useWallet';

function ProfileItem({
  icon,
  label,
  onPress,
  right,
  destructive,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={[styles.profileItem, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.profileItemIcon, { backgroundColor: destructive ? '#EF444420' : colors.muted }]}>
        <Icon name={icon} size={18} color={destructive ? '#EF4444' : colors.primary} />
      </View>
      <Text style={[styles.profileItemLabel, { color: destructive ? '#EF4444' : colors.foreground, fontFamily: 'Inter_500Medium' }]}>
        {label}
      </Text>
      {right ?? <Icon name="chevron-right" size={18} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { balance: liveBalance, refetch: refetchWallet } = useWallet();
  const { isCelebrity, loading: celebrityLoading } = useCelebrity();

  useFocusEffect(useCallback(() => { refetchWallet(); }, [refetchWallet]));

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'WM';

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={['#FF6B33', '#E8527A', '#B44CFF']}
        style={[styles.header, { paddingTop: topPad + 20 }]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user ? `${user.firstName} ${user.lastName}` : 'Guest User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.phone}>{user?.phone ? `+91 ${user.phone}` : ''}</Text>
        <Text style={styles.memberSince}>Member since {user?.memberSince}</Text>
      </LinearGradient>

      {/* Wallet balance */}
      <View style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.walletLabel, { color: colors.mutedForeground }]}>Wallet Balance</Text>
          <Text style={[styles.walletBalance, { color: colors.foreground }]}>
            ₹{liveBalance.toLocaleString('en-IN')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/wallet')}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addMoneyBtn}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {([
          { label: 'Bookings', value: '12', icon: 'calendar' },
          { label: 'Favorites', value: '8', icon: 'heart' },
          { label: 'Referrals', value: '5', icon: 'users' },
        ] as Array<{ label: string; value: string; icon: IconName }>).map((stat) => (
          <View key={stat.label} style={styles.statItem}>
            <Icon name={stat.icon} size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ProfileItem icon="edit-2" label="Edit Profile" onPress={() => {}} />
        <ProfileItem icon="shopping-bag" label="My Orders" onPress={() => router.push('/bookings')} />
        <ProfileItem icon="heart" label="Saved Celebrities" onPress={() => router.push('/favorites')} />
        <ProfileItem icon="bell" label="Notifications" onPress={() => router.push('/occasion-alerts')} />
        <ProfileItem
          icon="sun"
          label="Theme"
          onPress={toggle}
          right={
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: '#ccc', true: colors.primary }}
              thumbColor="#fff"
            />
          }
        />
        <ProfileItem icon="help-circle" label="Help & Support" onPress={() => router.push('/support')} />
      </View>

      {!celebrityLoading && isCelebrity && (
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity
            style={[styles.dashboardBtn]}
            onPress={() => router.push('/celebrity-dashboard')}
          >
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dashboardBtnGrad}>
              <Icon name="star" size={18} color="#fff" />
              <Text style={styles.dashboardBtnText}>Celebrity Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { borderColor: '#EF4444' }]}>
        <Icon name="log-out" size={18} color="#EF4444" />
        <Text style={[styles.logoutText, { color: '#EF4444' }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 32, alignItems: 'center' },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)' },
  phone: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  memberSince: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  walletCard: { margin: 20, marginBottom: 12, borderRadius: 14, padding: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  walletLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  walletBalance: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  addMoneyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999 },
  addMoneyText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statsRow: { marginHorizontal: 20, borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  actionsCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  profileItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  profileItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  profileItemLabel: { flex: 1, fontSize: 14 },
  dashboardBtn: { marginBottom: 12 },
  dashboardBtnGrad: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dashboardBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 20, borderWidth: 1.5, borderRadius: 12, padding: 14 },
  logoutText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
