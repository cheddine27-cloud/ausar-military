/**
 * FreeTrialPage — صفحة التجربة المجانية
 *
 * مسار الزائر التجاري: يصل الزائر من زر «ابدأ التجربة المجانية» في الصفحة
 * الرئيسية، يملأ بيانات مؤسسته (يُحفظ في قاعدة البيانات للمتابعة التجارية)،
 * ثم يضغط «ادخل التجربة الآن» ليدخل لوحة التحكم مباشرة بحساب الديمو المهيأ
 * (جلسات DEMO-RC و DEMO-QR نشطة) دون أي انتظار أو موافقة.
 *
 * حماية ضد السبام (HoneyPot) — v5.0.12:
 * - حقل «الموقع الإلكتروني» مخفي بصريًا عن البشر (tabindex=-1 + إخفاء مطلق)
 *   لكنه موجود في DOM؛ البوتات تملؤه تلقائيًا فنكشف إرساله الفوري.
 * - حارس زمني: يجب أن تمر ≥ 4 ثوانٍ بين فتح النموذج والإرسال (البوتات ترسل فوريًا).
 * - عند اكتشاف سبام نرفض الإرسال بصمت (بدون رسالة خطأ تكشف وجود الحماية).
 */
import { useState } from 'react';
import { ArrowRight, Calendar, Check, GraduationCap, Landmark, MessageCircle, School, ShieldCheck, Store, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';

const LOGO_URL = '/icons/icon-512x512.png';
const WHATSAPP_PHONE = '213562183070';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;

const institutionTypes = [
  { id: 'military', label: 'جامعة', icon: GraduationCap },
  { id: 'school', label: 'مدرسة / مؤسسة تربوية', icon: School },
  { id: 'training', label: 'مركز تكوين', icon: Landmark },
  { id: 'company', label: 'شركة / مؤسسة', icon: Store },
];

export default function FreeTrialPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [users, setUsers] = useState('');
  // حقل HoneyPot — البوتات تملؤه، البشر لا يرونه
  const [hpWebsite, setHpWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // حارس زمني: وقت فتح النموذج لقياس سرعة الإرسال
  const openedAt = Date.now();
  const HONEYPOT_FILL_DELAY_MS = 4000;

  const valid = name.trim().length >= 2 && phone.trim().length >= 8 && !!type;

  /** كشف البوتات عبر HoneyPot + حارس زمني — يُستدعى قبل أي إرسال */
  const isSpam = (): boolean => {
    // 1) البوتات تملأ الحقول المخفية عادة
    if (hpWebsite.trim() !== '') return true;
    // 2) الإرسال الفوري (< 4 ثوانٍ من فتح الصفحة) سلوك بوت شائع
    if (Date.now() - openedAt < HONEYPOT_FILL_DELAY_MS) return true;
    return false;
  };

  const submitRequest = async () => {
    setError('');
    if (isSpam()) {
      // رفض صامت — لا نكشف آلية الحماية للبوتات ولا نزعج المستخدمين
      console.warn('spam blocked by honeypot');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase
        .from('trial_requests')
        .insert(
          {
            institution_name: name.trim(),
            contact_phone: phone.trim(),
            institution_type: type,
            user_count: users.trim() || null,
            source: 'landing_hero',
          },
          { count: 'exact' }
        );
      if (error) throw new Error(error.message);
      setSent(true);
    } catch (e) {
      setError('تعذّر إرسال طلبك — جرّب مرة أخرى أو تواصل معنا مباشرة عبر واتساب');
      console.warn('lead save error', e);
    } finally {
      setSending(false);
    }
  };

  const goWhatsApp = () => {
    const msg = encodeURIComponent(
      `مرحباً، أود تجربة نظام Ausar Military — المؤسسة: ${name.trim() || 'غير محدد'}، الهاتف: ${phone.trim()}`
    );
    window.open(`${WHATSAPP_URL}?text=${msg}`, '_blank', 'noopener');
  };

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-50/70 to-white text-slate-950 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-100 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-4 lg:px-12">
          <a href="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Ausar Military" className="h-12 w-12 rounded-2xl" />
            <div>
              <p className="text-2xl font-black leading-none text-slate-900 dark:text-slate-50">Ausar Military</p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">الحضور الذكي والموثق</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:text-blue-400"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للرئيسية
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Calendar className="h-4 w-4" />
            تجربة مجانية — بدون بطاقة بنكية · 14 يومًا
          </span>
          <h1 className="mt-6 text-3xl font-black leading-snug text-slate-950 md:text-5xl dark:text-slate-50">
            اطلب <span className="text-blue-600">تجربتك الخاصة</span> المجانية
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            اترك بياناتك وسيتواصل معك فريقنا مباشرة لإنشاء حساب خاص بمؤسستك،
            يُهيَّأ على قياسك وعلى بياناتك التجريبية الخاصة — بدون بطاقة بنكية.
          </p>
          <div className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-black text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" /> تسجيل ذاتي غير متاح — حسابات خاصة فقط
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" /> متابعة تجريبية مباشرة على واتساب
            </span>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-10">
          {!sent ? (
            <>
              <p className="mb-6 text-base font-bold text-slate-600 dark:text-slate-300">
                نخدم المؤسسات والوزارات بحسابات مخصصة — املأ البيانات التالية وسنتصل بك خلال ساعات العمل.
              </p>
              <div className="grid gap-6 md:grid-cols-2 relative">
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-800 dark:text-slate-100">اسم المؤسسة *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: جامعة العلوم والتقنية"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-800 dark:text-slate-100">رقم الهاتف / واتساب *</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+213 5XX XX XX XX"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </div>
                {/*
                  حقل HoneyPot — مخفي عن البشر بخصائص إخفاء مطلق (وليس display:none
                  الذي تتجاهله بعض البوتات). وجود القيمة فيه = طلب مزيف.
                */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden opacity-0"
                  style={{ position: 'absolute' }}
                >
                  <label htmlFor="hp-website">الموقع الإلكتروني</label>
                  <input
                    id="hp-website"
                    type="text"
                    name="website"
                    autoComplete="off"
                    tabIndex={-1}
                    value={hpWebsite}
                    onChange={(e) => setHpWebsite(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-black text-slate-800 dark:text-slate-100">عدد المستخدمين التقريبي</label>
                  <input
                    type="text"
                    value={users}
                    onChange={(e) => setUsers(e.target.value)}
                    placeholder="مثال: 200 مستخدم"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-black text-slate-800 dark:text-slate-100">نوع المؤسسة *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {institutionTypes.map((t) => {
                      const Icon = t.icon;
                      const active = type === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setType(t.id)}
                          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-black transition ${
                            active
                              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  <X className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={submitRequest}
                disabled={!valid || sending}
                className="mt-8 inline-flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-8 text-lg font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'جاري الإرسال...' : 'اطلب تجربتك المجانية'}
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                بياناتك تحفظ فقط لمتابعة فريقنا معك — لا رسائل مزعجة ولن تُشارك مع أي طرف ثالث.
              </p>
              <a
                href={`${WHATSAPP_URL}?text=${encodeURIComponent('مرحباً، أود تجربة نظام Ausar Military')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-6 text-base font-black text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
              >
                <MessageCircle className="h-5 w-5" />
                تواصل معنا مباشرة على واتساب
              </a>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800/60 dark:bg-emerald-950/40">
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60">
                  <Check className="h-8 w-8 text-emerald-600" />
                </span>
                <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-50">تم استلام طلبك بنجاح ✓</p>
                <p className="mt-3 text-base font-semibold text-slate-600 dark:text-slate-300">
                  فريقنا راجع طلبك وسيتواصل معك عبر واتساب على الرقم الذي تركته لإنشاء حسابك الخاص وتجهيز تجربتك.
                </p>
              </div>
              <button
                type="button"
                onClick={goWhatsApp}
                className="mt-8 inline-flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-emerald-600 px-8 text-lg font-black text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-6 w-6" />
                تواصل معنا الآن على واتساب
              </button>
              <p className="mt-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                كلما تواصلت مبكراً، كلما جهّزنا حسابك أسرع — بياناتك التجريبية تُعد خصيصاً لمؤسستك.
              </p>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
          جميع الحسابات تُنشأ يدوياً من فريقنا لضمان أمان بياناتك — لا تسجيل ذاتي مفتوح للجمهور.
        </p>
      </section>
    </main>
  );
}
