-- ============================================================================
-- v5.0.0 — Factory Reset Protection (بصمة جهاز مركبة + سجل معرّفات الجهاز)
-- ============================================================================
-- المشكلة: بصمة Android الحالية تعتمد على `androidInfo.id` (Android ID) وحده،
-- وهو يتغير عند إعادة ضبط المصنع (Factory Reset). هذا يتيح لطالب ماهر مسح
-- هوية جهازه وتسجيل حضوره بجهاز زميل.
--
-- الحل بثلاث طبقات:
-- 1. بصمة مركّبة من خصائص ثابتة لا تتغير مع إعادة الضبط:
--    (brand + model + product + os_version)
--    + Android ID (يتغير — لكنه طبقة ثانية فقط وليس الأساس)
-- 2. جدول `student_device_identities` يحفظ كل معرّف Android ID سابق
--    لنفس الطالب — حتى بعد Factory Reset يتعرّف النظام على الجهاز من
--    البصمة المركّبة ويعرف أن معرّفه السابق يخصه هو.
-- 3. فحص "الجهاز مرتبط بطالب آخر" يشمل جدول السجل — فلا يمكن لأحد
--    تبديل الأجهزة بين الطلاب.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. جدول سجل معرّفات الجهاز (Device Identity History)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_device_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL,
  device_fingerprint_hash TEXT NOT NULL, -- hash بصمة مركّبة (brand|model|product|os_version)
  android_id TEXT NOT NULL,              -- Android ID كما كان وقت التسجيل (يتغير بعد reset)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_detected BOOLEAN NOT NULL DEFAULT false, -- true إذا تغيّر android_id بعد factory reset
  UNIQUE (student_id, android_id)
);

-- index سريع لفحص "هل هذا الجهاز مرتبط بطالب آخر؟"
CREATE INDEX IF NOT EXISTS idx_student_device_identities_fingerprint
  ON public.student_device_identities (device_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_student_device_identities_student
  ON public.student_device_identities (student_id);

COMMENT ON TABLE public.student_device_identities IS
  'سجل كل معرّف جهاز استخدمه كل طالب — يحمي من هجمات Factory Reset: إذا تغيّر Android ID بعد إعادة ضبط المصنع، البصمة المركّبة (brand|model|os) تكشف أن الجهاز هو نفسه يعود لنفس الطالب.';

-- ----------------------------------------------------------------------------
-- 2. تحديث جدول student_devices: عمود للبصمة المركّبة
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_devices
  ADD COLUMN IF NOT EXISTS composite_fingerprint TEXT;

COMMENT ON COLUMN public.student_devices.composite_fingerprint IS
  'بصمة مركّبة ثابتة: brand|model|product|os_version — لا تتغير مع Factory Reset. الأساس الجديد للتحقق من الجهاز بدل Android ID وحده.';

-- ----------------------------------------------------------------------------
-- 3. ترحيل البيانات الموجودة: توليد composite_fingerprint للجهاز النشط
-- ----------------------------------------------------------------------------
-- ملاحظة: الأجهزة الحالية لم يكن لديها composite فستبقى NULL حتى أول
-- حضور من تطبيق محدّث. هذا مقصود — لن نؤثّر على الأجهزة العاملة.

-- ----------------------------------------------------------------------------
-- 4. سياسات RLS لجدول السجل الجديد
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_device_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_device_identities select" ON public.student_device_identities;
DROP POLICY IF EXISTS "student_device_identities insert" ON public.student_device_identities;
DROP POLICY IF EXISTS "student_device_identities update" ON public.student_device_identities;

-- القراءة:Edge Function تكتب بـ service_role، والقراءة الإدارية عبر private helpers.
CREATE POLICY "student_device_identities select"
  ON public.student_device_identities
  FOR SELECT
  TO authenticated
  USING (exists (select 1 from private.can_access_institution(
    student_device_identities.institution_id
  )));

-- Edge Function هي الوحيدة التي تكتب فعليًا (service_role).
CREATE POLICY "student_device_identities insert"
  ON public.student_device_identities
  FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin());

CREATE POLICY "student_device_identities update"
  ON public.student_device_identities
  FOR UPDATE TO authenticated
  USING (private.is_super_admin());

