import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
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
} from "lucide-react";
import { toast } from "sonner";

const STATUS_STEPS = [
  { key: "pending_payment", label: "申請提交" },
  { key: "received", label: "BOXIUM 收件" },
  { key: "submitted_to_psa", label: "已出團" },
  { key: "grading", label: "鑑定中" },
  { key: "graded", label: "鑑定完成" },
  { key: "completed", label: "已完成" },
];

const STATUS_ORDER = [
  "pending_payment", "paid", "received", "submitted_to_psa", "grading", "graded", "payment_pending", "returned", "completed"
];

function getStepIndex(status: string) {
  const map: Record<string, number> = {
    awaiting_payment: 0,
    pending_shipment: 0,
    pending_payment: 0,
    paid: 0,
    received: 1,
    submitted_to_psa: 2,
    grading: 3,
    graded: 4,
    payment_pending: 4,
    returned: 5,
    completed: 5,
  };
  return map[status] ?? 0;
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "待付款確認",
  pending_shipment: "待寄件",
  pending_payment: "待收件",
  paid: "待收件",
  received: "已收件",
  submitted_to_psa: "已出團",
  grading: "鑑定中",
  graded: "鑑定完成",
  payment_pending: "待付款",
  payment_overdue: "付款逾期",
  returned: "已寄回",
  completed: "已完成",
  cancelled: "已取消",
};

