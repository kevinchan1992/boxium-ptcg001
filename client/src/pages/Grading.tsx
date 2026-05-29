import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  Package,
  Bell,
  Award,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Truck,
  Star,
} from "lucide-react";
import { getProxiedImageUrl } from "@/lib/utils";

// Countdown timer component
function CountdownTimer({ deadline }: { deadline: Date }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diff = deadline.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
  const seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

  if (diff <= 0) return <span className="text-red-500 font-bold">{t('grading.countdown.expired')}</span>;

  return (
    <div className="flex gap-3 justify-center">
      {[
        { value: days, label: t('grading.countdown.days') },
        { value: hours, label: t('grading.countdown.hours') },
        { value: minutes, label: t('grading.countdown.minutes') },
        { value: seconds, label: t('grading.countdown.seconds') },
      ].map(({ value, label }) => (
        <div key={label} className="flex flex-col items-center">
          <div className="bg-[#06038d] text-white text-2xl font-bold w-14 h-14 flex items-center justify-center rounded-lg">
            {String(value).padStart(2, "0")}
          </div>
          <span className="text-xs text-gray-500 mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Grading Banner Carousel ───────────────────────────────────────────────────────────────────
function GradingBannerCarousel() {
  const { data: images } = trpc.grading.getBannerImages.useQuery();
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!images || images.length === 0) return;
    const track = trackRef.current;
    if (!track) return;
    const speed = 0.5;
    const step = () => {
      if (!pausedRef.current) {
        posRef.current += speed;
        const half = track.scrollWidth / 2;
        if (posRef.current >= half) posRef.current -= half;
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [images?.length]);

  if (!images || images.length === 0) return null;

  const doubled = [...images, ...images];

  return (
    <section className="bg-white py-8 overflow-hidden">
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-white to-transparent" />
        <div
          ref={trackRef}
          className="flex items-end gap-3 pl-3 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {doubled.map((img, idx) => (
            <div
              key={`${img.id}-${idx}`}
              className="flex-shrink-0 rounded-xl overflow-hidden shadow-md"
              style={{ width: '110px' }}
            >
              <img
                src={getProxiedImageUrl(img.imageUrl) ?? ""}
                alt={img.altText || `grading-banner-${idx + 1}`}
                className="w-full h-auto block"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Public Reviews Section ───────────────────────────────────────────────────────────────────
function PublicReviewsSection() {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.grading.getPublicReviews.useQuery({ limit: 6 });

  if (isLoading || !data || data.length === 0) return null;

  const avgRating = data.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / data.length;

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('grading.reviews.title')}</h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className={`h-5 w-5 ${s <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
              ))}
            </div>
            <span className="text-lg font-bold text-gray-800">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-gray-500">{t('grading.reviews.reviewCount', { count: data.length })}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((review: { id: number; rating: number; comment: string | null; createdAt: Date; userName: string | null }) => (
            <div key={review.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-1 mb-2">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} className={`h-4 w-4 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
              {review.comment && (
                <p className="text-sm text-gray-700 italic mb-3">"{review.comment}"</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">
                  {review.userName ? review.userName.charAt(0) + "***" : t('grading.reviews.anonymous')}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Grading() {
  const { t } = useTranslation();
  const { data: tiers, isLoading: tiersLoading } = trpc.grading.getServiceTiers.useQuery();
  const { data: nextBatch } = trpc.grading.getNextBatch.useQuery();

  const STEPS = [
    { step: 1, title: t('grading.steps.step1.title'), desc: t('grading.steps.step1.desc'), icon: FileText, highlight: true },
    { step: 2, title: t('grading.steps.step2.title'), desc: t('grading.steps.step2.desc'), icon: Bell },
    { step: 3, title: t('grading.steps.step3.title'), desc: t('grading.steps.step3.desc'), icon: Package, highlight: true },
    { step: 4, title: t('grading.steps.step4.title'), desc: t('grading.steps.step4.desc'), icon: Shield },
    { step: 5, title: t('grading.steps.step5.title'), desc: t('grading.steps.step5.desc'), icon: Clock },
    { step: 6, title: t('grading.steps.step6.title'), desc: t('grading.steps.step6.desc'), icon: DollarSign, highlight: true },
    { step: 7, title: t('grading.steps.step7.title'), desc: t('grading.steps.step7.desc'), icon: Truck },
  ];

  const FEATURES = [
    { icon: Shield, title: t('grading.features.safe.title'), desc: t('grading.features.safe.desc') },
    { icon: Package, title: t('grading.features.fullService.title'), desc: t('grading.features.fullService.desc') },
    { icon: Bell, title: t('grading.features.notification.title'), desc: t('grading.features.notification.desc') },
    { icon: Award, title: t('grading.features.official.title'), desc: t('grading.features.official.desc') },
  ];

  const FAQS = [
    { q: t('grading.faq.q1'), a: t('grading.faq.a1') },
    { q: t('grading.faq.q2'), a: t('grading.faq.a2') },
    { q: t('grading.faq.q3'), a: t('grading.faq.a3') },
    { q: t('grading.faq.q4'), a: t('grading.faq.a4') },
    { q: t('grading.faq.q5'), a: t('grading.faq.a5') },
    { q: t('grading.faq.q6'), a: t('grading.faq.a6') },
    { q: t('grading.faq.q7'), a: t('grading.faq.a7') },
    { q: t('grading.faq.q8'), a: t('grading.faq.a8') },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero Banner ── */}
      <section className="bg-[#06038d] text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute bottom-10 right-10 w-48 h-48 border-4 border-yellow-400 rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-20 h-20 border-2 border-white rotate-45" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Badge className="bg-yellow-400 text-[#06038d] font-bold mb-4 text-sm px-3 py-1">
            {t('grading.hero.badge')}
          </Badge>
          <div className="flex items-center justify-center gap-4 mb-4">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo-white_32a1e418.png"
              alt="BOXIUM"
              className="h-12 sm:h-16 md:h-20 w-auto object-contain"
            />
            <span className="text-white text-3xl sm:text-4xl font-bold">×</span>
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/psa-logo_e1ed218d.png"
              alt="PSA"
              className="h-10 sm:h-14 md:h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-yellow-400">{t('grading.hero.title')}</span>
          </h1>
          <p className="text-base md:text-xl text-blue-200 mb-8 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
            {t('grading.hero.subtitle')}
          </p>
          <div className="flex flex-row gap-3 justify-center">
            <Link href="/grading/submit" className="flex-1 max-w-[180px]">
              <Button size="lg" className="w-full bg-yellow-400 text-[#06038d] hover:bg-yellow-300 font-bold text-sm sm:text-base px-4 sm:px-8">
                {t('grading.hero.submitBtn')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/grading/orders" className="flex-1 max-w-[180px]">
              <Button size="lg" variant="outline" className="w-full border-white text-white hover:bg-white/10 font-bold text-sm sm:text-base px-4 sm:px-8">
                {t('grading.hero.viewOrdersBtn')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Next Batch Countdown ── */}
      {nextBatch && (
        <section className="bg-yellow-50 border-b border-yellow-200 py-8 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold text-yellow-700 mb-2 uppercase tracking-wide">
              {t('grading.countdown.nextBatchDeadline')}
            </p>
            <p className="text-lg font-bold text-gray-800 mb-4">
              {nextBatch.batchName} — {new Date(nextBatch.cutoffDate).toLocaleDateString()}
            </p>
            <CountdownTimer deadline={new Date(nextBatch.cutoffDate)} />
            <p className="text-sm text-gray-500 mt-3">
              {t('grading.countdown.notice')}
            </p>
          </div>
        </section>
      )}

      {/* ── Grading Banner Carousel ── */}
      <GradingBannerCarousel />

      {/* ── Features ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            {t('grading.features.title')}
          </h2>
          <p className="text-center text-gray-500 mb-10">{t('grading.features.subtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#06038d]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-6 w-6 text-[#06038d]" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Flow ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            {t('grading.steps.title')}
          </h2>
          <p className="text-center text-gray-500 mb-10">{t('grading.steps.subtitle')}</p>
          <div className="relative">
            <div className="space-y-4">
              {STEPS.map(({ step, title, desc, icon: Icon, highlight }) => (
                <div
                  key={step}
                  className={`flex gap-4 p-4 rounded-xl transition-all ${
                    highlight
                      ? "bg-[#06038d] text-white shadow-lg"
                      : "bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg z-10 ${
                    highlight ? "bg-yellow-400 text-[#06038d]" : "bg-white border-2 border-gray-200 text-gray-600"
                  }`}>
                    {step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${highlight ? "text-yellow-400" : "text-[#06038d]"}`} />
                      <h3 className="font-bold text-base">{title}</h3>
                      {highlight && (
                        <Badge className="bg-yellow-400 text-[#06038d] text-xs font-bold">{t('grading.steps.actionRequired')}</Badge>
                      )}
                    </div>
                    <p className={`text-sm ${highlight ? "text-blue-200" : "text-gray-500"}`}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Table ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
            {t('grading.pricing.title')}
          </h2>
          <p className="text-center text-gray-500 mb-10">{t('grading.pricing.subtitle')}</p>

          {tiersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <thead>
                  <tr className="bg-[#06038d] text-white">
                    <th className="text-left p-3 sm:p-4 font-semibold whitespace-nowrap">{t('grading.pricing.tier')}</th>
                    <th className="text-right p-3 sm:p-4 font-semibold whitespace-nowrap">{t('grading.pricing.feePerCard')}</th>
                    <th className="text-right p-3 sm:p-4 font-semibold whitespace-nowrap">{t('grading.pricing.turnaround')}</th>
                    <th className="text-right p-3 sm:p-4 font-semibold whitespace-nowrap hidden sm:table-cell">{t('grading.pricing.maxDeclaredValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers?.map((tier: any, idx: number) => (
                    <tr
                      key={tier.id}
                      className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}
                    >
                      <td className="p-3 sm:p-4">
                        <div className="font-bold text-gray-900 whitespace-nowrap">{tier.name}</div>
                        {tier.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{tier.description}</div>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-right whitespace-nowrap">
                        <span className="text-lg sm:text-xl font-bold text-[#06038d]">HK${parseFloat(tier.feeHkd).toLocaleString()}</span>
                      </td>
                      <td className="p-3 sm:p-4 text-right whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {t('grading.pricing.workingDays', { min: tier.estimatedDaysMin, max: tier.estimatedDaysMax })}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 text-right hidden sm:table-cell whitespace-nowrap">
                        <span className="text-gray-700">USD ${parseFloat(tier.maxDeclaredValueUsd).toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 space-y-1">
            <p className="text-xs text-gray-500">{t('grading.pricing.note1')}</p>
            <p className="text-xs text-gray-500">{t('grading.pricing.note2')}</p>
          </div>
        </div>
      </section>

      {/* ── Shipping Address ── */}
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-[#06038d] text-white rounded-2xl p-8 text-center">
            <Package className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t('grading.shipping.title')}</h2>
            <p className="text-blue-200 text-sm mb-4">{t('grading.shipping.subtitle')}</p>
            <div className="bg-white/10 rounded-xl p-5 text-left space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold text-sm w-20 flex-shrink-0">{t('grading.shipping.recipient')}</span>
                <span className="text-white font-bold">BOXIUM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold text-sm w-20 flex-shrink-0">{t('grading.shipping.phone')}</span>
                <span className="text-white font-bold">55090102</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold text-sm w-20 flex-shrink-0 mt-0.5">{t('grading.shipping.method')}</span>
                <span className="text-white font-bold">{t('grading.shipping.sfStation')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold text-sm w-20 flex-shrink-0 mt-0.5">{t('grading.shipping.address')}</span>
                <span className="text-white">{t('grading.shipping.addressValue')}</span>
              </div>
            </div>
            <p className="text-xs text-blue-300 mt-4">
              {t('grading.shipping.printWarning')}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#06038d]/10 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-[#06038d]" />
              </div>
              <h3 className="font-bold text-gray-900">{t('grading.shipping.packagingTitle')}</h3>
            </div>
            <div className="space-y-3">
              {[
                { num: "1", title: t('grading.shipping.packaging1Title'), desc: t('grading.shipping.packaging1Desc'), color: "bg-[#06038d]" },
                { num: "2", title: t('grading.shipping.packaging2Title'), desc: t('grading.shipping.packaging2Desc'), color: "bg-[#06038d]" },
                { num: "3", title: t('grading.shipping.packaging3Title'), desc: t('grading.shipping.packaging3Desc'), color: "bg-[#06038d]" },
                { num: "★", title: t('grading.shipping.packaging4Title'), desc: t('grading.shipping.packaging4Desc'), color: "bg-yellow-400 text-[#06038d]" },
              ].map(({ num, title, desc, color }) => (
                <div key={num} className="flex items-start gap-3">
                  <span className={`w-6 h-6 ${color} ${num === "★" ? "text-[#06038d]" : "text-white"} rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5`}>{num}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Payment Notice ── */}
      <section className="py-8 px-4 bg-amber-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 mb-1">{t('grading.payment.importantTitle')}</p>
              <p className="text-sm text-amber-700">{t('grading.payment.importantDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── User Reviews ── */}
      <PublicReviewsSection />

      {/* ── FAQ ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-10">
            {t('grading.faq.title')}
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQS.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="bg-white rounded-xl border border-gray-100 px-4 shadow-sm"
              >
                <AccordionTrigger className="text-left font-semibold text-gray-800 hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-sm pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA Bottom ── */}
      <section className="py-16 px-4 bg-[#06038d] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <CheckCircle2 className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{t('grading.cta.title')}</h2>
          <p className="text-blue-200 mb-8">{t('grading.cta.subtitle')}</p>
          <Link href="/grading/submit">
            <Button size="lg" className="bg-yellow-400 text-[#06038d] hover:bg-yellow-300 font-bold text-base px-10">
              {t('grading.cta.submitBtn')}
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
