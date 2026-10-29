# Ausar Military v2.9.0 — SaaS Multi-Sector Attendance Platform

**Release date:** 2026-05-24 
**Status:** Production-like demo, ready for first pilot/customer 
**Live URL:** https://Ausar Military.vercel.app 
**Repository:** https://github.com/phantome001/university-attendance-system2026

---

## 🎯 Platform overview

Ausar Military هي منصة SaaS عربية احترافية لإدارة الحضور والغياب، مصممة من الأساس لتدعم عدة قطاعات في نفس النظام بعزل تام بين كل مؤسسة. كل مؤسسة ترى وتدير بياناتها فقط، وكل مدير فرعي (عميد كلية، رئيس قسم) يرى نطاقه فقط، وكل أستاذ يرى أفواجه المعيّنة فقط.

## 🏛️ Sectors supported

| Sector | Hierarchy chain | Vocabulary |
|---|---|---|
| **University** | كلية → قسم → تخصص → فوج | الطالب، الأستاذ، الفوج |
| **School** | سنة دراسية → قسم → مادة | التلميذ، الأستاذ، القسم |
| **Training Center** | فرع → تخصص → دورة → مجموعة | المتربص، المكوّن، الدورة |
| **Company** | فرع → قسم → فريق → وردية | الموظف، المسؤول، الفريق |

## ✨ Key features

### Three-tier dashboard
- **Super Admin Dashboard** — مالك المنصة، يدير كل المؤسسات والاشتراكات
- **Institution Admin Dashboard** — لوحة كل مؤسسة، تتكيف تلقائياً مع نوعها
- **Teacher Dashboard** — الأستاذ يرى فقط أفواجه

### Hierarchical permission model
- Roles: `super_admin`, `institution_owner`, `institution_admin`, `faculty_admin`, `department_admin`, `viewer`, `teacher`
- Per-user scope via `user_scopes` table (institution-wide or specific unit subtree)
- Teachers gated by `teacher_assignments` (must be explicitly assigned to a cohort)

### Tenant isolation
- Postgres Row-Level Security on every table
- Helper functions in `private` schema (SECURITY DEFINER) with strict search_path
- Validated against 7 role scenarios (super, institution, faculty, department, viewer, teacher, service_role)
- Zero cross-tenant leakage in tests

### Sub-institution scope picker
- مدير المؤسسة يستطيع إنشاء عميد كلية أو رئيس قسم بنطاق محدد
- شجرة هرمية في dialog الإنشاء، عبر helper `private.user_can_view_unit` و `user_can_manage_unit`

### Teacher Assignments UI
- Dialog ثنائي القسمين: cohort scope + subject-level (cohort + unit)
- بانر تحذير للأساتذة بدون تعيينات
- Auto-open بعد إنشاء أستاذ جديد

### Groups linked to academic units
- `cohorts.unit_id` يربط كل فوج بوحدة في الهيكل الأكاديمي
- Breadcrumb top-down في كل عرض: كلية / قسم / تخصص / فوج
- Default fallback unit للأفواج غير المرتبطة

### Justifications workflow
- جدول `absence_justifications` (sector-agnostic)
- Approve / Reject / حفظ ملاحظة فقط
- KPI: قيد المراجعة / مقبولة هذا الشهر / مرفوضة هذا الشهر / متوسط زمن المعالجة
- RLS هرمية عبر `student.cohort.unit_id`

### Reports — Excel + PDF Arabic RTL
- 5 أنواع: تقرير الحضور / الغيابات / التبريرات / الأساتذة / الأفواج
- فلاتر: من/إلى، الوحدة الأكاديمية، الفوج، الأستاذ
- KPIs قابلة للتصدير: الجلسات، الحضورات، الغيابات، نسبة الحضور، الفوج الأكثر غياباً، الأستاذ الأكثر نشاطاً
- Excel via `exceljs` (RTL sheets، borders، auto-width)
- PDF via `html2pdf.js` (HTML عربي + landscape A4)
- Empty state صريح حين لا توجد بيانات (لا أرقام وهمية)

