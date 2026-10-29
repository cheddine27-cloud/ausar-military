# Ausar Military — Roadmap بعد أول زبون

> هذه ليست TODO خيالية. كل بند هنا مبرّر بسبب فعلي رصدناه أثناء بناء v2.10.0 ولم نلمسه لأنه خارج نطاق MVP الديمو. الأولوية تتغيّر حسب طلب الزبون الأول.

---

## ✅ منجز في v2.10.0 (لم يعد على الـ Roadmap)

- ✅ تفعيل 6 تبويبات Institution Admin: الحضور، الأجهزة، الاشتراك، الإعدادات، سجل النشاط، الدعم
- ✅ نظام تذاكر الدعم داخل لوحة المؤسسة (مع RLS)
- ✅ صفحة عرض الاشتراك الكاملة (read-only) مع عرض الحدود
- ✅ صفحة الأجهزة مع زر إلغاء الربط لتسهيل تغيير الهواتف
- ✅ تسميات قطاعية في كل تبويب (4 قطاعات)

---

## 🔥 P1 — قبل التسليم لأول زبون فعلي

### 1.1 Monitoring + Error tracking
**السبب:** الآن لا يوجد رؤية للأخطاء التي يواجهها المستخدم. لو حدث 500 على Edge Function في 3 صباحاً، لن نعرف. 
**الحل:** 
- Sentry أو Logtail (free tier كافٍ في البداية)
- اربطه بـ Vercel + Edge Functions
- إعداد alerts على WhatsApp/Email عند 5+ errors في الدقيقة

### 1.2 Backups policy
**السبب:** Supabase يعمل backup يومي تلقائياً، لكن لا توجد سياسة استرجاع موثّقة. 
**الحل:** 
- توثيق RTO/RPO (recovery time/point objectives)
- اختبار استرجاع كامل مرة شهرياً (BEGIN/ROLLBACK سيناريو على branch)
- Export schema + bucket مرة أسبوعياً إلى مساحة منفصلة (S3/MinIO)

### 1.3 Signed APK / AAB
**السبب:** APK الحالي غير موقّع رسمياً (debug signing). لا يقبله Play Store ولا يثق به مدير IT في مؤسسة جدية. 
**الحل:** 
- إنشاء keystore منفصل ومحفوظ في password manager
- بناء `flutter build apk --release` و `flutter build appbundle --release`
- (اختياري) رفعه على Google Play Internal Testing track

### 1.4 Production environment variables hygiene
**السبب:** Edge Functions تستعمل `SUPABASE_SERVICE_ROLE_KEY` مباشرة. مصمّم لذلك، لكن يجب التأكد من:
- لا يوجد leak لهذا المفتاح في أي frontend bundle
- التشغيل بـ VITE_SUPABASE_ANON_KEY فقط على الواجهة
- مراجعة جميع `.env` و `.env.local` و `.env.production` عبر `git log`

---

## ⚙️ P2 — أول 3 أشهر من الإنتاج

### 2.1 Notifications via Edge Function
**السبب:** P8 و P10 وثّقا أن `notifications.insert` محصور على super_admin بـ RLS. مدراء المؤسسات لا يستطيعون إنشاء إشعار للأستاذ بعد قبول التبرير. حالياً نعرض toast hint فقط. 
**الحل:** Edge Function `send-institution-notification` تعمل بـ service_role + تتحقق من صلاحيات المرسل قبل الكتابة في `notifications`.

### 2.2 SMS / WhatsApp notifications للأولياء
**السبب:** المدارس بشكل خاص تطلب إعلام الأولياء فور تسجيل غياب التلميذ. 
**الحل:**
- تكامل مع API محلية: Twilio (دولي) أو 360imo (جزائري) أو Octopush (متوسطي)
- جدول `parent_contacts` مرتبط بـ students
- Edge Function `notify-parent` على trigger من attendances

### 2.3 Advanced security events table
**السبب:** نسجّل activity_logs لكن ليس بشكل منهجي للأحداث الأمنية. 
**الحل:** جدول `security_events` مع:
- `event_type`: failed_login, suspicious_device, gps_outlier, multi_attempt_qr
- `severity`: info/warning/critical
- IP + user_agent + metadata
- Dashboard في Super Admin لمراقبة في الوقت الحقيقي

### 2.4 Better PDF templates
**السبب:** PDF الحالي يستعمل `html2pdf.js` — جيد لكنه يصدّر صفحة HTML مرنة. للتقارير الرسمية للوزارة قد نحتاج layouts ثابتة A4 portrait مع شعار رسمي وتوقيع مدير المؤسسة. 
**الحل:** 
- مكتبة pdfmake أو Puppeteer-server-side
- Templates متعددة (تقرير شهري للوزارة، تقرير حضور لطالب، تقرير للأهل)

