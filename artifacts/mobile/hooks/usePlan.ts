import { useCallback, useEffect, useState } from 'react';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';

interface Plan {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  service_discount_percentage: number;
  referral_commission_percentage: number;
  is_active: boolean;
  features: string[];
}

interface UsePlanResult {
  plan: string | null;
  discountPercentage: number;
  getDiscountedPrice: (basePrice: number) => number;
  loading: boolean;
}

export function usePlan(): UsePlanResult {
  const { user, session } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!user?.profileId || !session?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const [profileRes, plansRes] = await Promise.all([
          supabaseFetch(
            `/rest/v1/profiles?select=plan&id=eq.${user.profileId}&limit=1`,
            {},
            session.access_token,
          ),
          supabaseFetch(
            '/rest/v1/plans?select=*&is_active=eq.true',
            {},
            session.access_token,
          ),
        ]);

        let currentPlan = 'basic';
        if (profileRes.ok) {
          const rows = await profileRes.json() as Array<{ plan: string }>;
          if (rows && rows.length > 0 && rows[0].plan) {
            currentPlan = rows[0].plan;
          }
        }

        let discount = 0;
        if (plansRes.ok) {
          const plans = await plansRes.json() as Plan[];
          const matchedPlan = plans.find(
            (p) => p.name.toLowerCase() === currentPlan.toLowerCase(),
          );
          if (matchedPlan) {
            discount = matchedPlan.service_discount_percentage ?? 0;
          }
        }

        setPlan(currentPlan);
        setDiscountPercentage(discount);
      } catch {
        setPlan('basic');
        setDiscountPercentage(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [user?.profileId, session?.access_token]);

  const getDiscountedPrice = useCallback(
    (basePrice: number) => Math.round(basePrice * (1 - discountPercentage / 100)),
    [discountPercentage],
  );

  return { plan, discountPercentage, getDiscountedPrice, loading };
}
