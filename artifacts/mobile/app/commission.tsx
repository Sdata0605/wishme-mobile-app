import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface ReferralTransaction {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  booking_id: string | null;
  commission_level: 1 | 2;
  commission_amount: number;
  status: 'completed' | 'pending';
  order_type: string | null;
  created_at: string;
}

interface CelebrityWalletTransaction {
  id: string;
  celebrity_id: string;
  booking_id: string | null;
  transaction_type: string;
  amount: number;
  gross_amount: number | null;
  tds_percentage: number | null;
  tds_amount: number | null;
  commission_percentage: number | null;
  description: string | null;
  status: string;
  created_at: string;
}

const STATIC_EARNINGS = [
  { month: 'Jan', amount: 800 },
  { month: 'Feb', amount: 1200 },
  { month: 'Mar', amount: 950 },
  { month: 'Apr', amount: 1600 },
  { month: 'May', amount: 2100 },
  { month: 'Jun', amount: 1800 },
];

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Failed: '#EF4444',
};

const LEVEL_COLORS: Record<string, string> = { L1: '#FF6B33', L2: '#B44CFF' };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateToDisplay(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatOrderType(orderType: string | null): string | null {
  if (!orderType) return null;
  return orderType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildEarningsChart(
  referralTxns: ReferralTransaction[],
  celebTxns: CelebrityWalletTransaction[],
): { month: string; amount: number }[] {
  const monthMap = new Map<string, number>();
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  [...referralTxns].forEach((t) => {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + t.commission_amount);
  });

  [...celebTxns].forEach((t) => {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + t.amount);
  });

  if (monthMap.size === 0) return STATIC_EARNINGS;

  const sortedKeys = Array.from(monthMap.keys()).sort().slice(-6);
  return sortedKeys.map((key) => {
    const [, monthStr] = key.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    return { month: MONTH_NAMES[monthIdx], amount: monthMap.get(key) ?? 0 };
  });
}