### Attendance flow
- QR Code (مع timestamp validation: 2 دقائق صلاحية)
- إدخال الرمز يدوياً
- Edge Function `register-attendance` يستخدم service_role server-side
- بصمة الجهاز (طالب واحد لكل بصمة مدى الحياة)
- GPS advisory mode (يحسب المسافة `distance_meters` لكن لا يرفض الحضور — مناسب لـ GPS غير الدقيق داخل المباني)
- **Edge Function ومنطق الحضور لم يتأثرا في v2.9.0**

## 🧪 Validation results

| الفحص | النتيجة |
|---|---|
| `npx tsc --noEmit` | ✅ Exit 0 |
| `npm run build` | ✅ Built in 13.52s |
| `npm run lint` | ✅ 0 errors في كود v2.6+ (5 errors قديمة في `SuperAdmin.tsx` خارج النطاق) |
| `npm audit --audit-level=high` | ✅ 0 high/critical |
| Supabase security advisors | ✅ صفر تحذيرات جديدة |
| Supabase performance advisors | ✅ صفر مشاكل (FK indexes كاملة) |

## 🧪 E2E sector coverage

| Sector | E2E DB simulation | Result |
|---|---|---|
| University (live data) | 1 unit / 1 cohort / 3 students / 3 sessions / 1 attendance | ✅ |
| School | 3 units / 1 cohort / 2 students / 1 session / 1 attendance / 1 justification | ✅ |
| Training | 4 units / 1 cohort / 1 student / 1 session / 1 attendance | ✅ |
| Company | 4 units / 1 team / 2 employees / 1 session / 2 attendances | ✅ |

كل اختبارات المحاكاة داخل `BEGIN/ROLLBACK` — صفر تلوث للقاعدة.

## 📋 What this release does NOT change

- ❌ `register-attendance` Edge Function — لم تُلمس
- ❌ Flutter app / APK — تجمد على v2.5.7
- ❌ QR / Code attendance flow
- ❌ Student-facing pages
- ❌ Existing Super Admin Dashboard architecture (تحسينات تسميات فقط)

## 🟡 Known limitations

1. **`attendances.status` column** غير موجود — قبول التبرير يسجّل الموافقة فقط، لا يحوّل الغياب تلقائياً إلى "بعذر". تحسين مستقبلي (P11+).
2. **Notifications insert** محصورة على super_admin بـ RLS — مدير المؤسسة لا يستطيع إرسال إشعار آلي للأستاذ بعد قبول التبرير. الحل المؤقت: toast hint "أبلغ الأستاذ يدوياً". Edge Function إضافية لاحقاً.
3. **5 lint errors قديمة** في `SuperAdmin.tsx` (any types من 2026-05-17). pre-existing، خارج نطاق v2.6-v2.9.
4. **Bundle size** > 2.5 MB (SuperAdmin.tsx ضخم) — code-splitting مؤجل لـ post-customer.
5. **Leaked password protection** على Supabase Auth معطّل افتراضياً — يفعَّل بنقرة من Dashboard.

## 🔄 Migration history (v2.6 → v2.9)

```
20260520000000 — v260 institution admin foundations
20260521000000 — v270 hierarchical scope foundations (P1)
20260521010000 — v270 phase 2A backfill teacher assignments
20260521020000 — v270 phase 2A select RLS evolution
20260522000000 — v270 phase 2B add cohorts.unit_id
20260522010000 — v270 phase 2B safe backfill unit_id
20260522020000 — v270 phase 2B hierarchical select RLS
20260523000000 — v280 phase 8 justifications hierarchical select
20260524000000 — v290 phase 10 tighten WRITE RLS
```

## 🔗 Reference docs

- `DEMO_ACCOUNTS.md` — حسابات الديمو الجاهزة
- `DEMO_SCRIPT_AR.md` — سيناريو عرض 10-15 دقيقة
- `SALES_PITCH_AR.md` — العرض التجاري
- `ROADMAP_AFTER_FIRST_CUSTOMER.md` — التحسينات بعد أول زبون

---

**Ausar Military v2.9.0** — جاهز للجلسات التجارية الأولى ولـ pilot في مؤسسة واحدة.
