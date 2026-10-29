import { useState } from 'react';
import {
  X,
  Check,
  FileText,
  GraduationCap,
  MapPin,
  MessageCircle,
  Mic,
  PlayCircle,
  Send,
  QrCode,
  School,
  ShieldCheck,
  Smartphone,
  WifiOff,
    Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CountUp } from '@/components/CountUp';
const LOGO_URL = '/icons/icon-512x512.png';

const WHATSAPP_PHONE = '213562183070';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;
const TELEGRAM_URL = 'https://t.me/seifski';

const navItems = [
  { label: 'البداية', href: '#top' },
  { label: 'المميزات', href: '#features' },
  { label: 'الأسعار', href: '#pricing' },
  { label: 'تحميل التطبيق', href: '/app' },
];

const mktFeatures = [
  {
    title: 'منادات ذكية',
    text: 'المسؤول ينادي الحاضرين واحداً تلو الآخر من هاتفه — مثالي للمدارس ومراكز التكوين حيث الحضور لا يملكون هواتف، والنتائج تصل الإدارة لحظياً دون أي جهد.',
    icon: Mic,
  },
  {
    title: 'رمز QR فوري',
    text: 'كل مشارك يمسح رمز الجلسة من هاتفه ويُسجَّل حضوره في ثوانٍ — للجامعات والمؤتمرات والتكوين الداخلي في الشركات.',
    icon: QrCode,
  },
  {
    title: 'يعمل بدون إنترنت',
    text: 'لا يوقف انقطاع الشبكة عملك: تسجَّل السجلات وتُرفع تلقائياً فور عودة الاتصال، دون تكرار ودون أن يفقدك النظام دقيقة واحدة من بياناتك.',
    icon: WifiOff,
  },
  {
    title: 'تحقق جغرافي مرن',
    text: 'مصمم لواقع GPS داخل المباني الجزائرية: تأكيد، مراجعة، أو اشتباه — يضمن حضوراً حقيقياً دون رفض حالة صحيحة.',
    icon: MapPin,
  },
  {
    title: 'منع التلاعب',
    text: 'بصمة الجهاز الفريدة تمنع أي تسجيل بالنيابة، والتوقيع الزمني في الخادم يوثق كل حضور — بيانات تثق بها أمام أي رقابة أو تحقيق.',
    icon: ShieldCheck,
  },
  {
    title: 'تقارير PDF و Excel',
    text: 'كشوف حضور رسمية جاهزة بنقرة واحدة: شهرياً، لكل فوج، لكل مشرف، لكل نشاط — بدل ساعات من العمل اليدوي.',
    icon: FileText,
  },
];

const audiences = [
  {
    title: 'الجامعات والمعاهد العليا',
    text: 'إدارة حضور الكليات والأقسام والمحاضرات برمز QR وسعات ضخمة تصل إلى 5,000 مستخدم — بدون ازدحام النظام حتى في أكبر القاعات.',
    icon: GraduationCap,
    tag: 'رمز QR + موقع جغرافي',
    image: '/assets/institutions/university.png',
  },
  {
    title: 'المدارس ومراكز التكوين',
    text: 'منادات ذكية من هاتف الأستاذ أو المدرب — لا حاجة لهواتف الحضور إطلاقاً، والنتائج تصل الإدارة لحظياً.',
    icon: School,
    tag: 'منادات ذكية فقط',
    image: '/assets/institutions/school.png',
  },
  {
    title: 'الشركات والمؤسسات',
    text: 'تكوين داخلي، اجتماعات، دوام ميداني أو ورشات: توثق حضور الموظفين والمتدربين ببيانات موثقة وجاهزة للمحاسبة والموارد البشرية.',
    icon: Wrench,
    tag: 'كلا النظامين',
    image: '/assets/institutions/institute.png',
  },
];

interface PricingTier {
  size: string;
  yearly: string;
  setup: string;
  note: string;
  featured?: boolean;
}

interface PricingCategory {
  id: string;
  title: string;
  description: string;
  tiers: PricingTier[];
}

