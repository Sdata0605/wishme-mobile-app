import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { CREDIT_TYPES, STATUS_COLORS, fmtDate, txLabel, txIconInfo, styles } from './shared';
import type { ColorsType, AuthUser, AuthSession } from './shared';

interface TxItem {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description?: string;
  created_at: string;
  source?: string;
}

interface TxTabProps {
  colors: ColorsType;
  bottomPad: number;
  user: AuthUser;
  session: AuthSession;
}

export function TransactionsTab({ colors, bottomPad, user, session }: TxTabProps) {
  const [items, setItems] = useState<TxItem[]>([]);
  const [paymentLookup, setPaymentLookup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const profileId = user?.profileId ?? '';

  useEffect(() => {
    if (!profileId || !session?.access_token) {
      setLoading(false);
      return;
    }

    const fetchWalletTxns = async (uid: string): Promise<TxItem[]> => {
      const res = await supabaseFetch(
        `/rest/v1/wallet_transactions?user_id=eq.${uid}&select=*&order=created_at.desc`,
        {},
        session.access_token!,
      );
      if (!res.ok) return [];
      return ((await res.json()) as TxItem[]) ?? [];
    };

    Promise.all([
      fetchWalletTxns(profileId).then(async (rows) => {
        if (rows.length === 0 && user?.id && user.id !== profileId) {
          return fetchWalletTxns(user.id);
        }
        return rows;
      }).catch(() => [] as TxItem[]),

      supabaseFetch(
        `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&select=*&order=created_at.desc`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return [] as TxItem[];
        const rows = (await res.json()) as Array<{
          id: string;
          commission_amount: number;
          status: string;
          created_at: string;
          booking_id?: string;
          [key: string]: unknown;
        }>;
        return (rows ?? []).map((r) => ({
          ...r,
          source: 'referral',
          transaction_type: 'referral_commission',
          amount: r.commission_amount ?? 0,
          status: r.status,
          description: r.booking_id ? `Referral – Booking #${String(r.booking_id).slice(0, 8)}` : 'Referral Bonus',
        } as TxItem));
      }).catch(() => [] as TxItem[]),

      supabaseFetch(
        `/rest/v1/payment_transactions?user_id=eq.${profileId}&select=wishme_payment_id,user_id,amount,paid_at&order=paid_at.desc`,
        {},
        session.access_token,
      ).then(async (res) => {
        if (!res.ok) return {} as Record<string, string>;
        const rows = (await res.json()) as Array<{ wishme_payment_id?: string; amount?: number }>;
        const lookup: Record<string, string> = {};
        for (const r of rows ?? []) {
          if (r.wishme_payment_id && r.amount != null) {
            const key = String(Math.abs(r.amount));
            if (!lookup[key]) lookup[key] = r.wishme_payment_id;
          }
        }
        return lookup;
      }).catch(() => ({} as Record<string, string>)),
    ]).then(([walletTxns, refTxns, lookup]) => {
      const merged: TxItem[] = [
        ...(walletTxns as TxItem[]).map((t) => ({ ...t, source: 'wallet' })),
        ...(refTxns as TxItem[]),
      ];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(merged);
      setPaymentLookup(lookup as Record<string, string>);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [profileId, session]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <ActivityIndicator color="#B026FF" />
      </View>
    );
  }

  const filtered = search.trim()
    ? items.filter((tx) => {
        const wmId = paymentLookup[String(Math.abs(tx.amount))] ?? '';
        return wmId.toLowerCase().includes(search.toLowerCase().trim());
      })
    : items;

  const displayed = showAll ? filtered : filtered.slice(0, 10);

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by WishMe Payment ID"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="characters"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {!filtered.length ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Icon name="credit-card" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search ? 'No results found' : 'No transactions yet'}
          </Text>
        </View>
      ) : (
        <>
          {displayed.map((item) => {
            const isCredit = CREDIT_TYPES.has(item.transaction_type);
            const statusColor = STATUS_COLORS[item.status] ?? '#F59E0B';
            const iconInfo = txIconInfo(item.transaction_type);
            const wmId = paymentLookup[String(Math.abs(item.amount))];
            return (
              <View
                key={`${item.id}-${item.source}`}
                style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.txIconCircle, { backgroundColor: iconInfo.color + '20' }]}>
                  <Icon name={iconInfo.name} size={18} color={iconInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.txTopRow}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]}>
                      {txLabel(item.transaction_type, item.description)}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: isCredit ? '#22C55E20' : '#EF444420' }]}>
                      <Text style={[styles.typeBadgeText, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                        {isCredit ? 'Credit' : 'Debit'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.txBottomRow}>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                  </View>
                  {wmId ? (
                    <Text style={[styles.wmId, { color: colors.mutedForeground }]}>{wmId}</Text>
                  ) : null}
                </View>
                <Text style={[styles.txAmt, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                  {isCredit ? '+' : '-'}₹{Math.abs(item.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })}

          {filtered.length > 10 && (
            <TouchableOpacity
              onPress={() => setShowAll((v) => !v)}
              style={[styles.viewAllBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                {showAll ? 'Show Less' : `View All (${filtered.length})`}
              </Text>
              <Icon name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}
