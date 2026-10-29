# Ausar Military — Demo Accounts

**Live URL:** https://Ausar Military.vercel.app/panel-sk2025x/login

> ⚠️ هذه الحسابات للديمو والاختبار فقط. لا تستعملها في بيئة إنتاجية.

---

## ✅ Available demo accounts

### 1. Super Admin (مالك المنصة)
| | |
|---|---|
| **Username** | `owner_qhudoor` |
| **Email** | `owner.demo@Ausar Military.example` |
| **Password** | `Owner2026QH` |
| **Role** | `super_admin` |
| **Institution** | لا شيء (يرى كل المؤسسات) |

**ماذا يستطيع أن يرى:**
- كل المؤسسات الـ 4 (university/school/training/company)
- إنشاء مؤسسة جديدة + إعطاؤها مدير
- مراقبة حضور كل المؤسسات
- التقارير الإجمالية للمنصة
- إدارة الاشتراكات والفوترة
- حذف أي مؤسسة (مع حذر)

**ماذا لا يستطيع أن يفعل (في الديمو):**
- لا يوجد قيد، super_admin يتجاوز RLS كاملاً

---

### 2. Institution Admin (مدير المؤسسة)
| | |
|---|---|
| **Username** | `admin_skikda` |
| **Email** | `admin.skikda@Ausar Military.test` |
| **Password** | `NuExbgjAYegk` |
| **Role** | `institution_admin` |
| **Institution** | جامعة سكيكدة 20 أوت 1955 |

**ماذا يستطيع أن يرى:**
- كل الكليات والأقسام والتخصصات والأفواج داخل جامعة سكيكدة
- كل الأساتذة والطلاب داخل الجامعة
- كل الجلسات والحضور والتبريرات
- التقارير الكاملة للجامعة
- إنشاء عمداء كليات / رؤساء أقسام بنطاق محدد
- إدارة التعيينات (ربط الأستاذ بالأفواج)

**ماذا لا يستطيع أن يفعل:**
- لا يرى أي بيانات من المدرسة / المركز / الشركة
- لا يستطيع إنشاء مؤسسة جديدة
- لا يستطيع تعديل الاشتراك (super_admin فقط)

---

### 3. Teacher (الأستاذ)
| | |
|---|---|
| **Username** | `taher` |
| **Email** | `taher@univ-skikda.dz` |
| **Password** | `Taher@2026!` |
| **Role** | `teacher` |
| **Institution** | جامعة سكيكدة 20 أوت 1955 |
| **Assignments** | فوج 01 (الوحدة الأكاديمية الافتراضية) |

**ماذا يستطيع أن يرى:**
- فوجه المسند فقط (فوج 01)
- طلاب فوجه (3 طلاب)
- جلساته (3 جلسات)
- الحضور المسجل في جلساته
- إنشاء جلسة جديدة لفوجه فقط
- توليد QR Code للحضور

**ماذا لا يستطيع أن يفعل:**
- لا يرى أفواج أساتذة آخرين
- لا يرى طلاب خارج فوجه
- لا يستطيع إنشاء أو تعديل cohorts/students/admins
- لا يستطيع إنشاء جلسة لفوج غير مسند له

---

## ⚠️ Missing demo accounts (تحتاج إنشاء قبل الديمو الكامل)

> ✅ **تحديث v2.10.1:** تم إنشاء الحسابات الـ 3 التالية (faculty_admin / department_admin / viewer) وتم اختبارها على RLS. التفاصيل أدناه.

### 4. Faculty Admin (عميد كلية) — ✅ منشأ في v2.10.1
| | |
|---|---|
| **Username** | `dean_sciences_demo` |
| **Email** | `dean.sciences@Ausar Military.test` |
| **Password** | `Dean@2026!` |
| **Role** | `faculty_admin` |
| **Institution** | جامعة سكيكدة |
| **Scope** | كلية العلوم وعلوم التكنولوجيا (FST) |

**ما يستطيع أن يرى:** كل ما تحت FST (قسم INFO + تخصص ISIL + فوج 01 + 5 طلاب). 
**ما لا يستطيع أن يرى:** كليات أخرى داخل جامعة سكيكدة، أو أي بيانات من مؤسسات أخرى.

### 5. Department Admin (رئيس قسم) — ✅ منشأ في v2.10.1
| | |
|---|---|
| **Username** | `head_it_demo` |
| **Email** | `head.it@Ausar Military.test` |
| **Password** | `Head@2026!` |
| **Role** | `department_admin` |
| **Institution** | جامعة سكيكدة |
| **Scope** | قسم الإعلام الآلي (INFO) |

**ما يستطيع أن يرى:** كل ما تحت INFO (تخصص ISIL + فوج 01 + 5 طلاب). 
**ما لا يستطيع أن يرى:** أقسام أخرى أو الكلية الأم بكاملها.

### 6. Viewer (قارئ فقط) — ✅ منشأ في v2.10.1
| | |
|---|---|
| **Username** | `viewer_demo` |
| **Email** | `viewer@Ausar Military.test` |
| **Password** | `Viewer@2026!` |
| **Role** | `viewer` |
| **Institution** | جامعة سكيكدة |
| **Scope** | المؤسسة كاملة (read-only) |

**ما يستطيع أن يرى:** كل بيانات جامعة سكيكدة (4 وحدات، 1 فوج، 5 طلاب، 3 جلسات...). 
**ما لا يستطيع أن يفعل:** أي UPDATE / INSERT / DELETE — RLS يرفضها على مستوى Postgres نفسه (تم اختبار ذلك في v2.10.1 وإصلاح bug في `is_unrestricted_in_institution()`).

### 7. مدراء المؤسسات الأخرى (school/training/company) — ⚠️ غير منشأة
المؤسسات موجودة بـ `auth_user_id = NULL`:
- مدرسة المستقبل التجريبية (`school`)
- مركز التكوين الرقمي التجريبي (`training`)
- شركة كيو حضور التجريبية (`company`)

**اقتراحي للديمو الشامل:**
1. ادخل بـ `owner_qhudoor`
2. عبر Super Admin Dashboard، أنشئ `institution_admin` لكل واحدة من المؤسسات الـ 3
3. شغّل سيناريو الديمو على كل قطاع

أو **بشكل أبسط للجلسة الأولى**: استعمل جامعة سكيكدة فقط (البيانات الكاملة موجودة) واشرح أن نفس المنطق ينطبق على القطاعات الأخرى مع التسميات المناسبة.

---

## 🎓 Demo student data

في جامعة سكيكدة (البيانات الحية):
- 3 طلاب في فوج 01
- 3 جلسات أنشأها taher
- 1 attendance مسجل فعلياً عبر QR
- 1 student_device مرتبط ببصمة جهاز الطالب

تجربة الحضور من جانب الطالب:
- افتح https://Ausar Military.vercel.app
- اضغط "ابدأ الآن"
- اختر QR (تحتاج جلسة active من حساب taher)
- أدخل الرقم الجامعي + الاسم + اللقب لطالب موجود في الجامعة
- ستُسجَّل الحضور (يستعمل service_role عبر Edge Function)

---

## 🛡️ Security note

كل الحسابات الديموية تعتمد على Supabase Auth + RLS من الـ database. لا يمكن لأي حساب رؤية بيانات خارج صلاحياته حتى لو حاول استدعاء API مباشرة.