const pricingCategories: PricingCategory[] = [
  {
    id: 'companies',
    title: 'الشركات',
    description: 'تكوين داخلي، دوام، اجتماعات — حضور موثق جاهز للموارد البشرية',
    tiers: [
      { size: 'شركة صغيرة', yearly: '100,000', setup: '50,000', note: 'اشتراك سنوي ثابت' },
      { size: 'شركة متوسطة', yearly: '150,000', setup: '50,000', note: 'اشتراك سنوي ثابت', featured: true },
      { size: 'شركة كبيرة', yearly: '200,000', setup: '50,000', note: 'اشتراك سنوي ثابت' },
    ],
  },
  {
    id: 'training',
    title: 'مراكز التكوين',
    description: 'متابعة حضور المتدربين في مراكز التكوين المهني والورشات',
    tiers: [
      { size: 'مركز صغير', yearly: '20,000', setup: '20,000', note: 'اشتراك سنوي ثابت' },
      { size: 'مركز متوسط', yearly: '30,000', setup: '20,000', note: 'اشتراك سنوي ثابت', featured: true },
      { size: 'أكاديمية كبيرة', yearly: '50,000', setup: '20,000', note: 'اشتراك سنوي ثابت' },
    ],
  },
  {
    id: 'schools',
    title: 'المؤسسات التعليمية',
    description: 'مدارس خاصة، ابتدائيات ومتوسطات — منادات ذكية بدون هواتف التلاميذ',
    tiers: [
      { size: 'مؤسسة ابتدائية', yearly: '20,000', setup: '20,000', note: 'اشتراك سنوي ثابت' },
      { size: 'مدرسة خاصة (500 تلميذ)', yearly: '60,000', setup: '30,000', note: '120 دج/تلميذ سنوياً', featured: true },
      { size: 'مؤسسة كبيرة (متوسطة / ثانوية)', yearly: '30,000', setup: '20,000', note: 'اشتراك سنوي ثابت' },
    ],
  },
  {
    id: 'universities',
    title: 'الجامعات',
    description: 'إدارة حضور الكليات والأقسام والمحاضرات بأكبر السعات',
    tiers: [
      { size: '10,000 طالب', yearly: '1,000,000', setup: '200,000', note: '100 دج/طالب سنوياً' },
    ],
  },
  {
    id: 'private-universities',
    title: 'الجامعات الخاصة',
    description: 'حلول مخصصة للجامعات والمدارس العليا الخاصة',
    tiers: [
      { size: '5,000 طالب', yearly: '750,000', setup: '250,000', note: '150 دج/طالب سنوياً' },
    ],
  },
];

