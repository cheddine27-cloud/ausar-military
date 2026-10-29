# Ausar Military — Permissions Matrix

**Version:** v2.11.x 
**Status:** Frozen for first-customer demo (post v2.10.2-stable hardening) 
**Source of truth:** `supabase/migrations/20260524010000_v2_11_permissions_foundation.sql` and `20260524*_v2_11_*.sql`

---

## كيف يعمل النظام (نظرة سريعة)

كل عملية حسّاسة في لوحة المؤسسة لها **مفتاح صلاحية** (`permission_key`) في جدول `permission_catalog`.

**التحقّق على ثلاث طبقات:**

1. **UI** — `getCurrentAdminPermissionMap()` يقرأ `role_permission_defaults` + `admin_permission_overrides` ويبني خريطة `Record<key, boolean>`. الأزرار التي تتطلّب صلاحية مفقودة لا تُعرَض.
2. **API/Edge Function** — كل function حسّاس (`create-institution-user`, `reset-institution-user-password`) يتحقّق من الدور قبل التنفيذ، عبر service_role server-side.
3. **Postgres RLS** — defense-in-depth نهائي على مستوى الجداول. لو فاتت الواجهة والـ Edge Function، RLS يرفض الكتابة (انظر `private.user_can_manage_unit`, `private.is_unrestricted_in_institution`).

أيّ دور أو صلاحية أُضيفت بعد ذلك يجب أن تمرّ على هذه الطبقات الثلاث.

---

## 1. مصفوفة الأدوار × الصلاحيات (defaults)

✅ = مسموح | ❌ = غير مسموح | — = ليس له معنى

| Permission | super_admin | inst_owner | inst_admin | faculty_admin | dept_admin | staff | teacher | viewer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **users.create** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **users.manage_scope** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **users.delete** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **users.reset_password** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **structure.manage** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **students.read** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **students.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **groups.read** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **groups.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **teachers.assign** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **sessions.create** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **sessions.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **attendance.read** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **attendance.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **devices.read** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **devices.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **reports.read** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **reports.export** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **justifications.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **settings.manage** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **subscription.manage** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **support.manage** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

> هذه القيم مأخوذة مباشرة من `role_permission_defaults`. أي override في `admin_permission_overrides` يطغى عليها.

---

## 2. الأدوار × النطاق (Scope)

| Role | Scope الافتراضي | يستطيع الرؤية | يستطيع الكتابة | الاستعمال النموذجي |
|---|---|---|---|---|
| **super_admin** | الكل | كل المؤسسات | كل المؤسسات | مالك Ausar Military |
| **institution_owner** | مؤسسته كاملة | كل بيانات مؤسسته | كل بيانات مؤسسته | مالك المؤسسة (نادر) |
| **institution_admin** | مؤسسته كاملة | كل بيانات مؤسسته | كل بيانات مؤسسته | المدير العام للمؤسسة |
| **faculty_admin** | كلية واحدة + كل ما تحتها | شجرة كليته فقط | شجرة كليته فقط | عميد كلية |
| **department_admin** | قسم واحد + كل ما تحته | شجرة قسمه فقط | شجرة قسمه فقط | رئيس قسم |
| **staff** | المؤسسة كاملة (read-only) | كل بيانات مؤسسته | لا شيء | السكرتاريا، الموظف الإداري |
| **teacher** | حسب `teacher_assignments` | أفواجه المسندة فقط | أفواجه المسندة فقط | أستاذ يدرّس |
| **viewer** | المؤسسة كاملة (read-only) | كل بيانات مؤسسته | لا شيء | لجنة جودة، مفتش، مراجع |

> **ملاحظة مهمة:** الفرق بين `staff` و `viewer` في الصلاحيات وليس في النطاق:
> - `staff` يمتلك `support.manage` (يستطيع فتح تذاكر دعم باسم المؤسسة)
> - `viewer` لا يمتلك `support.manage` (للقراءة فقط، حتى الدعم)

---

## 3. مثال عملي: ماذا يستطيع كل دور؟

