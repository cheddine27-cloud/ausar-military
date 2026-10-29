<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=250&section=header&text=Ausar Military&fontSize=50&fontAlignY=38&desc=SaaS%20Attendance%20Platform&descAlignY=61&descAlign=62" />

  <h1>Ausar Military</h1>

  <p>
    <b>Ausar Military is a SaaS attendance and absence management platform for universities, institutes, and training organizations, using QR sessions and device fingerprinting.</b>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status" />
    <img src="https://img.shields.io/badge/License-Proprietary-red.svg" alt="License" />
    <img src="https://img.shields.io/badge/Version-v2.4.2-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Android%20%7C%20iOS-lightgrey.svg" alt="Platform" />
  </p>
  <br><br>

  <a href="https://github.com/phantome001/university-attendance-system2026/releases/latest">
    <img src="https://img.shields.io/badge/📱_تحميل_تطبيق_الطالب-APK_Download-brightgreen?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" />
  </a>

  <a href="https://Ausar Military.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/🌐_لوحة_التحكم-Admin_Dashboard-blue?style=for-the-badge&logo=vercel&logoColor=white" alt="Admin Dashboard" />
  </a>
</div>

---

## 📥 تحميل وتثبيت تطبيق الطالب | Download & Install

### خطوات التثبيت على Android:
1. اضغط على زر **"تحميل تطبيق الطالب"** الأخضر أعلاه، أو حمّل من [صفحة الإصدارات](https://github.com/phantome001/university-attendance-system2026/releases/latest).
2. انقل ملف `.apk` إلى هاتفك (عبر USB / Telegram / Google Drive).
3. افتح الملف على هاتفك واضغط **"تثبيت"**.
4. إذا ظهرت رسالة "مصدر غير معروف"، اذهب إلى:
   - ⚙️ **الإعدادات** → **الأمان** → **السماح بالتثبيت من مصادر غير معروفة** ✅
5. افتح التطبيق وابدأ بتسجيل حضورك! 🎉

---

## 🌟 نظرة عامة | Overview

تم بناء هذا النظام ليحل مشكلة التلاعب في تسجيل الحضور في المدرجات الجامعية. يتكون النظام من **لوحة تحكم إدارية لمديري الأقسام والأساتذة** (مبنية بـ React)، و**تطبيق هاتف ذكي للطلاب** (مبني بـ Flutter).

يعتمد النظام على توليد رمز QR ديناميكي متغير زمنياً يُعرض على شاشة الأستاذ، ويقوم الطالب بمسحه عبر تطبيقه. لضمان الموثوقية بنسبة 100%، يقوم النظام بتسجيل البصمة الرقمية لجهاز الطالب (Device Fingerprint) لمنع طالب واحد من تحضير زملائه!

---

## 📸 لقطات الشاشة | Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><b>لوحة تحكم الأستاذ (الويب)</b></td>
      <td align="center"><b>تطبيق الطالب (الهاتف)</b></td>
    </tr>
    <tr>
      <td><img src="https://via.placeholder.com/600x350/0D1117/FFFFFF?text=Admin+Dashboard+Screenshot" alt="Admin Dashboard" width="500"/></td>
      <td><img src="https://via.placeholder.com/300x450/0D1117/FFFFFF?text=Student+Mobile+App" alt="Student App" width="250"/></td>
    </tr>
    <tr>
      <td><img src="https://via.placeholder.com/600x350/0D1117/FFFFFF?text=QR+Code+Session" alt="QR Session" width="500"/></td>
      <td><img src="https://via.placeholder.com/300x450/0D1117/FFFFFF?text=QR+Scanner+View" alt="QR Scanner" width="250"/></td>
    </tr>
  </table>
  <i>(يمكنك استبدال هذه الصور الروابط بصور حقيقية من مشروعك لاحقاً داخل مجلد <code>docs/</code>)</i>
</div>

---

## ✨ الميزات المعمارية | Core Features

### 🛡️ حماية ضد التلاعب (Anti-Cheat)
- **Device Fingerprinting:** يربط حساب الطالب بجهازه الفيزيائي.
- **Dynamic QR Code:** يتغير الرمز كل 10 ثوانٍ لمنع تصويره وإرساله في مجموعات الواتساب.
- **Geo-location Check (اختياري):** التأكد من تواجد الطالب فعلياً داخل القاعة.

### 👨‍🏫 واجهة الإدارة (React Web Admins)
- **إدارة الأساتذة والكليات:** نظام صلاحيات دقيق (Super Admin vs Professor).
- **إدارة الجلسات والأفواج:** استيراد الطلاب من ملفات Excel و CSV.
- **إحصائيات متقدمة وتقارير:** لوحة تحكم ذكية (KPIs) مع إمكانية تصدير قوائم الحضور والتقارير بصيغة PDF احترافي أو Excel.

### 📱 تطبيق الطلاب (Flutter Mobile App)
- **ماسح QR فائق السرعة:** يعمل في ظروف الإضاءة الضعيفة.
- **إدخال الكود يدوياً:** كخطة بديلة إذا تعطلت الكاميرا.
- **دعم الأوفلاين (Offline-First):** النظام يحتفظ بسجل الحضور إذا انقطع الإنترنت ويرفعه فور عودة الاتصال.

---

## 🛠️ التقنيات المستخدمة | Tech Stack

<div align="center">
  <img src="https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
</div>

---

## ⚙️ طريقة التثبيت والتشغيل | Installation Setup

للمطورين الذين لديهم تصريح للعمل على هذا المشروع، يرجى اتباع الخطوات التالية لتهيئة بيئة التطوير.

### 0️⃣ المتطلبات المسبقة (Prerequisites)
- [Node.js](https://nodejs.org/) (v18+)
- [Flutter SDK](https://flutter.dev/docs/get-started/install) (v3.24+)
- حساب [Supabase](https://supabase.com/)

### 1️⃣ إعداد قاعدة البيانات (Supabase Backend)
1. قم بإنشاء مشروع جديد في Supabase.
2. اذهب إلى SQL Editor ونفذ الأكواد الموجودة في مسار `database_schema.sql` (إن وُجد).
3. انسخ الـ `URL` والـ `Anon Key` و `Service Role Key`.

### 2️⃣ تشغيل لوحة التحكم (React Web App)
افتح التيرمينال داخل المجلد الرئيسي للمشروع ونفذ:

```bash
# 1. تثبيت الحزم اللازمة
npm install

# 2. إنشاء ملف البيئة
cp .env.example .env
# قم بوضع مفاتيح Supabase الخاصة بك داخل ملف .env

# 3. تشغيل سيرفر التطوير المحلي
npm run dev
```
ستعمل लोحة التحكم على الرابط `http://localhost:5173`.

### 3️⃣ تشغيل تطبيق الموبايل (Flutter Student App)
قم بفتح ترمينال جديد وادخل إلى مجلد `student_app_flutter`:

```bash
# 1. الدخول لمجلد الهاتف
cd student_app_flutter

# 2. جلب حزم فلاتر
flutter pub get

# 3. تشغيل التطبيق على الهاتف المتصل أو المحاكي (Emulator)
flutter run
```

---

## 📁 الهيكلية | Project Structure

```text
📦 university-attendance-system2026/
 ┣ 📂 src/                    # كود الـ Frontend (React + TypeScript)
 ┃ ┣ 📂 components/           # المكونات الفرعية ولوحات الأدمين (Shadcn)
 ┃ ┣ 📂 pages/                # الصفحات الرئيسية للتطبيق
 ┃ ┗ 📂 lib/                  # دوال الاتصال بـ Supabase والأدوات المساعدة
 ┣ 📂 student_app_flutter/    # كود تطبيق الطلاب للموبايل (Flutter + Dart)
 ┃ ┣ 📂 lib/features/         # ميزات التطبيق (الماسح، الإعدادات...)
 ┃ ┗ 📂 lib/services/         # خدمات الأوفلاين والاتصال بالنت
 ┣ 📄 index.html              # ملف الـ HTML الرئيسي للويب
 ┣ 📄 package.json            # إعدادات مشروع React
 ┗ 📄 README.md               # الدليل الشامل للمشروع (هذا الملف)
```

---

## 🔒 الإشعار القانوني والترخيص | License & Copyright

**Copyright © 2025-2026 Developer Seif Eddine. جميع الحقوق محفوظة.**

⚠️ **هذا البرنامج ذو ملكية خاصة وسرية.** يُمنع منعاً باتاً نسخ، توزيع، تعديل، أو استخدام أي جزء من هذا الكود بدون إذن كتابي صريح من المالك. 

هذا النظام يمثل حلاً تجارياً متقدماً للمؤسسات التعليمية. للنسخ والإصدارات التجارية يرجى التواصل مباشرة.

---

<div align="center">
  <b>هل تنتمي لمؤسسة تعليمية وتود استخدام هذا النظام؟</b><br>
  تواصل معي الآن لتجهيز ديمو (Demo) خاص بك! <br><br>
  <a href="https://t.me/seifski21" target="_blank">
    <img src="https://img.shields.io/badge/Contact%20Me%20on-Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  </a>
</div>
