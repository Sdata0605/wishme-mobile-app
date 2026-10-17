/** Subscribes to Supabase realtime UPDATEs on the user's bookings, music generations and Wish a Friend orders. */
import { useEffect, useRef } from 'react';
import { SUPABASE_WS_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';

export function useRealtimeBookings(
  profileId: string | null,
  accessToken: string | null,
  onUpdate: (table: string) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!profileId || !accessToken) return;
    const wsBase = SUPABASE_WS_URL;
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;

    const send = (msg: object) => {
      try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {}
    };

    const join = (table: string) => {
      send({
        topic: `realtime:public:${table}`,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            postgres_changes: [{ event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${profileId}` }],
          },
          access_token: accessToken,
        },
        ref: String(++ref),
      });
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        join('bookings');
        join('music_generations');
        join('wish_friend_orders');
        heartbeat = setInterval(() => {
          send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) });
        }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          const isUpdate =
            msg.event === 'postgres_changes' &&
            (msg.payload?.data?.type === 'UPDATE' || msg.payload?.eventType === 'UPDATE');
          if (isUpdate) {
            const topic: string = msg.topic ?? '';
            if (topic.includes('wish_friend_orders')) {
              onUpdateRef.current('wish_friend_orders');
            } else if (topic.includes('music_generations')) {
              onUpdateRef.current('music_generations');
            } else if (topic.includes('bookings')) {
              onUpdateRef.current('bookings');
            }
          }
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws?.close();
    };
  }, [profileId, accessToken]);
}