### `staff_skikda_demo` (دور staff)
- ✅ يفتح كل التبويبات: الرئيسية، الطلاب، الأفواج، الحضور، الأجهزة، التقارير، الدعم
- ✅ يستطيع تصدير التقارير PDF/Excel
- ✅ يستطيع فتح تذكرة دعم
- ❌ لا يستطيع إنشاء جلسة حضور
- ❌ لا يستطيع حذف طالب أو تعديله
- ❌ لا يستطيع تعديل فوج
- ❌ لا يستطيع إنشاء مستخدم
- ❌ لا يستطيع reset password
- ❌ لا يستطيع تغيير الإعدادات أو الاشتراك
- ❌ تبويبات `Structure / Justifications / Settings / Subscription` لا تظهر له (لا صلاحية)

### `dean_sciences_demo` (faculty_admin، scope: FST)
- ✅ يرى الكلية وكل ما تحتها (INFO + ISIL + فوج 01)
- ❌ لا يرى أي كلية أخرى
- ✅ ينشئ مستخدمين داخل كليته فقط
- ✅ ينشئ جلسات وحضور داخل كليته
- ❌ لا يصل إلى `Settings` أو `Subscription` (هذا للمدير العام)

### `viewer_demo` (viewer، institution-wide)
- ✅ يرى كل بيانات سكيكدة
- ✅ يصدّر التقارير PDF/Excel
- ❌ لا يستطيع أي UPDATE / INSERT / DELETE — RLS يرفضها على Postgres
- ❌ تبويبات `Users / Structure / Justifications / Settings / Support / Subscription` لا تظهر له

---

## 4. القنوات الحسّاسة (الـ Edge Functions)

| Edge Function | يقبل من | يرفض من | الحماية |
|---|---|---|---|
| `create-institution-user` | super_admin, institution_owner, institution_admin | باقي الأدوار → HTTP 403 | role check + tenant isolation |
| `reset-institution-user-password` | super_admin, institution_owner, institution_admin | باقي الأدوار → HTTP 403 | role check + tenant isolation + role whitelist للـ target |
| `register-attendance` | service_role server-side فقط | كل ما عداه | الواجهة لا تستدعيه مباشرة |

> اختبار pre-customer أكّد أن `staff` و `viewer` يحصلان على HTTP 403 من القناتين، بنص خطأ عربي واضح.

---

## 5. كيف تضيف صلاحية جديدة لاحقاً

عملية موثّقة بثلاث خطوات لا تتغيّر:

1. **DB migration:**
   ```sql
   INSERT INTO permission_catalog (...) VALUES ('feature.action', 'category', 'description');
   INSERT INTO role_permission_defaults (role, permission_key, allowed) VALUES ...;
   ```
2. **TypeScript constant:**
   ```ts
   // src/lib/permissions.ts
   export const PERMISSIONS = {
     ...,
     featureAction: 'feature.action',
   };
   ```
3. **استعمال في الواجهة:**
   ```tsx
   const canDoIt = can(permissions, PERMISSIONS.featureAction);
   {canDoIt && <Button onClick={...}>Action</Button>}
   ```
4. **(اختياري لكن مستحسن)** — تحقّق Edge Function أو RLS مقابل لها.

---

## 6. حدود معروفة (للمستقبل)

- لا يوجد UI حتى الآن لـ super_admin أو institution_admin لتعديل `admin_permission_overrides` يدوياً (الجدول جاهز لكن الواجهة pending). الحل المؤقت: SQL مباشر.
- الدور `super_admin` يحصل على كل الصلاحيات تلقائياً عبر `private.is_super_admin()` ولا يمرّ على جدول `role_permission_defaults`.
- الـ Edge Functions تحقّق بالـ role وليس بالـ permission key. لو احتجنا تفويض دقيق (مثلاً faculty_admin معيّن لا يستطيع reset)، يجب إضافة `current_admin_has_permission` check داخل الـ Edge Function — على Roadmap بعد التعاقد الأول.

---

🎯 آخر تحقّق pre-customer: 6 حسابات ديمو تختبر كل المسارات. تفاصيل في `docs/PRE_CUSTOMER_DEMO_CHECKLIST.md`.
