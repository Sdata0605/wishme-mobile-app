import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtDate, fmtRupee, StatusBadge, SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { Booking, CelebrityOrder, ImagePromotion, TabProps } from './shared';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

export function BookingsTab({ celebrity, colors, session }: TabProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [imagePromos, setImagePromos] = useState<ImagePromotion[]>([]);
  const [orders, setOrders] = useState<CelebrityOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, ipRes, wfRes, uaRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/bookings?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=50`,
          {},
          session?.access_token,
        ),
        supabaseFetch(
          `/rest/v1/image_promotions?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=30`,
          {},
          session?.access_token,
        ),
        supabaseFetch(
          `/rest/v1/wish_friend_orders?celebrity_id=eq.${celebrity.id}&select=id,order_type,recipient_name,occasion,price_paid,status,created_at,video_url,profiles(first_name,last_name)&order=created_at.desc&limit=50`,
          {},
          session?.access_token,
        ),
        supabaseFetch(
          `/rest/v1/ugc_ads?celebrity_id=eq.${celebrity.id}&select=id,product_name,price_paid,status,created_at,video_url&order=created_at.desc&limit=50`,
          {},
          session?.access_token,
        ),
      ]);
      if (bRes.ok) { const rows = await bRes.json() as Booking[]; setBookings(rows ?? []); }
      if (ipRes.ok) { const rows = await ipRes.json() as ImagePromotion[]; setImagePromos(rows ?? []); }

      // Wish a Friend, UGC videos and UGC ads: the admin makes the video, and the celebrity is paid when it is completed.
      const merged: CelebrityOrder[] = [];
      if (wfRes.ok) {
        const rows = await wfRes.json() as Array<{ id: string; order_type: string; recipient_name: string | null; occasion: string | null; price_paid: number; status: string; created_at: string; video_url: string | null; profiles?: { first_name?: string; last_name?: string } | null }>;
        for (const r of rows ?? []) {
          merged.push({
            id: r.id,
            kind: 'wish_friend',
            label: r.order_type === 'ugc_video' ? 'UGC video' : 'Video wish',
            title: `${r.recipient_name ?? 'Friend'}${r.occasion ? ` · ${r.occasion}` : ''}`,
            price_paid: r.price_paid,
            status: r.status,
            created_at: r.created_at,
            customer: r.profiles ? `${r.profiles.first_name ?? ''} ${r.profiles.last_name ?? ''}`.trim() || 'Customer' : 'Customer',
            video_url: r.video_url,
          });
        }
      }
      if (uaRes.ok) {
        const rows = await uaRes.json() as Array<{ id: string; product_name: string | null; price_paid: number; status: string; created_at: string; video_url: string | null }>;
        for (const r of rows ?? []) {
          merged.push({ id: r.id, kind: 'ugc_ad', label: 'UGC ad', title: r.product_name ?? 'UGC ad', price_paid: r.price_paid, status: r.status, created_at: r.created_at, customer: 'Customer', video_url: r.video_url });
        }
      }
      if (merged.length > 0) {
        // What the celebrity was actually paid for each order comes from the earnings ledger.
        const ids = merged.map(o => o.id).join(',');
        const ledgerRes = await supabaseFetch(
          `/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${celebrity.id}&transaction_type=eq.earning&booking_id=in.(${ids})&select=booking_id,amount`,
          {},
          session?.access_token,
        );
        if (ledgerRes.ok) {
          const ledger = await ledgerRes.json() as Array<{ booking_id: string; amount: number }>;
          const earned = new Map((ledger ?? []).map(l => [l.booking_id, Number(l.amount)]));
          for (const o of merged) if (earned.has(o.id)) o.earned = earned.get(o.id);
        }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(merged);
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  const toggleExpand = (id: string) => {
    setExpandedBookings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  useEffect(() => {
    if (!session?.access_token) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;
    const send = (msg: object) => { try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {} };
    const join = (table: string) => {
      send({
        topic: `realtime:public:${table}`,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            postgres_changes: [{ event: '*', schema: 'public', table, filter: `celebrity_id=eq.${celebrity.id}` }],
          },
          access_token: session.access_token,
        },
        ref: String(++ref),
      });
    };
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        join('bookings');
        join('image_promotions');
        join('wish_friend_orders');
        join('ugc_ads');
        heartbeat = setInterval(() => { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.event === 'postgres_changes') fetchBookings();
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}
    return () => { if (heartbeat) clearInterval(heartbeat); ws?.close(); };
  }, [celebrity.id, session?.access_token, fetchBookings]);

  const updateStatus = async (id: string, status: string) => {
    setActing(id);
    try {
      const res = await supabaseFetch(
        `/rest/v1/bookings?id=eq.${id}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ status }) },
        session?.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to update booking (${res.status})`);
      } else {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update booking');
    }
    setActing(null);
  };

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text={`All Bookings (${bookings.length})`} colors={colors} />
      {bookings.length === 0 && <SectionEmpty icon="credit-card" text="No bookings yet" colors={colors} />}
      {bookings.map(b => {
        const fanName = b.profiles ? `${b.profiles.first_name ?? ''} ${b.profiles.last_name ?? ''}`.trim() : 'Fan';
        let requestDetails: { recipientName?: string; occasion?: string; message?: string } | null = null;
        try { if (b.message) { const parsed = JSON.parse(b.message); requestDetails = parsed?.requestDetails ?? parsed?.step1 ?? parsed ?? null; } } catch {}
        const isExpanded = expandedBookings.has(b.id);
        return (
          <Card key={b.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fanName}</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{b.service_type?.replace(/_/g, ' ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.priceText, { color: '#7B5CFA' }]}>{fmtRupee(b.final_price)}</Text>
                <StatusBadge status={b.status} />
              </View>
            </View>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(b.created_at)}</Text>
            {requestDetails && (
              <TouchableOpacity onPress={() => toggleExpand(b.id)} style={{ marginTop: 8 }}>
                <View style={[styles.rowBetween, { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={{ color: '#7B5CFA', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Request Details</Text>
                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#7B5CFA" />
                </View>
                {isExpanded && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {requestDetails.recipientName ? <Text style={[styles.cardSub, { color: colors.foreground }]}>To: {requestDetails.recipientName}</Text> : null}
                    {requestDetails.occasion ? <Text style={[styles.cardSub, { color: colors.foreground }]}>Occasion: {requestDetails.occasion}</Text> : null}
                    {requestDetails.message ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{requestDetails.message}</Text> : null}
                  </View>
                )}
              </TouchableOpacity>
            )}
            {b.status === 'pending' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => updateStatus(b.id, 'accepted')}
                  disabled={acting === b.id}
                  style={[styles.smallBtn, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}
                >
                  {acting === b.id ? <ActivityIndicator size="small" color="#22C55E" /> : <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Accept</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateStatus(b.id, 'rejected')}
                  disabled={acting === b.id}
                  style={[styles.smallBtn, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}
                >
                  <Text style={{ color: '#EF4444', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        );
      })}

      <SectionTitle text={`Wish a Friend & UGC Orders (${orders.length})`} colors={colors} />
      {orders.length === 0 ? (
        <SectionEmpty icon="video" text="No Wish a Friend or UGC orders yet" colors={colors} />
      ) : (
        orders.map(o => (
          <Card key={`${o.kind}-${o.id}`} colors={colors}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{o.title}</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{o.label} · {o.customer}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                <Text style={[styles.priceText, { color: '#7B5CFA' }]}>{fmtRupee(o.price_paid)}</Text>
                <StatusBadge status={o.status} />
              </View>
            </View>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(o.created_at)}</Text>
            <Text style={{ marginTop: 6, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: o.earned != null ? '#22C55E' : colors.mutedForeground }}>
              {o.earned != null ? `You earned ${fmtRupee(o.earned)}` : o.status === 'completed' ? 'Earning is being added' : 'You are paid when the order is completed'}
            </Text>
          </Card>
        ))
      )}

      <SectionTitle text="Image Promotions" colors={colors} />
      {imagePromos.length === 0 ? (
        <SectionEmpty icon="image" text="No image promotions yet" colors={colors} />
      ) : (
        imagePromos.map(ip => {
          const customer = ip.profiles ? `${ip.profiles.first_name ?? ''} ${ip.profiles.last_name ?? ''}`.trim() : 'Customer';
          return (
            <Card key={ip.id} colors={colors}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{ip.concept || 'Image Promotion'}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{customer}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text style={[styles.priceText, { color: '#7B5CFA' }]}>{fmtRupee(ip.price_paid)}</Text>
                  <StatusBadge status={ip.status} />
                </View>
              </View>
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(ip.created_at)}</Text>
            </Card>
          );
        })
      )}
    </View>
  );
}