export default function CommissionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user, session } = useAuth();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDateObj, setStartDateObj] = useState<Date | null>(null);
  const [endDateObj, setEndDateObj] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState<Date | null>(null);
  const [draftEndDate, setDraftEndDate] = useState<Date | null>(null);

  const [referralTxns, setReferralTxns] = useState<ReferralTransaction[]>([]);
  const [pendingReferralTxns, setPendingReferralTxns] = useState<ReferralTransaction[]>([]);
  const [celebTxns, setCelebTxns] = useState<CelebrityWalletTransaction[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!session?.access_token || !user?.profileId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const profileId = user.profileId;
      const token = session.access_token;

      let referralUrl = `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&status=eq.completed&order=created_at.desc`;
      if (startDate) referralUrl += `&created_at=gte.${startDate}T00:00:00`;
      if (endDate) referralUrl += `&created_at=lte.${endDate}T23:59:59`;

      const pendingUrl = `/rest/v1/referral_transactions?referrer_id=eq.${profileId}&status=eq.pending&order=created_at.desc`;

      let celebUrl = `/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${profileId}&transaction_type=eq.earning&order=created_at.desc`;
      if (startDate) celebUrl += `&created_at=gte.${startDate}T00:00:00`;
      if (endDate) celebUrl += `&created_at=lte.${endDate}T23:59:59`;

      try {
        const [referralRes, pendingRes, celebRes] = await Promise.all([
          supabaseFetch(referralUrl, {}, token),
          supabaseFetch(pendingUrl, {}, token),
          supabaseFetch(celebUrl, {}, token),
        ]);

        if (referralRes.ok) {
          const data = await referralRes.json() as ReferralTransaction[];
          setReferralTxns(Array.isArray(data) ? data : []);
        }
        if (pendingRes.ok) {
          const data = await pendingRes.json() as ReferralTransaction[];
          setPendingReferralTxns(Array.isArray(data) ? data : []);
        }
        if (celebRes.ok) {
          const data = await celebRes.json() as CelebrityWalletTransaction[];
          setCelebTxns(Array.isArray(data) ? data : []);
        }
      } catch {}

      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    },
    [session, user, startDate, endDate],
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const totalReferral = referralTxns.reduce((s, t) => s + t.commission_amount, 0);
  const totalCelebrity = celebTxns.reduce((s, t) => s + t.amount, 0);
  const totalTds = celebTxns.reduce((s, t) => s + (t.tds_amount ?? 0), 0);
  const pendingEarnings = pendingReferralTxns.reduce((s, t) => s + t.commission_amount, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonthReferral = referralTxns
    .filter((t) => new Date(t.created_at) >= monthStart)
    .reduce((s, t) => s + t.commission_amount, 0);
  const thisMonthCelebrity = celebTxns
    .filter((t) => new Date(t.created_at) >= monthStart)
    .reduce((s, t) => s + t.amount, 0);
  const thisMonth = thisMonthReferral + thisMonthCelebrity;

  const earnings = buildEarningsChart(referralTxns, celebTxns);
  const max = Math.max(...earnings.map((e) => e.amount), 1);

  const isEmpty = !loading && referralTxns.length === 0 && celebTxns.length === 0;

  if (!user || !session) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Commission</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.authGate}>
          <Icon name="trending-up" size={48} color={colors.mutedForeground} />
          <Text style={[s.authGateTitle, { color: colors.foreground }]}>Sign in to view commissions</Text>
          <TouchableOpacity style={s.signInBtn} onPress={() => router.push('/login' as never)}>
            <Text style={s.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Commission</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        {/* Top hero */}
        <LinearGradient colors={['#FF6B33', '#B44CFF']} style={s.topCard}>
          <Text style={s.earningsLabel}>Total Earned</Text>
          <Text style={s.earnings}>₹{(totalReferral + totalCelebrity).toLocaleString('en-IN')}</Text>
          <View style={s.heroStats}>
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>₹{thisMonth.toLocaleString('en-IN')}</Text>
              <Text style={s.heroStatLabel}>This Month</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>₹{pendingEarnings.toLocaleString('en-IN')}</Text>
              <Text style={s.heroStatLabel}>Pending</Text>
            </View>
          </View>
          <TouchableOpacity style={s.withdrawBtn} onPress={() => router.push('/wallet' as never)}>
            <Text style={s.withdrawBtnText}>Withdraw Earnings</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* 3-card summary */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="users" size={18} color="#FF6B33" />
            <Text style={[s.summaryVal, { color: colors.foreground }]}>₹{totalReferral.toLocaleString('en-IN')}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Referral Earned</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="star" size={18} color="#B44CFF" />
            <Text style={[s.summaryVal, { color: colors.foreground }]}>₹{totalCelebrity.toLocaleString('en-IN')}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Celebrity Earned</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="alert-circle" size={18} color="#EF4444" />
            <Text style={[s.summaryVal, { color: colors.foreground }]}>₹{totalTds.toLocaleString('en-IN')}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>TDS Deducted</Text>
          </View>
        </View>

        {/* Date filter */}
        <View style={[s.dateFilter, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.dateFilterTitle, { color: colors.foreground }]}>Filter by Date</Text>
          <View style={s.dateInputRow}>
            <TouchableOpacity
              style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border }]}
              onPress={() => {
                setDraftStartDate(startDateObj ?? new Date());
                setShowStartPicker(true);
              }}
              activeOpacity={0.7}
            >
              <Icon name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[s.dateInputText, { color: startDateObj ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {startDateObj ? dateToDisplay(startDateObj) : 'Start Date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border }]}
              onPress={() => {
                setDraftEndDate(endDateObj ?? new Date());
                setShowEndPicker(true);
              }}
              activeOpacity={0.7}
            >
              <Icon name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[s.dateInputText, { color: endDateObj ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {endDateObj ? dateToDisplay(endDateObj) : 'End Date'}
              </Text>
            </TouchableOpacity>
          </View>
          {(startDate || endDate) ? (
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => {
                setStartDate('');
                setEndDate('');
                setStartDateObj(null);
                setEndDateObj(null);
              }}
            >
              <Text style={[s.clearBtnText, { color: colors.mutedForeground }]}>Clear Filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Native date pickers */}
        {Platform.OS === 'android' && showStartPicker && (
          <DateTimePicker
            value={startDateObj ?? new Date()}
            mode="date"
            display="default"
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              setShowStartPicker(false);
              if (event.type === 'set' && date) {
                setStartDateObj(date);
                setStartDate(dateToISO(date));
              }
            }}
          />
        )}
        {Platform.OS === 'android' && showEndPicker && (
          <DateTimePicker
            value={endDateObj ?? new Date()}
            mode="date"
            display="default"
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              setShowEndPicker(false);
              if (event.type === 'set' && date) {
                setEndDateObj(date);
                setEndDate(dateToISO(date));
              }
            }}
          />
        )}
        {Platform.OS === 'ios' && (
          <Modal visible={showStartPicker} transparent animationType="slide">
            <Pressable style={s.iosPickerOverlay} onPress={() => setShowStartPicker(false)}>
              <Pressable style={[s.iosPickerContainer, { backgroundColor: colors.card }]}>
                <View style={[s.iosPickerHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                    <Text style={[s.iosPickerCancel, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[s.iosPickerTitle, { color: colors.foreground }]}>Start Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (draftStartDate) {
                        setStartDateObj(draftStartDate);
                        setStartDate(dateToISO(draftStartDate));
                      }
                      setShowStartPicker(false);
                    }}
                  >
                    <Text style={[s.iosPickerDone, { color: '#FF6B33' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={draftStartDate ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_event: DateTimePickerEvent, date?: Date) => {
                    if (date) setDraftStartDate(date);
                  }}
                  style={s.iosDatePicker}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}
        {Platform.OS === 'ios' && (
          <Modal visible={showEndPicker} transparent animationType="slide">
            <Pressable style={s.iosPickerOverlay} onPress={() => setShowEndPicker(false)}>
              <Pressable style={[s.iosPickerContainer, { backgroundColor: colors.card }]}>
                <View style={[s.iosPickerHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => setShowEndPicker(false)}>
                    <Text style={[s.iosPickerCancel, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={[s.iosPickerTitle, { color: colors.foreground }]}>End Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (draftEndDate) {
                        setEndDateObj(draftEndDate);
                        setEndDate(dateToISO(draftEndDate));
                      }
                      setShowEndPicker(false);
                    }}
                  >
                    <Text style={[s.iosPickerDone, { color: '#FF6B33' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={draftEndDate ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_event: DateTimePickerEvent, date?: Date) => {
                    if (date) setDraftEndDate(date);
                  }}
                  style={s.iosDatePicker}
                />
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Loading state */}
        {loading ? (
          <ActivityIndicator size="large" color="#FF6B33" style={{ marginTop: 40 }} />
        ) : isEmpty ? (
          /* Empty state */
          <View style={s.emptyState}>
            <Icon name="trending-up" size={48} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No commission earnings yet</Text>
            <Text style={[s.emptySubtitle, { color: colors.mutedForeground }]}>
              Complete bookings and refer users to start earning
            </Text>
          </View>
        ) : (
          <>
            {/* Referral Commissions */}
            {referralTxns.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Referral Commissions</Text>
                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                  {referralTxns.map((item) => {
                    const levelKey = `L${item.commission_level}`;
                    const lc = LEVEL_COLORS[levelKey] ?? '#6B7280';
                    const sc = STATUS_COLORS['Completed'];
                    const orderLabel = formatOrderType(item.order_type);
                    return (
                      <View key={item.id} style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={s.commCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.commBookingId, { color: colors.foreground }]}>
                              Level {item.commission_level} Referral
                            </Text>
                            {orderLabel ? (
                              <Text style={[s.commSubtitle, { color: colors.mutedForeground }]}>{orderLabel}</Text>
                            ) : null}
                            <Text style={[s.commDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                          </View>
                          <View style={[s.levelBadge, { backgroundColor: lc + '20' }]}>
                            <Text style={[s.levelText, { color: lc }]}>{levelKey}</Text>
                          </View>
                          <View style={[s.statusBadge, { backgroundColor: sc + '20' }]}>
                            <Text style={[s.statusText, { color: sc }]}>Completed</Text>
                          </View>
                        </View>
                        <Text style={[s.commAmount, { color: '#22C55E' }]}>
                          +₹{item.commission_amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Celebrity Commissions */}
            {celebTxns.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Celebrity Commissions</Text>
                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                  {celebTxns.map((item) => (
                    <View key={item.id} style={[s.commCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={s.commCardTop}>
                        <Text style={[s.commBookingId, { color: colors.foreground }]} numberOfLines={1}>
                          {item.description ?? 'Booking Commission'}
                        </Text>
                        <Text style={[s.commDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
                      </View>
                      <View style={s.celebCommRow}>
                        <View style={s.celebCommItem}>
                          <Text style={[s.celebCommLabel, { color: colors.mutedForeground }]}>Gross</Text>
                          <Text style={[s.celebCommVal, { color: colors.foreground }]}>
                            ₹{(item.gross_amount ?? 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        <View style={s.celebCommItem}>
                          <Text style={[s.celebCommLabel, { color: colors.mutedForeground }]}>
                            TDS {item.tds_percentage ?? 0}%
                          </Text>
                          <Text style={[s.celebCommVal, { color: '#EF4444' }]}>
                            -₹{(item.tds_amount ?? 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        <View style={s.celebCommItem}>
                          <Text style={[s.celebCommLabel, { color: colors.mutedForeground }]}>Net</Text>
                          <Text style={[s.celebCommVal, { color: '#22C55E' }]}>
                            ₹{item.amount.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Earnings chart */}
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground, marginHorizontal: 0, marginBottom: 10 }]}>
                Earnings Chart
              </Text>
              <View style={[s.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.bars}>
                  {earnings.map((e) => (
                    <View key={e.month} style={s.barWrap}>
                      <LinearGradient
                        colors={['#FF6B33', '#B44CFF']}
                        style={[s.bar, { height: Math.max((e.amount / max) * 120, 4) }]}
                      />
                      <Text style={[s.barMonth, { color: colors.mutedForeground }]}>{e.month}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  topCard: { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center' },
  earningsLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  earnings: { color: '#fff', fontSize: 40, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  heroStats: { flexDirection: 'row', width: '100%', marginBottom: 16 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  heroStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 8 },
  withdrawBtn: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 9999 },
  withdrawBtnText: { color: '#FF6B33', fontSize: 14, fontFamily: 'Inter_700Bold' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 5 },
  summaryVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  dateFilter: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  dateFilterTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  dateInputRow: { flexDirection: 'row', gap: 10 },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    height: 42,
  },
  dateInputText: { flex: 1, fontSize: 13, height: 42 },
  clearBtn: { marginTop: 10, alignSelf: 'center' },
  clearBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 8,
  },
  commCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  commCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commBookingId: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  commSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  commDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  commAmount: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  levelBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  celebCommRow: { flexDirection: 'row', gap: 8 },
  celebCommItem: { flex: 1, alignItems: 'center', gap: 2 },
  celebCommLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  celebCommVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 140, paddingBottom: 24 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 6 },
  barMonth: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  authGate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  authGateTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  signInBtn: {
    backgroundColor: '#FF6B33',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 9999,
    marginTop: 8,
  },
  signInBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  iosPickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  iosPickerContainer: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  iosPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iosPickerTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  iosPickerCancel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  iosPickerDone: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  iosDatePicker: { width: '100%' },
});
