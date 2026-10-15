import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
} from 'react-native';
import { fmtDate, StatusBadge, SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { TabProps } from './shared';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';

interface Review {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  booking_id?: string;
  profiles?: { first_name: string; last_name: string };
  bookings?: { service_type: string };
}

export function ReviewsTab({ celebrity, colors, session }: TabProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseFetch(
      `/rest/v1/celebrity_reviews?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name),bookings(service_type)&order=created_at.desc&limit=30`,
      {},
      session?.access_token,
    ).then(async res => {
      if (res.ok) { const r = await res.json() as Review[]; setReviews(r ?? []); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [celebrity.id, session?.access_token]);

  if (loading) return <LoadingBox />;
  if (!reviews.length) return <SectionEmpty icon="star" text="No reviews yet" colors={colors} />;

  const avgRating = reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length;
  const starCounts = [5, 4, 3, 2, 1].map(s => ({ star: s, count: reviews.filter(r => Math.round(r.rating) === s).length }));

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 48, fontFamily: 'Inter_700Bold', lineHeight: 56 }}>{avgRating.toFixed(1)}</Text>
          <View style={[styles.starsRow, { marginBottom: 12 }]}>
            {[1, 2, 3, 4, 5].map(s => (
              <Icon key={s} name="star" size={18} color={s <= Math.round(avgRating) ? '#F59E0B' : colors.border} />
            ))}
          </View>
          <View style={{ width: '100%', gap: 4 }}>
            {starCounts.map(({ star, count }) => (
              <View key={star} style={[styles.rowBetween, { gap: 8 }]}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, width: 20, textAlign: 'right' }}>{star}★</Text>
                <View style={[styles.ratingBar, { backgroundColor: colors.border, flex: 1 }]}>
                  <View style={[styles.ratingBarFill, { width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }]} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, width: 24 }}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>
      <SectionTitle text={`Reviews (${reviews.length})`} colors={colors} />
      {reviews.map(r => {
        const fan = r.profiles ? `${r.profiles.first_name ?? ''} ${r.profiles.last_name ?? ''}`.trim() : 'Fan';
        const serviceType = r.bookings?.service_type;
        return (
          <Card key={r.id} colors={colors}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fan}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {serviceType && <StatusBadge status={serviceType.replace(/_/g, ' ')} />}
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Icon key={s} name="star" size={13} color={s <= (r.rating ?? 0) ? '#F59E0B' : colors.border} />
                  ))}
                </View>
              </View>
            </View>
            {r.review_text ? <Text style={[styles.cardSub, { color: colors.foreground, marginTop: 4 }]}>{r.review_text}</Text> : null}
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(r.created_at)}</Text>
          </Card>
        );
      })}
    </View>
  );
}
