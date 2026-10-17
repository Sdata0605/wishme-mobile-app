import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { fmtDate, fmtRupee, FilterChips, StatusBadge, SectionEmpty, LoadingBox, Card, styles } from './shared';
import type { TabProps } from './shared';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

/**
 * Every order made with this celebrity, of every kind, in one list: video wishes and promotions
 * (bookings), image promotions, Wish a Friend, UGC videos and UGC ads. Tap an order to see everything the
 * customer asked for and what was delivered (the video, the image, the card), as the admin sees it.
 * The admin team fulfils orders; the celebrity is paid when an order is completed.
 */

interface OrderItem {
  key: string;
  id: string;
  label: string;
  title: string;
  customer: string;
  price: number;
  status: string;
  created_at: string;
  /** What the celebrity was paid for this order (net of TDS), from the earnings ledger. */
  earned?: number;
  fields: Array<[string, string]>;
  images: string[];
  videoUrl?: string | null;
  cardUrl?: string | null;
}

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';
const isHttp = (u?: string | null): u is string => !!u && /^https?:\/\//i.test(u);
const asImage = (u?: string | null): string | null => (u ? (isHttp(u) ? u : B2_BASE + u) : null);
const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v)).trim();
const nameOf = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Customer' : 'Customer';

function pushField(fields: Array<[string, string]>, label: string, value: unknown) {
  const v = clean(value);
  if (v) fields.push([label, v]);
}

const IN_PROGRESS = ['pending', 'pending_approval', 'confirmed', 'processing', 'in_progress', 'accepted'];
const DONE_STATUS = ['completed', 'video_sent', 'delivered'];
const REJECTED = ['rejected', 'declined', 'failed', 'cancelled'];

