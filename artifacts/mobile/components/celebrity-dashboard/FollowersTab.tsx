import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LoadingBox, Card, styles } from './shared';
import type { TabProps } from './shared';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_WS_URL, supabaseFetch } from '@/constants/supabase';

/** How many users are subscribed to this celebrity. Only the number: who they are stays private. */
export function FollowersTab({ celebrity, colors, session }: TabProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_favorites?celebrity_id=eq.${celebrity.id}&status=eq.active&select=id&limit=100000`,
        {},
        session?.access_token,
      );
      if (res.ok) setCount(((await res.json()) as unknown[]).length);
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  // Live: a new subscriber updates the number without a refresh.
  useEffect(() => {
    if (!session?.access_token) return;
    const wsBase = SUPABASE_WS_URL;
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;
    const send = (msg: object) => { try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {} };
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        send({
          topic: 'realtime:public:celebrity_favorites',
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
        try { if (JSON.parse(evt.data as string).event === 'postgres_changes') fetchCount(); } catch {}
      };
      ws.onerror = () => {};
    } catch {}
    return () => { if (heartbeat) clearInterval(heartbeat); ws?.close(); };
  }, [celebrity.id, session?.access_token, fetchCount]);

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={[styles.statCardIcon, { backgroundColor: '#EC489922' }]}>
            <Icon name="heart" size={22} color="#EC4899" />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 40, fontFamily: 'Inter_700Bold', marginTop: 8 }}>{count}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>
            {count === 1 ? 'subscribed fan' : 'subscribed fans'}
          </Text>
        </View>
      </Card>
    </View>
  );
}
