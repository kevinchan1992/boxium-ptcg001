import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Printer,
  Package,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  AlertCircle,
  MapPin,
  ExternalLink,
  XCircle,
  PartyPopper,
  Bot,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Star,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { getProxiedImageUrl } from "@/lib/utils";

// Compress image to reduce payload size before uploading as base64
const compressImageToBase64 = (file: File, maxWidthPx = 1600, quality = 0.82): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidthPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });

// STATUS_STEPS is now generated inside the component using t()

const STATUS_ORDER = [
   "pending_payment", "received", "submitted_to_psa", "grading", "graded", "returned", "completed"
];
function getStepIndex(status: string) {
  const map: Record<string, number> = {
    awaiting_payment: 0,
    pending_review: 0,
    pending_shipment: 0,
    pending_payment: 0,
    received: 1,
    submitted_to_psa: 2,
    grading: 3,
    graded: 4,
    returned: 5,
    completed: 5,
  };
  return map[status] ?? 0;
}
// STATUS_LABEL is now generated inside the component using t()

// ─── Printable Slip ───────────────────────────────────────────────────────────
function PrintableSlip({ submission }: { submission: any }) {
  const { t } = useTranslation();
  return (
    <div id="printable-slip-root" className="hidden print:block font-sans text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print {
          body > *:not(#printable-slip-root) { display: none !important; }
          #printable-slip-root { display: block !important; }
          nav, header, button, [data-print-hide] { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
      {/* ── Header Banner ── */}
      <div style={{ background: '#06038d', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* BOXIUM Logo Image */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo_62cbf293.webp"
            alt="BOXIUM"
            style={{ height: '52px', width: 'auto', objectFit: 'contain', borderRadius: '6px' }}
          />
          <div>
            <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '16px', letterSpacing: '0.5px' }}>{t("grading.psaApplicationTitle")}</div>
            <div style={{ color: '#b0b8e8', fontSize: '11px', marginTop: '2px' }}>{t("grading.printAndSendNote")}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#FEDD00', fontWeight: '700', fontSize: '14px', fontFamily: 'monospace', letterSpacing: '1px' }}>{submission.orderNo}</div>
          <div style={{ color: '#b0b8e8', fontSize: '11px', marginTop: '3px' }}>
            {new Date(submission.createdAt).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '20px 28px' }}>

        {/* Applicant Info */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', background: '#f8faff' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t("grading.applicant")}</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#06038d' }}>{submission.user?.name ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{t("grading.userId")}#{submission.userId ?? submission.user?.id ?? '—'}</div>
          </div>
          <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', background: '#f8faff' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('grading.detail.tier')}</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#06038d' }}>{submission.items?.[0]?.tier?.name ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>HK${submission.items?.[0]?.tier ? parseFloat(submission.items[0].tier.feeHkd).toLocaleString() : '—'} / {t("grading.perCard")} · {t("grading.totalCards", { count: submission.items.length })}</div>
          </div>
          <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', background: '#f8faff' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('grading.detail.orderNo')}</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#06038d', fontFamily: 'monospace' }}>{submission.orderNo}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{t("grading.totalCards", { count: submission.items.length })}</div>
          </div>
        </div>

        {/* Two-column: Shipping Address (to BOXIUM) + Return Address (to customer) */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {/* Send-to BOXIUM address */}
          <div style={{ flex: 1, border: '1.5px solid #06038d', borderRadius: '8px', padding: '12px 14px', background: '#f0f2ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: '18px', height: '18px', background: '#06038d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: '10px' }}>📦</span>
              </div>
              <span style={{ fontWeight: '700', fontSize: '12px', color: '#06038d' }}>{t("grading.sendToBoxiumAddress")}</span>
            </div>
            <div style={{ fontSize: '11px', lineHeight: '1.7' }}>
              <div><span style={{ color: '#6b7280' }}>{t("grading.recipient")}：</span><span style={{ fontWeight: '600' }}>BOXIUM</span></div>
              <div><span style={{ color: '#6b7280' }}>{t("grading.phone")}：</span><span style={{ fontWeight: '600' }}>55090102</span></div>
              <div><span style={{ color: '#6b7280' }}>{t("grading.method")}：</span><span style={{ fontWeight: '600' }}>SF Station 852Z351</span></div>
              <div><span style={{ color: '#6b7280' }}>{t("grading.address")}：</span><span style={{ fontWeight: '600' }}>{t("grading.boxiumAddress")}</span></div>
            </div>
            <div style={{ marginTop: '8px', padding: '5px 8px', background: '#fff3cd', borderRadius: '4px', fontSize: '10px', fontWeight: '600', color: '#92400e' }}>
              ⚠️ {t("grading.sendWithSlip")}
            </div>
          </div>
          {/* Return address (customer's delivery address) */}
          <div style={{ flex: 1, border: '1.5px solid #16a34a', borderRadius: '8px', padding: '12px 14px', background: '#f0fdf4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: '18px', height: '18px', background: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: '10px' }}>🏠</span>
              </div>
              <span style={{ fontWeight: '700', fontSize: '12px', color: '#16a34a' }}>{t("grading.returnAddress")}</span>
            </div>
            {submission.returnAddress ? (
              <div style={{ fontSize: '11px', lineHeight: '1.7' }}>
                <div><span style={{ color: '#6b7280' }}>{t("grading.recipient")}：</span><span style={{ fontWeight: '600' }}>{submission.returnAddress.recipientName}</span></div>
                <div><span style={{ color: '#6b7280' }}>{t("grading.phone")}：</span><span style={{ fontWeight: '600' }}>{submission.returnAddress.phone}</span></div>
                {submission.returnAddress.sfStationName && (
                  <div><span style={{ color: '#6b7280' }}>{t("grading.sfStation")}：</span><span style={{ fontWeight: '600' }}>{submission.returnAddress.sfStationName} ({submission.returnAddress.sfStationCode})</span></div>
                )}
                <div><span style={{ color: '#6b7280' }}>{t("grading.address")}：</span><span style={{ fontWeight: '600' }}>{[submission.returnAddress.district, submission.returnAddress.region, submission.returnAddress.address].filter(Boolean).join(' ')}</span></div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>{t("grading.noReturnAddress")}</div>
            )}
          </div>
        </div>

        {/* Card List */}
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ background: '#06038d', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: '700', fontSize: '13px' }}>{t('grading.detail.cardList')}</span>
            <span style={{ color: '#FEDD00', fontWeight: '600', fontSize: '12px' }}>{t("grading.totalCards", { count: submission.items.length })}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#eef0ff', borderBottom: '1px solid #c7d2fe' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', width: '28px', color: '#374151', fontWeight: '600' }}>#</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#374151', fontWeight: '600' }}>{t("grading.cardName")}</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px', color: '#374151', fontWeight: '600' }}>{t("grading.setNumber")}</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px', color: '#374151', fontWeight: '600' }}>{t('grading.detail.tier')}</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '70px', color: '#374151', fontWeight: '600' }}>{t("grading.fee")}</th>
              </tr>
            </thead>
            <tbody>
              {submission.items.map((item: any, idx: number) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '10px 12px', color: '#6b7280', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: '600', color: '#111827', lineHeight: '1.4', wordBreak: 'break-word' }}>{item.cardName}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '11px' }}>
                    {[item.cardSet, item.cardNumber].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ background: '#eef0ff', color: '#06038d', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {item.tier?.name ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#06038d' }}>
                    HK${item.tier ? parseFloat(item.tier.feeHkd).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #06038d', background: '#f0f2ff' }}>
                <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#06038d', fontSize: '13px' }}>{t("grading.totalFeePrepaid")}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#06038d', fontSize: '14px' }}>
                  HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '14px 16px', fontSize: '12px' }}>
          <div style={{ fontWeight: '700', color: '#06038d', marginBottom: '8px', fontSize: '13px' }}>{t("grading.importantNotes")}</div>
          <ol style={{ paddingLeft: '16px', margin: 0, lineHeight: '1.8', color: '#374151' }}>
            <li>{t("grading.noteTracking")}</li>
            <li>{t("grading.notePackaging")}</li>
            <li>{t("grading.notePrepaid")}</li>
            <li>{t("grading.noteContact")}</li>
          </ol>
        </div>

    
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── Review Section ──────────────────────────────────────────────────────────
function ReviewSection({ submissionId }: { submissionId: number }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const utils = trpc.useUtils();

  const { data: existingReview, isLoading } = trpc.grading.getMyReview.useQuery({ submissionId });
  const submitReview = trpc.grading.submitReview.useMutation({
    onSuccess: () => {
      toast.success(t("grading.reviewThanks"));
      utils.grading.getMyReview.invalidate({ submissionId });
    },
    onError: (err) => toast.error(err.message || t("grading.reviewSubmitFailed")),
  });

  if (isLoading) return null;

  if (existingReview) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <p className="font-bold text-green-800 text-sm mb-2">✅ {t("grading.reviewSubmitted")}</p>
        <div className="flex items-center gap-1 mb-2">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} className={`h-5 w-5 ${s <= existingReview.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
          ))}
          <span className="text-sm text-gray-600 ml-1">{existingReview.rating}/5</span>
        </div>
        {existingReview.comment && (
          <p className="text-sm text-gray-700 italic">"{existingReview.comment}"</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
      <p className="font-bold text-yellow-800 text-sm mb-3">⭐ {t("grading.rateService")}</p>
      {/* Star rating */}
      <div className="flex items-center gap-1 mb-3">
        {[1,2,3,4,5].map((s) => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHoverRating(s)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(s)}
            className="focus:outline-none"
          >
            <Star className={`h-7 w-7 transition-colors ${s <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-600 ml-2">{["", t("grading.ratingVeryBad"), t("grading.ratingBad"), t("grading.ratingOk"), t("grading.ratingGood"), t("grading.ratingExcellent")][rating]}</span>
        )}
      </div>
      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("grading.reviewPlaceholder")}
        maxLength={500}
        rows={3}
        className="w-full text-sm border border-yellow-200 rounded-lg p-2 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400 mb-2"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded"
          />
          {t("grading.makePublic")}
        </label>
        <button
          type="button"
          disabled={rating === 0 || submitReview.isPending}
          onClick={() => submitReview.mutate({ submissionId, rating, comment: comment.trim() || undefined, isPublic })}
          className="bg-[#06038d] text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#06038d]/90 transition-colors"
        >
          {submitReview.isPending ? t("common.submitting") : t("grading.submitReview")}
        </button>
      </div>
    </div>
  );
}

export default function GradingOrderDetail() {
  const { t } = useTranslation();
  const STATUS_STEPS = [
    { key: "pending_payment", label: t('grading.detail.statusStep.submitted') },
    { key: "received", label: t('grading.detail.statusStep.received') },
    { key: "submitted_to_psa", label: t('grading.detail.statusStep.sentToPSA') },
    { key: "grading", label: t('grading.detail.statusStep.grading') },
    { key: "graded", label: t('grading.detail.statusStep.graded') },
    { key: "completed", label: t('grading.detail.statusStep.completed') },
  ];
  const STATUS_LABEL: Record<string, string> = {
    awaiting_payment: t('grading.detail.status.awaitingPayment'),
    pending_review: t('grading.detail.status.pendingReview'),
    pending_shipment: t('grading.detail.status.pendingShipment'),
    pending_payment: t('grading.detail.status.pendingPayment'),
    received: t('grading.detail.status.received'),
    submitted_to_psa: t('grading.detail.status.submittedToPSA'),
    grading: t('grading.detail.status.grading'),
    graded: t('grading.detail.status.graded'),
    payment_overdue: t('grading.detail.status.paymentOverdue'),
    returned: t('grading.detail.status.returned'),
    completed: t('grading.detail.status.completed'),
    cancelled: t('grading.detail.status.cancelled'),
  };
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const isPaymentSuccess = searchParams.get("payment") === "success";
  const isUpgradePaymentSuccess = searchParams.get("upgrade_payment") === "success";

  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "alipay_hk">("stripe");
  const [payingLoading, setPayingLoading] = useState(false);
  const [showAlipayQR, setShowAlipayQR] = useState(false);
  const [alipayProofFile, setAlipayProofFile] = useState<File | null>(null);
  const [alipayProofPreview, setAlipayProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [aiVerifyResult, setAiVerifyResult] = useState<{
    isValid: boolean;
    confidence: "high" | "medium" | "low";
    detectedAmount: string | null;
    detectedOrderNo: string | null;
    amountMatch: boolean | null;
    orderNoMatch: boolean | null;
    issues: string[];
    summary: string;
  } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  // Upgrade Alipay payment states
  const [upgradePayMethod, setUpgradePayMethod] = useState<"stripe" | "alipay_hk">("stripe");
  const [showUpgradeAlipayQR, setShowUpgradeAlipayQR] = useState(false);
  const [upgradeAlipayProofFile, setUpgradeAlipayProofFile] = useState<File | null>(null);
  const [upgradeAlipayProofPreview, setUpgradeAlipayProofPreview] = useState<string | null>(null);
  const [uploadingUpgradeProof, setUploadingUpgradeProof] = useState(false);
   const [upgradeProofSubmittedLocal, setUpgradeProofSubmittedLocal] = useState(false);
  const submissionId = parseInt(params.id ?? "0", 10);
  const utils = trpc.useUtils();
  const { data: submission, isLoading, refetch: refetchSubmission } = trpc.grading.getSubmissionDetail.useQuery(
    { id: submissionId },
    { enabled: submissionId > 0 }
  );
  // Derive from backend: if upgrade is pending AND alipayProofStatus is pending_review, proof was already submitted
  // This persists across page refreshes unlike the local state alone
  const upgradeProofSubmitted = upgradeProofSubmittedLocal || (
    !!(submission as any)?.upgradeCheckoutSessionId &&
    !(submission as any)?.upgradePaidAt &&
    (submission as any)?.alipayProofStatus === "pending_review"
  );

  // Poll for AI verification result after upgrade proof is submitted
  const [aiPollingActive, setAiPollingActive] = useState(false);
  useEffect(() => {
    if (!upgradeProofSubmitted || !aiPollingActive) return;
    // Already have result, stop polling
    if ((submission as any)?.alipayProofAiResult) {
      setAiPollingActive(false);
      return;
    }
    const timer = setInterval(() => {
      refetchSubmission();
    }, 3000);
    // Stop polling after 60s
    const timeout = setTimeout(() => {
      clearInterval(timer);
      setAiPollingActive(false);
    }, 60000);
    return () => { clearInterval(timer); clearTimeout(timeout); };
  }, [upgradeProofSubmitted, aiPollingActive, (submission as any)?.alipayProofAiResult, refetchSubmission]);

  // Poll for AI verification result after initial alipay proof is submitted
  const [alipayAiPollingActive, setAlipayAiPollingActive] = useState(false);
  useEffect(() => {
    if (!alipayAiPollingActive) return;
    // Already have result, stop polling
    if ((submission as any)?.alipayProofAiResult) {
      setAlipayAiPollingActive(false);
      return;
    }
    const timer = setInterval(() => {
      refetchSubmission();
    }, 3000);
    // Stop polling after 90s
    const timeout = setTimeout(() => {
      clearInterval(timer);
      setAlipayAiPollingActive(false);
    }, 90000);
    return () => { clearInterval(timer); clearTimeout(timeout); };
  }, [alipayAiPollingActive, (submission as any)?.alipayProofAiResult, refetchSubmission]);

  const { data: qrData } = trpc.grading.getSubmissionQrCode.useQuery(
    { submissionId },
    { enabled: submissionId > 0 }
  );

  const submitAlipayProofMutation = trpc.grading.submitGradingAlipayProof.useMutation({
    onSuccess: () => {
      setUploadingProof(false);
      setProofSubmitted(true);
      toast.success(t("grading.screenshotSubmitted"));
      // Refetch to update status to pending_shipment, then start AI polling
      refetchSubmission();
      setAlipayAiPollingActive(true);
    },
    onError: (err: any) => {
      setUploadingProof(false);
      toast.error(`${t("grading.submitFailed")}：${err.message}`);
    },
  });

  const cancelSubmissionMutation = trpc.grading.cancelSubmission.useMutation({
    onSuccess: () => {
      toast.success(t("grading.applicationCancelled"));
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
      setCancelConfirm(false);
    },
    onError: (err: any) => {
      toast.error(`${t("grading.cancelFailed")}：${err.message}`);
      setCancelConfirm(false);
    },
  });

  const verifyAlipayProofMutation = trpc.grading.verifyAlipayProofWithAI.useMutation({
    onSuccess: (result) => {
      setAiVerifying(false);
      setAiVerifyResult(result as any);
    },
    onError: (err: any) => {
      setAiVerifying(false);
      toast.error(`${t("grading.aiVerifyFailed")}：${err.message}`);
    },
  });

  const handleAlipayProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAlipayProofFile(file);
    setAiVerifyResult(null); // Reset AI result when new file selected
    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => URL.revokeObjectURL(previewUrl);
    setAlipayProofPreview(previewUrl);
    // Auto-trigger AI verification with compressed image
    setAiVerifying(true);
    compressImageToBase64(file).then(({ base64, mimeType }) => {
      verifyAlipayProofMutation.mutate({ submissionId, proofImageBase64: base64, mimeType });
    }).catch(() => setAiVerifying(false));
  };

  const handleSubmitAlipayProof = async () => {
    if (!alipayProofFile) return;
    setUploadingProof(true);
    try {
      const { base64, mimeType } = await compressImageToBase64(alipayProofFile);
      submitAlipayProofMutation.mutate({
        submissionId,
        proofImageBase64: base64,
        mimeType,
      });
    } catch {
      setUploadingProof(false);
      toast.error(t("grading.imageCompressFailed"));
    }
  };

  // ── Resubmit Alipay proof after rejection ──────────────────────────────────
  const [resubmitProofFile, setResubmitProofFile] = useState<File | null>(null);
  const [resubmitProofPreview, setResubmitProofPreview] = useState<string | null>(null);
  const [uploadingResubmit, setUploadingResubmit] = useState(false);
  const [resubmitAiVerifying, setResubmitAiVerifying] = useState(false);
  const [resubmitAiResult, setResubmitAiResult] = useState<{ result: string; confidence: string; summary: string } | null>(null);

  const resubmitAlipayProofMutation = trpc.grading.resubmitGradingAlipayProof.useMutation({
    onSuccess: () => {
      setUploadingResubmit(false);
      toast.success(t("grading.screenshotResubmitted"));
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
      setResubmitProofFile(null);
      setResubmitProofPreview(null);
      setResubmitAiResult(null);
    },
    onError: (err: any) => {
      setUploadingResubmit(false);
      toast.error(`${t("grading.resubmitFailed")}：${err.message}`);
    },
  });

  const handleResubmitProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResubmitProofFile(file);
    setResubmitAiResult(null);
    setResubmitProofPreview(URL.createObjectURL(file));
    setResubmitAiVerifying(true);
    compressImageToBase64(file).then(({ base64, mimeType }) => {
      verifyAlipayProofMutation.mutate(
        { submissionId, proofImageBase64: base64, mimeType },
        {
          onSuccess: (r: any) => { setResubmitAiVerifying(false); setResubmitAiResult(r); },
          onError: () => { setResubmitAiVerifying(false); },
        }
      );
    }).catch(() => setResubmitAiVerifying(false));
  };

  const handleResubmitAlipayProof = async () => {
    if (!resubmitProofFile) return;
    setUploadingResubmit(true);
    try {
      const { base64, mimeType } = await compressImageToBase64(resubmitProofFile);
      resubmitAlipayProofMutation.mutate({
        submissionId,
        proofImageBase64: base64,
        mimeType,
      });
    } catch {
      setUploadingResubmit(false);
      toast.error(t("grading.imageCompressFailed"));
    }
  };

  // ── Submit SF Express tracking number ─────────────────────────────────────
  const [trackingInput, setTrackingInput] = useState("");
  const [trackingSubmitting, setTrackingSubmitting] = useState(false);

  const submitTrackingMutation = trpc.grading.submitTrackingNumber.useMutation({
    onSuccess: () => {
      setTrackingSubmitting(false);
      toast.success(t("grading.trackingSubmitted"));
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
      setTrackingInput("");
    },
    onError: (err: any) => {
      setTrackingSubmitting(false);
      toast.error(`${t("grading.submitFailed")}：${err.message}`);
    },
  });

  const createPaymentMutation = trpc.grading.createPaymentIntent.useMutation({
    onSuccess: (data: any) => {
      setPayingLoading(false);
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success(t("grading.redirectingToPayment"));
      }
    },
    onError: (err: any) => {
      setPayingLoading(false);
      toast.error(`${t("grading.paymentFailed")}：${err.message}`);
    },
  });

  const reopenUpgradeCheckoutMutation = trpc.grading.reopenUpgradeCheckout.useMutation({
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success(t("grading.redirectingToSurcharge"));
      }
    },
    onError: (err: any) => {
      toast.error(`${t("grading.repayFailed")}：${err.message}`);
    },
  });

  // Auto-invalidate when returning from upgrade payment success
  useEffect(() => {
    if (isUpgradePaymentSuccess && submissionId > 0) {
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
    }
  }, [isUpgradePaymentSuccess, submissionId]);

  const handlePrint = () => {
    if (!submission) return;
    const totalFee = parseFloat(submission.totalFeeHkd).toLocaleString();
    const tierName = (submission as any).items?.[0]?.tier?.name ?? '—';
    const tierFee = (submission as any).items?.[0]?.tier ? parseFloat((submission as any).items[0].tier.feeHkd).toLocaleString() : '—';
    const userName = (submission as any).user?.name ?? '—';
    const userId = (submission as any).userId ?? (submission as any).user?.id ?? '—';
    const orderDate = new Date(submission.createdAt).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
    const qrCodeHtml = qrData?.qrDataUrl
      ? `<div style="text-align:center;margin-top:4px"><img src="${qrData.qrDataUrl}" alt="QR Code" style="width:80px;height:80px" /><div style="color:#b0b8e8;font-size:9px;margin-top:2px">${t("grading.scanForDetails")}</div></div>`
      : '';
    const itemsHtml = (submission as any).items.map((item: any, idx: number) => `
      <tr style="border-bottom:1px solid #e5e7eb;background:${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}">
        <td style="padding:10px 12px;color:#6b7280;text-align:center">${idx + 1}</td>
        <td style="padding:10px 12px;font-weight:600;color:#111827;word-break:break-word">${item.cardName}</td>
        <td style="padding:10px 12px;color:#6b7280;font-size:11px">${[item.cardSet, item.cardNumber].filter(Boolean).join(' / ') || '—'}</td>
        <td style="padding:10px 12px;text-align:center"><span style="background:#eef0ff;color:#06038d;padding:2px 8px;border-radius:4px;font-weight:600;font-size:11px;white-space:nowrap">${item.tier?.name ?? '—'}</span></td>
        <td style="padding:10px 12px;text-align:right;font-weight:600;color:#111827">HK$${item.tier ? parseFloat(item.tier.feeHkd).toLocaleString() : '—'}</td>
      </tr>
    `).join('');
    const returnAddr = (submission as any).returnAddress;
    const returnAddrHtml = returnAddr
      ? `<div style="font-size:11px;line-height:1.7">
          <div><span style="color:#6b7280">${t("grading.recipient")}：</span><span style="font-weight:600">${returnAddr.recipientName || ''}</span></div>
          <div><span style="color:#6b7280">${t("grading.phone")}：</span><span style="font-weight:600">${returnAddr.phone || ''}</span></div>
          ${returnAddr.sfStationName ? `<div><span style="color:#6b7280">${t("grading.sfStation")}：</span><span style="font-weight:600">${returnAddr.sfStationName} (${returnAddr.sfStationCode})</span></div>` : ''}
          <div><span style="color:#6b7280">${t("grading.address")}：</span><span style="font-weight:600">${[returnAddr.district, returnAddr.region, returnAddr.address].filter(Boolean).join(' ')}</span></div>
        </div>`
      : `<div style="font-size:11px;color:#9ca3af;font-style:italic">${t("grading.noReturnAddress")}</div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t("grading.applicationSlip")} ${submission.orderNo}</title>
    <style>body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;background:#fff}@page{margin:10mm;size:A4}*{box-sizing:border-box}</style>
    </head><body>
    <div style="background:#06038d;padding:16px 28px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:16px">
        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo_62cbf293.webp" alt="BOXIUM" style="height:52px;width:auto;object-fit:contain;border-radius:6px" />
        <div>
          <div style="color:#fff;font-weight:700;font-size:16px">${t("grading.psaApplicationTitle")}</div>
          <div style="color:#b0b8e8;font-size:11px;margin-top:2px">${t("grading.printAndSendNote")}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:16px">
        ${qrCodeHtml}
        <div style="text-align:right">
          <div style="color:#FEDD00;font-weight:700;font-size:14px;font-family:monospace">${submission.orderNo}</div>
          <div style="color:#b0b8e8;font-size:11px;margin-top:3px">${orderDate}</div>
        </div>
      </div>
    </div>
    <div style="padding:20px 28px">
      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;background:#f8faff">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-transform:uppercase">${t("grading.applicant")}</div>
          <div style="font-weight:700;font-size:14px;color:#06038d">${userName}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${t("grading.userId")}#${userId}</div>
        </div>
        <div style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;background:#f8faff">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-transform:uppercase">{t('grading.detail.tier')}</div>
          <div style="font-weight:700;font-size:14px;color:#06038d">${tierName}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">HK$${tierFee} / ${t("grading.perCard")} · ${t("grading.totalCards", { count: (submission as any).items.length })}</div>
        </div>
        <div style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;background:#f8faff">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-transform:uppercase">{t('grading.detail.orderNo')}</div>
          <div style="font-weight:700;font-size:14px;color:#06038d;font-family:monospace">${submission.orderNo}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${t("grading.totalCards", { count: (submission as any).items.length })}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;border:1.5px solid #06038d;border-radius:8px;padding:12px 14px;background:#f0f2ff">
          <div style="font-weight:700;font-size:12px;color:#06038d;margin-bottom:8px">📦 ${t("grading.sendToBoxiumAddress")}</div>
          <div style="font-size:11px;line-height:1.7">
            <div><span style="color:#6b7280">${t("grading.recipient")}：</span><span style="font-weight:600">BOXIUM</span></div>
            <div><span style="color:#6b7280">${t("grading.phone")}：</span><span style="font-weight:600">55090102</span></div>
            <div><span style="color:#6b7280">${t("grading.method")}：</span><span style="font-weight:600">SF Station 852Z351</span></div>
            <div><span style="color:#6b7280">${t("grading.address")}：</span><span style="font-weight:600">${t("grading.boxiumAddress")}</span></div>
          </div>
          <div style="margin-top:8px;padding:5px 8px;background:#fff3cd;border-radius:4px;font-size:10px;font-weight:600;color:#92400e">${t("grading.sendWithSlip")}</div>
        </div>
        <div style="flex:1;border:1.5px solid #16a34a;border-radius:8px;padding:12px 14px;background:#f0fdf4">
          <div style="font-weight:700;font-size:12px;color:#16a34a;margin-bottom:8px">🏠 ${t("grading.returnAddress")}</div>
          ${returnAddrHtml}
        </div>
      </div>
      <div style="border:1px solid #d1d5db;border-radius:8px;overflow:hidden;margin-bottom:16px">
        <div style="background:#06038d;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:white;font-weight:700;font-size:13px">${t('grading.detail.cardList')}</span>
          <span style="color:#FEDD00;font-weight:600;font-size:12px">${t("grading.totalCards", { count: (submission as any).items.length })}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#eef0ff;border-bottom:1px solid #c7d2fe">
            <th style="padding:8px 12px;text-align:left;width:28px;color:#374151;font-weight:600">#</th>
            <th style="padding:8px 12px;text-align:left;color:#374151;font-weight:600">${t("grading.cardName")}</th>
            <th style="padding:8px 12px;text-align:left;width:100px;color:#374151;font-weight:600">${t("grading.setNumber")}</th>
            <th style="padding:8px 12px;text-align:center;width:80px;color:#374151;font-weight:600">${t('grading.detail.tier')}</th>
            <th style="padding:8px 12px;text-align:right;width:70px;color:#374151;font-weight:600">${t("grading.fee")}</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot><tr style="border-top:2px solid #06038d;background:#f0f2ff">
            <td colspan="4" style="padding:10px 12px;text-align:right;font-weight:700;color:#06038d;font-size:13px">${t("grading.totalFeePrepaid")}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#06038d;font-size:14px">HK$${totalFee}</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="border:1px solid #d1d5db;border-radius:8px;padding:14px 16px;font-size:12px">
        <div style="font-weight:700;color:#06038d;margin-bottom:8px;font-size:13px">${t("grading.importantNotes")}</div>
        <ol style="padding-left:16px;margin:0;line-height:1.8;color:#374151">
          <li>${t("grading.noteTracking")}</li>
          <li>${t("grading.notePackaging")}</li>
          <li>${t("grading.notePrepaid")}</li>
          <li>${t("grading.noteContact")}</li>
        </ol>
      </div>
      <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between">
        <div style="font-size:10px;color:#9ca3af">${t("grading.footerService")}</div>
        <div style="font-size:10px;color:#9ca3af">${t("grading.footerAutoGenerated")}</div>
      </div>
    </div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handlePay = () => {
    if (paymentMethod === "alipay_hk") {
      setShowAlipayQR(true);
      return;
    }
    setPayingLoading(true);
    createPaymentMutation.mutate({
      submissionId,
      paymentMethod,
      origin: window.location.origin,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#06038d]" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t("grading.notFound")}</h2>
          <Button variant="outline" onClick={() => navigate("/grading/orders")}>
            {t("grading.backToMyApplications")}
          </Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(submission.status);
  const isCancelled = submission.status === "cancelled";
  // awaiting_payment: 申請已建立，等待付款（Stripe 或 AlipayHK 截圖尚未提交）
  const isAwaitingPayment = submission.status === "awaiting_payment";
  // pending_review: AlipayHK 截圖已提交，等待管理員審核（新主狀態）
  const isAlipayPendingReview = submission.status === "pending_review";
  // awaiting_payment 且 AlipayHK 截圖被拒絕（需重新上傳）
  const isAlipayRejected = submission.status === "awaiting_payment" && (submission as any).alipayProofStatus === "rejected";
  // 付款已確認（Stripe 付款成功 或 AlipayHK 截圖已批准 → pending_shipment）
  const isPaymentConfirmed = submission.status === "pending_shipment" && !isAlipayRejected;
  const isGraded = submission.status === "graded";
  const isCompleted = submission.status === "completed" || submission.status === "returned";

  return (
    <>
      {/* Printable slip (hidden on screen) */}
      <PrintableSlip submission={submission} />

      {/* Screen view */}
      <div className="min-h-screen bg-gray-50 py-8 px-4 print:hidden">
        <div className="max-w-2xl mx-auto">
          {/* Back + Print */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate("/grading/orders")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">{t("grading.backToMyApplications")}</span>
            </button>
{(isPaymentConfirmed || isGraded || isCompleted || submission.status === "received" || submission.status === "submitted_to_psa" || submission.status === "grading" || submission.status === "graded") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[#06038d] text-[#06038d] hover:bg-blue-50"
            >
              <Printer className="h-4 w-4 mr-2" />
              {t("grading.printSlip")}
            </Button>
            )}
          </div>

          {/* ── Upgrade Payment Success Banner ── */}
          {isUpgradePaymentSuccess && !isCancelled && (
            <div className="bg-green-50 border-2 border-green-400 rounded-xl p-5 mb-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-800 text-base">{t("grading.upgradeSurchargeSuccess")}</p>
                  <p className="text-sm text-green-600">{t("grading.orderNo")}：<span className="font-mono font-bold">{submission.orderNo}</span></p>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-4">
                <p className="text-sm font-bold text-gray-800 mb-2">{t("grading.surchargeSummary")}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">{t("grading.newTier")}：</span>
                    <span className="font-semibold text-gray-800">{(submission as any).upgradeNewTierName ?? t("grading.upgraded")}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("grading.surchargeDiff")}：</span>
                    <span className="font-bold text-green-700">HK${parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("grading.newTotalFee")}：</span>
                    <span className="font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("grading.cardCount")}：</span>
                    <span className="font-semibold text-gray-800">{t("grading.cardCountValue", { count: submission.items.length })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment Success Banner ── */}
          {isPaymentSuccess && !isCancelled && (
            <div className="bg-green-50 border-2 border-green-400 rounded-xl p-5 mb-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <PartyPopper className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-800 text-base">{t("grading.paymentSuccess")}</p>
                  <p className="text-sm text-green-600">{t("grading.orderNo")}：<span className="font-mono font-bold">{submission.orderNo}</span></p>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-4 mb-3">
                <p className="text-sm font-bold text-gray-800 mb-2">{t("grading.applicationSummary")}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">{t("grading.cardCount")}：</span>
                    <span className="font-semibold text-gray-800">{t("grading.cardCountValue", { count: submission.items.length })}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("grading.serviceTier")}：</span>
                    <span className="font-semibold text-gray-800">{(submission as any).items?.[0]?.tier?.name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("grading.amountPaid")}：</span>
                    <span className="font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t("grading.applicationDate")}：</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(submission.createdAt).toLocaleDateString("zh-HK")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-bold text-amber-800 mb-1">📦 {t("grading.nextStepSendCards")}</p>
                <p className="text-xs text-amber-700 mb-1">{t("grading.printAndSendTo")}</p>
                <p className="text-xs font-semibold text-amber-800">SF Station 852Z351 · BOXIUM · 55090102</p>
                <p className="text-xs text-amber-700">{t("grading.boxiumAddressFull")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100 h-7 text-xs"
                  onClick={handlePrint}
                >
                  <Printer className="h-3 w-3 mr-1.5" />
                  {t("grading.printSlipNow")}
                </Button>
              </div>
            </div>
          )}

          {/* Order header */}
          <div className="bg-[#06038d] text-white rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 text-xs mb-1">{t("grading.applicationNo")}</p>
                <p className="font-bold text-lg font-mono">{submission.orderNo}</p>
                <p className="text-blue-200 text-xs mt-1">
                  {new Date(submission.createdAt).toLocaleDateString("zh-HK", {
                    year: "numeric", month: "long", day: "numeric"
                  })}
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                isCancelled ? "bg-red-500 text-white" : isCompleted ? "bg-green-500 text-white" : isAwaitingPayment ? "bg-yellow-300 text-gray-900" : isAlipayRejected ? "bg-red-500 text-white" : isAlipayPendingReview ? "bg-blue-500 text-white" : "bg-yellow-400 text-[#06038d]"
              }`}>
                {isAlipayRejected ? t("grading.screenshotRejected") : isAlipayPendingReview ? t("grading.screenshotPendingReview") : (STATUS_LABEL[submission.status] ?? submission.status)}
              </span>
            </div>
          </div>

          {/* Awaiting payment notice */}
          {isAwaitingPayment && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-bold text-green-800">{t("grading.applicationCreatedPayNow")}</p>
              </div>
              <p className="text-sm text-green-700 mb-4">{t("grading.paymentConfirmNote")}</p>

              {/* Payment method selection */}
              {!showAlipayQR && !proofSubmitted && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-black mb-2">{t("grading.selectPaymentMethod")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Stripe / Credit Card */}
                      <label
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          paymentMethod === "stripe" ? "border-[#06038d] bg-blue-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          value="stripe"
                          checked={paymentMethod === "stripe"}
                          onChange={() => setPaymentMethod("stripe")}
                          className="accent-[#06038d]"
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <svg height="16" viewBox="0 0 1000 324" xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
                              <rect width="1000" height="324" rx="40" fill="#1A1F71"/>
                              <text x="500" y="240" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="220" fill="white" textAnchor="middle">VISA</text>
                            </svg>
                            <svg height="16" viewBox="0 0 152 96" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
                              <rect width="152" height="96" rx="8" fill="#252525"/>
                              <circle cx="58" cy="48" r="30" fill="#EB001B"/>
                              <circle cx="94" cy="48" r="30" fill="#F79E1B"/>
                              <path d="M76 24.5a30 30 0 0 1 0 47 30 30 0 0 1 0-47z" fill="#FF5F00"/>
                            </svg>
                          </div>
                          <span className="text-xs font-semibold text-black">{t("grading.creditDebitCard")}</span>
                        </div>
                      </label>
                      {/* Alipay HK */}
                      <label
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          paymentMethod === "alipay_hk" ? "border-[#06038d] bg-blue-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          value="alipay_hk"
                          checked={paymentMethod === "alipay_hk"}
                          onChange={() => setPaymentMethod("alipay_hk")}
                          className="accent-[#06038d]"
                        />
                        <div className="flex flex-col gap-1">
                          <img
                            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png"
                            alt="AlipayHK"
                            className="h-6 object-contain"
                          />
                          <span className="text-xs font-semibold text-black">{t("grading.alipayHK")}</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm text-black">{t("grading.amountDue")}</p>
                      <p className="text-2xl font-bold text-[#06038d]">
                        HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={handlePay}
                      disabled={payingLoading}
                      className="bg-[#06038d] hover:bg-[#06038d]/90 text-white px-6"
                    >
                      {payingLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('common.processing')}</>
                      ) : (
                        <><CreditCard className="h-4 w-4 mr-2" />{t('grading.detail.payNow')}</>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* Alipay QR Code flow - new version with AI verification */}
              {showAlipayQR && !proofSubmitted && (
                <div className="space-y-4">
                  <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png"
                        alt="AlipayHK"
                        className="h-7 object-contain"
                      />
                      <span className="font-bold text-black text-sm">{t("grading.scanAlipayQR")}</span>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://w.alipay.hk/s12/3RYKWzGXrQ")}`}
                      alt="Alipay HK QR Code"
                      className="w-44 h-44 mx-auto rounded-xl border-4 border-white shadow-lg object-contain"
                    />
                    <p className="text-xs text-gray-500 mt-2">{t("grading.orClickLinkToPay")}</p>
                    <a
                      href="https://w.alipay.hk/s12/3RYKWzGXrQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#06038d] underline font-semibold"
                    >
                      https://w.alipay.hk/s12/3RYKWzGXrQ
                    </a>
                    <div className="mt-3 bg-blue-50 rounded-lg p-3 text-left">
                      <p className="text-xs font-bold text-black mb-1">{t("grading.paymentAmount")}</p>
                      <p className="text-xl font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{t("grading.remarkFillOrderNo", { orderNo: submission.orderNo })}</p>
                    </div>
                  </div>

                  {/* Upload proof */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-black">{t('grading.detail.uploadScreenshot')}</p>
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                        <Bot className="h-3 w-3 text-[#06038d]" />
                        <span className="text-xs text-[#06038d] font-semibold">{t("grading.aiAutoVerify")}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{t("grading.uploadAlipayScreenshot")}</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlipayProofChange}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90 cursor-pointer"
                    />
                    {alipayProofPreview && (
                      <img src={alipayProofPreview} alt={t("grading.screenshotPreview")} className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />
                    )}

                    {/* AI Verification Status */}
                    {aiVerifying && (
                      <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <Loader2 className="h-4 w-4 text-[#06038d] animate-spin flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#06038d]">{t("grading.aiVerifying")}</p>
                          <p className="text-xs text-blue-600">{t("grading.aiAnalyzing")}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Verification Result */}
                    {!aiVerifying && aiVerifyResult && (
                      <div className={`mt-3 rounded-lg p-3 border ${
                        aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low'
                          ? 'bg-green-50 border-green-300'
                          : aiVerifyResult.isValid
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-red-50 border-red-300'
                      }`}>
                        <div className="flex items-start gap-2">
                          {aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? (
                            <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : aiVerifyResult.isValid ? (
                            <ShieldQuestion className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold mb-1 ${
                              aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? 'text-green-800' :
                              aiVerifyResult.isValid ? 'text-yellow-800' : 'text-red-800'
                            }`}>
                              {aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? t("grading.aiVerifyPassed") :
                               aiVerifyResult.isValid ? t("grading.aiVerifyWarning") : t("grading.aiVerifyFailed2")}
                              <span className="font-normal ml-1 opacity-70">({t("grading.confidence")}: {aiVerifyResult.confidence === 'high' ? '高' : aiVerifyResult.confidence === 'medium' ? '中' : '低'})</span>
                            </p>
                            <p className={`text-xs mb-2 ${
                              aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? 'text-green-700' :
                              aiVerifyResult.isValid ? 'text-yellow-700' : 'text-red-700'
                            }`}>{aiVerifyResult.summary}</p>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              {aiVerifyResult.detectedAmount !== null && (
                                <div className={`flex items-center gap-1 ${
                                  aiVerifyResult.amountMatch ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {aiVerifyResult.amountMatch ? '✔' : '✖'}
                                  <span>{t("grading.amount")}: HK${aiVerifyResult.detectedAmount}</span>
                                </div>
                              )}
                              {aiVerifyResult.detectedOrderNo !== null && (
                                <div className={`flex items-center gap-1 ${
                                  aiVerifyResult.orderNoMatch ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {aiVerifyResult.orderNoMatch ? '✔' : '✖'}
                                  <span>{t("grading.orderNoLabel")}: {aiVerifyResult.detectedOrderNo}</span>
                                </div>
                              )}
                            </div>
                            {aiVerifyResult.issues.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {aiVerifyResult.issues.map((issue, i) => (
                                  <li key={i} className="text-xs text-red-700">• {issue}</li>
                                ))}
                              </ul>
                            )}
                            {!aiVerifyResult.isValid && (
                              <p className="text-xs text-gray-500 mt-1.5">{t("grading.canStillSubmitForManualReview")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-3 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowAlipayQR(false); setAlipayProofFile(null); setAlipayProofPreview(null); setAiVerifyResult(null); }}
                        className="w-full border-gray-300 text-black text-xs h-9"
                      >
                        {t("common.back")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!alipayProofFile || !submission?.id) return;
                          setAiVerifyResult(null);
                          setAiVerifying(true);
                          try {
                            const { base64, mimeType } = await compressImageToBase64(alipayProofFile);
                            verifyAlipayProofMutation.mutate({
                              submissionId: submission.id,
                              proofImageBase64: base64,
                              mimeType,
                            });
                          } catch {
                            setAiVerifying(false);
                          }
                        }}
                        disabled={!alipayProofFile || aiVerifying}
                        className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs h-9"
                      >
                        {t("grading.reVerify")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitAlipayProof}
                        disabled={!alipayProofFile || uploadingProof || aiVerifying}
                        className="w-full bg-[#06038d] hover:bg-[#06038d]/90 text-white text-xs h-9"
                      >
                        {uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("common.uploading")}</> : t("grading.submitScreenshot")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {proofSubmitted && (
                <div className="bg-green-50 border border-green-300 rounded-xl p-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800 mb-1">{t("grading.screenshotSubmittedSuccess")}</p>
                  <p className="text-sm text-green-700">{t("grading.adminWillConfirm")}</p>
                </div>
              )}

              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-green-200">
                {!cancelConfirm ? (
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => setCancelConfirm(true)}>
                    <XCircle className="h-3 w-3 mr-1.5" />{t("grading.cancelApplication")}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-semibold">{t("grading.confirmCancel")}</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3" disabled={cancelSubmissionMutation.isPending} onClick={() => cancelSubmissionMutation.mutate({ submissionId })}>
                      {cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("grading.confirmCancelBtn")}
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 h-7 text-xs px-3" onClick={() => setCancelConfirm(false)}>{t('common.back')}</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AlipayHK proof pending review - payment submitted but not yet confirmed */}
          {isAlipayPendingReview && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <p className="font-bold text-blue-800">{t("grading.alipayScreenshotPending")}</p>
              </div>
              <p className="text-sm text-blue-700 mb-4">{t("grading.adminConfirmWithin24h")}</p>
              {/* Show proof image if available */}
              {(submission as any)?.alipayProofImageUrl && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-blue-800 mb-2">{t("grading.submittedScreenshot")}：</p>
                  <img
                    src={(submission as any).alipayProofImageUrl}
                    alt={t("grading.paymentScreenshot")}
                    className="max-h-48 rounded-lg border border-blue-200 mx-auto block object-contain"
                  />
                </div>
              )}
              {/* AI verification result */}
              <div className="mt-2">
                {(submission as any)?.alipayProofAiResult ? (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    (submission as any).alipayProofAiResult === 'pass'
                      ? 'bg-green-100 text-green-800'
                      : (submission as any).alipayProofAiResult === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <span>{(submission as any).alipayProofAiResult === 'pass' ? '✅' : (submission as any).alipayProofAiResult === 'warning' ? '⚠️' : '❌'}</span>
                    <span>
                      {(submission as any).alipayProofAiResult === 'pass'
                        ? t("grading.aiPassedWaitAdmin")
                        : (submission as any).alipayProofAiResult === 'warning'
                        ? t("grading.aiWarningManualReview")
                        : t("grading.aiFailedCheckScreenshot")}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{t("grading.aiVerifyingWait")}</span>
                  </div>
                )}
              </div>
              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-blue-200">
                {!cancelConfirm ? (
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => setCancelConfirm(true)}>
                    <XCircle className="h-3 w-3 mr-1.5" />{t("grading.cancelApplication")}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-semibold">{t("grading.confirmCancel")}</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3" disabled={cancelSubmissionMutation.isPending} onClick={() => cancelSubmissionMutation.mutate({ submissionId })}>
                      {cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("grading.confirmCancelBtn")}
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 h-7 text-xs px-3" onClick={() => setCancelConfirm(false)}>{t('common.back')}</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alipay proof rejected - resubmit UI */}
          {isAlipayRejected && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <XCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-bold text-red-800">{t("grading.screenshotRejectedReupload")}</p>
                  <p className="text-xs text-red-600">{t("grading.adminNotConfirmedProof")}</p>
                </div>
              </div>
              {/* Rejection reason */}
              {(submission as any).alipayProofRejectionReason && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-red-800 mb-1">{t("grading.rejectionReason")}：</p>
                  <p className="text-sm text-red-700">{(submission as any).alipayProofRejectionReason}</p>
                </div>
              )}
              {/* Previous rejected proof */}
              {(submission as any).alipayProofImageUrl && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-red-800 mb-2">{t("grading.rejectedScreenshot")}：</p>
                  <img
                    src={(submission as any).alipayProofImageUrl}
                    alt={t("grading.rejectedScreenshot")}
                    className="max-h-40 rounded-lg border-2 border-red-300 mx-auto block object-contain opacity-60"
                  />
                </div>
              )}
              {/* Resubmit section */}
              <div className="border-t border-red-200 pt-4">
                <p className="text-sm font-bold text-red-800 mb-3">{t("grading.reuploadPaymentScreenshot")}</p>
                <label className="block w-full border-2 border-dashed border-red-300 rounded-lg p-4 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-all mb-3">
                  <input type="file" accept="image/*" className="sr-only" onChange={handleResubmitProofChange} />
                  {resubmitProofPreview ? (
                    <img src={resubmitProofPreview} alt={t("grading.newScreenshot")} className="max-h-40 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <Printer className="h-5 w-5 text-red-500" />
                      </div>
                      <p className="text-sm font-semibold text-red-700">{t("grading.clickToSelectNewScreenshot")}</p>
                      <p className="text-xs text-red-500">{t("grading.supportedFormats")}</p>
                    </div>
                  )}
                </label>
                {/* AI verification result for resubmit */}
                {resubmitProofFile && (
                  <div className="mb-3">
                    {resubmitAiVerifying ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{t("grading.aiVerifyingWait")}</span>
                      </div>
                    ) : resubmitAiResult ? (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        resubmitAiResult.result === 'pass' ? 'bg-green-100 text-green-800' :
                        resubmitAiResult.result === 'warning' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        <span>{resubmitAiResult.result === 'pass' ? '✅' : resubmitAiResult.result === 'warning' ? '⚠️' : '❌'}</span>
                        <span>{resubmitAiResult.result === 'pass' ? t("grading.aiVerifyPassed") : resubmitAiResult.result === 'warning' ? 'AI 核對有警告' : 'AI 核對未通過'}</span>
                      </div>
                    ) : null}
                  </div>
                )}
                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  disabled={!resubmitProofFile || uploadingResubmit || resubmitAiVerifying}
                  onClick={handleResubmitAlipayProof}
                >
                  {uploadingResubmit ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.submitting")}</>
                  ) : (
                    <>{t("grading.resubmitScreenshot")}</>
                  )}
                </Button>
              </div>
              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-red-200">
                {!cancelConfirm ? (
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => setCancelConfirm(true)}>
                    <XCircle className="h-3 w-3 mr-1.5" />{t("grading.cancelApplication")}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-semibold">{t("grading.confirmCancel")}</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3" disabled={cancelSubmissionMutation.isPending} onClick={() => cancelSubmissionMutation.mutate({ submissionId })}>
                      {cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("grading.confirmCancelBtn")}
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 h-7 text-xs px-3" onClick={() => setCancelConfirm(false)}>{t('common.back')}</Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Progress stepper */}
          {!isCancelled && !isAwaitingPayment && !isAlipayPendingReview && !isAlipayRejected && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">{t('grading.detail.progress')}</h3>
              <div className="flex items-start">
                {STATUS_STEPS.map((step, idx) => {
                  const done = currentStepIdx > idx;
                  const active = currentStepIdx === idx;
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <div className="flex items-center w-full">
                        <div className={`flex-1 h-0.5 ${idx === 0 ? "invisible" : done || active ? "bg-[#06038d]" : "bg-gray-200"}`} />
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          done ? "bg-green-500" : active ? "bg-[#06038d] ring-4 ring-blue-100" : "bg-gray-200"
                        }`}>
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          ) : active ? (
                            <Clock className="h-3.5 w-3.5 text-white" />
                          ) : (
                            <span className="text-xs text-gray-400">{idx + 1}</span>
                          )}
                        </div>
                        <div className={`flex-1 h-0.5 ${idx === STATUS_STEPS.length - 1 ? "invisible" : done ? "bg-[#06038d]" : "bg-gray-200"}`} />
                      </div>
                      <p className={`text-xs mt-1.5 text-center leading-tight ${active ? "text-[#06038d] font-bold" : done ? "text-green-600" : "text-gray-400"}`}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shipping notice (before received) - only show when payment is confirmed */}
          {isPaymentConfirmed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-amber-800 mb-1">{t("grading.sendCardsToAddress")}</p>
                  <p className="text-sm text-amber-700 font-semibold">📦 SF Station 852Z351</p>
                  <p className="text-sm text-amber-700">{t("grading.boxiumAddressFull")}</p>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ {t("grading.printSlipWarning")}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100 h-8 text-xs"
                    onClick={handlePrint}
                  >
                    <Printer className="h-3 w-3 mr-1.5" />
                    {t("grading.printSlip")}
                  </Button>
                  {/* Tracking number section */}
                  <div className="mt-4 pt-3 border-t border-amber-200">
                    <p className="text-xs font-bold text-amber-800 mb-2">📦 {t("grading.submitTrackingAfterSend")}</p>
                    {(submission as any).trackingNumber ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-green-700">{t("grading.trackingSubmittedLabel")}</p>
                          <p className="text-sm font-bold text-green-800 font-mono">{(submission as any).trackingNumber}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          placeholder={t("grading.trackingPlaceholder")}
                          className="flex-1 text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-black"
                          disabled={trackingSubmitting}
                        />
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 h-10"
                          disabled={!trackingInput.trim() || trackingSubmitting}
                          onClick={() => {
                            setTrackingSubmitting(true);
                            submitTrackingMutation.mutate({ submissionId, trackingNumber: trackingInput });
                          }}
                        >
                          {trackingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.submit")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tracking number display when status is received */}
          {submission.status === "received" && (submission as any).trackingNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-blue-800 mb-1">{t("grading.trackingSubmittedWaiting")}</p>
                  <p className="text-sm text-blue-700 mb-2">{t("grading.autoUpdateReceived")}</p>
                  <div className="bg-white border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-600">{t("grading.sfTrackingNumber")}</p>
                    <p className="text-base font-bold text-blue-900 font-mono">{(submission as any).trackingNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Batch info */}
          {submission.batch && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-purple-800 text-sm mb-1">{t("grading.batchInfo")}</p>
              <div className="text-xs text-purple-700 space-y-0.5">
                <p>{t("grading.batchName")}：{(submission.batch as any).batchName ?? (submission.batch as any).name ?? t("common.unknown")}</p>
                {((submission.batch as any).shippedDate || (submission.batch as any).shippedAt) && (
                  <p>{t("grading.shippedDate")}：{new Date((submission.batch as any).shippedDate ?? (submission.batch as any).shippedAt).toLocaleDateString("zh-HK")}</p>
                )}
                {((submission.batch as any).expectedReturnDate || (submission.batch as any).estimatedReturnAt) && (
                  <p>{t("grading.expectedReturn")}：{new Date((submission.batch as any).expectedReturnDate ?? (submission.batch as any).estimatedReturnAt).toLocaleDateString("zh-HK")}</p>
                )}
              </div>
            </div>
          )}

          {/* Upgrade diff fee pending banner */}
          {(submission as any).upgradeCheckoutSessionId && !(submission as any).upgradePaidAt && (
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-4 mb-4">
              {!showUpgradeAlipayQR && !upgradeProofSubmitted && (
                <>
                  {/* Show rejection reason if upgrade proof was rejected */}
                  {(submission as any).alipayProofStatus === "rejected" && (submission as any).alipayProofRejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">{t("grading.screenshotRejectedReupload")}</p>
                        <p className="text-xs text-red-600 mt-0.5">{t("grading.rejectionReason")}：{(submission as any).alipayProofRejectionReason}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">⇑</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-orange-800 mb-1">{t("grading.upgradedPaySurcharge")}</p>
                      <p className="text-sm text-orange-700 mb-1">
                        {t("grading.upgradedToTier", { tier: (submission as any).upgradeNewTierName ?? t("grading.newTier") })}
                        {t("grading.surchargeDiffAmount", { amount: parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString() })}
                      </p>
                      <p className="text-xs text-orange-600">{t("grading.newTotalFee")}：HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Payment method selection */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-orange-800 mb-2">{t("grading.selectSurchargeMethod")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        upgradePayMethod === 'stripe' ? 'border-orange-400 bg-orange-100' : 'border-gray-200 bg-white'
                      }`}>
                        <input type="radio" className="sr-only" checked={upgradePayMethod === 'stripe'} onChange={() => setUpgradePayMethod('stripe')} />
                        <CreditCard className="h-4 w-4 text-orange-700" />
                        <span className="text-xs font-semibold text-orange-900">{t("grading.creditCardStripe")}</span>
                      </label>
                      <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        upgradePayMethod === 'alipay_hk' ? 'border-orange-400 bg-orange-100' : 'border-gray-200 bg-white'
                      }`}>
                        <input type="radio" className="sr-only" checked={upgradePayMethod === 'alipay_hk'} onChange={() => setUpgradePayMethod('alipay_hk')} />
                        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-4 object-contain" />
                        <span className="text-xs font-semibold text-orange-900">{t("grading.alipayHK")}</span>
                      </label>
                    </div>
                  </div>
                  {upgradePayMethod === 'stripe' ? (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white w-full"
                      onClick={() => {
                        reopenUpgradeCheckoutMutation.mutate({
                          submissionId,
                          origin: window.location.origin,
                        });
                      }}
                      disabled={reopenUpgradeCheckoutMutation.isPending}
                    >
                      {reopenUpgradeCheckoutMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('common.processing')}</>
                      ) : (
                        <><CreditCard className="h-4 w-4 mr-2" />{t("grading.creditCardSurcharge")}</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white w-full"
                      onClick={() => setShowUpgradeAlipayQR(true)}
                    >
                      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-4 object-contain mr-2" />
                      {t("grading.alipayHKSurcharge")}
                    </Button>
                  )}
                </>
              )}
              {/* Alipay QR for upgrade */}
              {showUpgradeAlipayQR && !upgradeProofSubmitted && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">⇑</span>
                    </div>
                    <p className="font-bold text-orange-800 text-sm">{t("grading.alipayHKSurchargeAmount", { amount: parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString() })}</p>
                  </div>
                  <div className="bg-white border border-orange-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-7 object-contain" />
                      <span className="font-bold text-gray-900">{t("grading.alipayHKPayment")}</span>
                    </div>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://w.alipay.hk/s12/3RYKWzGXrQ")}`} alt="AlipayHK QR" className="mx-auto rounded-lg border border-gray-200 mb-2" width={160} height={160} />
                    <a href="https://w.alipay.hk/s12/3RYKWzGXrQ" target="_blank" rel="noopener noreferrer" className="text-xs text-[#06038d] hover:underline block mb-1">https://w.alipay.hk/s12/3RYKWzGXrQ</a>
                    <p className="text-xs text-gray-500">{t("grading.scanQROrClickLink")}</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">{t('grading.detail.uploadScreenshot')}</p>
                    <p className="text-xs text-gray-500 mb-3">{t("grading.uploadScreenshotAfterPay")}</p>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUpgradeAlipayProofFile(f);
                        setUpgradeAlipayProofPreview(URL.createObjectURL(f));
                      }
                    }} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90" />
                    {upgradeAlipayProofPreview && <img src={upgradeAlipayProofPreview} alt={t("grading.screenshotPreview")} className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowUpgradeAlipayQR(false)} className="flex-1 text-black border-orange-300">{t('common.back')}</Button>
                    <Button
                      onClick={async () => {
                        if (!upgradeAlipayProofFile) return;
                        setUploadingUpgradeProof(true);
                        try {
                          const { base64, mimeType } = await compressImageToBase64(upgradeAlipayProofFile);
                          await submitAlipayProofMutation.mutateAsync({
                            submissionId,
                            proofImageBase64: base64,
                            mimeType,
                          });
                          setUpgradeProofSubmittedLocal(true);
                          setAiPollingActive(true);
                        } catch (e: any) {
                          toast.error(e.message || t("grading.submitFailed"));
                        } finally {
                          setUploadingUpgradeProof(false);
                        }
                      }}
                      disabled={!upgradeAlipayProofFile || uploadingUpgradeProof}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {uploadingUpgradeProof ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("common.uploading")}</> : t("grading.submitScreenshot")}
                    </Button>
                  </div>
                </div>
              )}
              {/* Upgrade proof submitted */}
              {upgradeProofSubmitted && (
                <div className="text-center py-2">
                  <CheckCircle2 className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="font-bold text-orange-800">{t("grading.surchargeScreenshotSubmitted")}</p>
                  <p className="text-sm text-orange-700 mt-1">{t("grading.adminConfirmSurchargeWithin24h")}</p>
                  {/* AI verification status */}
                  <div className="mt-3">
                    {(submission as any)?.alipayProofAiResult ? (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        (submission as any).alipayProofAiResult === 'pass'
                          ? 'bg-green-100 text-green-800'
                          : (submission as any).alipayProofAiResult === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <span>{(submission as any).alipayProofAiResult === 'pass' ? '✅' : (submission as any).alipayProofAiResult === 'warning' ? '⚠️' : '❌'}</span>
                        <span>
                          {(submission as any).alipayProofAiResult === 'pass'
                            ? t("grading.aiPassedWaitAdmin")
                            : (submission as any).alipayProofAiResult === 'warning'
                            ? t("grading.aiWarningManualReview")
                            : t("grading.aiFailedCheckScreenshot")}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{t("grading.aiVerifyingWait")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grading results + payment - only show if upgrade diff is NOT yet paid */}
          {isGraded && !((submission as any).upgradeCheckoutSessionId && !(submission as any).upgradePaidAt) && !(submission as any).upgradePaidAt && !(submission as any).paidAt && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-bold text-green-800">{t("grading.gradingCompletePayNow")}</p>
              </div>
              {/* PSA results per item */}
              <div className="space-y-2 mb-4">
                {submission.items.filter((i: any) => i.psaGrade).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
                    <span className="text-sm font-semibold text-gray-800">{item.cardName}</span>
                    <div className="flex items-center gap-2">
                      {item.psaGrade && (
                        <span className="bg-[#06038d] text-white text-xs font-bold px-2 py-0.5 rounded">
                          PSA {item.psaGrade}
                        </span>
                      )}
                      {item.psaCertNumber && (
                        <a
                          href={`https://www.psacard.com/cert/${item.psaCertNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#06038d] hover:underline flex items-center gap-0.5"
                        >
                          #{item.psaCertNumber}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment deadline */}
              {submission.paymentDeadline && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4 text-sm text-orange-700">
                  ⚠️ {t("grading.payBeforeDeadline", { date: new Date(submission.paymentDeadline).toLocaleDateString() })}對卡片自行處理之權利。
                </div>
              )}

              {/* Payment method */}
              {!showAlipayQR && !proofSubmitted && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-black mb-2">{t("grading.selectPaymentMethod")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Stripe / Credit Card */}
                      <label
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          paymentMethod === "stripe" ? "border-[#06038d] bg-blue-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          value="stripe"
                          checked={paymentMethod === "stripe"}
                          onChange={() => setPaymentMethod("stripe")}
                          className="accent-[#06038d]"
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            {/* Visa logo */}
                            <svg height="16" viewBox="0 0 1000 324" xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
                              <rect width="1000" height="324" rx="40" fill="#1A1F71"/>
                              <text x="500" y="240" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="220" fill="white" textAnchor="middle">VISA</text>
                            </svg>
                            {/* Mastercard logo */}
                            <svg height="16" viewBox="0 0 152 96" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
                              <rect width="152" height="96" rx="8" fill="#252525"/>
                              <circle cx="58" cy="48" r="30" fill="#EB001B"/>
                              <circle cx="94" cy="48" r="30" fill="#F79E1B"/>
                              <path d="M76 24.5a30 30 0 0 1 0 47 30 30 0 0 1 0-47z" fill="#FF5F00"/>
                            </svg>
                          </div>
                          <span className="text-xs font-semibold text-black">{t("grading.creditDebitCard")}</span>
                        </div>
                      </label>
                      {/* Alipay HK */}
                      <label
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          paymentMethod === "alipay_hk" ? "border-[#06038d] bg-blue-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          value="alipay_hk"
                          checked={paymentMethod === "alipay_hk"}
                          onChange={() => setPaymentMethod("alipay_hk")}
                          className="accent-[#06038d]"
                        />
                        <div className="flex flex-col gap-1">
                          <img
                            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png"
                            alt="AlipayHK"
                            className="h-6 object-contain"
                          />
                          <span className="text-xs font-semibold text-black">{t("grading.alipayHK")}</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm text-black">{t("grading.amountDue")}</p>
                      <p className="text-2xl font-bold text-[#06038d]">
                        HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={handlePay}
                      disabled={payingLoading}
                      className="bg-[#06038d] hover:bg-[#06038d]/90 text-white px-6"
                    >
                      {payingLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('common.processing')}</>
                      ) : (
                        <><CreditCard className="h-4 w-4 mr-2" />{t('grading.detail.payNow')}</>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* Alipay QR Code flow */}
              {showAlipayQR && !proofSubmitted && (
                <div className="space-y-4">
                  <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png"
                        alt="AlipayHK"
                        className="h-7 object-contain"
                      />
                      <span className="font-bold text-black text-sm">{t("grading.scanAlipayQR")}</span>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://w.alipay.hk/s12/3RYKWzGXrQ")}`}
                      alt="Alipay HK QR Code"
                      className="w-44 h-44 mx-auto rounded-xl border-4 border-white shadow-lg object-contain"
                    />
                    <p className="text-xs text-gray-500 mt-2">{t("grading.orClickLinkToPay")}</p>
                    <a
                      href="https://w.alipay.hk/s12/3RYKWzGXrQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#06038d] underline font-semibold"
                    >
                      https://w.alipay.hk/s12/3RYKWzGXrQ
                    </a>
                    <div className="mt-3 bg-blue-50 rounded-lg p-3 text-left">
                      <p className="text-xs font-bold text-black mb-1">{t("grading.paymentAmount")}</p>
                      <p className="text-xl font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{t("grading.remarkFillOrderNo", { orderNo: submission.orderNo })}</p>
                    </div>
                  </div>

                  {/* Upload proof */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-black">{t('grading.detail.uploadScreenshot')}</p>
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                        <Bot className="h-3 w-3 text-[#06038d]" />
                        <span className="text-xs text-[#06038d] font-semibold">{t("grading.aiAutoVerify")}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{t("grading.uploadAlipayScreenshot")}</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlipayProofChange}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90 cursor-pointer"
                    />
                    {alipayProofPreview && (
                      <img src={alipayProofPreview} alt={t("grading.screenshotPreview")} className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />
                    )}

                    {/* AI Verification Status */}
                    {aiVerifying && (
                      <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <Loader2 className="h-4 w-4 text-[#06038d] animate-spin flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#06038d]">{t("grading.aiVerifying")}</p>
                          <p className="text-xs text-blue-600">{t("grading.aiAnalyzing")}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Verification Result */}
                    {!aiVerifying && aiVerifyResult && (
                      <div className={`mt-3 rounded-lg p-3 border ${
                        aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low'
                          ? 'bg-green-50 border-green-300'
                          : aiVerifyResult.isValid
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-red-50 border-red-300'
                      }`}>
                        <div className="flex items-start gap-2">
                          {aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? (
                            <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : aiVerifyResult.isValid ? (
                            <ShieldQuestion className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold mb-1 ${
                              aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? 'text-green-800' :
                              aiVerifyResult.isValid ? 'text-yellow-800' : 'text-red-800'
                            }`}>
                              {aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? t("grading.aiVerifyPassed") :
                               aiVerifyResult.isValid ? t("grading.aiVerifyWarning") : t("grading.aiVerifyFailed2")}
                              <span className="font-normal ml-1 opacity-70">({t("grading.confidence")}: {aiVerifyResult.confidence === 'high' ? '高' : aiVerifyResult.confidence === 'medium' ? '中' : '低'})</span>
                            </p>
                            <p className={`text-xs mb-2 ${
                              aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? 'text-green-700' :
                              aiVerifyResult.isValid ? 'text-yellow-700' : 'text-red-700'
                            }`}>{aiVerifyResult.summary}</p>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              {aiVerifyResult.detectedAmount !== null && (
                                <div className={`flex items-center gap-1 ${
                                  aiVerifyResult.amountMatch ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {aiVerifyResult.amountMatch ? '✔' : '✖'}
                                  <span>{t("grading.amount")}: HK${aiVerifyResult.detectedAmount}</span>
                                </div>
                              )}
                              {aiVerifyResult.detectedOrderNo !== null && (
                                <div className={`flex items-center gap-1 ${
                                  aiVerifyResult.orderNoMatch ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {aiVerifyResult.orderNoMatch ? '✔' : '✖'}
                                  <span>{t("grading.orderNoLabel")}: {aiVerifyResult.detectedOrderNo}</span>
                                </div>
                              )}
                            </div>
                            {aiVerifyResult.issues.length > 0 && (
                              <ul className="mt-1.5 space-y-0.5">
                                {aiVerifyResult.issues.map((issue, i) => (
                                  <li key={i} className="text-xs text-red-700">• {issue}</li>
                                ))}
                              </ul>
                            )}
                            {!aiVerifyResult.isValid && (
                              <p className="text-xs text-gray-500 mt-1.5">{t("grading.canStillSubmitForManualReview")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-3 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowAlipayQR(false); setAlipayProofFile(null); setAlipayProofPreview(null); setAiVerifyResult(null); }}
                        className="w-full border-gray-300 text-black text-xs h-9"
                      >
                        {t("common.back")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!alipayProofFile || !submission?.id) return;
                          setAiVerifyResult(null);
                          setAiVerifying(true);
                          try {
                            const { base64, mimeType } = await compressImageToBase64(alipayProofFile);
                            verifyAlipayProofMutation.mutate({
                              submissionId: submission.id,
                              proofImageBase64: base64,
                              mimeType,
                            });
                          } catch {
                            setAiVerifying(false);
                          }
                        }}
                        disabled={!alipayProofFile || aiVerifying}
                        className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs h-9"
                      >
                        {t("grading.reVerify")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitAlipayProof}
                        disabled={!alipayProofFile || uploadingProof || aiVerifying}
                        className="w-full bg-[#06038d] hover:bg-[#06038d]/90 text-white text-xs h-9"
                      >
                        {uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("common.uploading")}</> : t("grading.submitScreenshot")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Proof submitted */}
              {proofSubmitted && (
                <div className="bg-green-50 border border-green-300 rounded-xl p-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800 mb-1">{t("grading.screenshotSubmittedSuccess")}</p>
                  <p className="text-sm text-green-700">{t("grading.adminWillConfirmOrder")}</p>
                </div>
              )}
            </div>
          )}

          {/* Grading complete + upgrade paid - waiting for return shipment */}
          {isGraded && (submission as any).upgradePaidAt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <p className="font-bold text-blue-800">{t("grading.surchargePaidWaitingReturn")}</p>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                {t("grading.surchargePaidReturnNote")}
              </p>
              <div className="bg-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800">
                <span className="font-semibold">⚡ {t("grading.sfCOD")}</span>：{t("grading.sfCODNote")}
              </div>

            </div>
          )}

          {/* Return tracking number card */}
          {(submission as any).returnTrackingNo && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-5 w-5 text-green-600" />
                <p className="font-bold text-green-800">{t("grading.boxiumShipped")}</p>
              </div>
              <p className="text-sm text-green-700 mb-3">
                {t("grading.trackingNote")}
              </p>
              <div className="bg-white border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <span className="font-mono font-bold text-gray-800 text-base tracking-wider">{(submission as any).returnTrackingNo}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText((submission as any).returnTrackingNo);
                      toast.success(t("grading.trackingCopied"));
                    }}
                    className="text-xs text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-100 transition-colors whitespace-nowrap"
                  >
                    {t("common.copy")}
                  </button>
                  <a
                    href={`https://www.sf-express.com/hk/tc/dynamic_function/waybill/#search/bill-number/${(submission as any).returnTrackingNo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white bg-[#e2231a] rounded px-2 py-1 hover:bg-[#c01d15] transition-colors whitespace-nowrap"
                  >
                    {t("grading.sfQuery")}
                  </a>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">⚡ {t("grading.sfCODPickupNote")}</p>
            </div>
          )}
          {/* Return Address display card */}
          {(submission as any).returnAddress && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
              <div className="bg-green-700 text-white px-5 py-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-bold text-sm">{t("grading.customerAddress")}</span>
                <span className="text-green-200 text-xs ml-1">（{t("grading.afterGradingReturnNote")}）</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">{t("grading.recipient")}</span>
                    <p className="font-semibold text-gray-900">{(submission as any).returnAddress.recipientName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">{t("grading.phone")}</span>
                    <p className="font-semibold text-gray-900">{(submission as any).returnAddress.phone}</p>
                  </div>
                  {(submission as any).returnAddress.sfStationName && (
                    <div className="col-span-2">
                      <span className="text-gray-500 text-xs">{t("grading.sfStation")}</span>
                      <p className="font-semibold text-gray-900">{(submission as any).returnAddress.sfStationName} ({(submission as any).returnAddress.sfStationCode})</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-gray-500 text-xs">{t("grading.address")}</span>
                    <p className="font-semibold text-gray-900">
                      {[(submission as any).returnAddress.district, (submission as any).returnAddress.region, (submission as any).returnAddress.address].filter(Boolean).join(' ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#06038d]" />
              <span className="font-bold text-gray-900 text-sm">{t("grading.cardListWithCount", { count: submission.items.length })}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {submission.items.map((item: any, idx: number) => (
                <div key={item.id} className="p-4 flex items-start gap-3">
                  {item.cardImageUrl ? (
                    <img
                      src={getProxiedImageUrl(item.cardImageUrl) ?? ""}
                      alt={item.cardName}
                      className="w-10 h-14 object-contain rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.cardName}</p>
                    {(item.cardSet || item.cardNumber) && (
                      <p className="text-xs text-gray-500">
                        {[item.cardSet, item.cardNumber].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs text-black border-gray-400">{item.tier?.name ?? "—"}</Badge>
                    </div>
                    {item.psaGrade && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="bg-[#06038d] text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          PSA {item.psaGrade}
                        </span>
                        {item.psaCertNumber && (
                          <a
                            href={`https://www.psacard.com/cert/${item.psaCertNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#06038d] hover:underline flex items-center gap-0.5 font-medium"
                          >
                            #{item.psaCertNumber}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-[#06038d] text-sm flex-shrink-0">
                    HK${item.tier ? parseFloat(item.tier.feeHkd).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
            {/* Fee summary - show breakdown if upgrade diff exists */}
            {(submission as any).upgradeDiffFeeHkd && parseFloat((submission as any).upgradeDiffFeeHkd) > 0 ? (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 space-y-1.5">
                {/* Initial fee row */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {t("grading.initialFee")}
                    {(submission as any).paidAt && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        ✓ {t("grading.paid")}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">
                    HK${(parseFloat(submission.totalFeeHkd) - parseFloat((submission as any).upgradeDiffFeeHkd)).toLocaleString()}
                  </span>
                </div>
                {/* Upgrade diff fee row */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-600">
                    {t("grading.upgradeSurcharge")}
                    {(submission as any).upgradePaidAt ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        ✓ {t("grading.paid")}
                      </span>
                    ) : (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full">
                        {t("grading.pendingPayment")}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-orange-600 font-semibold">
                    + HK${parseFloat((submission as any).upgradeDiffFeeHkd).toLocaleString()}
                  </span>
                </div>
                {/* Divider + total */}
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                  <span className="text-sm text-gray-700 font-semibold">{t("grading.totalPSAFee")}</span>
                  <span className="font-bold text-[#06038d] text-lg">
                    HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 font-semibold">
                    {t("grading.totalPSAFee")}
                    {(submission as any).paidAt && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        ✓ {t("grading.paid")}
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-[#06038d] text-lg">
                    HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Review section for completed submissions */}
          {(submission.status === "completed" || submission.status === "returned") && (
            <ReviewSection submissionId={submission.id} />
          )}
          {/* Admin notes */}
          {submission.adminNotes && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
               <p className="font-bold text-blue-800 text-sm mb-1">{t("grading.boxiumNote")}</p>
              <p className="text-sm text-blue-700">{submission.adminNotes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
