import { QRCode } from 'react-qr-code';
import {
  BadgeCheck,
  Download,
  Fingerprint,
  Globe2,
  Headphones,
  MapPin,
  MessageCircle,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

const APK_VERSION = 'v2.5.7';
const APK_FILENAME = `Ausar Military-${APK_VERSION}.apk`;
const APK_DOWNLOAD_URL = `/download/${APK_FILENAME}`;
const WEB_APP_URL = '/scan';
const LOGO_URL = '/icons/icon-512x512.png';
const PHONE_SHOWCASE_URL = '/download/phone-showcase.png';

const WHATSAPP_PHONE = '213562183070';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;
const TELEGRAM_URL = 'https://t.me/seifski';
// لا نعرض اسم الحساب الشخصي في الواجهة — يظهر زر «تواصل معنا على تيليجرام» فقط (v5.0.13)

const navItems = [
  { label: 'الصفحة الرئيسية', href: '/' },
  { label: 'تشغيل نسخة الويب', href: WEB_APP_URL },
  { label: 'طريقة الاستعمال', href: '#steps' },
  { label: 'الدعم', href: '#support' },
];

const platformLinks = [
  { label: 'الصفحة الرئيسية',   href: '/' },
  { label: 'تشغيل نسخة الويب',  href: WEB_APP_URL },
  { label: 'طريقة الاستعمال',   href: '#steps' },
];

const supportLinks = [
  { label: 'تواصل معنا',        href: '#support' },
  { label: 'الدعم الفني',       href: TELEGRAM_URL },
  { label: 'دليل الاستخدام',    href: '#steps' },
  { label: 'كيف تسجل حضورك',    href: '#steps' },
];

const featureBadges = [
  { title: 'يعمل من المتصفح', subtitle: 'بدون تثبيت — مباشرة من هاتفك', icon: Globe2 },
  { title: 'QR / رمز الجلسة', subtitle: 'مسح فوري أو إدخال يدوي', icon: QrCode },
  { title: 'بصمة الجهاز', subtitle: 'حضورك أنت فقط — لا تسجيل بالنيابة', icon: Fingerprint },
  { title: 'حضور موثق', subtitle: 'سجل رسمي يحمي حقوقك', icon: ShieldCheck },
];

const steps = [
  { number: '1', title: 'افتح التطبيق أو المتصفح', text: 'حمّل التطبيق على هاتفك أو شغّله مباشرة من المتصفح — أقل من دقيقة.', icon: Download },
  { number: '2', title: 'امسح رمز الجلسة', text: 'وجّه كاميرتك إلى رمز QR أو أدخل الرمز يدوياً — النظام يتعرف عليك تلقائياً.', icon: QrCode },
  { number: '3', title: 'حضورك موثق', text: 'اضغط تأكيد، ويُسجَّل حضورك فوراً في سجلات مؤسستك ببيانات موثقة لا تقبل النقاش.', icon: BadgeCheck },
];

export default function DownloadPage() {
  return (
    <main id="top" dir="rtl" className="download-page-light min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-4 lg:px-12">
          <a href="#top" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Ausar Military" className="h-14 w-14 rounded-2xl" />
            <div>
              <p className="text-3xl font-black leading-none text-slate-900 dark:text-slate-50">Ausar Military</p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">الحضور الذكي والموثق</p>
            </div>
          </a>

          <nav className="hidden items-center gap-10 text-[15px] font-bold text-slate-800 dark:text-slate-200 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="relative py-3 transition hover:text-blue-600 dark:hover:text-blue-400"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:from-blue-700 hover:to-blue-800"
          >
            <span>🏠</span>
            الصفحة الرئيسية
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800 dark:bg-slate-950">
        <div className="pointer-events-none absolute left-0 top-24 h-[420px] w-[520px] rounded-full border border-dashed border-blue-200 opacity-60 dark:border-blue-800 dark:opacity-40" />
        <div className="mx-auto grid max-w-[1480px] items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12">
          <div className="order-2 lg:order-2">
            <img
              src={PHONE_SHOWCASE_URL}
              alt="واجهات تطبيق Ausar Military للطالب: البداية، مسح QR، وتأكيد الحضور"
              className="mx-auto w-full max-w-[720px] object-contain lg:mx-0"
            />
          </div>

          <div className="order-1 text-center lg:order-1 lg:text-right">
            <h1 className="text-5xl font-black tracking-tight text-blue-600 md:text-7xl">Ausar Military</h1>
            <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950 md:text-[2.7rem] dark:text-slate-50">
              سجّل حضورك في ثوانٍ — حضور موثق لا يقبل النقاش
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-xl leading-9 text-slate-600 dark:text-slate-300 lg:mx-0">
              امسح رمز QR أو أدخل رمز الجلسة من هاتفك — وخلال ثوانٍ يكون حضورك مسجلاً
              وموثقاً رسمياً في سجلات مؤسستك، محمياً ببصمة جهازك الفريدة.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <a
                href={APK_DOWNLOAD_URL}
                download={APK_FILENAME}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-blue-600 px-6 text-lg font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <Smartphone className="h-5 w-5" />
                تحميل تطبيق الطالب APK
              </a>
              <a
                href={WEB_APP_URL}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-lg border border-blue-500 bg-white px-6 text-lg font-black text-blue-600 transition hover:bg-blue-50 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
              >
                <Globe2 className="h-5 w-5" />
                تشغيل التطبيق في المتصفح
              </a>
            </div>

            <section id="download" className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid items-center gap-5 sm:grid-cols-[160px_1fr]" dir="ltr">
                <div className="rounded-lg bg-white p-2">
                  <QRCode value={APK_DOWNLOAD_URL} size={140} fgColor="#020617" />
                </div>
                <div dir="rtl">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">امسح بهاتفك — التحميل يبدأ فوراً</p>
                  <h3 className="mt-1 text-3xl font-black text-slate-950 dark:text-slate-50">Ausar Military APK</h3>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <InfoPill label="الإصدار" value={APK_VERSION} />
                    <InfoPill label="الحجم" value="69.3 MB" />
                    <InfoPill label="النظام" value="Android" />
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {featureBadges.map((feature) => (
                <article
                  key={feature.title}
                  className="grid min-h-[74px] grid-cols-[42px_1fr] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-right shadow-sm"
                  dir="ltr"
                >
                  <feature.icon className="h-9 w-9 shrink-0 text-blue-600" />
                  <div dir="rtl" className="min-w-0">
                    <h3 className="truncate text-[15px] font-black leading-5 text-slate-950 dark:text-slate-50">{feature.title}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 dark:text-slate-400">{feature.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="steps" className="bg-white px-6 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="text-center text-3xl font-black text-slate-950 dark:text-slate-50">احسب حضورك في 3 خطوات — لا يستغرق دقيقة</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.number}
                className="grid min-h-[96px] grid-cols-[56px_1fr_40px] items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                dir="ltr"
              >
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-blue-600">
                  <step.icon className="h-7 w-7" />
                </div>
                <div dir="rtl" className="min-w-0 text-right">
                  <h3 className="text-lg font-black leading-6 text-slate-950 dark:text-slate-50">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.text}</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-lg font-black text-white">
                  {step.number}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer id="support" className="bg-[#061d35] px-6 py-8 text-white">
        <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Ausar Military" className="h-16 w-16 rounded-2xl" />
              <div>
                <p className="text-3xl font-black">Ausar Military</p>
                <p className="mt-1 text-sm text-blue-100">حضور ذكي وموثق — للجامعات والشركات ومراكز التكوين</p>
              </div>
            </div>
            <p className="mt-5 max-w-md leading-8 text-blue-100">
              حل آمن وسريع لكل مؤسسة تعمل بالأشخاص: جامعات، مدارس، مراكز تكوين، شركات وإدارات — حضور موثق بدون أوراق.
            </p>
          </div>

          <FooterColumn title="المنصة" links={platformLinks} />
          <FooterColumn title="الدعم" links={supportLinks} />
          <div>
            <h3 className="text-xl font-black">تواصل معنا</h3>
            <div className="mt-5 space-y-4 text-blue-100">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                <Send className="h-4 w-4" /> تواصل معنا على تيليجرام
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> تواصل معنا على واتساب
              </a>
              <p className="flex items-center gap-3"><MapPin className="h-4 w-4" /> الجزائر</p>
              <p className="flex items-center gap-3"><Headphones className="h-4 w-4" /> دعم المؤسسات والجامعات</p>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-[1320px] border-t border-white/10 pt-5 text-center text-sm text-blue-100">
          © 2026 Ausar Military. جميع الحقوق محفوظة.
        </div>
      </footer>
    </main>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950 dark:text-slate-50">{value}</p>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-xl font-black">{title}</h3>
      <ul className="mt-5 space-y-3 text-blue-100">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="transition hover:text-white">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