function PricingTabs() {
  const [active, setActive] = useState('companies');
  const category = pricingCategories.find((c) => c.id === active) ?? pricingCategories[0];
  return (
    <>
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {pricingCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActive(cat.id)}
            className={`rounded-full px-5 py-2.5 text-sm font-black transition ${
              active === cat.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-400'
            }`}
          >
            {cat.title}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-base font-semibold text-slate-600 dark:text-slate-300">{category.description}</p>
      <div className={`mt-8 grid items-stretch gap-6 ${category.tiers.length === 1 ? 'mx-auto max-w-md' : 'md:grid-cols-3'}`}>
        {category.tiers.map((tier) => (
          <article
            key={tier.size}
            className={`relative flex flex-col rounded-2xl border p-8 text-center shadow-sm ${
              tier.featured
                ? 'border-2 border-blue-600 bg-white shadow-lg shadow-blue-600/15 dark:bg-slate-900'
                : 'border-blue-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            {tier.featured && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-5 py-1.5 text-sm font-black text-white">
                الأكثر طلباً
              </span>
            )}
            <h3 className="text-2xl font-black text-slate-950 dark:text-slate-50">{tier.size}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{tier.note}</p>
            <p className="mt-6">
              <span className="text-4xl font-black text-blue-600 lg:text-5xl">{tier.yearly}</span>
              <span className="mr-2 text-lg font-bold text-slate-600 dark:text-slate-400">دج/سنة</span>
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-blue-200/70 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">تثبيت الخدمة (مرة واحدة/سنة)</p>
                <p className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{tier.setup} <span className="text-base font-bold text-slate-600 dark:text-slate-400">دج</span></p>
              </div>
            </div>
            <ul className="mt-6 flex-1 space-y-3 text-right">
              {['كل مميزات Ausar Military لفئتك', 'دعم فني بالعربية', 'تحديثات مستمرة وحماية البيانات'].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
                  <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="font-semibold">{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-8 inline-flex items-center justify-center rounded-lg px-6 py-3.5 text-lg font-black transition ${
                tier.featured
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700'
                  : 'border-2 border-slate-300 text-slate-800 hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:text-slate-100 dark:hover:text-blue-400'
              }`}
            >
              اطلب عرض تجريبي
            </a>
          </article>
        ))}
      </div>
    </>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [showDemoVideo, setShowDemoVideo] = useState(false);

  return (
    <main id="top" dir="rtl" className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100">
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
            {navItems.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                className={`relative py-3 transition hover:text-blue-600 ${
                  index === 0 ? 'text-blue-600' : ''
                }`}
              >
                {item.label}
                {index === 0 && (
                  <span className="absolute inset-x-0 -bottom-1 mx-auto h-0.5 w-12 rounded-full bg-blue-600" />
                )}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ===== قسم البطل ===== */}
              <section className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-b from-blue-50 to-white dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="pointer-events-none absolute -left-32 top-10 h-[420px] w-[520px] rounded-full border border-dashed border-blue-200 opacity-60 dark:border-blue-800 dark:opacity-40" />
        <div className="mx-auto max-w-[1180px] px-6 py-14 lg:px-12 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* النص والأزرار */}
            <div className="text-center lg:text-right">
              <h1 className="mx-auto text-4xl font-black leading-[1.3] tracking-tight text-slate-950 md:text-6xl lg:mx-0 dark:text-slate-50">
                أرقام حضور <span className="text-blue-600">موثوقة</span> في ثوانٍ
              </h1>
              <p className="mx-auto mt-6 text-xl leading-9 text-slate-600 md:max-w-xl lg:mx-0 dark:text-slate-300">
                Ausar Military يحوّل حضورك من أوراق يدوية وبيانات مشكوك فيها إلى سجلات رقمية
                موثقة تصل للإدارة لحظياً — للجامعات والمدارس ومراكز التكوين والشركات،
                بدون إنترنت ودون أي تلاعب.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
                <button
                  type="button"
                  onClick={() => navigate('/trial')}
                  className="inline-flex h-14 min-w-[220px] items-center justify-center gap-3 rounded-lg bg-blue-600 px-8 text-lg font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  ابدأ التجربة المجانية
                </button>
                <button
                  type="button"
                  onClick={() => setShowDemoVideo(true)}
                  className="inline-flex h-14 min-w-[220px] items-center justify-center gap-3 rounded-lg border-2 border-blue-600 px-8 text-lg font-black text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  شاهد العرض
                  <PlayCircle className="h-6 w-6" />
                </button>
              </div>
              <p className="mt-6 text-sm font-bold text-slate-500 dark:text-slate-400">
                ✓ بدون بطاقة بنكية · ✓ تجربة مجانية 14 يوماً · ✓ دعم بالعربية
              </p>
            </div>

            {/* صورة لوحة التحكم */}
            <div className="relative mx-auto w-full max-w-[680px] lg:mx-0">
              <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-100 opacity-70 dark:bg-blue-900/40 dark:opacity-60" />
              <img
                src="/assets/hero/dashboard-mockup.png"
                alt="لوحة تحكم Ausar Military — الجلسات اليومية ورمز QR"
                loading="lazy"
                className="relative w-full rounded-2xl shadow-2xl shadow-blue-900/15 dark:shadow-blue-400/10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== كيف يعمل في 3 خطوات ===== */}
      <section id="how-it-works" className="relative border-b border-blue-100 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-12">
          <p className="text-center text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">كيف يعمل</p>
          <h2 className="mt-3 text-center text-4xl font-black text-slate-950 dark:text-slate-50">من فكرة إلى إدارة حضور متكاملة في ثلاث خطوات فقط</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'سجّل طلب التجربة',
                text: 'املأ نموذجًا سريعًا من 10 ثوانٍ — اسم المؤسسة، نوعها وعدد المستخدمين — وسنتواصل معك مباشرة.',
                icon: FileText,
              },
              {
                step: '2',
                title: 'نجهّز حسابك يدويًا',
                text: 'فريقنا ينشئ حساب مؤسستك يدويًا لضمان الأمان والخصوصية الكاملة — لا تسجيل ذاتي مفتوح للأغراب.',
                icon: ShieldCheck,
              },
              {
                step: '3',
                title: 'ابدأ بإدارة حضورك',
                text: 'الأستاذ ينادي الحضور من هاتفه، والإدارة ترى التقارير لحظيًا — حضور، غيابات وجلسات دون أي تلاعب.',
                icon: Mic,
              },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white to-blue-50/50 p-8 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60">
                <div className="absolute -top-5 right-8 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/30">
                  {s.step}
                </div>
                <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <s.icon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-950 dark:text-slate-50">{s.title}</h3>
                <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== عدادات الإحصائيات ===== */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-blue-600 to-blue-700 py-14 dark:border-slate-800 dark:from-blue-700 dark:to-blue-800">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-12">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              { end: 5, suffix: '+', label: 'مؤسسات تجريبية نشطة' },
              { end: 50, suffix: '+', label: 'مستخدم مسجل' },
              { end: 4, suffix: '', label: 'قطاعات تخدمها المنصة' },
              { end: 100, suffix: '%', label: 'إغلاق كامل أمام الغرباء' },
            ].map((c) => (
              <div key={c.label}>
                <CountUp end={c.end} suffix={c.suffix} className="text-5xl font-black text-white md:text-6xl" />
                <p className="mt-3 text-lg font-bold text-blue-100">{c.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm font-bold text-blue-200">أرقام حقيقية من قاعدة بيانات Ausar Military — تتحدث مع كل مؤسسة جديدة تنضم إلينا</p>
        </div>
      </section>

      {/* ===== شريط الثقة ===== */}
      <section className="border-b border-slate-100 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-[1180px] px-6 text-center">
          <p className="text-lg font-black text-slate-700 dark:text-slate-200">يخدم مؤسسات جزائرية في التعليم والتكوين والشركات</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-2 text-2xl font-black"><GraduationCap className="h-7 w-7" /> جامعات</span>
            <span className="flex items-center gap-2 text-2xl font-black"><School className="h-7 w-7" /> مدارس</span>
            <span className="flex items-center gap-2 text-2xl font-black"><Wrench className="h-7 w-7" /> مراكز تكوين</span>
            <span className="flex items-center gap-2 text-2xl font-black"><ShieldCheck className="h-7 w-7" /> سحابة آمنة</span>
          </div>
        </div>
      </section>

      {/* ===== نتائج الإطلاق التجريبي ===== */}
      <section id="testimonials" className="border-b border-blue-100 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-12">
          <p className="text-center text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">مرحلة الإطلاق التجريبي (Beta)</p>
          <h2 className="mt-3 text-center text-4xl font-black text-slate-950 dark:text-slate-50">نتائج وآراء من المؤسسات التي اختبرت المنصة</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                quote: 'اختبرنا المنادات الذكية من الهاتف في مدرستنا، والنتائج كانت مبهرة — سهولة في الاستخدام ودقة في التقارير اللحظية التي تصل للإدارة فوراً.',
                name: 'مختبر تجريبي',
                role: 'مدير مدرسة ابتدائية — وهران',
                icon: School,
              },
              {
                quote: 'تجربة تسجيل الحضور عبر الـ QR كانت سريعة جداً مع أعداد كبيرة من المتدربين. المنصة توفر ساعات من العمل اليدوي في استخراج التقارير.',
                name: 'مختبر تجريبي',
                role: 'مسؤول مركز تكوين مهني — سكيكدة',
                icon: Wrench,
              },
              {
                quote: 'نظام بصمة الجهاز الذي اختبرناه يضمن أماناً عالياً ويمنع التلاعب بالحضور. البيانات موثقة بدقة، مما يسهل عملية الرقابة الإدارية.',
                name: 'مختبر تجريبي',
                role: 'أستاذ جامعي — قسنطينة',
                icon: GraduationCap,
              },
            ].map((t, idx) => (
              <article
                key={idx}
                className="relative flex flex-col rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white to-blue-50/40 p-7 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60"
              >
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <t.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950 dark:text-slate-50">{t.name}</h3>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t.role}</p>
                  </div>
                </div>
                <p className="mt-5 flex-1 leading-8 text-slate-600 dark:text-slate-300">«{t.quote}»</p>
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-lg">★</span>
                    ))}
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    مرحلة الاختبار
                  </span>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center text-sm font-semibold text-slate-400 dark:text-slate-500">
            هذه النتائج تم جمعها خلال فترة الإطلاق التجريبي للمنصة لضمان الجودة قبل الإطلاق الرسمي
          </p>
        </div>
      </section>

      {/* ===== المميزات ===== */}
      <section id="features" className="bg-slate-50/60 py-16 dark:bg-slate-900/60">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-12">
          <p className="text-center text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">المميزات</p>
          <h2 className="mt-3 text-center text-4xl font-black text-slate-950 dark:text-slate-50">كل ما تحتاجه إدارة الحضور في منصة واحدة — من القاعة إلى المكتب</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mktFeatures.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-blue-200/80 bg-white p-7 shadow-sm transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-slate-50">{f.title}</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== الجمهور المستهدف ===== */}
      <section className="bg-white py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-12">
          <h2 className="text-center text-4xl font-black text-slate-950 dark:text-slate-50">مصممة لكل مؤسسة تعمل بالأشخاص</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {audiences.map((a) => (
              <article
                key={a.title}
                className="rounded-2xl border border-blue-200/80 bg-white p-7 text-right shadow-sm transition hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
                dir="rtl"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-14 w-14 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <a.icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-blue-50 px-4 py-1.5 text-xs font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">{a.tag}</span>
                </div>
                <img
                  src={a.image}
                  alt={a.title}
                  loading="lazy"
                  className="mt-6 w-full rounded-xl border border-slate-100 bg-[#f1f5f9] object-cover dark:border-slate-800 dark:bg-slate-800"
                />
                <h3 className="mt-5 text-2xl font-black text-slate-950 dark:text-slate-50">{a.title}</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{a.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== الأسعار ===== */}
      <section id="pricing" className="bg-slate-50/60 py-16 dark:bg-slate-900/60">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-12">
          <p className="text-center text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">الأسعار</p>
          <h2 className="mt-3 text-center text-4xl font-black text-slate-950 dark:text-slate-50">اختر الباقة المناسبة لمؤسستك</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-600 dark:text-slate-300">
            أسعار واضحة مبنية على حجم مؤسستك — ادفع فقط على ما تستعمله، بدون رسوم خفية.
          </p>

          {/* تبويبات الفئات */}
          <PricingTabs />

          <p className="mt-8 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
            ✓ الأسعار قابلة للمفاوضة حسب حجم مؤسستك · جميع الباقات تشمل التحديثات المستمرة وحماية البيانات السحابية · تجربة مجانية 14 يوماً.
          </p>
        </div>
      </section>

      {/* ===== شريط الدعوة للعمل ===== */}
      <section className="border-t-4 border-blue-400 bg-gradient-to-l from-blue-700 to-blue-900 py-14 text-white dark:border-blue-500">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-3xl font-black md:text-4xl">حوّل حضورك من أوراق مشكوك فيها إلى أرقام تثق بها</h2>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-lg bg-white px-10 text-lg font-black text-blue-700 shadow-lg transition hover:bg-blue-50"
          >
            <MessageCircle className="h-5 w-5" />
            اطلب عرض تجريبي الآن
          </a>
          <p className="text-sm text-blue-100">
            أو حمّل تطبيق الطالب مباشرة: <a href="/app" className="font-black text-white underline">صفحة التحميل</a>
          </p>
        </div>
      </section>

      <footer className="bg-[#061d35] px-6 py-8 text-white">
        <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Ausar Military" className="h-16 w-16 rounded-2xl" />
              <div>
                <p className="text-3xl font-black">Ausar Military</p>
                <p className="mt-1 text-sm text-blue-100">الحضور الذكي والموثق</p>
              </div>
            </div>
            <p className="mt-5 max-w-md leading-8 text-blue-100">
              حل آمن وسريع لكل مؤسسة تعمل بالأشخاص: جامعات، مدارس، مراكز تكوين، شركات وإدارات.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-black">الصفحات</h3>
            <ul className="mt-5 space-y-3 text-blue-100">
              <li><a href="#top" className="transition hover:text-white">البداية</a></li>
              <li><a href="#features" className="transition hover:text-white">المميزات</a></li>
              <li><a href="#pricing" className="transition hover:text-white">الأسعار</a></li>
              <li><a href="/app" className="transition hover:text-white">تحميل التطبيق</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-black">تواصل معنا</h3>
            <div className="mt-5 space-y-4 text-blue-100">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> تواصل معنا على واتساب
              </a>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                <Send className="h-4 w-4" /> تواصل معنا على تيليجرام
              </a>
              <p className="flex items-center gap-3"><MapPin className="h-4 w-4" /> الجزائر</p>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-[1320px] border-t border-white/10 pt-5 text-center text-sm text-blue-100">
          <p>© 2026 Ausar Military. جميع الحقوق محفوظة.</p>
          <p className="mt-2 text-blue-200/70">Developed by Ausar Military Team</p>
        </div>
      </footer>

      {/* Modal فيديو العرض */}
      {showDemoVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
          onClick={() => setShowDemoVideo(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowDemoVideo(false)}
              className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-50">الفيديو التوضيحي للمنصة</p>
              <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                شاهد كيف يعمل Ausar Military في أقل من دقيقتين
              </p>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 shadow-inner">
              <iframe
                src="https://drive.google.com/file/d/10bauR8V86G_rxriY9eCXE6hTD6dz_yoR/preview"
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Ausar Military Demo Video"
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> تواصل معنا لطلب نسخة تجريبية
              </a>
              <button
                type="button"
                onClick={() => setShowDemoVideo(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-100 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