### 2.5 SQL views for large institutions
**السبب:** P9 (Reports) يجمع البيانات في JS بعد جلبها بـ Promise.all. مناسب لـ < 10K طالب. مؤسسة بـ 50K طالب ستعاني. 
**الحل:** 
- Materialized views: `mv_institution_attendance_kpis`, `mv_cohort_stats`
- Refresh كل 15 دقيقة عبر cron job
- التقارير تقرأ من الـ views بدل aggregation client-side

---

## 💼 P3 — الإنتاج الكامل (3-12 شهر)

### 3.1 Production billing integration
**السبب:** الآن `subscriptions` table موجود لكن لا توجد بوابة دفع. 
**الحل:** 
- تكامل مع Chargily (جزائري — Edahabia/CIB) أو Stripe (دولي)
- Edge Function `create-subscription-checkout` 
- Webhook على success/failure
- إيقاف مؤسسة تلقائياً بعد 30 يوم من عدم الدفع

### 3.2 SSO / SAML / LDAP
**السبب:** المؤسسات الكبيرة تطلب تسجيل دخول موحّد مع نظامها الموجود (Active Directory). 
**الحل:** Supabase Auth يدعم SAML 2.0 — التفعيل بنقرة + توثيق إعداد لكل عميل.

### 3.3 Mobile push notifications
**السبب:** الأستاذ يحتاج إشعار فوري عند فتح طالب طلب تبرير. 
**الحل:** Firebase Cloud Messaging + Flutter integration.

### 3.4 Advanced cheating detection
**السبب:** بصمة الجهاز + GPS advisory جيدان لكن: ماذا لو طالب فتح session على هاتفه ثم أعطاه لزميله؟ 
**الحل:** 
- Liveness check بسيط (selfie واحد عند بداية كل semester)
- Behavioral biometrics: typing patterns، swipe patterns
- Anomaly detection: طالب سجّل حضور في 5 جلسات في 5 دقائق = إنذار

### 3.5 Multi-language support
**السبب:** نحن جزائريون لكن السوق المغاربي يطلب فرنسي + إنجليزي. 
**الحل:** i18n عبر `react-i18next` — كل النصوص في `src/locales/`.

### 3.6 Webhook system للزبائن المتقدمين
**السبب:** زبون كبير قد يريد إرسال attendance events لـ ERP داخلي. 
**الحل:** جدول `webhooks` لكل institution + Edge Function يطلق عند events.

---

## 🛡️ Security hardening (مستمر)

### Immediate (نقرة واحدة في Supabase Dashboard)
- ✅ Enable Leaked Password Protection (Auth → Policies)
- ✅ Set search_path explicitly on `_set_updated_at()` function
- ✅ Add MFA option for super_admin

### Short term
- Rate limiting على Edge Functions (Supabase pro feature)
- IP allowlist لـ super_admin login
- Session timeout بعد 8 ساعات لأدوار الإدارة

### Medium term
- Penetration testing من شركة جزائرية متخصصة
- ISO 27001 alignment (إن طلبه زبون كبير)
- GDPR compliance audit + data processing agreement

---

## 🐛 Known technical debt (خارج نطاق MVP)

| البند | المكان | السبب |
|---|---|---|
| 5 lint errors `any` | `src/pages/SuperAdmin.tsx` | pre-existing من 2026-05-17 |
| Bundle size 2.5+ MB | `dist/assets/index-*.js` | SuperAdmin.tsx ضخم (10K سطر) — code splitting لاحقاً |
| `attendances.status` column مفقود | DB schema | تحويل الغياب لـ "بعذر" تلقائياً مؤجل |
| Notification.insert محصورة | RLS policy | يحتاج Edge Function (P2.1 أعلاه) |
| Default unit في كل مؤسسة | Phase 2B backfill | للأفواج بدون ربط — يحذف لاحقاً عند تنظيف |

---

## 📊 الخلاصة

**الآن:** Ausar Military v2.10.0 جاهز كـ pilot في مؤسسة واحدة، بلوحة Institution Admin مكتملة 14/14 تبويب. 
**خلال شهر بعد التعاقد:** نضيف Monitoring + Backups + Signed APK + Notifications. 
**خلال 3 أشهر:** SMS للأولياء + SQL views + Better PDF. 
**خلال سنة:** SSO + Push + Advanced security + Multi-language + Webhooks.

كل خطوة لها زبون مستفيد منها مباشرة. لا نبني في الفراغ.
