import { useCallback, useEffect, useState } from 'react';
import type { IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import type { Session } from '@/context/AuthContext';

export interface Activity {
  key: string;
  icon: IconName;
  title: string;
  sub: string;
  at: string;
  /** The dashboard section this row opens. */
  section: string;
}

export interface DashboardData {
  /** Earnings credited since the 1st of this month (net of TDS). */
  monthEarnings: number;
  /** Orders the team still has to make (waiting or being made). */
  ordersToDo: number;
  unreadMessages: number;
  followers: number;
  hasBank: boolean;
  recent: Activity[];
  loaded: boolean;
}

const EMPTY: DashboardData = { monthEarnings: 0, ordersToDo: 0, unreadMessages: 0, followers: 0, hasBank: true, recent: [], loaded: false };

const plain = (s: string) => s.replace(/_/g, ' ');

/**
 * The few numbers the side bar badges and the Overview screen need, fetched together so both stay in step.
 * Pass a changing `refreshKey` to load again (pull to refresh).
 */
export function useDashboardData(celebrityId: string | undefined, profileId: string | undefined, session: Session | null, refreshKey: number): DashboardData {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const token = session?.access_token;

  const load = useCallback(async () => {
    if (!celebrityId || !token) return;
    const get = async <T,>(path: string): Promise<T[]> => {
      try {
        const r = await supabaseFetch(path, {}, token);
        return r.ok ? (((await r.json()) as T[]) ?? []) : [];
      } catch {
        return [];
      }
    };
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const c = `celebrity_id=eq.${celebrityId}`;

    const [ledger, todoB, todoW, todoA, convos, favs, banks, ordersB, ordersW, ordersA, payouts, reviews] = await Promise.all([
      get<{ amount: number }>(`/rest/v1/celebrity_wallet_transactions?${c}&transaction_type=eq.earning&created_at=gte.${encodeURIComponent(monthStart)}&select=amount&limit=1000`),
      get<{ id: string }>(`/rest/v1/bookings?${c}&status=in.(pending,confirmed)&select=id&limit=500`),
      get<{ id: string }>(`/rest/v1/wish_friend_orders?${c}&status=in.(pending,processing)&select=id&limit=500`),
      get<{ id: string }>(`/rest/v1/ugc_ads?${c}&status=in.(pending_approval,processing)&select=id&limit=500`),
      get<{ id: string }>(`/rest/v1/conversations?${c}&select=id&limit=200`),
      get<{ id: string }>(`/rest/v1/celebrity_favorites?${c}&status=eq.active&select=id&limit=100000`),
      profileId ? get<{ id: string }>(`/rest/v1/bank_details?user_id=eq.${profileId}&select=id&limit=1`) : Promise.resolve([{ id: 'x' }]),
      get<{ id: string; service_type: string; final_price: number; status: string; created_at: string }>(`/rest/v1/bookings?${c}&select=id,service_type,final_price,status,created_at&order=created_at.desc&limit=5`),
      get<{ id: string; order_type: string; recipient_name: string | null; price_paid: number; status: string; created_at: string }>(`/rest/v1/wish_friend_orders?${c}&select=id,order_type,recipient_name,price_paid,status,created_at&order=created_at.desc&limit=5`),
      get<{ id: string; product_name: string | null; price_paid: number; status: string; created_at: string }>(`/rest/v1/ugc_ads?${c}&select=id,product_name,price_paid,status,created_at&order=created_at.desc&limit=5`),
      get<{ id: string; requested_amount: number; status: string; requested_at: string }>(`/rest/v1/payout_requests?${c}&select=id,requested_amount,status,requested_at&order=requested_at.desc&limit=3`),
      get<{ id: string; rating: number; created_at: string }>(`/rest/v1/celebrity_reviews?${c}&select=id,rating,created_at&order=created_at.desc&limit=3`),
    ]);

    let unread = 0;
    if (convos.length > 0 && profileId) {
      const ids = convos.map(x => x.id).join(',');
      const msgs = await get<{ id: string }>(`/rest/v1/messages?conversation_id=in.(${ids})&is_read=eq.false&sender_id=neq.${profileId}&select=id&limit=500`);
      unread = msgs.length;
    }

    const recent: Activity[] = [
      ...ordersB.map(o => ({ key: `b-${o.id}`, icon: 'shopping-bag' as IconName, title: `New ${plain(o.service_type ?? 'order')}`, sub: `₹${Number(o.final_price ?? 0).toLocaleString('en-IN')} · ${plain(o.status)}`, at: o.created_at, section: 'orders' })),
      ...ordersW.map(o => ({ key: `w-${o.id}`, icon: 'video' as IconName, title: `${o.order_type === 'ugc_video' ? 'UGC video' : 'Video wish'} for ${o.recipient_name ?? 'a friend'}`, sub: `₹${Number(o.price_paid ?? 0).toLocaleString('en-IN')} · ${plain(o.status)}`, at: o.created_at, section: 'orders' })),
      ...ordersA.map(o => ({ key: `a-${o.id}`, icon: 'video' as IconName, title: `UGC ad: ${o.product_name ?? 'new order'}`, sub: `₹${Number(o.price_paid ?? 0).toLocaleString('en-IN')} · ${plain(o.status)}`, at: o.created_at, section: 'orders' })),
      ...payouts.map(p => ({ key: `p-${p.id}`, icon: 'wallet' as IconName, title: `Withdrawal of ₹${Number(p.requested_amount).toLocaleString('en-IN')}`, sub: p.status === 'processed' ? 'Paid' : p.status === 'processing' ? 'On its way' : plain(p.status), at: p.requested_at, section: 'wallet' })),
      ...reviews.map(r => ({ key: `r-${r.id}`, icon: 'star' as IconName, title: `New ${r.rating}-star review`, sub: 'From a fan', at: r.created_at, section: 'reviews' })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);

    setData({
      monthEarnings: ledger.reduce((s, l) => s + Number(l.amount ?? 0), 0),
      ordersToDo: todoB.length + todoW.length + todoA.length,
      unreadMessages: unread,
      followers: favs.length,
      hasBank: banks.length > 0,
      recent,
      loaded: true,
    });
  }, [celebrityId, profileId, token]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return data;
}
