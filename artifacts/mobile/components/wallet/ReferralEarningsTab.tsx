import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { STATUS_COLORS, LEVEL_COLORS, fmtDate, styles } from './shared';
import type { ColorsType, AuthUser, AuthSession } from './shared';

interface RefItem {
  id: string;
  referred_id?: string;
  booking_id?: string;
  commission_amount: number;
  commission_level?: number;
  order_type?: string;
  status: string;
  created_at: string;
}

interface RefTabProps {
  colors: ColorsType;
  bottomPad: number;
  user: AuthUser;
  session: AuthSession;
}

export function ReferralEarningsTab({ colors, bottomPad, user, session }: RefTabProps) {
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);

  const profileId = user?.profileId ?? '';

  useEffect(() => {
    if (!profileId || !session?.access_token) {
      setLoading(false);
      return;
    }
    supabaseFetch(
      `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&select=*`,
      {},
      session.access_token,
    )
      .then(async (res) => {
        if (res.ok) {
          const rows = (await res.json()) as RefItem[];
          setItems(rows ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId, session]);

  const completed = items.filter((r) => r.status === 'completed');
  const pending = items.filter((r) => r.status === 'pending');
  const totalEarned = completed.reduce((s, r) => s + (r.commission_amount ?? 0), 0);
  const uniqueFriends = new Set(completed.map((r) => r.referred_id).filter(Boolean)).size;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#FF5F1F" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#B026FF', '#FF5F1F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.refEarningCard}
      >
        <Text style={styles.refEarningLabel}>Total Referral Earnings</Text>
        <Text style={styles.refEarningAmt}>₹{totalEarned.toLocaleString('en-IN')}</Text>
        <Text style={[styles.refEarningLabel, { marginTop: 4 }]}>Credited to wallet</Text>

        <View style={styles.refStatsRow}>
          <View style={styles.refStatItem}>
            <Text style={styles.refStatNumber}>{uniqueFriends}</Text>
            <Text style={styles.refStatLabel}>Friends</Text>
          </View>
          <View style={styles.refStatDivider} />
          <View style={styles.refStatItem}>
            <Text style={styles.refStatNumber}>{pending.length}</Text>
            <Text style={styles.refStatLabel}>Pending</Text>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity
        style={styles.inviteBtn}
        onPress={() => router.push('/referrals' as never)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#B026FF', '#FF5F1F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.inviteBtnGrad}
        >
          <Icon name="users" size={18} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite Friends</Text>
        </LinearGradient>
      </TouchableOpacity>

      {!items.length ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Icon name="users" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No referral earnings yet</Text>
        </View>
      ) : (
        items.map((item) => {
          const lvl = item.commission_level ?? 1;
          const lvlColor = LEVEL_COLORS[lvl] ?? '#B026FF';
          const statusColor = STATUS_COLORS[item.status] ?? '#F59E0B';
          return (
            <View key={item.id} style={[styles.refRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.refTopRow}>
                  <Text style={[styles.txDesc, { color: colors.foreground }]}>
                    {item.booking_id ? `Booking #${String(item.booking_id).slice(0, 8)}` : 'Referral Bonus'}
                  </Text>
                  <View style={[styles.levelBadge, { backgroundColor: lvlColor + '20' }]}>
                    <Text style={[styles.levelText, { color: lvlColor }]}>L{lvl}</Text>
                  </View>
                </View>
                <View style={styles.txBottomRow}>
                  <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.txAmt, { color: '#22C55E' }]}>
                +₹{(item.commission_amount ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
