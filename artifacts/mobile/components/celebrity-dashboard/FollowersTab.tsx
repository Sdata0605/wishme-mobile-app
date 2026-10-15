import React, { useCallback, useEffect, useState } from 'react';
import {
  Text,
  View,
} from 'react-native';
import { fmtDate, StatusBadge, SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { TabProps } from './shared';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

interface Follower {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  subscription_expires_at?: string | null;
  profiles?: { first_name: string; last_name: string; email?: string };
}

export function FollowersTab({ celebrity, colors, session }: TabProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowers = useCallback(async () => {
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_favorites?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name,email)&order=created_at.desc&limit=50`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as Follower[]; setFollowers(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchFollowers(); }, [fetchFollowers]);

  useEffect(() => {
    if (!session?.access_token) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;
    const send = (msg: object) => { try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {} };
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        send({
          topic: `realtime:public:celebrity_favorites`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              postgres_changes: [{ event: '*', schema: 'public', table: 'celebrity_favorites', filter: `celebrity_id=eq.${celebrity.id}` }],
            },
            access_token: session.access_token,
          },
          ref: String(++ref),
        });
        heartbeat = setInterval(() => { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.event === 'postgres_changes') fetchFollowers();
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}
    return () => { if (heartbeat) clearInterval(heartbeat); ws?.close(); };
  }, [celebrity.id, session?.access_token, fetchFollowers]);

  if (loading) return <LoadingBox />;
  if (!followers.length) return <SectionEmpty icon="heart" text="No followers yet" colors={colors} />;

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View style={[styles.statCardIcon, { backgroundColor: '#EC489922' }]}>
            <Icon name="heart" size={22} color="#EC4899" />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 36, fontFamily: 'Inter_700Bold', marginTop: 8 }}>{followers.length}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Total Followers</Text>
        </View>
      </Card>
      <SectionTitle text={`Followers (${followers.length})`} colors={colors} />
      {followers.map(f => {
        const fan = f.profiles ? `${f.profiles.first_name ?? ''} ${f.profiles.last_name ?? ''}`.trim() : 'Fan';
        const email = f.profiles?.email;
        const expiresAt = f.subscription_expires_at ? fmtDate(f.subscription_expires_at) : 'Lifetime';
        return (
          <Card key={f.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fan}</Text>
                {email ? <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{email}</Text> : null}
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>Since {fmtDate(f.created_at)}</Text>
                <Text style={[styles.cardDate, { color: f.subscription_expires_at ? colors.mutedForeground : '#22C55E' }]}>
                  Expires: {expiresAt}
                </Text>
              </View>
              <StatusBadge status={f.status || 'active'} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}
