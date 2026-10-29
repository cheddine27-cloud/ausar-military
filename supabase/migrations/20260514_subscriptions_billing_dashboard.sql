-- Q-Hudoor v2.5.0 - Super Admin subscriptions and manual billing
-- Safe additive migration: no attendance tables or flows are changed.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS current_period_end DATE,
  ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'DZD',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS last_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS max_users INTEGER,
  ADD COLUMN IF NOT EXISTS max_teachers INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.subscriptions
SET
  plan_name = COALESCE(plan_name, plan_type, 'Starter'),
  max_users = COALESCE(max_users, student_limit, 500),
  max_teachers = COALESCE(max_teachers, session_limit),
  billing_cycle = COALESCE(billing_cycle, 'monthly'),
  currency = COALESCE(currency, 'DZD'),
  payment_status = COALESCE(payment_status, 'pending'),
  current_period_end = COALESCE(current_period_end, end_date),
  updated_at = COALESCE(updated_at, NOW());

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  invoice_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'DZD',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id
  ON public.subscription_payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_institution_id
  ON public.subscription_payments(institution_id);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_payments tenant select" ON public.subscription_payments;
DROP POLICY IF EXISTS "subscription_payments super insert" ON public.subscription_payments;
DROP POLICY IF EXISTS "subscription_payments super update" ON public.subscription_payments;
DROP POLICY IF EXISTS "subscription_payments super delete" ON public.subscription_payments;

CREATE POLICY "subscription_payments tenant select" ON public.subscription_payments
  FOR SELECT TO authenticated
  USING (private.can_access_institution(institution_id));

CREATE POLICY "subscription_payments super insert" ON public.subscription_payments
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "subscription_payments super update" ON public.subscription_payments
  FOR UPDATE TO authenticated
  USING (private.is_super_admin())
  WITH CHECK (private.is_super_admin());

CREATE POLICY "subscription_payments super delete" ON public.subscription_payments
  FOR DELETE TO authenticated
  USING (private.is_super_admin());
