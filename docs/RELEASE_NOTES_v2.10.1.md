# Ausar Military v2.10.1 — Pre-Customer Demo Hardening

**Release Date:** 2026-05-23 
**Type:** Patch (RLS hardening + demo accounts) 
**Live URL:** https://Ausar Military.vercel.app 
**Previous version:** [v2.10.0](RELEASE_NOTES_v2.10.0.md) (نفس اليوم)

---

## 🎯 Headline

v2.10.1 هو إصدار patch مكثّف اكتُشف خلاله **bug RLS حقيقي** أثناء التحقّق ما قبل العرض التجاري، وتم إصلاحه. كما تم إنشاء 3 حسابات ديمو إضافية (faculty_admin / department_admin / viewer) لتعزيز سيناريو الـ Scope Picker أمام الزبون.

> ⚠️ **هذا ليس feature جديد.** هو bug fix أمني + بيانات ديمو + توثيق pre-demo.

---

## 🔒 Bug fix أمني (RLS hardening)

### المشكلة المكتشفة

دالة `private.is_unrestricted_in_institution(target_institution_id uuid)` كانت تُرجع `true` لأيّ user_scopes صف بـ `unit_id IS NULL`، **بصرف النظر عن `scope_role`**.

**التأثير العملي:** مستعمل بدور `viewer` لو كان ربطه على مستوى المؤسسة كاملة (institution-wide read-only) كان قادراً على UPDATE / DELETE / INSERT على عدة جداول (students, cohorts, sessions...) لأن سياسات الكتابة تعتمد على `is_unrestricted_in_institution()`.

**كيف اكتُشِف:** أثناء إنشاء حساب `viewer_demo` في BEGIN/ROLLBACK simulation كـ pre-customer test، تبيّن أن viewer قادر على UPDATE 5 طلاب في Skikda — وهذا انتهاك واضح لعقد الـ "viewer = read only".

**ملاحظة:** هذا bug في طبقة defense-in-depth فقط (الواجهة لا تعرض أزرار التعديل لـ viewer). لم يُستغَلّ في الإنتاج لأنه لا يوجد مستعمل viewer قبل اليوم.

### الإصلاح

```sql
CREATE OR REPLACE FUNCTION private.is_unrestricted_in_institution(target_institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    private.is_super_admin()
    OR (
      private.current_admin_role() IN ('institution_owner', 'institution_admin')
      AND private.current_admin_institution_id() = target_institution_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_scopes us
      WHERE us.admin_id = private.current_admin_id()
        AND us.institution_id = target_institution_id
        AND us.unit_id IS NULL
        AND us.scope_role <> 'viewer'   -- ← الإصلاح
    )
$$;
```

**Migration:** `v2_10_1_fix_viewer_rls_writes`

نَفس النمط مستعمل بالفعل في `private.user_can_manage_unit()` التي كانت سليمة — وحّدنا المنطق.

### اختبار الإصلاح

| الحساب | الدور | UPDATE students | النتيجة |
|---|---|---|---|
| `admin_skikda` | institution_admin | 5 صفوف | ✅ يعمل (legitimate manager) |
| `dean_sciences_demo` | faculty_admin (FST) | 5 صفوف | ✅ يعمل (within scope) |
| `viewer_demo` | viewer (institution-wide) | 0 صفوف | 🔒 محظور |
| `viewer_demo` | viewer | INSERT cohort | 🔒 RLS violation error |

---

## 👥 3 حسابات ديمو إضافية في جامعة سكيكدة

تم إنشاؤها مباشرة في DB عبر migration آمن `v2_10_1_demo_extra_accounts_skikda` (idempotent، يعتمد على `extensions.crypt` لتشفير كلمات السر بـ bcrypt — نفس النمط المستعمل في `auth.users` الإدارية).

| Username | Password | Role | Scope |
|---|---|---|---|
| `dean_sciences_demo` | `Dean@2026!` | `faculty_admin` | كلية العلوم وعلوم التكنولوجيا (FST) |
| `head_it_demo` | `Head@2026!` | `department_admin` | قسم الإعلام الآلي (INFO) |
| `viewer_demo` | `Viewer@2026!` | `viewer` | المؤسسة كاملة (read-only) |

كل واحد له صف صحيح في `user_scopes` يربطه بنطاقه. تم اختبار الـ RLS لكلٍّ منهم مباشرة في الـ DB.

---

## 📚 وثائق جديدة

- ✨ `docs/PRE_CUSTOMER_DEMO_CHECKLIST.md` — ورقة مرجعية موحَّدة (روابط، حسابات، خطوات 10 دقائق، أسئلة الزبون)
- ✨ `docs/KNOWN_LIMITATIONS_FOR_FIRST_CUSTOMER.md` — صياغة تجارية شفّافة لما هو متوفر اليوم وما سيُفعَّل لاحقاً (SMS، billing، APK signing، monitoring، backups)

---

## ✅ نتائج الفحوص

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` | ✅ 0 أخطاء |
| `npm run build` | ✅ يبني بنجاح |
| `npm run lint` | ✅ لا أخطاء جديدة |
| `npm audit --audit-level=high` | ✅ 0 high (3 moderate في sub-deps قديمة) |
| Supabase security advisors | ✅ نفس 4 تحذيرات pre-existing |
| Supabase performance advisors | ✅ unused indexes فقط |
| RLS regression test (admin_skikda) | ✅ يعمل كما قبل |
| RLS regression test (taher) | ✅ يعمل كما قبل |
| RLS new test (dean) | ✅ يرى FST فقط |
| RLS new test (head) | ✅ يرى INFO فقط |
| RLS new test (viewer) | ✅ يقرأ فقط، **لا يكتب** |

---

## 🚫 لم يتغيّر

- ❌ Flutter APK
- ❌ `register-attendance` Edge Function
- ❌ QR / Code attendance flow
- ❌ Teacher Dashboard
- ❌ Super Admin UI
- ❌ Institution Admin UI (التبويبات الـ 14 كما هي)
- ❌ سياسات RLS على الجداول مباشرة (التغيير على helper function فقط)

---

## 📦 Migrations في v2.10.1

```
1. v2_10_1_fix_viewer_rls_writes      — إصلاح RLS للـ viewer
2. v2_10_1_demo_extra_accounts_skikda — إنشاء 3 حسابات ديمو
```

كلاهما idempotent ولا يكسر أيّ حالة موجودة.

---

## 🎯 جاهزية لأول عرض تجاري

**نعم، الآن أقوى من قبل.** اكتشاف bug أمني وإصلاحه في طور Pre-Customer هو دليل على أن العملية تعمل: نختبر، نكتشف، نُصلح، نوثّق. النسخة v2.10.1 تتجاوز v2.10.0 في الموثوقية الأمنية، حتى لو لم تُضِف feature واحد جديد للواجهة.

---

## 🔗 Links

- **Live:** https://Ausar Military.vercel.app
- **Login:** https://Ausar Military.vercel.app/panel-sk2025x/login
- **Tag:** `v2.10.1`
- **Pre-customer checklist:** `docs/PRE_CUSTOMER_DEMO_CHECKLIST.md`
- **Limitations brief:** `docs/KNOWN_LIMITATIONS_FOR_FIRST_CUSTOMER.md`
