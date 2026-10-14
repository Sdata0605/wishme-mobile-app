import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { expandEvents, listEvents } from '@/services/hub/calendar';
import { listReminders, listRemindersBetween } from '@/services/hub/reminders';

export interface AgendaItem {
  key: string;
  kind: 'event' | 'reminder';
  id: string;
  title: string;
  /** ISO time, or null for "anytime". */
  at: string | null;
  allDay: boolean;
}

const FRESH_MS = 2 * 60 * 1000;
const CACHE = 'home_brief_v1';

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Today's agenda: calendar events plus reminders due today or overdue, sorted by time.
 * Paints the last good snapshot straight away, then refetches; data under two minutes old counts as fresh and
 * errors keep the old data on screen (the Flutter BriefService rules).
 */
export function useHomeBrief() {
  const { user, getValidSession } = useAuth();
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const lastFetch = useRef(0);
  const uid = user?.id ?? '';

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(`${CACHE}:${uid}`).then(raw => {
      if (!raw) return;
      try {
        const c = JSON.parse(raw) as { agenda: AgendaItem[] };
        setAgenda(c.agenda);
        setLoaded(true);
      } catch {
        // an unreadable snapshot is ignored
      }
    });
  }, [uid]);

  const refresh = useCallback(async (force = false) => {
    if (!uid) return;
    if (!force && Date.now() - lastFetch.current < FRESH_MS) return;
    lastFetch.current = Date.now();
    try {
      const token = (await getValidSession())?.access_token;
      if (!token) return;
      const now = new Date();
      const [events, reminders] = await Promise.all([
        listEvents(token, startOfDay(now), endOfDay(now)),
        listReminders(token, 200),
      ]);
      const items: AgendaItem[] = [
        ...expandEvents(events, startOfDay(now), endOfDay(now)).map(o => ({
          key: `e:${o.key}`, kind: 'event' as const, id: o.event.id, title: o.event.title,
          at: o.event.all_day ? null : o.start.toISOString(), allDay: o.event.all_day,
        })),
        ...reminders
          .filter(r => r.status === 'pending' && (!r.due_at || new Date(r.due_at) <= endOfDay(now)))
          .map(r => ({ key: `r:${r.id}`, kind: 'reminder' as const, id: r.id, title: r.title, at: r.due_at, allDay: false })),
      ].sort((a, b) => (a.at ? new Date(a.at).getTime() : Infinity) - (b.at ? new Date(b.at).getTime() : Infinity));
      const trimmed = items.slice(0, 6);
      setAgenda(trimmed);
      setLoaded(true);
      AsyncStorage.setItem(`${CACHE}:${uid}`, JSON.stringify({ agenda: trimmed })).catch(() => {});
    } catch {
      // keep what is on screen
      setLoaded(true);
    }
  }, [uid, getValidSession]);

  return { agenda, loaded, refresh };
}

export interface MonthItem { key: string; kind: 'event' | 'reminder'; id: string; title: string; at: string | null }

/** Everything dated inside one month, grouped by day, for the heat-map. */
export function useMonthItems(month: Date) {
  const { user, getValidSession } = useAuth();
  const [byDay, setByDay] = useState<Record<string, MonthItem[]>>({});
  const [loading, setLoading] = useState(true);
  const uid = user?.id ?? '';
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = (await getValidSession())?.access_token;
        if (!token) return;
        const from = new Date(month.getFullYear(), month.getMonth(), 1);
        const to = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
        const [events, reminders] = await Promise.all([listEvents(token, from, to), listRemindersBetween(token, from, to)]);
        const map: Record<string, MonthItem[]> = {};
        const add = (d: Date, item: MonthItem) => { (map[dayKey(d)] ??= []).push(item); };
        for (const o of expandEvents(events, from, to)) {
          add(o.start, { key: `e:${o.key}`, kind: 'event', id: o.event.id, title: o.event.title, at: o.event.all_day ? null : o.start.toISOString() });
        }
        for (const r of reminders) {
          if (r.due_at && r.status !== 'cancelled') add(new Date(r.due_at), { key: `r:${r.id}`, kind: 'reminder', id: r.id, title: r.title, at: r.due_at });
        }
        if (!cancelled) setByDay(map);
      } catch {
        // the grid just stays empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, monthKey, getValidSession]);

  return { byDay, loading };
}