// ─── Printable Slip ───────────────────────────────────────────────────────────
function PrintableSlip({ submission }: { submission: any }) {
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
            <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '16px', letterSpacing: '0.5px' }}>PSA 代客鑑定申請單</div>
            <div style={{ color: '#b0b8e8', fontSize: '11px', marginTop: '2px' }}>請將此申請單打印後連同卡牌一起寄出</div>
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
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>申請人</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#06038d' }}>{submission.user?.name ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>用戶 ID：#{submission.userId ?? submission.user?.id ?? '—'}</div>
          </div>
          <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', background: '#f8faff' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>服務層級</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#06038d' }}>{submission.items?.[0]?.tier?.name ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>HK${submission.items?.[0]?.tier ? parseFloat(submission.items[0].tier.feeHkd).toLocaleString() : '—'} / 張 · 共 {submission.items.length} 張</div>
          </div>
          <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', background: '#f8faff' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>申請編號</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#06038d', fontFamily: 'monospace' }}>{submission.orderNo}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>共 {submission.items.length} 張卡牌</div>
          </div>
        </div>

        {/* Shipping Address */}
        <div style={{ border: '1.5px solid #06038d', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', background: '#f0f2ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '20px', height: '20px', background: '#06038d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: '11px' }}>📦</span>
            </div>
            <span style={{ fontWeight: '700', fontSize: '13px', color: '#06038d' }}>送件地址</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: '12px' }}>
            <div><span style={{ color: '#6b7280' }}>收件人：</span><span style={{ fontWeight: '600' }}>BOXIUM</span></div>
            <div><span style={{ color: '#6b7280' }}>聯絡電話：</span><span style={{ fontWeight: '600' }}>55090102</span></div>
            <div><span style={{ color: '#6b7280' }}>寄件方式：</span><span style={{ fontWeight: '600' }}>順豐站 852Z351</span></div>
            <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>地址：</span><span style={{ fontWeight: '600' }}>香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</span></div>
          </div>
          <div style={{ marginTop: '10px', padding: '6px 10px', background: '#fff3cd', borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: '#92400e' }}>
            ⚠️ 請確保此申請單與卡牌一同寄出，否則無法處理您的申請
          </div>
        </div>

        {/* Card List */}
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ background: '#06038d', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: '700', fontSize: '13px' }}>卡牌清單</span>
            <span style={{ color: '#FEDD00', fontWeight: '600', fontSize: '12px' }}>共 {submission.items.length} 張</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#eef0ff', borderBottom: '1px solid #c7d2fe' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', width: '28px', color: '#374151', fontWeight: '600' }}>#</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#374151', fontWeight: '600' }}>卡牌名稱</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', width: '100px', color: '#374151', fontWeight: '600' }}>系列 / 編號</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px', color: '#374151', fontWeight: '600' }}>服務層級</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '70px', color: '#374151', fontWeight: '600' }}>費用</th>
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
                <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#06038d', fontSize: '13px' }}>代送 PSA 費用合計（已預付）</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#06038d', fontSize: '14px' }}>
                  HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '14px 16px', fontSize: '12px' }}>
          <div style={{ fontWeight: '700', color: '#06038d', marginBottom: '8px', fontSize: '13px' }}>重要事項</div>
          <ol style={{ paddingLeft: '16px', margin: 0, lineHeight: '1.8', color: '#374151' }}>
            <li>請使用有追蹤號碼的寄件方式，並自行購買保險。</li>
            <li>卡片請妥善包裝，建議使用硬卡套及泡泡紙保護。</li>
            <li>鑑定費用已於申請時預付，鑑定完成後無需額外付款。</li>
            <li>如有查詢，請透過平台訊息聯絡 BOXIUM。</li>
          </ol>
        </div>

    
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GradingOrderDetail() {
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
  const [upgradeProofSubmitted, setUpgradeProofSubmitted] = useState(false);

  const submissionId = parseInt(params.id ?? "0", 10);
  const utils = trpc.useUtils();

  const { data: submission, isLoading, refetch: refetchSubmission } = trpc.grading.getSubmissionDetail.useQuery(
    { id: submissionId },
    { enabled: submissionId > 0 }
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

  const { data: qrData } = trpc.grading.getSubmissionQrCode.useQuery(
    { submissionId },
    { enabled: submissionId > 0 }
  );

  const submitAlipayProofMutation = trpc.grading.submitGradingAlipayProof.useMutation({
    onSuccess: () => {
      setUploadingProof(false);
      setProofSubmitted(true);
      toast.success("截圖已提交，等待管理員確認收款");
    },
    onError: (err: any) => {
      setUploadingProof(false);
      toast.error(`提交失敗：${err.message}`);
    },
  });

  const cancelSubmissionMutation = trpc.grading.cancelSubmission.useMutation({
    onSuccess: () => {
      toast.success("申請已取消");
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
      setCancelConfirm(false);
    },
    onError: (err: any) => {
      toast.error(`取消失敗：${err.message}`);
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
      toast.error(`AI 核對失敗：${err.message}`);
    },
  });

  const handleAlipayProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAlipayProofFile(file);
    setAiVerifyResult(null); // Reset AI result when new file selected
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAlipayProofPreview(ev.target?.result as string);
      // Auto-trigger AI verification after file is loaded
      const base64 = (ev.target?.result as string).split(",")[1];
      setAiVerifying(true);
      verifyAlipayProofMutation.mutate({
        submissionId,
        proofImageBase64: base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitAlipayProof = async () => {
    if (!alipayProofFile) return;
    setUploadingProof(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      submitAlipayProofMutation.mutate({
        submissionId,
        proofImageBase64: base64,
        mimeType: alipayProofFile.type,
      });
    };
    reader.readAsDataURL(alipayProofFile);
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
      toast.success("截圖已重新提交，等待管理員再次確認");
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
      setResubmitProofFile(null);
      setResubmitProofPreview(null);
      setResubmitAiResult(null);
    },
    onError: (err: any) => {
      setUploadingResubmit(false);
      toast.error(`重新提交失敗：${err.message}`);
    },
  });

  const handleResubmitProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResubmitProofFile(file);
    setResubmitAiResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setResubmitProofPreview(ev.target?.result as string);
      const base64 = (ev.target?.result as string).split(",")[1];
      setResubmitAiVerifying(true);
      verifyAlipayProofMutation.mutate(
        { submissionId, proofImageBase64: base64, mimeType: file.type },
        {
          onSuccess: (r: any) => { setResubmitAiVerifying(false); setResubmitAiResult(r); },
          onError: () => { setResubmitAiVerifying(false); },
        }
      );
    };
    reader.readAsDataURL(file);
  };

  const handleResubmitAlipayProof = async () => {
    if (!resubmitProofFile) return;
    setUploadingResubmit(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      resubmitAlipayProofMutation.mutate({
        submissionId,
        proofImageBase64: base64,
        mimeType: resubmitProofFile.type,
      });
    };
    reader.readAsDataURL(resubmitProofFile);
  };

  // ── Submit SF Express tracking number ─────────────────────────────────────
  const [trackingInput, setTrackingInput] = useState("");
  const [trackingSubmitting, setTrackingSubmitting] = useState(false);

  const submitTrackingMutation = trpc.grading.submitTrackingNumber.useMutation({
    onSuccess: () => {
      setTrackingSubmitting(false);
      toast.success("追蹤號碼已提交，管理員將確認收件");
      utils.grading.getSubmissionDetail.invalidate({ id: submissionId });
      setTrackingInput("");
    },
    onError: (err: any) => {
      setTrackingSubmitting(false);
      toast.error(`提交失敗：${err.message}`);
    },
  });

  const createPaymentMutation = trpc.grading.createPaymentIntent.useMutation({
    onSuccess: (data: any) => {
      setPayingLoading(false);
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("正在跳轉至付款頁面...");
      }
    },
    onError: (err: any) => {
      setPayingLoading(false);
      toast.error(`付款失敗：${err.message}`);
    },
  });

  const reopenUpgradeCheckoutMutation = trpc.grading.reopenUpgradeCheckout.useMutation({
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        toast.success("正在跳轉至補付差價頁面...");
      }
    },
    onError: (err: any) => {
      toast.error(`重新付款失敗：${err.message}`);
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
      ? `<div style="text-align:center;margin-top:4px"><img src="${qrData.qrDataUrl}" alt="QR Code" style="width:80px;height:80px" /><div style="color:#b0b8e8;font-size:9px;margin-top:2px">掃描查看申請詳情</div></div>`
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
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>申請單 ${submission.orderNo}</title>
    <style>body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;background:#fff}@page{margin:10mm;size:A4}*{box-sizing:border-box}</style>
    </head><body>
    <div style="background:#06038d;padding:16px 28px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:16px">
        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/boxium-logo_62cbf293.webp" alt="BOXIUM" style="height:52px;width:auto;object-fit:contain;border-radius:6px" />
        <div>
          <div style="color:#fff;font-weight:700;font-size:16px">PSA 代客鑑定申請單</div>
          <div style="color:#b0b8e8;font-size:11px;margin-top:2px">請將此申請單打印後連同卡牌一起寄出</div>
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
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-transform:uppercase">申請人</div>
          <div style="font-weight:700;font-size:14px;color:#06038d">${userName}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">用戶 ID：#${userId}</div>
        </div>
        <div style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;background:#f8faff">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-transform:uppercase">服務層級</div>
          <div style="font-weight:700;font-size:14px;color:#06038d">${tierName}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">HK$${tierFee} / 張 · 共 ${(submission as any).items.length} 張</div>
        </div>
        <div style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;background:#f8faff">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-transform:uppercase">申請編號</div>
          <div style="font-weight:700;font-size:14px;color:#06038d;font-family:monospace">${submission.orderNo}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">共 ${(submission as any).items.length} 張卡牌</div>
        </div>
      </div>
      <div style="border:1.5px solid #06038d;border-radius:8px;padding:14px 16px;margin-bottom:16px;background:#f0f2ff">
        <div style="font-weight:700;font-size:13px;color:#06038d;margin-bottom:8px">📦 送件地址</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:12px">
          <div><span style="color:#6b7280">收件人：</span><span style="font-weight:600">BOXIUM</span></div>
          <div><span style="color:#6b7280">聯絡電話：</span><span style="font-weight:600">55090102</span></div>
          <div><span style="color:#6b7280">寄件方式：</span><span style="font-weight:600">順豐站 852Z351</span></div>
          <div style="grid-column:1/-1"><span style="color:#6b7280">地址：</span><span style="font-weight:600">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</span></div>
        </div>
        <div style="margin-top:10px;padding:6px 10px;background:#fff3cd;border-radius:4px;font-size:11px;font-weight:600;color:#92400e">⚠️ 請確保此申請單與卡牌一同寄出，否則無法處理您的申請</div>
      </div>
      <div style="border:1px solid #d1d5db;border-radius:8px;overflow:hidden;margin-bottom:16px">
        <div style="background:#06038d;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
          <span style="color:white;font-weight:700;font-size:13px">卡牌清單</span>
          <span style="color:#FEDD00;font-weight:600;font-size:12px">共 ${(submission as any).items.length} 張</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#eef0ff;border-bottom:1px solid #c7d2fe">
            <th style="padding:8px 12px;text-align:left;width:28px;color:#374151;font-weight:600">#</th>
            <th style="padding:8px 12px;text-align:left;color:#374151;font-weight:600">卡牌名稱</th>
            <th style="padding:8px 12px;text-align:left;width:100px;color:#374151;font-weight:600">系列 / 編號</th>
            <th style="padding:8px 12px;text-align:center;width:80px;color:#374151;font-weight:600">服務層級</th>
            <th style="padding:8px 12px;text-align:right;width:70px;color:#374151;font-weight:600">費用</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot><tr style="border-top:2px solid #06038d;background:#f0f2ff">
            <td colspan="4" style="padding:10px 12px;text-align:right;font-weight:700;color:#06038d;font-size:13px">代送 PSA 費用合計（已預付）</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#06038d;font-size:14px">HK$${totalFee}</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="border:1px solid #d1d5db;border-radius:8px;padding:14px 16px;font-size:12px">
        <div style="font-weight:700;color:#06038d;margin-bottom:8px;font-size:13px">重要事項</div>
        <ol style="padding-left:16px;margin:0;line-height:1.8;color:#374151">
          <li>請使用有追蹤號碼的寄件方式，並自行購買保險。</li>
          <li>卡片請妥善包裝，建議使用硬卡套及泡泡紙保護。</li>
          <li>鑑定費用已於申請時預付，鑑定完成後無需額外付款。</li>
          <li>如有查詢，請透過平台訊息聯絡 BOXIUM。</li>
        </ol>
      </div>
      <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between">
        <div style="font-size:10px;color:#9ca3af">BOXIUM × PSA 代客鑑定服務 · boxium.asia</div>
        <div style="font-size:10px;color:#9ca3af">此申請單由系統自動生成，如有疑問請聯絡 BOXIUM</div>
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">找不到申請</h2>
          <Button variant="outline" onClick={() => navigate("/grading/orders")}>
            返回我的申請
          </Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(submission.status);
  const isCancelled = submission.status === "cancelled";
  // awaiting_payment: 申請已建立，等待付款（Stripe 或 AlipayHK 截圖尚未提交）
  const isAwaitingPayment = submission.status === "awaiting_payment";
  // pending_shipment 且 AlipayHK 截圖待審核（管理員尚未確認）
  const isAlipayPendingReview = submission.status === "pending_shipment" && (submission as any).alipayProofStatus === "pending_review";
  // pending_shipment 且 AlipayHK 截圖被拒絕（需重新上傳）
  const isAlipayRejected = submission.status === "pending_shipment" && (submission as any).alipayProofStatus === "rejected";
  // 付款已確認（Stripe 付款成功 或 AlipayHK 截圖已批准）
  const isPaymentConfirmed = submission.status === "pending_shipment" && !isAlipayPendingReview && !isAlipayRejected;
  const isGraded = submission.status === "graded" || submission.status === "payment_pending";
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
              <span className="text-sm">返回我的申請</span>
            </button>
{(isPaymentConfirmed || isGraded || isCompleted || submission.status === "received" || submission.status === "submitted_to_psa" || submission.status === "grading" || submission.status === "graded") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[#06038d] text-[#06038d] hover:bg-blue-50"
            >
              <Printer className="h-4 w-4 mr-2" />
              打印申請單
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
                  <p className="font-bold text-green-800 text-base">升級差價補付成功！</p>
                  <p className="text-sm text-green-600">申請單號：<span className="font-mono font-bold">{submission.orderNo}</span></p>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-4">
                <p className="text-sm font-bold text-gray-800 mb-2">補付摘要</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">新服務層級：</span>
                    <span className="font-semibold text-gray-800">{(submission as any).upgradeNewTierName ?? '已升級'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">補付差價：</span>
                    <span className="font-bold text-green-700">HK${parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">新總費用：</span>
                    <span className="font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">卡牌數量：</span>
                    <span className="font-semibold text-gray-800">{submission.items.length} 張</span>
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
                  <p className="font-bold text-green-800 text-base">付款成功！申請已確認</p>
                  <p className="text-sm text-green-600">申請單號：<span className="font-mono font-bold">{submission.orderNo}</span></p>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-4 mb-3">
                <p className="text-sm font-bold text-gray-800 mb-2">申請摘要</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">卡牌數量：</span>
                    <span className="font-semibold text-gray-800">{submission.items.length} 張</span>
                  </div>
                  <div>
                    <span className="text-gray-500">服務層級：</span>
                    <span className="font-semibold text-gray-800">{(submission as any).items?.[0]?.tier?.name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">已付金額：</span>
                    <span className="font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">申請日期：</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(submission.createdAt).toLocaleDateString("zh-HK")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-bold text-amber-800 mb-1">📦 下一步：寄出您的卡牌</p>
                <p className="text-xs text-amber-700 mb-1">請打印申請單，連同卡牌一起寄至：</p>
                <p className="text-xs font-semibold text-amber-800">順豐站 852Z351 · BOXIUM · 55090102</p>
                <p className="text-xs text-amber-700">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100 h-7 text-xs"
                  onClick={handlePrint}
                >
                  <Printer className="h-3 w-3 mr-1.5" />
                  立即打印申請單
                </Button>
              </div>
            </div>
          )}

          {/* Order header */}
          <div className="bg-[#06038d] text-white rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 text-xs mb-1">申請單號</p>
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
                {isAlipayRejected ? "截圖被拒絕" : isAlipayPendingReview ? "截圖待審核" : (STATUS_LABEL[submission.status] ?? submission.status)}
              </span>
            </div>
          </div>

          {/* Awaiting payment notice */}
          {isAwaitingPayment && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-bold text-green-800">申請已建立！請完成付款</p>
              </div>
              <p className="text-sm text-green-700 mb-4">付款確認後申請將自動進入處理。</p>
              {/* Payment method selection */}
              {!showAlipayQR && !proofSubmitted && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-black mb-2">選擇付款方式</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "stripe" ? "border-[#06038d] bg-blue-50" : "border-gray-200 bg-white"
                      }`}>
                        <input type="radio" value="stripe" checked={paymentMethod === "stripe"} onChange={() => setPaymentMethod("stripe")} className="accent-[#06038d]" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <svg height="16" viewBox="0 0 1000 324" xmlns="http://www.w3.org/2000/svg" aria-label="Visa"><path d="M651.19.5c-70.933 0-134.32 36.766-134.32 104.69 0 77.9 112.42 83.28 112.42 122.42 0 16.478-18.884 31.229-51.137 31.229-45.773 0-79.984-20.611-79.984-20.611l-14.638 68.547S519.72 324 584.94 324c77.406 0 138.67-38.333 138.67-107.66 0-82.316-112.89-87.536-112.89-123.86 0-12.908 15.555-27.052 47.675-27.052 36.315 0 65.888 14.987 65.888 14.987L737.86 23.5S706.13.5 651.19.5zm-648.97 5L.5 19.053s29.784 5.457 56.553 16.356c34.44 12.422 36.861 19.747 42.643 42.228L155.48 314.5h79.994L366.69 5.5H286.85L203.19 220.71 170.98 38.507C168.22 15.623 150.96 5.5 129.45 5.5H2.22zm411.87 0L345.3 314.5h76.165L490.15 5.5h-76.06zm451.76 0L713.56 314.5h74.228l14.338-45.494H886.5l8.25 45.494H969L905.04 5.5h-38.19zm32.55 68.281l19.5 117.72H814.96l52.44-117.72z" fill="#1A1F71"/></svg>
                            <svg height="16" viewBox="0 0 131.39 86.9" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard"><rect width="131.39" height="86.9" rx="8" fill="none"/><circle cx="43.45" cy="43.45" r="43.45" fill="#eb001b"/><circle cx="87.94" cy="43.45" r="43.45" fill="#f79e1b"/><path d="M65.7 14.15a43.43 43.43 0 0 1 0 58.6 43.43 43.43 0 0 1 0-58.6z" fill="#ff5f00"/></svg>
                          </div>
                          <span className="text-xs text-gray-600">信用卡 / 扣帳卡</span>
                        </div>
                      </label>
                      <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "alipay_hk" ? "border-[#06038d] bg-blue-50" : "border-gray-200 bg-white"
                      }`}>
                        <input type="radio" value="alipay_hk" checked={paymentMethod === "alipay_hk"} onChange={() => setPaymentMethod("alipay_hk")} className="accent-[#06038d]" />
                        <div className="flex flex-col gap-1">
                          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-5 object-contain" />
                          <span className="text-xs text-gray-600">支付寳 HK</span>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm text-black">應付金額</p>
                      <p className="text-2xl font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</p>
                    </div>
                    <Button onClick={handlePay} disabled={payingLoading} className="bg-[#06038d] hover:bg-[#06038d]/90 text-white px-6">
                      {payingLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />處理中...</> : <><CreditCard className="h-4 w-4 mr-2" />立即付款</>}
                    </Button>
                  </div>
                </>
              )}
              {/* Alipay QR Code flow */}
              {showAlipayQR && !proofSubmitted && (
                <div className="space-y-4">
                  <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-7 object-contain" />
                      <span className="font-bold text-gray-900">支付寳 HK 付款</span>
                    </div>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://w.alipay.hk/s12/3RYKWzGXrQ")}`} alt="AlipayHK QR" className="mx-auto rounded-lg border border-gray-200 mb-2" width={160} height={160} />
                    <a href="https://w.alipay.hk/s12/3RYKWzGXrQ" target="_blank" rel="noopener noreferrer" className="text-xs text-[#06038d] hover:underline block mb-1">https://w.alipay.hk/s12/3RYKWzGXrQ</a>
                    <p className="text-xs text-gray-500">掃描 QR code 或點擊連結完成付款</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">上傳付款截圖</p>
                    <p className="text-xs text-gray-500 mb-3">付款後請上傳截圖，管理員確認後申請將自動進入處理。</p>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setAlipayProofFile(f); const r = new FileReader(); r.onload = (ev) => setAlipayProofPreview(ev.target?.result as string); r.readAsDataURL(f); }
                    }} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90" />
                    {alipayProofPreview && <img src={alipayProofPreview} alt="截圖預覽" className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAlipayQR(false)} className="flex-1 text-black">返回</Button>
                    <Button onClick={handleSubmitAlipayProof} disabled={!alipayProofFile || uploadingProof} className="flex-1 bg-[#06038d] hover:bg-[#06038d]/90 text-white">
                      {uploadingProof ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />上傳中...</> : "提交截圖"}
                    </Button>
                  </div>
                </div>
              )}
              {proofSubmitted && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="font-bold text-blue-800">截圖已提交！</p>
                  <p className="text-sm text-blue-700 mt-1">管理員將於 24 小時內確認付款。</p>
                </div>
              )}
              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-green-200">
                {!cancelConfirm ? (
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => setCancelConfirm(true)}>
                    <XCircle className="h-3 w-3 mr-1.5" />取消申請
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-semibold">確定要取消此申請？</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3" disabled={cancelSubmissionMutation.isPending} onClick={() => cancelSubmissionMutation.mutate({ submissionId })}>
                      {cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認取消"}
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 h-7 text-xs px-3" onClick={() => setCancelConfirm(false)}>返回</Button>
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
                <p className="font-bold text-blue-800">支付寳 HK 截圖已提交，等待管理員確認</p>
              </div>
              <p className="text-sm text-blue-700 mb-4">管理員將於 24 小時內確認收款，確認後申請將自動進入處理。</p>
              {/* Show proof image if available */}
              {(submission as any)?.alipayProofImageUrl && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-blue-800 mb-2">已提交截圖：</p>
                  <img
                    src={(submission as any).alipayProofImageUrl}
                    alt="付款截圖"
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
                        ? 'AI 核對通過，等待管理員確認'
                        : (submission as any).alipayProofAiResult === 'warning'
                        ? 'AI 核對有警告，管理員將人工審核'
                        : 'AI 核對未通過，請確認截圖是否正確'}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>AI 核對中，請稍候…</span>
                  </div>
                )}
              </div>
              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-blue-200">
                {!cancelConfirm ? (
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => setCancelConfirm(true)}>
                    <XCircle className="h-3 w-3 mr-1.5" />取消申請
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-semibold">確定要取消此申請？</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3" disabled={cancelSubmissionMutation.isPending} onClick={() => cancelSubmissionMutation.mutate({ submissionId })}>
                      {cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認取消"}
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 h-7 text-xs px-3" onClick={() => setCancelConfirm(false)}>返回</Button>
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
                  <p className="font-bold text-red-800">截圖已被拒絕，請重新上傳</p>
                  <p className="text-xs text-red-600">管理員尚未確認此截圖為有效付款証明</p>
                </div>
              </div>
              {/* Rejection reason */}
              {(submission as any).alipayProofRejectionReason && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-red-800 mb-1">拒絕原因：</p>
                  <p className="text-sm text-red-700">{(submission as any).alipayProofRejectionReason}</p>
                </div>
              )}
              {/* Previous rejected proof */}
              {(submission as any).alipayProofImageUrl && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-red-800 mb-2">被拒絕的截圖：</p>
                  <img
                    src={(submission as any).alipayProofImageUrl}
                    alt="被拒絕的截圖"
                    className="max-h-40 rounded-lg border-2 border-red-300 mx-auto block object-contain opacity-60"
                  />
                </div>
              )}
              {/* Resubmit section */}
              <div className="border-t border-red-200 pt-4">
                <p className="text-sm font-bold text-red-800 mb-3">重新上傳付款截圖</p>
                <label className="block w-full border-2 border-dashed border-red-300 rounded-lg p-4 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-all mb-3">
                  <input type="file" accept="image/*" className="sr-only" onChange={handleResubmitProofChange} />
                  {resubmitProofPreview ? (
                    <img src={resubmitProofPreview} alt="新截圖" className="max-h-40 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <Printer className="h-5 w-5 text-red-500" />
                      </div>
                      <p className="text-sm font-semibold text-red-700">點擊選擇新截圖</p>
                      <p className="text-xs text-red-500">支持 JPG、PNG 格式</p>
                    </div>
                  )}
                </label>
                {/* AI verification result for resubmit */}
                {resubmitProofFile && (
                  <div className="mb-3">
                    {resubmitAiVerifying ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>AI 核對中，請稍候…</span>
                      </div>
                    ) : resubmitAiResult ? (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                        resubmitAiResult.result === 'pass' ? 'bg-green-100 text-green-800' :
                        resubmitAiResult.result === 'warning' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        <span>{resubmitAiResult.result === 'pass' ? '✅' : resubmitAiResult.result === 'warning' ? '⚠️' : '❌'}</span>
                        <span>{resubmitAiResult.result === 'pass' ? 'AI 核對通過' : resubmitAiResult.result === 'warning' ? 'AI 核對有警告' : 'AI 核對未通過'}</span>
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
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />提交中…</>
                  ) : (
                    <>重新提交截圖</>
                  )}
                </Button>
              </div>
              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-red-200">
                {!cancelConfirm ? (
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-7 text-xs" onClick={() => setCancelConfirm(true)}>
                    <XCircle className="h-3 w-3 mr-1.5" />取消申請
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 font-semibold">確定要取消此申請？</span>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3" disabled={cancelSubmissionMutation.isPending} onClick={() => cancelSubmissionMutation.mutate({ submissionId })}>
                      {cancelSubmissionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "確認取消"}
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 h-7 text-xs px-3" onClick={() => setCancelConfirm(false)}>返回</Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Progress stepper */}
          {!isCancelled && !isAwaitingPayment && !isAlipayPendingReview && !isAlipayRejected && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">申請進度</h3>
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
                  <p className="font-bold text-amber-800 mb-1">請將卡牌寄至以下地址</p>
                  <p className="text-sm text-amber-700 font-semibold">📦 順豐站 852Z351</p>
                  <p className="text-sm text-amber-700">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ 請打印申請單連同卡牌一起寄出，否則無法處理您的申請
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100 h-8 text-xs"
                    onClick={handlePrint}
                  >
                    <Printer className="h-3 w-3 mr-1.5" />
                    打印申請單
                  </Button>
                  {/* Tracking number section */}
                  <div className="mt-4 pt-3 border-t border-amber-200">
                    <p className="text-xs font-bold text-amber-800 mb-2">📦 寄出後，請提交順豐追蹤號碼</p>
                    {(submission as any).trackingNumber ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-green-700">已提交追蹤號碼</p>
                          <p className="text-sm font-bold text-green-800 font-mono">{(submission as any).trackingNumber}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          placeholder="輸入順豐追蹤號碼（如：SF1234567890HK）"
                          className="flex-1 text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
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
                          {trackingSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "提交"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Batch info */}
          {submission.batch && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-purple-800 text-sm mb-1">出團批次資訊</p>
              <div className="text-xs text-purple-700 space-y-0.5">
                <p>批次：{(submission.batch as any).batchName ?? (submission.batch as any).name ?? '未知'}</p>
                {((submission.batch as any).shippedDate || (submission.batch as any).shippedAt) && (
                  <p>出團日期：{new Date((submission.batch as any).shippedDate ?? (submission.batch as any).shippedAt).toLocaleDateString("zh-HK")}</p>
                )}
                {((submission.batch as any).expectedReturnDate || (submission.batch as any).estimatedReturnAt) && (
                  <p>預計回件：{new Date((submission.batch as any).expectedReturnDate ?? (submission.batch as any).estimatedReturnAt).toLocaleDateString("zh-HK")}</p>
                )}
              </div>
            </div>
          )}

          {/* Upgrade diff fee pending banner */}
          {(submission as any).upgradeCheckoutSessionId && !(submission as any).upgradePaidAt && (
            <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-4 mb-4">
              {!showUpgradeAlipayQR && !upgradeProofSubmitted && (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">⇑</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-orange-800 mb-1">服務層級已升級，請補付差價</p>
                      <p className="text-sm text-orange-700 mb-1">
                        您的申請已升級至 <strong>{(submission as any).upgradeNewTierName ?? '新層級'}</strong>，
                        需補付差價 <strong className="text-orange-900">HK${parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString()}</strong>。
                      </p>
                      <p className="text-xs text-orange-600">新總費用：HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Payment method selection */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-orange-800 mb-2">選擇補付方式</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        upgradePayMethod === 'stripe' ? 'border-orange-400 bg-orange-100' : 'border-gray-200 bg-white'
                      }`}>
                        <input type="radio" className="sr-only" checked={upgradePayMethod === 'stripe'} onChange={() => setUpgradePayMethod('stripe')} />
                        <CreditCard className="h-4 w-4 text-orange-700" />
                        <span className="text-xs font-semibold text-orange-900">信用卡 / Stripe</span>
                      </label>
                      <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        upgradePayMethod === 'alipay_hk' ? 'border-orange-400 bg-orange-100' : 'border-gray-200 bg-white'
                      }`}>
                        <input type="radio" className="sr-only" checked={upgradePayMethod === 'alipay_hk'} onChange={() => setUpgradePayMethod('alipay_hk')} />
                        <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-4 object-contain" />
                        <span className="text-xs font-semibold text-orange-900">支付寶 HK</span>
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
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />處理中...</>
                      ) : (
                        <><CreditCard className="h-4 w-4 mr-2" />信用卡補付差價</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white w-full"
                      onClick={() => setShowUpgradeAlipayQR(true)}
                    >
                      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-4 object-contain mr-2" />
                      支付寶 HK 補付差價
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
                    <p className="font-bold text-orange-800 text-sm">支付寶 HK 補付差價 HK${parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString()}</p>
                  </div>
                  <div className="bg-white border border-orange-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/alipay-hk-logo_7e21b75c.png" alt="AlipayHK" className="h-7 object-contain" />
                      <span className="font-bold text-gray-900">支付寶 HK 付款</span>
                    </div>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://w.alipay.hk/s12/3RYKWzGXrQ")}`} alt="AlipayHK QR" className="mx-auto rounded-lg border border-gray-200 mb-2" width={160} height={160} />
                    <a href="https://w.alipay.hk/s12/3RYKWzGXrQ" target="_blank" rel="noopener noreferrer" className="text-xs text-[#06038d] hover:underline block mb-1">https://w.alipay.hk/s12/3RYKWzGXrQ</a>
                    <p className="text-xs text-gray-500">掃描 QR code 或點擊連結完成付款</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">上傳付款截圖</p>
                    <p className="text-xs text-gray-500 mb-3">付款後請上傳截圖，管理員確認後補付將完成。</p>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUpgradeAlipayProofFile(f);
                        const r = new FileReader();
                        r.onload = (ev) => setUpgradeAlipayProofPreview(ev.target?.result as string);
                        r.readAsDataURL(f);
                      }
                    }} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90" />
                    {upgradeAlipayProofPreview && <img src={upgradeAlipayProofPreview} alt="截圖預覽" className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowUpgradeAlipayQR(false)} className="flex-1 text-black border-orange-300">返回</Button>
                    <Button
                      onClick={async () => {
                        if (!upgradeAlipayProofFile) return;
                        setUploadingUpgradeProof(true);
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const base64 = (ev.target?.result as string).split(',')[1];
                          try {
                            await submitAlipayProofMutation.mutateAsync({
                              submissionId,
                              proofImageBase64: base64,
                              mimeType: upgradeAlipayProofFile.type,
                            });
                            setUpgradeProofSubmitted(true);
                            setAiPollingActive(true);
                          } catch (e: any) {
                            toast.error(e.message || '提交失敗');
                          } finally {
                            setUploadingUpgradeProof(false);
                          }
                        };
                        reader.readAsDataURL(upgradeAlipayProofFile);
                      }}
                      disabled={!upgradeAlipayProofFile || uploadingUpgradeProof}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {uploadingUpgradeProof ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />上傳中...</> : '提交截圖'}
                    </Button>
                  </div>
                </div>
              )}
              {/* Upgrade proof submitted */}
              {upgradeProofSubmitted && (
                <div className="text-center py-2">
                  <CheckCircle2 className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="font-bold text-orange-800">補付截圖已提交！</p>
                  <p className="text-sm text-orange-700 mt-1">管理員將於 24 小時內確認補付。</p>
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
                            ? 'AI 核對通過，等待管理員確認'
                            : (submission as any).alipayProofAiResult === 'warning'
                            ? 'AI 核對有警告，管理員將人工審核'
                            : 'AI 核對未通過，請確認截圖是否正確'}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>AI 核對中，請稍候…</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grading results + payment */}
          {isGraded && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-bold text-green-800">鑑定完成！請完成付款</p>
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
                      {item.psaCertNo && (
                        <a
                          href={`https://www.psacard.com/cert/${item.psaCertNo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#06038d] hover:underline flex items-center gap-0.5"
                        >
                          #{item.psaCertNo}
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
                  ⚠️ 請於 <strong>{new Date(submission.paymentDeadline).toLocaleDateString("zh-HK")}</strong> 前完成付款，逾期平台保留對卡片自行處理之權利。
                </div>
              )}

              {/* Payment method */}
              {!showAlipayQR && !proofSubmitted && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-black mb-2">選擇付款方式</p>
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
                          <span className="text-xs font-semibold text-black">信用卡 / 扣帳卡</span>
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
                          <span className="text-xs font-semibold text-black">支付寶 HK</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm text-black">應付金額</p>
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
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />處理中...</>
                      ) : (
                        <><CreditCard className="h-4 w-4 mr-2" />立即付款</>
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
                      <span className="font-bold text-black text-sm">掃描支付寶 HK QR Code 付款</span>
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("https://w.alipay.hk/s12/3RYKWzGXrQ")}`}
                      alt="Alipay HK QR Code"
                      className="w-44 h-44 mx-auto rounded-xl border-4 border-white shadow-lg object-contain"
                    />
                    <p className="text-xs text-gray-500 mt-2">或點擊連結付款：</p>
                    <a
                      href="https://w.alipay.hk/s12/3RYKWzGXrQ"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#06038d] underline font-semibold"
                    >
                      https://w.alipay.hk/s12/3RYKWzGXrQ
                    </a>
                    <div className="mt-3 bg-blue-50 rounded-lg p-3 text-left">
                      <p className="text-xs font-bold text-black mb-1">付款金額</p>
                      <p className="text-xl font-bold text-[#06038d]">HK${parseFloat(submission.totalFeeHkd).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">備注請填寫申請單號：{submission.orderNo}</p>
                    </div>
                  </div>

                  {/* Upload proof */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-black">上傳付款截圖</p>
                      <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                        <Bot className="h-3 w-3 text-[#06038d]" />
                        <span className="text-xs text-[#06038d] font-semibold">AI 自動核對</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">完成付款後，請上傳支付寶 HK 付款成功截圖。系統將自動使用 AI 核對金額和單號。</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlipayProofChange}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90 cursor-pointer"
                    />
                    {alipayProofPreview && (
                      <img src={alipayProofPreview} alt="截圖預覽" className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />
                    )}

                    {/* AI Verification Status */}
                    {aiVerifying && (
                      <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <Loader2 className="h-4 w-4 text-[#06038d] animate-spin flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#06038d]">AI 核對中...</p>
                          <p className="text-xs text-blue-600">正在分析截圖內容，核對金額和單號</p>
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
                              {aiVerifyResult.isValid && aiVerifyResult.confidence !== 'low' ? '✅ AI 核對通過' :
                               aiVerifyResult.isValid ? '⚠️ AI 核對小心' : '❌ AI 核對未通過'}
                              <span className="font-normal ml-1 opacity-70">(可信度: {aiVerifyResult.confidence === 'high' ? '高' : aiVerifyResult.confidence === 'medium' ? '中' : '低'})</span>
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
                                  <span>金額: HK${aiVerifyResult.detectedAmount}</span>
                                </div>
                              )}
                              {aiVerifyResult.detectedOrderNo !== null && (
                                <div className={`flex items-center gap-1 ${
                                  aiVerifyResult.orderNoMatch ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {aiVerifyResult.orderNoMatch ? '✔' : '✖'}
                                  <span>單號: {aiVerifyResult.detectedOrderNo}</span>
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
                              <p className="text-xs text-gray-500 mt-1.5">如確認付款已完成，仍可提交截圖由管理員手動核對。</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowAlipayQR(false); setAlipayProofFile(null); setAlipayProofPreview(null); setAiVerifyResult(null); }}
                        className="flex-1 border-gray-300 text-black"
                      >
                        返回
                      </Button>
                      {alipayProofFile && !aiVerifying && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!alipayProofFile || !submission?.id) return;
                            setAiVerifyResult(null);
                            setAiVerifying(true);
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const base64 = (e.target?.result as string).split(',')[1];
                              verifyAlipayProofMutation.mutate({
                                submissionId: submission.id,
                                proofImageBase64: base64,
                                mimeType: alipayProofFile.type || 'image/jpeg',
                              });
                            };
                            reader.readAsDataURL(alipayProofFile);
                          }}
                          className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        >
                          重新核對
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSubmitAlipayProof}
                        disabled={!alipayProofFile || uploadingProof || aiVerifying}
                        className="flex-1 bg-[#06038d] hover:bg-[#06038d]/90 text-white"
                      >
                        {uploadingProof ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />上傳中...</> : "提交截圖"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Proof submitted */}
              {proofSubmitted && (
                <div className="bg-green-50 border border-green-300 rounded-xl p-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800 mb-1">截圖已提交！</p>
                  <p className="text-sm text-green-700">管理員確認收款後，訂單將自動完成。如有查詢請聯絡 BOXIUM。</p>
                </div>
              )}
            </div>
          )}

          {/* Card list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#06038d]" />
              <span className="font-bold text-gray-900 text-sm">卡牌清單（{submission.items.length} 張）</span>
            </div>
            <div className="divide-y divide-gray-100">
              {submission.items.map((item: any, idx: number) => (
                <div key={item.id} className="p-4 flex items-start gap-3">
                  {item.cardImageUrl ? (
                    <img
                      src={item.cardImageUrl}
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
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="bg-[#06038d] text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          PSA {item.psaGrade}
                        </span>
                        {item.psaCertNo && (
                          <span className="text-xs text-gray-500">#{item.psaCertNo}</span>
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
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600 font-semibold">代送 PSA 費用合計</span>
              <span className="font-bold text-[#06038d] text-lg">
                HK${parseFloat(submission.totalFeeHkd).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Admin notes */}
          {submission.adminNotes && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-blue-800 text-sm mb-1">BOXIUM 備注</p>
              <p className="text-sm text-blue-700">{submission.adminNotes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
