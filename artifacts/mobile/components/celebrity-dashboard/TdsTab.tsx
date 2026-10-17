import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtDate, fmtRupee, SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { TabProps, WalletTx } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';

export function TdsTab({ celebrity, colors, session }: TabProps) {
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${celebrity.id}&tds_amount=not.is.null&order=created_at.desc&limit=1000`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as WalletTx[]; setTxns(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const totalGross = txns.reduce((s, t) => s + (t.gross_amount ?? 0), 0);
  const totalTds = txns.reduce((s, t) => s + (t.tds_amount ?? 0), 0);
  const totalNet = txns.reduce((s, t) => s + (t.amount ?? 0), 0);

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="TDS Summary" colors={colors} />

      {loading ? <LoadingBox /> : (
        <>
          <Card colors={colors}>
            {[
              { label: 'Gross Earnings', value: fmtRupee(totalGross), color: '#22C55E' },
              { label: 'TDS Deducted', value: fmtRupee(totalTds), color: '#EF4444' },
              { label: 'Net Amount', value: fmtRupee(totalNet), color: '#FF5F1F' },
            ].map(row => (
              <View key={row.label} style={[styles.rowBetween, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.cardSub, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={{ color: row.color, fontFamily: 'Inter_700Bold', fontSize: 16 }}>{row.value}</Text>
              </View>
            ))}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 12 }}>
              Showing the TDS actually deducted on all your earnings so far. Consult a CA for exact tax filing.
            </Text>
            <TouchableOpacity
              onPress={() => {
                const summary = `WishMe TDS Summary\nGross Earnings: ${fmtRupee(totalGross)}\nTDS Deducted: ${fmtRupee(totalTds)}\nNet Amount: ${fmtRupee(totalNet)}\nTransactions: ${txns.length}`;
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
            <SectionEmpty icon="trending-up" text="No TDS has been deducted yet" colors={colors} />
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
                    <Text style={{ color: '#FF5F1F', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Net: {fmtRupee(t.amount)}</Text>
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
