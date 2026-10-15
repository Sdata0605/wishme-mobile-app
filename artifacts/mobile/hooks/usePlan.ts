import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchOne, fetchRows } from '@/services/supabaseRest';

interface Plan {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  service_discount_percentage: number;
  referral_commission_l1?: number | null;
  referral_commission_l2?: number | null;
  is_active: boolean;
  features: string[];
}

interface UsePlanResult {
  plan: string | null;
  discountPercentage: number;
  getDiscountedPrice: (basePrice: number) => number;
  loading: boolean;
}

const DEFAULT_PLAN = 'basic';

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
        // Each request fails on its own: a missing profile row must not hide the plan list, and vice versa.
        const [profile, plans] = await Promise.all([
          fetchOne<{ plan: string | null }>(
            `/rest/v1/profiles?select=plan&id=eq.${user.profileId}&limit=1`,
            session.access_token,
          ).catch(() => null),
          fetchRows<Plan>('/rest/v1/plans?select=*&is_active=eq.true', session.access_token).catch(() => []),
        ]);

        const currentPlan = profile?.plan || DEFAULT_PLAN;
        const matched = plans.find((p) => p.name.toLowerCase() === currentPlan.toLowerCase());

        setPlan(currentPlan);
        setDiscountPercentage(matched?.service_discount_percentage ?? 0);
      } catch {
        setPlan(DEFAULT_PLAN);
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