export function OrdersTab({ celebrity, colors, session }: TabProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    const token = session?.access_token;
    const id = celebrity.id;
    try {
      const get = async <T,>(path: string): Promise<T[]> => {
        const r = await supabaseFetch(path, {}, token);
        return r.ok ? (((await r.json()) as T[]) ?? []) : [];
      };
      const [bookings, promos, friends, ads] = await Promise.all([
        get<any>(`/rest/v1/bookings?celebrity_id=eq.${id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=100`),
        get<any>(`/rest/v1/image_promotions?celebrity_id=eq.${id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=100`),
        get<any>(`/rest/v1/wish_friend_orders?celebrity_id=eq.${id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=100`),
        get<any>(`/rest/v1/ugc_ads?celebrity_id=eq.${id}&select=*&order=created_at.desc&limit=100`),
      ]);

      const items: OrderItem[] = [];

      for (const b of bookings) {
        let msg: any = null;
        try { if (b.message) msg = JSON.parse(b.message); } catch { /* plain text message */ }
        const req = msg?.requestDetails ?? msg?.step1 ?? {};
        const guide = msg?.creativeGuidelines ?? {};
        const fields: Array<[string, string]> = [];
        pushField(fields, 'For', req.recipientName);
        pushField(fields, 'Occasion', req.occasion);
        pushField(fields, 'Message', req.message ?? (msg ? '' : b.message));
        pushField(fields, 'Goal', guide.goal ?? b.instructions);
        pushField(fields, 'Tone', guide.toneAndStyle);
        pushField(fields, 'Delivery', b.delivery_type);
        pushField(fields, 'Delivery date', b.delivery_date);
        pushField(fields, 'Script', b.script_content ?? b.generated_script);
        items.push({
          key: `booking-${b.id}`, id: b.id,
          label: String(b.service_type ?? 'booking').replace(/_/g, ' '),
          title: clean(req.recipientName) || 'Booking',
          customer: nameOf(b.profiles), price: Number(b.final_price ?? 0), status: b.status, created_at: b.created_at,
          earned: b.status === 'completed' || b.status === 'video_sent' || b.status === 'confirmed' ? Number(b.celebrity_commission ?? 0) || undefined : undefined,
          fields,
          images: [asImage(b.reference_image_url)].filter(Boolean) as string[],
          videoUrl: isHttp(b.video_url) ? b.video_url : null,
          cardUrl: isHttp(b.card_url) ? b.card_url : null,
        });
      }

      for (const p of promos) {
        const fields: Array<[string, string]> = [];
        pushField(fields, 'Concept', p.concept);
        pushField(fields, 'Branding', p.branding_details);
        items.push({
          key: `promo-${p.id}`, id: p.id, label: 'image promotion', title: clean(p.concept).slice(0, 60) || 'Image promotion',
          customer: nameOf(p.profiles), price: Number(p.price_paid ?? 0), status: p.status, created_at: p.created_at,
          fields, images: [asImage(p.generated_image_url)].filter(Boolean) as string[],
        });
      }

      for (const w of friends) {
        const fields: Array<[string, string]> = [];
        pushField(fields, 'For', w.recipient_name);
        pushField(fields, 'Occasion', w.occasion);
        pushField(fields, 'Relationship', w.relationship);
        pushField(fields, 'Tone', w.tone);
        pushField(fields, 'What to say', w.prompt);
        pushField(fields, 'Format', w.aspect_ratio);
        pushField(fields, 'Opening style', w.hook_style);
        pushField(fields, 'Closing line', w.call_to_action);
        items.push({
          key: `friend-${w.id}`, id: w.id, label: w.order_type === 'ugc_video' ? 'UGC video' : 'video wish + card',
          title: `${clean(w.recipient_name) || 'Friend'}${w.occasion ? ` · ${w.occasion}` : ''}`,
          customer: nameOf(w.profiles), price: Number(w.price_paid ?? 0), status: w.status, created_at: w.created_at,
          fields, images: [asImage(w.reference_image_url)].filter(Boolean) as string[],
          videoUrl: isHttp(w.video_url) ? w.video_url : null,
          cardUrl: isHttp(w.card_url) ? w.card_url : null,
        });
      }

      for (const a of ads) {
        const fields: Array<[string, string]> = [];
        pushField(fields, 'Product', a.product_name);
        pushField(fields, 'About', a.product_description);
        pushField(fields, 'Brief', a.prompt);
        pushField(fields, 'Format', a.aspect_ratio);
        pushField(fields, 'Opening style', a.hook_style);
        pushField(fields, 'Closing line', a.call_to_action);
        items.push({
          key: `ad-${a.id}`, id: a.id, label: 'UGC ad', title: clean(a.product_name) || 'UGC ad',
          customer: 'Customer', price: Number(a.price_paid ?? 0), status: a.status, created_at: a.created_at,
          fields, images: [asImage(a.product_image_url)].filter(Boolean) as string[],
          videoUrl: isHttp(a.video_url) ? a.video_url : null,
        });
      }

      // What the celebrity was actually paid on each order comes from the earnings ledger.
      if (items.length > 0) {
        const ledger = await get<{ booking_id: string; amount: number }>(
          `/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${id}&transaction_type=eq.earning&select=booking_id,amount&limit=1000`,
        );
        const earned = new Map(ledger.map(l => [l.booking_id, Number(l.amount)]));
        for (const it of items) if (earned.has(it.id)) it.earned = earned.get(it.id);
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(items);
    } catch {
      // keep what is on screen
    }
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Live: an order made, delivered or paid shows up without a refresh.
  useEffect(() => {
    if (!session?.access_token) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;
    const send = (msg: object) => { try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {} };
    const join = (table: string) => send({
      topic: `realtime:public:${table}`,
      event: 'phx_join',
      payload: {
        config: { broadcast: { ack: false, self: false }, postgres_changes: [{ event: '*', schema: 'public', table, filter: `celebrity_id=eq.${celebrity.id}` }] },
        access_token: session.access_token,
      },
      ref: String(++ref),
    });
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ['bookings', 'image_promotions', 'wish_friend_orders', 'ugc_ads', 'celebrity_wallet_transactions'].forEach(join);
        heartbeat = setInterval(() => { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 30000);
      };
      ws.onmessage = (evt) => {
        try { if (JSON.parse(evt.data as string).event === 'postgres_changes') fetchOrders(); } catch {}
      };
      ws.onerror = () => {};
    } catch {}
    return () => { if (heartbeat) clearInterval(heartbeat); ws?.close(); };
  }, [celebrity.id, session?.access_token, fetchOrders]);

  const counts = useMemo(() => ({
    all: orders.length,
    progress: orders.filter(o => IN_PROGRESS.includes(o.status)).length,
    done: orders.filter(o => DONE_STATUS.includes(o.status)).length,
    rejected: orders.filter(o => REJECTED.includes(o.status)).length,
  }), [orders]);

  const shown = useMemo(() => orders.filter(o =>
    filter === 'all' ? true
      : filter === 'progress' ? IN_PROGRESS.includes(o.status)
      : filter === 'done' ? DONE_STATUS.includes(o.status)
      : REJECTED.includes(o.status)), [orders, filter]);

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 10, marginTop: 0 }]}>
        {counts.all} {counts.all === 1 ? 'order' : 'orders'} · {counts.done} completed / {counts.progress} in progress
      </Text>
      {counts.all > 0 && (
        <FilterChips
          colors={colors}
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'progress', label: 'In progress', count: counts.progress },
            { key: 'done', label: 'Completed', count: counts.done },
            ...(counts.rejected > 0 ? [{ key: 'rejected', label: 'Rejected', count: counts.rejected }] : []),
          ]}
        />
      )}
      {counts.all === 0 && <SectionEmpty icon="credit-card" text="No orders yet" colors={colors} />}
      {counts.all > 0 && shown.length === 0 && <SectionEmpty icon="credit-card" text="No orders in this filter" colors={colors} />}

      {shown.map(o => {
        const isOpen = open === o.key;
        return (
          <Card key={o.key} colors={colors}>
            <TouchableOpacity onPress={() => setOpen(isOpen ? null : o.key)} activeOpacity={0.8}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{o.title}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground, textTransform: 'capitalize' }]}>{o.label} · {o.customer}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text style={[styles.priceText, { color: '#B026FF' }]}>{fmtRupee(o.price)}</Text>
                  <StatusBadge status={o.status} />
                </View>
              </View>
              <View style={[styles.rowBetween, { marginTop: 6 }]}>
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(o.created_at)}</Text>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#B026FF" />
              </View>
              <Text style={{ marginTop: 4, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: o.earned ? '#22C55E' : colors.mutedForeground }}>
                {o.earned ? `You earned ${fmtRupee(o.earned)}` : ['completed', 'video_sent', 'delivered'].includes(o.status) ? 'Earning is being added' : 'You are paid when the order is completed'}
              </Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
                {o.fields.map(([label, value]) => (
                  <View key={label}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{label.toUpperCase()}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 }}>{value}</Text>
                  </View>
                ))}

                {o.images.map(uri => (
                  <Image key={uri} source={{ uri }} style={{ width: '100%', height: 220, borderRadius: 12 }} contentFit="cover" />
                ))}

                {o.videoUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(o.videoUrl!)} style={[styles.smallBtn, { borderColor: '#B026FF', backgroundColor: '#B026FF20', alignSelf: 'flex-start' }]}>
                    <Text style={{ color: '#B026FF', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Watch the video</Text>
                  </TouchableOpacity>
                ) : null}
                {o.cardUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(o.cardUrl!)} accessibilityRole="imagebutton" accessibilityLabel="Open the card">
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 4 }}>THE CARD</Text>
                    <Image source={{ uri: o.cardUrl }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} contentFit="cover" />
                  </TouchableOpacity>
                ) : null}
                {!o.videoUrl && !o.cardUrl && o.images.length === 0 && o.fields.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Nothing delivered yet.</Text>
                ) : null}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}
