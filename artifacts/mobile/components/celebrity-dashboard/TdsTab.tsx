import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtDate, fmtRupee, SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { TabProps, WalletTx } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';

const FY_OPTIONS = ['FY 2022-23', 'FY 2023-24', 'FY 2024-25', 'FY 2025-26'] as const;

function fyDateRange(fy: string): { start: string; end: string } {
  const m = fy.match(/FY (\d{4})-(\d{2})/);
  if (!m) return { start: '', end: '' };
  const startYear = parseInt(m[1], 10);
  const endYear = startYear + 1;
  return { start: `${startYear}-04-01`, end: `${endYear}-03-31` };
}

export function TdsTab({ celebrity, colors, session }: TabProps) {
  const [selectedFY, setSelectedFY] = useState<string>('FY 2024-25');
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const { start, end } = fyDateRange(selectedFY);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${celebrity.id}&tds_amount=not.is.null&created_at=gte.${start}&created_at=lte.${end}T23:59:59&order=created_at.desc`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as WalletTx[]; setTxns(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, selectedFY, session?.access_token]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const totalGross = txns.reduce((s, t) => s + (t.gross_amount ?? 0), 0);
  const totalTds = txns.reduce((s, t) => s + (t.tds_amount ?? 0), 0);
  const totalNet = txns.reduce((s, t) => s + (t.amount ?? 0), 0);

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="TDS Summary" colors={colors} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {FY_OPTIONS.map(fy => (
          <TouchableOpacity
            key={fy}
            onPress={() => setSelectedFY(fy)}
            style={[styles.chipBtn, { borderColor: selectedFY === fy ? '#7B5CFA' : colors.border, backgroundColor: selectedFY === fy ? '#7B5CFA18' : 'transparent' }]}
          >
            <Text style={{ color: selectedFY === fy ? '#7B5CFA' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{fy}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <LoadingBox /> : (
        <>
          <Card colors={colors}>
            {[
              { label: 'Gross Earnings', value: fmtRupee(totalGross), color: '#22C55E' },
              { label: 'TDS Deducted', value: fmtRupee(totalTds), color: '#EF4444' },
              { label: 'Net Amount', value: fmtRupee(totalNet), color: '#3B82F6' },
            ].map(row => (
              <View key={row.label} style={[styles.rowBetween, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.cardSub, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={{ color: row.color, fontFamily: 'Inter_700Bold', fontSize: 16 }}>{row.value}</Text>
              </View>
            ))}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 12 }}>
              Showing actual TDS deducted on transactions for {selectedFY}. Consult a CA for exact tax filing.
            </Text>
            <TouchableOpacity
              onPress={() => {
                const summary = `WishMe TDS Summary — ${selectedFY}\nGross Earnings: ${fmtRupee(totalGross)}\nTDS Deducted: ${fmtRupee(totalTds)}\nNet Amount: ${fmtRupee(totalNet)}\nTransactions: ${txns.length}`;
                Clipboard.setStringAsync(summary).then(() => Alert.alert('Copied', 'TDS summary copied to clipboard!'));
              }}
              style={[styles.copyBtn, { borderColor: colors.border }]}
            >
              <Icon name="copy" size={14} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13, marginLeft: 6 }}>Copy Summary</Text>
            </TouchableOpacity>
          </Card>

          <SectionTitle text={`TDS Transactions (${txns.length})`} colors={colors} />
          {txns.length === 0 ? (
            <SectionEmpty icon="trending-up" text={`No TDS transactions in ${selectedFY}`} colors={colors} />
          ) : (
            txns.map(t => (
              <Card key={t.id} colors={colors}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardSub, { color: colors.foreground }]} numberOfLines={1}>{t.description || t.transaction_type?.replace(/_/g, ' ')}</Text>
                    <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(t.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Gross: {fmtRupee(t.gross_amount ?? 0)}</Text>
                    <Text style={{ color: '#EF4444', fontFamily: 'Inter_400Regular', fontSize: 12 }}>TDS {t.tds_percentage ?? 0}%: -{fmtRupee(t.tds_amount ?? 0)}</Text>
                    <Text style={{ color: '#3B82F6', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Net: {fmtRupee(t.amount)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </View>
  );
}
