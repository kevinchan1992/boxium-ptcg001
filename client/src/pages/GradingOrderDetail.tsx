import { useState } from "react";
import { useLocation, useParams } from "wouter";
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
  pending_shipment: "待收件",
  pending_payment: "待收件",
  paid: "待收件",
  received: "已收件",
  submitted_to_psa: "已出團",
  grading: "鑑定中",
  graded: "鑑定完成",
  payment_pending: "待付款",
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
                <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#06038d', fontSize: '13px' }}>代送 PSA 費用合計（鑑定後付款）</td>
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
            <li>鑑定完成後，系統將通知您付款，請於 <strong>30 天內</strong> 完成付款。</li>
            <li>逾期未付款，平台保留對相關卡片自行處理之權利。</li>
            <li>如有查詢，請透過平台訊息聯絡 BOXIUM。</li>
          </ol>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>BOXIUM × PSA 代客鑑定服務 · boxium.asia</div>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>此申請單由系統自動生成，如有疑問請聯絡 BOXIUM</div>
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GradingOrderDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "alipay_hk">("stripe");
  const [payingLoading, setPayingLoading] = useState(false);
  const [showAlipayQR, setShowAlipayQR] = useState(false);
  const [alipayProofFile, setAlipayProofFile] = useState<File | null>(null);
  const [alipayProofPreview, setAlipayProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);

  const submissionId = parseInt(params.id ?? "0", 10);
  const { data: submission, isLoading } = trpc.grading.getSubmissionDetail.useQuery(
    { id: submissionId },
    { enabled: submissionId > 0 }
  );

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

  const handleAlipayProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAlipayProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAlipayProofPreview(ev.target?.result as string);
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
          <div style="color:#b0b8e8;font-size:11px;margin-top:2px">請將此申請單打印後連同卡牧一起寄出</div>
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
            <td colspan="4" style="padding:10px 12px;text-align:right;font-weight:700;color:#06038d;font-size:13px">代送 PSA 費用合計（鑑定後付款）</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#06038d;font-size:14px">HK$${totalFee}</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="border:1px solid #d1d5db;border-radius:8px;padding:14px 16px;font-size:12px">
        <div style="font-weight:700;color:#06038d;margin-bottom:8px;font-size:13px">重要事項</div>
        <ol style="padding-left:16px;margin:0;line-height:1.8;color:#374151">
          <li>請使用有追蹤號碼的寄件方式，並自行購買保險。</li>
          <li>卡片請妥善包裝，建議使用硬卡套及泡泡紙保護。</li>
          <li>鑑定完成後，系統將通知您付款，請於 <strong>30 天內</strong> 完成付款。</li>
          <li>逾期未付款，平台保留對相關卡片自行處理之權利。</li>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[#06038d] text-[#06038d] hover:bg-blue-50"
            >
              <Printer className="h-4 w-4 mr-2" />
              打印申請單
            </Button>
          </div>

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
                isCancelled ? "bg-red-500" : isCompleted ? "bg-green-500" : "bg-yellow-400 text-[#06038d]"
              }`}>
                {STATUS_LABEL[submission.status] ?? submission.status}
              </span>
            </div>
          </div>

          {/* Progress stepper */}
          {!isCancelled && (
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

          {/* Shipping notice (before received) */}
          {(submission.status === "pending_payment" || submission.status === "paid") && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
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
                </div>
              </div>
            </div>
          )}

          {/* Batch info */}
          {submission.batch && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-purple-800 text-sm mb-1">出團批次資訊</p>
              <div className="text-xs text-purple-700 space-y-0.5">
                <p>批次：{submission.batch.name}</p>
                {submission.batch.shippedAt && (
                  <p>出團日期：{new Date(submission.batch.shippedAt).toLocaleDateString("zh-HK")}</p>
                )}
                {submission.batch.estimatedReturnAt && (
                  <p>預計回件：{new Date(submission.batch.estimatedReturnAt).toLocaleDateString("zh-HK")}</p>
                )}
              </div>
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

                  <div className="flex items-center justify-between pt-3 border-t border-green-200">
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
                    <p className="text-sm font-bold text-black mb-2">上傳付款截圖</p>
                    <p className="text-xs text-gray-500 mb-3">完成付款後，請上傳支付寶 HK 付款成功截圖，管理員確認後訂單將自動完成。</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlipayProofChange}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#06038d] file:text-white hover:file:bg-[#06038d]/90 cursor-pointer"
                    />
                    {alipayProofPreview && (
                      <img src={alipayProofPreview} alt="截圖預覽" className="mt-3 max-h-48 rounded-lg border border-gray-200 mx-auto block object-contain" />
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowAlipayQR(false); setAlipayProofFile(null); setAlipayProofPreview(null); }}
                        className="flex-1 border-gray-300 text-black"
                      >
                        返回
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitAlipayProof}
                        disabled={!alipayProofFile || uploadingProof}
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
