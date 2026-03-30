import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import OrderChat from "@/components/OrderChat";
import DisputeMediaUpload from "@/components/DisputeMediaUpload";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, CheckCircle, Truck, Clock, XCircle, AlertCircle,
  CreditCard, MapPin, Phone, User, Flag, Star, MessageSquare, Loader2,
  Copy, ExternalLink, ShieldCheck, CircleDot, Smartphone, FileImage, CheckSquare, XSquare, Hourglass
} from "lucide-react";
import { OrderStatusStepper } from "@/components/OrderStatusStepper";
import { Label } from "@/components/ui/label";

type VerifyResult = {
  verified: boolean;
  payeeVerified: boolean;
  detectedPayee: string | null;
  amountVerified: boolean;
  detectedAmount: number | null;
  currency: string | null;
  statusVerified: boolean;
  detectedStatus: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

const ALIPAY_QR_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";

function PayOrderButton({ orderId, listingId, amount }: { orderId: number; listingId?: number | null; amount: string }) {
  const [open, setOpen] = useState(false);
  const [alipayStep, setAlipayStep] = useState<"select" | "qr" | "shipping" | "upload" | "done">("select");
  const [proofUrl, setProofUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [shippingForm, setShippingForm] = useState({ name: "", phone: "", address: "", district: "", region: "香港" });
  const utils = trpc.useUtils();

  const getCheckoutMutation = trpc.marketplace.getOrderCheckoutUrl.useMutation({
    onSuccess: (data) => { setOpen(false); window.location.href = data.checkoutUrl; },
    onError: (e: any) => toast.error(e.message || "無法獲取付款連結"),
  });

  const switchToAlipayMutation = trpc.marketplace.switchOrderPaymentToAlipay.useMutation({
    onSuccess: () => setAlipayStep("qr"),
    onError: (e: any) => toast.error(e.message || "無法切換付款方式"),
  });

  const submitProofMutation = trpc.marketplace.submitAlipayProof.useMutation({
    onSuccess: () => {
      setAlipayStep("done");
      utils.marketplace.getOrderByNo.invalidate();
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "提交失敗，請重試"),
  });

  const verifyProofMutation = trpc.marketplace.verifyPaymentProof.useMutation({
    onSuccess: (data) => {
      setVerifyResult(data as VerifyResult);
      setIsVerifying(false);
      if (data.verified) toast.success("✅ 付款金額驗證成功！");
      else toast.error("⚠️ 驗證未通過，請重新上傳截圖");
    },
    onError: (e: any) => { setIsVerifying(false); toast.error("驗證失敗：" + e.message); },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("截圖不能超過 5MB"); return; }
    setIsUploading(true); setVerifyResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await submitProofMutation.mutateAsync({ orderId, proofImageBase64: base64, mimeType: file.type });
      setProofUrl(result.proofUrl);
      toast.success("截圖已上傳，正在 AI 驗證金額...");
      setIsVerifying(true);
      verifyProofMutation.mutate({ proofImageUrl: result.proofUrl, expectedAmountHkd: parseFloat(amount) });
    } catch { toast.error("截圖上傳失敗，請重試"); }
    finally { setIsUploading(false); e.target.value = ""; }
  };

  const canSubmitProof = proofUrl && verifyResult?.verified === true;
  const isPending = getCheckoutMutation.isPending || switchToAlipayMutation.isPending;

  const resetAndClose = () => { setOpen(false); setAlipayStep("select"); setProofUrl(""); setVerifyResult(null); setShippingForm({ name: "", phone: "", address: "", district: "", region: "香港" }); };

  return (
    <>
      <Button className="text-white font-bold" style={{ backgroundColor: "#06038d" }} onClick={() => { setAlipayStep("select"); setOpen(true); }}>
        <CreditCard className="w-4 h-4 mr-2" />前往付款
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md p-0 overflow-visible border-2 border-[#FEDD00] gap-0">
          <VisuallyHidden><DialogTitle>付款方式</DialogTitle></VisuallyHidden>
          {/* 深藍色頭部 */}
          <div className="bg-[#06038D] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FEDD00]/20 flex items-center justify-center">
                {alipayStep === "select" ? <CreditCard className="w-4 h-4 text-[#FEDD00]" /> : <Smartphone className="w-4 h-4 text-[#FEDD00]" />}
              </div>
              <h2 className="text-white font-bold text-lg">
                {alipayStep === "select" ? "選擇付款方式" : alipayStep === "done" ? "訂單已提交" : "支付寶 HK 付款"}
              </h2>
            </div>
            <button onClick={resetAndClose} className="text-white/60 hover:text-white transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 bg-white text-[#06038D]">

          {alipayStep === "select" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">付款金額：<span className="font-bold text-gray-900">HKD {parseFloat(amount).toFixed(2)}</span></p>
              <button className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#06038d] hover:bg-[#f0f4ff] transition-all text-left group" disabled={isPending} onClick={() => getCheckoutMutation.mutate({ orderId })}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#635bff" }}>
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-[#06038d]">Stripe 信用卡 / Apple Pay</p>
                  <p className="text-xs text-gray-500">Visa / Mastercard / Apple Pay</p>
                </div>
                {getCheckoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-[#06038d] text-lg">›</span>}
              </button>
              <button className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#1677ff] hover:bg-[#f0f7ff] transition-all text-left group" disabled={isPending} onClick={() => switchToAlipayMutation.mutate({ orderId })}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1677ff" }}>
                  <span className="text-white font-bold text-lg">支</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-[#1677ff]">支付寶 HK</p>
                  <p className="text-xs text-gray-500">AlipayHK 電子錢包付款</p>
                </div>
                {switchToAlipayMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-gray-300 group-hover:text-[#1677ff] text-lg">›</span>}
              </button>
              <p className="text-xs text-gray-400 text-center pt-1">所有付款均通過加密傳輸保護</p>
            </div>
          )}

          {alipayStep === "qr" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-4 text-sm">
                <p className="font-bold text-[#06038D]">付款金額：<span className="text-lg">HKD {parseFloat(amount).toFixed(2)}</span></p>
              </div>
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-500">請揃描 QR Code 或點擊連結付款</p>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ALIPAY_QR_URL)}`} alt="支付寶 HK QR Code" className="w-48 h-48 mx-auto rounded-xl border-4 border-white shadow-lg" />
                <a href={ALIPAY_QR_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#06038D] hover:underline text-sm">
                  <Smartphone className="w-4 h-4" />在手機上開啟支付寶 HK
                </a>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-medium">付款備注填寫欄位請填寫商品編號：</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm font-bold tracking-wide flex-1">{listingId ? `#BOXIUM-${listingId}` : "請查看訂單詳情"}</p>
                  {listingId && (
                    <button onClick={() => { navigator.clipboard.writeText(`#BOXIUM-${listingId}`); toast.success("商品編號已複製！"); }} className="flex items-center gap-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg px-2 py-1 text-xs font-medium transition-colors">
                      <Copy className="w-3 h-3" />複製編號
                    </button>
                  )}
                </div>
                <p className="text-amber-600 mt-1">⚠️ 請務必在支付寶備注欄填寫以上編號，方便核對付款</p>
              </div>
              <Button className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white" onClick={() => setAlipayStep("shipping")}>
                我已完成付款，填寫收貨地址
              </Button>
            </div>
          )}

          {alipayStep === "shipping" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm text-[#06038D]">
                <p className="font-medium">請填寫收貨地址</p>
                <p className="text-xs mt-1 text-gray-500">收貨地址將提供給賣家安排寄送</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>收件人姓名 *</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：陳大文" value={shippingForm.name} onChange={e => setShippingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>聯絡電話 *</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：9123 4567" value={shippingForm.phone} onChange={e => setShippingForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>詳細地址 *</Label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：旺角彌敦道 123 號 ABC 大廈 5 樓 A 室" value={shippingForm.address} onChange={e => setShippingForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>地區</Label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D]" placeholder="例：旺角" value={shippingForm.district} onChange={e => setShippingForm(f => ({ ...f, district: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>區域</Label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#06038D] bg-white" value={shippingForm.region} onChange={e => setShippingForm(f => ({ ...f, region: e.target.value }))}>
                    <option value="香港島">香港島</option>
                    <option value="九龍">九龍</option>
                    <option value="新界">新界</option>
                    <option value="香港">香港（不指定）</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">* 必填欄位。如不需要寄送可跳過。</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-[#06038D] border-gray-200" onClick={() => setAlipayStep("qr")}>返回</Button>
                <Button className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white" disabled={!shippingForm.name.trim() || !shippingForm.phone.trim() || !shippingForm.address.trim()} onClick={() => setAlipayStep("upload")}>
                  下一步：上傳截圖
                </Button>
              </div>
            </div>
          )}

          {alipayStep === "upload" && (
            <div className="space-y-4">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm">
                <p className="font-bold text-[#06038D]">付款金額：HKD {parseFloat(amount).toFixed(2)}</p>
                <p className="text-gray-500 mt-1">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>
              </div>
              <div>
                <Label>付款截圖 *</Label>
                <div className="mt-2 border-2 border-dashed border-[#06038D]/30 rounded-xl p-6 text-center">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /><p className="text-sm">上傳中...</p></div>
                  ) : proofUrl ? (
                    <div className="space-y-3">
                      <img src={proofUrl} alt="付款截圖" className="max-h-40 mx-auto rounded object-contain" />
                      {isVerifying ? (
                        <div className="flex items-center justify-center gap-2 text-[#06038D] text-sm"><Loader2 className="w-4 h-4 animate-spin" /><span>AI 正在驗證付款金額...</span></div>
                      ) : verifyResult ? (
                        <div className={`rounded-xl p-3 text-sm space-y-2 ${verifyResult.verified ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                          <div className="flex items-center gap-2 font-medium mb-2">
                            {verifyResult.verified ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">三項驗證全部通過</span></> : <><XCircle className="w-4 h-4 text-orange-600" /><span className="text-orange-800">驗證未完全通過</span></>}
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { ok: verifyResult.payeeVerified, label: `收款方：${verifyResult.detectedPayee ?? "未識別"}${!verifyResult.payeeVerified ? " （需為「零度有限公司」）" : ""}` },
                              { ok: verifyResult.amountVerified, label: `金額：${verifyResult.currency ?? "HKD"} ${verifyResult.detectedAmount ?? "未識別"}${!verifyResult.amountVerified ? ` （需為 HKD ${parseFloat(amount).toFixed(2)}）` : ""}` },
                              { ok: verifyResult.statusVerified, label: `狀態：${verifyResult.detectedStatus ?? "未識別"}${!verifyResult.statusVerified ? " （需為「成功」）" : ""}` },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {item.ok ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                <span className={item.ok ? "text-green-700" : "text-red-700"}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <p className={`text-xs mt-1 ${verifyResult.verified ? "text-green-700" : "text-orange-700"}`}>{verifyResult.reason}</p>
                          {!verifyResult.verified && (
                            <button className="mt-1 text-xs text-[#06038D] underline" onClick={() => { setProofUrl(""); setVerifyResult(null); }}>重新上傳截圖</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="order-proof-upload" />
                      <label htmlFor="order-proof-upload" className="cursor-pointer">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-sm text-gray-500">點擊上傳截圖</p>
                        <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 5MB</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              {verifyResult && !verifyResult.verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <p className="font-medium">⚠️ 如確認已付款，可繼續提交</p>
                  <p className="mt-1">訂單將標記為「待人工核對」，管理員將在 1-2 個工作天內確認。</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-[#06038D] border-gray-200" onClick={() => setAlipayStep("shipping")}>返回</Button>
                <Button
                  className="flex-1 bg-[#06038D] hover:bg-[#0804b8] text-white font-bold"
                  disabled={!proofUrl || isVerifying || isUploading}
                  onClick={() => {
                    setAlipayStep("done");
                    utils.marketplace.getOrderByNo.invalidate();
                    utils.marketplace.getMyOrders.invalidate();
                  }}
                >
                  {submitProofMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : canSubmitProof ? "✅ 提交訂單" : "提交訂單（待核對）"}
                </Button>
              </div>
            </div>
          )}

          {alipayStep === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="font-bold text-lg text-[#06038D]">訂單已提交！</p>
              <p className="text-sm text-gray-500">我們將在核對收款後確認你的訂單，通常需要 1-2 個工作天。</p>
              <Button className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white" onClick={resetAndClose}>關閉</Button>
            </div>
          )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Auto-complete countdown hook
function usePaymentCountdown(createdAt: Date | string | null | undefined, timeoutMinutes: number) {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; expired: boolean } | null>(null);
  useEffect(() => {
    if (!createdAt || !timeoutMinutes) return;
    const deadline = new Date(createdAt).getTime() + timeoutMinutes * 60 * 1000;
    const calc = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft({ minutes: 0, seconds: 0, expired: true }); return; }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ minutes, seconds, expired: false });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [createdAt, timeoutMinutes]);
  return timeLeft;
}

function useAutoCompleteCountdown(autoCompleteAt: Date | string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; pct: number } | null>(null);
  useEffect(() => {
    if (!autoCompleteAt) return;
    const target = new Date(autoCompleteAt).getTime();
    const TOTAL_MS = 14 * 24 * 60 * 60 * 1000;
    const calc = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, pct: 100 }); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const elapsed = TOTAL_MS - diff;
      const pct = Math.min(100, Math.max(0, (elapsed / TOTAL_MS) * 100));
      setTimeLeft({ days, hours, minutes, pct });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [autoCompleteAt]);
  return timeLeft;
}

// Carrier tracking URL mapping
const CARRIER_TRACKING: Record<string, { label: string; url: string | null }> = {
  sf_express: { label: "順豐速運 (SF Express)", url: "https://www.sf-express.com/hk/tc/dynamic_function/waybill/#search/bill-number/" },
  hkpost: { label: "香港郵政 (HK Post)", url: "https://www.hongkongpost.hk/en/mail_tracking/index.html?tracking_no=" },
  dhl: { label: "DHL", url: "https://www.dhl.com/hk-en/home/tracking.html?tracking-id=" },
  fedex: { label: "FedEx", url: "https://www.fedex.com/fedextrack/?trknbr=" },
  ups: { label: "UPS", url: "https://www.ups.com/track?tracknum=" },
  chunghwa_post: { label: "中華郵政", url: "https://postserv.post.gov.tw/pstmail/main_mail.jsp?targetTxn=EB100&query_type=1&searchItem=" },
  black_cat: { label: "黑貓宅急", url: "https://www.t-cat.com.tw/Inquire/Trace.aspx?no=" },
  other: { label: "其他", url: null },
};

function getCarrierLabel(shippingMethod: string | null | undefined): string {
  if (!shippingMethod) return "快遞";
  return CARRIER_TRACKING[shippingMethod]?.label ?? shippingMethod;
}

function getTrackingUrl(shippingMethod: string | null | undefined, trackingNumber: string): string | null {
  if (!shippingMethod) return null;
  const carrier = CARRIER_TRACKING[shippingMethod];
  if (!carrier?.url) return null;
  return carrier.url + encodeURIComponent(trackingNumber);
}

const ORDER_STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock className="w-4 h-4" />, desc: "等待買家完成付款" },
  paid_held: { label: "已付款，等待出貨", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-4 h-4" />, desc: "付款已確認，等待賣家出貨" },
  payment_received: { label: "已收款", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <CreditCard className="w-4 h-4" />, desc: "付款已確認，等待賣家處理" },
  processing: { label: "處理中", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Package className="w-4 h-4" />, desc: "賣家正在準備出貨" },
  shipped: { label: "已出貨", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Truck className="w-4 h-4" />, desc: "商品已寄出，請耐心等候" },
  delivered: { label: "已送達", color: "bg-teal-100 text-teal-800 border-teal-200", icon: <Truck className="w-4 h-4" />, desc: "商品已送達，請確認收貨" },
  completed: { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle className="w-4 h-4" />, desc: "訂單已完成" },
  cancelled: { label: "已取消", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <XCircle className="w-4 h-4" />, desc: "訂單已取消" },
  disputed: { label: "爭議中", color: "bg-red-100 text-red-800 border-red-200", icon: <AlertCircle className="w-4 h-4" />, desc: "爭議處理中，請等待管理員回覆" },
};

// Timeline steps in order
const TIMELINE_STEPS = [
  { key: "pending_payment", label: "訂單建立", icon: <CircleDot className="w-4 h-4" /> },
  { key: "payment_received", label: "付款確認", icon: <CreditCard className="w-4 h-4" /> },
  { key: "processing", label: "賣家處理中", icon: <Package className="w-4 h-4" /> },
  { key: "shipped", label: "已出貨", icon: <Truck className="w-4 h-4" /> },
  { key: "completed", label: "確認收貨", icon: <CheckCircle className="w-4 h-4" /> },
];

const STATUS_ORDER = ["pending_payment", "paid_held", "payment_received", "processing", "shipped", "delivered", "completed"];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`w-7 h-7 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function OrderTimeline({ order }: { order: any }) {
  const currentIdx = STATUS_ORDER.indexOf(order.orderStatus);
  const isDisputed = order.orderStatus === "disputed";
  const isCancelled = order.orderStatus === "cancelled";

  if (isCancelled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 text-gray-500">
          <XCircle className="w-6 h-6" />
          <div>
            <p className="font-medium text-gray-700">訂單已取消</p>
            <p className="text-sm text-gray-500">此訂單已被取消</p>
          </div>
        </div>
      </div>
    );
  }

  if (isDisputed) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">爭議處理中</p>
            <p className="text-sm text-red-500">管理員將在 1-3 個工作天內處理</p>
          </div>
        </div>
        {order.disputeReason && (
          <div className="pt-3 border-t border-red-200">
            <p className="text-xs font-medium text-red-700 mb-1">爭議原因：</p>
            <p className="text-sm text-red-800">{order.disputeReason}</p>
          </div>
        )}
        {/* Evidence Upload CTA - shown when dispute not yet resolved */}
        {!order.disputeResolution && (
          <div className="pt-3 border-t border-red-200">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">📎</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-orange-900">提交證據可加快處理</p>
                  <p className="text-xs text-orange-700 mt-0.5">上傳商品照片、對話截圖等證據，有助管理員在 1 個工作天內更快裁決。</p>
                </div>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" }}
              onClick={() => document.getElementById('dispute-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            >
              <span>📤</span> 前往上傳爭議證據
            </button>
          </div>
        )}
        {order.disputeResolution && (
          <div className="pt-3 border-t border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs font-semibold text-green-700">處理結果：</p>
            </div>
            <p className="text-sm text-green-700">{order.disputeResolution}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <style>{`
        @keyframes checkmark-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(6, 3, 141, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(6, 3, 141, 0); }
          100% { box-shadow: 0 0 0 0 rgba(6, 3, 141, 0); }
        }
        @keyframes line-fill {
          0% { transform: scaleY(0); transform-origin: top; }
          100% { transform: scaleY(1); transform-origin: top; }
        }
        @keyframes fade-slide-in {
          0% { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .timeline-done-icon { animation: checkmark-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .timeline-current-pulse { animation: pulse-ring 2s ease-in-out infinite; }
        .timeline-line-fill { animation: line-fill 0.5s ease-out both; }
        .timeline-step-content { animation: fade-slide-in 0.35s ease-out both; }
      `}</style>
      {TIMELINE_STEPS.map((step, idx) => {
        const stepStatusIdx = STATUS_ORDER.indexOf(step.key);
        const isDone = currentIdx > stepStatusIdx;
        const isCurrent = currentIdx === stepStatusIdx;
        const isPending = currentIdx < stepStatusIdx;

        // Get timestamp for this step
        let timestamp: Date | null = null;
        if (step.key === "pending_payment") timestamp = order.createdAt ? new Date(order.createdAt) : null;
        else if (step.key === "payment_received" && (order.paymentStatus === "paid" || isDone || isCurrent)) {
          timestamp = order.updatedAt ? new Date(order.updatedAt) : null;
        }
        else if (step.key === "shipped" && order.shippedAt) timestamp = new Date(order.shippedAt);
        else if (step.key === "completed" && order.buyerConfirmedAt) timestamp = new Date(order.buyerConfirmedAt);

        return (
          <div key={step.key} className="flex gap-4 pb-6 last:pb-0"
            style={{ animationDelay: `${idx * 0.08}s` }}>
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300 ${
                isDone
                  ? "bg-green-500 border-green-500 text-white timeline-done-icon"
                  : isCurrent
                  ? "bg-[#06038d] border-[#06038d] text-white timeline-current-pulse"
                  : "bg-white border-gray-200 text-gray-300"
              }`}
              style={isDone ? { animationDelay: `${idx * 0.1}s` } : undefined}>
                {isDone ? (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      style={{
                        strokeDasharray: 14,
                        strokeDashoffset: 0,
                        animation: `checkmark-draw 0.35s ease-out ${idx * 0.1}s both`
                      }}
                    />
                    <style>{`
                      @keyframes checkmark-draw {
                        0% { stroke-dashoffset: 14; }
                        100% { stroke-dashoffset: 0; }
                      }
                    `}</style>
                  </svg>
                ) : step.icon}
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 mt-1 min-h-[20px] transition-all duration-500 ${
                  isDone ? "bg-green-300 timeline-line-fill" : "bg-gray-200"
                }`}
                style={isDone ? { animationDelay: `${idx * 0.1 + 0.3}s` } : undefined}
                />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 pt-1.5 pb-2 timeline-step-content"
              style={{ animationDelay: `${idx * 0.08 + 0.05}s` }}>
              <div className="flex items-center justify-between gap-2">
                <p className={`font-medium text-sm transition-colors duration-300 ${isPending ? "text-gray-400" : "text-gray-900"}`}>
                  {step.label}
                  {isCurrent && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06038d] inline-block animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </span>
                  )}
                </p>
                {timestamp && (
                  <span className="text-xs text-gray-500">
                    {timestamp.toLocaleDateString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {/* Extra info for shipped step */}
              {step.key === "shipped" && isCurrent && order.trackingNumber && (() => {
                const trackUrl = getTrackingUrl(order.shippingMethod, order.trackingNumber);
                return (
                  <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
                    <span className="font-medium">{getCarrierLabel(order.shippingMethod)}</span>
                    <span className="mx-1">·</span>
                    追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
                    {trackUrl && (
                      <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 underline">
                        查詢<ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })()}
              {/* Auto-complete notice */}
              {step.key === "completed" && isPending && order.orderStatus === "shipped" && order.autoCompleteAt && (
                <p className="text-xs text-gray-500 mt-1">
                  系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成
                </p>
              )}
              {/* Alipay proof sub-timeline: 截圖已提交 → 審核中 → 已核准/已拒絕 */}
              {step.key === "pending_payment" && order.paymentMethod === "alipay_hk" && order.alipayProofSubmittedAt && (
                <div className="mt-2 ml-1 border-l-2 border-dashed border-gray-200 pl-3 space-y-2">
                  {/* 截圖已提交 */}
                  <div className="flex items-start gap-2">
                    <FileImage className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">截圖已提交</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.alipayProofSubmittedAt).toLocaleDateString("zh-HK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  {/* 審核狀態 */}
                  {order.alipayProofStatus === "pending_review" && (
                    <div className="flex items-start gap-2">
                      <Hourglass className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0 animate-pulse" />
                      <div>
                        <p className="text-xs font-medium text-yellow-700">截圖審核中</p>
                        <p className="text-xs text-gray-400">管理員將盡快核對，通常在 24 小時內完成</p>
                      </div>
                    </div>
                  )}
                  {order.alipayProofStatus === "approved" && (
                    <div className="flex items-start gap-2">
                      <CheckSquare className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-green-700">截圖已核准</p>
                        <p className="text-xs text-gray-400">付款已確認，賣家將開始處理訂單</p>
                      </div>
                    </div>
                  )}
                  {order.alipayProofStatus === "rejected" && (
                    <div className="flex items-start gap-2">
                      <XSquare className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-700">截圖已拒絕</p>
                        {order.alipayProofRejectionReason && (
                          <p className="text-xs text-red-500">{order.alipayProofRejectionReason}</p>
                        )}
                        <p className="text-xs text-gray-400">請重新上傳正確的付款截圖</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const params = useParams<{ orderNo: string }>();
  const orderNo = params.orderNo ?? "";
  const [, navigate] = useLocation();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  // Re-upload alipay proof state
  const [showReuploadDialog, setShowReuploadDialog] = useState(false);
  const [reuploadProofUrl, setReuploadProofUrl] = useState("");
  const [isReuploadUploading, setIsReuploadUploading] = useState(false);
  const [isReuploadVerifying, setIsReuploadVerifying] = useState(false);
  const [reuploadVerifyResult, setReuploadVerifyResult] = useState<VerifyResult | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.marketplace.getOrderByNo.useQuery(
    { orderNo },
    {
      enabled: !!orderNo,
      // Poll every 30s when order is in pending_payment or alipay_proof_submitted state
      // so the page auto-updates if the order is cancelled by timeout or payment is confirmed
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.order?.orderStatus;
        return (status === "pending_payment" || status === "alipay_proof_submitted") ? 30000 : false;
      },
    }
  );

  const buyerCancelMutation = trpc.marketplace.buyerCancelOrder.useMutation({
    onSuccess: () => {
      toast.success("❌ 訂單已取消");
      setShowCancelDialog(false);
      setCancelReason("");
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmReceiptMutation = trpc.marketplace.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success("✅ 已確認收貨，款項將轉帳給賣家");
      setShowConfirmDialog(false);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadDisputeEvidenceMutation = trpc.marketplace.uploadDisputeEvidence.useMutation();

  const reuploadProofMutation = trpc.marketplace.resubmitAlipayProof.useMutation({
    onError: (e: any) => toast.error(e.message || "上傳失敗，請重試"),
  });

  const reuploadVerifyMutation = trpc.marketplace.verifyPaymentProof.useMutation({
    onSuccess: (data) => {
      setReuploadVerifyResult(data as VerifyResult);
      setIsReuploadVerifying(false);
      if (data.verified) toast.success("✅ 付款金額驗證成功！");
      else toast.error("⚠️ 驗證未通過，請重新上傳截圖");
    },
    onError: (e: any) => { setIsReuploadVerifying(false); toast.error("驗證失敗：" + e.message); },
  });

  const handleReuploadProof = async (e: React.ChangeEvent<HTMLInputElement>, orderNo: string, amount: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("截圖不能超過 5MB"); return; }
    setIsReuploadUploading(true); setReuploadVerifyResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await reuploadProofMutation.mutateAsync({ orderNo, proofImageBase64: base64, mimeType: file.type });
      setReuploadProofUrl(result.proofUrl);
      toast.success("截圖已上傳，正在 AI 驗證金額...");
      setIsReuploadVerifying(true);
      reuploadVerifyMutation.mutate({ proofImageUrl: result.proofUrl, expectedAmountHkd: parseFloat(amount) });
    } catch { toast.error("截圖上傳失敗，請重試"); }
    finally { setIsReuploadUploading(false); e.target.value = ""; }
  };

  const openDisputeMutation = trpc.marketplace.openDispute.useMutation({
    onSuccess: () => {
      toast.success("⚠️ 爭議申請已提交，管理員將盡快處理");
      setShowDisputeDialog(false);
      setDisputeReason("");
      setDisputeEvidenceUrls([]);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
      utils.marketplace.getMyOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: number) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (disputeEvidenceUrls.length + files.length > 3) {
      toast.error("最多可上傳 3 張截圖");
      return;
    }
    setIsUploadingEvidence(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { toast.error("圖片不能超過 5MB"); continue; }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await uploadDisputeEvidenceMutation.mutateAsync({
          orderId,
          fileBase64: base64,
          mimeType: file.type,
        });
        newUrls.push(result.url);
      }
      setDisputeEvidenceUrls(prev => [...prev, ...newUrls]);
      toast.success(`已上傳 ${newUrls.length} 張截圖`);
    } catch {
      toast.error("上傳失敗，請重試");
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = "";
    }
  };

  const submitReviewMutation = trpc.marketplace.submitReview.useMutation({
    onSuccess: () => {
      toast.success("⭐ 評價已提交，感謝你的反饋！");
      setShowReviewDialog(false);
      setReviewComment("");
      setReviewRating(5);
      utils.marketplace.getOrderByNo.invalidate({ orderNo });
    },
    onError: (e) => toast.error(e.message),
  });

  // Payment timeout countdown - fetch timeout setting
  const { data: timeoutSettings } = trpc.system.getTimeoutSettings.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const paymentCountdown = usePaymentCountdown(
    data?.order?.orderStatus === "pending_payment" ? data?.order?.createdAt : null,
    timeoutSettings?.paymentTimeoutMinutes ?? 30
  );

  // Auto-complete countdown - MUST be called unconditionally before any conditional returns
  const autoCompleteCountdown = useAutoCompleteCountdown(
    data?.order?.orderStatus === "shipped" ? data?.order?.autoCompleteAt : null
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-40 animate-pulse" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }} />
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 space-y-4 animate-pulse">
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "#f0f4ff" }}>
            <Package className="w-10 h-10" style={{ color: "#06038d", opacity: 0.4 }} />
          </div>
          <p className="font-medium text-gray-700">訂單不存在或無權查看</p>
          <Link href="/profile?tab=orders"><Button style={{ backgroundColor: "#06038d" }} className="text-white font-bold">返回訂單列表</Button></Link>
        </div>
      </div>
    );
  }

  const { order, items, listing, review, isBuyer, isSeller, sellerPhone, buyerContactPhone, isMeetup } = data;

  const shippingAddr = (() => {
    if (!order.shippingAddress) return null;
    try { return JSON.parse(order.shippingAddress as string); } catch { return null; }
  })();

  const statusInfo = ORDER_STATUS_LABEL[order.orderStatus] ?? { label: order.orderStatus, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null, desc: "" };
  const canConfirm = isBuyer && (order.orderStatus === "shipped" || order.orderStatus === "delivered");
  // Calculate dispute window: 7 days from shipment
  const DISPUTE_WINDOW_DAYS = 7;
  const disputeDeadline = order.shippedAt ? (() => {
    const d = new Date(order.shippedAt);
    d.setDate(d.getDate() + DISPUTE_WINDOW_DAYS);
    return d;
  })() : null;
  const disputeDaysLeft = disputeDeadline ? Math.ceil((disputeDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isWithinDisputeWindow = disputeDaysLeft !== null ? disputeDaysLeft > 0 : true; // if no shippedAt, allow dispute
  const canDispute = isBuyer && ["shipped", "delivered", "payment_received", "processing", "paid_held"].includes(order.orderStatus) && isWithinDisputeWindow;
  const isCompleted = order.orderStatus === "completed";
  const canReview = isBuyer && isCompleted && order.sellerType === "seller" && !review;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Hero Banner ── */}
      <div
        className="relative"
        style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "#FEDD00" }} />
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-8">
          {/* LOGO row */}
          <div className="mb-5">
            <Link href="/">
              <img src="/boxium-logo.png" alt="BOXIUM" className="h-16 cursor-pointer p-1" />
            </Link>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl flex-shrink-0"
              style={{ background: "#FEDD00", borderColor: "white" }}
            >
              <ShieldCheck className="w-10 h-10" style={{ color: "#06038d" }} />
            </div>
            <div className="text-center md:text-left pb-1 flex-1">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h1 className="text-2xl md:text-3xl font-bold text-white">訂單詳情</h1>
                {order.shippingMethod === 'meetup' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400 text-amber-900 flex-shrink-0">
                    🤝 面交
                  </span>
                )}
              </div>
              <button
                className="text-white/70 text-sm font-mono flex items-center gap-1 mt-1 hover:text-white transition-colors mx-auto md:mx-0"
                onClick={() => { navigator.clipboard.writeText(order.orderNo); toast.success("訂單號已複製"); }}
              >
                #{order.orderNo}
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <Link href="/profile?tab=orders">
              <Button size="sm" className="font-bold" style={{ background: "#FEDD00", color: "#06038d" }}>
                <ArrowLeft className="w-4 h-4 mr-1" />返回訂單
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 space-y-5">

        {/* Status Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusInfo.color}`}>
                {statusInfo.icon}
              </div>
              <div className="min-w-0">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <p className="text-xs text-gray-600 mt-0.5 truncate">{statusInfo.desc}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-[#06038d] text-base sm:text-lg">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</p>
              <p className="text-xs text-gray-500 capitalize">{order.paymentMethod?.replace("_", " ")}</p>
            </div>
          </div>

          {/* Payment countdown banner */}
          {order.orderStatus === "pending_payment" && paymentCountdown && !paymentCountdown.expired && (
            <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="bg-amber-100 rounded-full p-1.5 flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">請盡快完成付款</p>
                <p className="text-xs text-amber-600 mt-0.5">超時後訂單將自動取消，商品重新上架</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-lg font-bold text-amber-700 tabular-nums">
                  {String(paymentCountdown.minutes).padStart(2, '0')}:{String(paymentCountdown.seconds).padStart(2, '0')}
                </p>
                <p className="text-[10px] text-amber-500">剩餘時間</p>
              </div>
            </div>
          )}
          {order.orderStatus === "pending_payment" && paymentCountdown?.expired && (
            <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">付款時限已到，訂單即將自動取消</p>
            </div>
          )}

          {/* Action Buttons - pending_payment: show pay button + cancel button */}
          {isBuyer && order.orderStatus === "pending_payment" && (
            <div className="px-4 pb-4 flex items-center gap-2 border-t pt-3">
              <PayOrderButton
                orderId={order.id}
                listingId={order.listingId}
                amount={order.subtotalHkd as string ?? "0"}
              />
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="w-4 h-4 mr-1.5" />取消訂單
              </Button>
            </div>
          )}
          {/* paid_held / payment_received / processing: waiting for seller to ship */}
          {isBuyer && ["paid_held", "payment_received", "processing"].includes(order.orderStatus) && (
            <div className="px-4 pb-4 border-t pt-3">
              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />付款已成功，等待賣家出貨中...
              </span>
            </div>
          )}
          {/* Action Buttons */}
          {(canConfirm || canDispute || canReview) && (
            <div className="px-4 pb-4 flex flex-wrap gap-2 border-t pt-3">
              {canConfirm && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowConfirmDialog(true)}>
                  <CheckCircle className="w-4 h-4 mr-1.5" />確認收貨
                </Button>
              )}
              {canDispute && (
                <div className="flex flex-col gap-0.5">
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDisputeDialog(true)}>
                    <Flag className="w-4 h-4 mr-1.5" />申請爭議
                  </Button>
                  {disputeDaysLeft !== null && disputeDaysLeft <= 3 && disputeDaysLeft > 0 && (
                    <p className="text-[10px] text-red-500">還有 {disputeDaysLeft} 天可申請</p>
                  )}
                </div>
              )}
              {isBuyer && ["shipped", "delivered"].includes(order.orderStatus) && !isWithinDisputeWindow && (
                <p className="text-xs text-gray-500 self-center">爬議申請期限已過（7 天）</p>
              )}
              {canReview && (
                <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowReviewDialog(true)}>
                  <Star className="w-4 h-4 mr-1.5" />評價賣家
                </Button>
              )}
            </div>
          )}
          {isCompleted && review && (
            <div className="px-4 pb-4 border-t pt-3">
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                已評價 {review.rating} 星
                {review.comment && <span className="ml-1 text-gray-600">· {review.comment}</span>}
              </span>
            </div>
          )}
        </div>

        {/* Payment Proof Status Banner */}
        {isBuyer && order.paymentMethod === "alipay_hk" && (order as any).alipayProofStatus === "pending_review" && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800 text-sm">截圖審核中</p>
              <p className="text-amber-700 text-xs mt-1">管理員正在核對您的付款截圖，通常在 1 個工作日內完成。</p>
            </div>
          </div>
        )}
        {isBuyer && order.paymentMethod === "alipay_hk" && (order as any).alipayProofStatus === "approved" && (
          <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-start gap-3">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800 text-sm">截圖已核准 ✅</p>
              <p className="text-green-700 text-xs mt-1">您的付款截圖已通過管理員審核，付款已確認完成。</p>
            </div>
          </div>
        )}
        {/* Payment Rejected Banner */}
        {isBuyer && order.paymentMethod === "alipay_hk" && (order as any).alipayProofStatus === "rejected" && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-800 text-sm">付款截圖已被拒絕</p>
                {(order as any).paymentRejectionReason && (
                  <p className="text-red-700 text-xs mt-1">管理員拒絕原因：{(order as any).paymentRejectionReason}</p>
                )}
                <p className="text-red-600 text-xs mt-1">請重新上傳正確的付款截圖。</p>
              </div>
            </div>
            <button
              className="w-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
              onClick={() => { setReuploadProofUrl(""); setReuploadVerifyResult(null); setShowReuploadDialog(true); }}
            >
              <span>🔄</span> 重新上傳付款截圖
            </button>
          </div>
        )}

        {/* Order Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "#06038d" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "#06038d" }} />訂單進度
          </h2>
          <OrderStatusStepper
            orderStatus={order.orderStatus}
            shippingMethod={order.shippingMethod}
            role={isBuyer ? "buyer" : "seller"}
            size="lg"
            timestamps={{
              createdAt: order.createdAt,
              paidAt: order.paidAt ?? (order.orderStatus !== "pending_payment" ? order.updatedAt : null),
              shippedAt: order.shippedAt,
              deliveredAt: (order as any).deliveredAt,
              completedAt: order.buyerConfirmedAt,
              meetupCompletedAt: order.buyerConfirmedAt,
            }}
          />
        </div>

        {/* Shipping Tracking */}
        {order.trackingNumber && (() => {
          const trackUrl = getTrackingUrl(order.shippingMethod, order.trackingNumber);
          return (
            <div className="rounded-xl p-4" style={{ backgroundColor: "#f0f4ff", border: "1px solid #c7d2fe" }}>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-indigo-900 text-sm">物流資訊</p>
                  <p className="text-sm text-indigo-700 mt-1">
                    <span className="font-medium">{getCarrierLabel(order.shippingMethod)}</span>
                    <span className="mx-2">·</span>
                    追蹤號：<span className="font-mono font-bold">{order.trackingNumber}</span>
                    <button
                      className="ml-2 text-indigo-500 hover:text-indigo-700"
                      onClick={() => { navigator.clipboard.writeText(order.trackingNumber!); toast.success("追蹤號已複製"); }}
                    >
                      <Copy className="w-3.5 h-3.5 inline" />
                    </button>
                  </p>
                  {trackUrl && (
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      點擊查詢追蹤狀態
                    </a>
                  )}
                  {order.shippedAt && (
                    <p className="text-xs text-indigo-600 mt-1">
                      出貨時間：{new Date(order.shippedAt).toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {order.autoCompleteAt && order.orderStatus === "shipped" && (
                    <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-indigo-700">自動確認收貨倒計時</p>
                        {autoCompleteCountdown && (
                          <span className="text-xs font-bold text-indigo-800">
                            {autoCompleteCountdown.days > 0 && `${autoCompleteCountdown.days} 天 `}
                            {autoCompleteCountdown.hours} 小時 {autoCompleteCountdown.minutes} 分鐘
                          </span>
                        )}
                      </div>
                      {autoCompleteCountdown && (
                        <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${autoCompleteCountdown.pct}%`,
                              background: autoCompleteCountdown.pct > 80
                                ? "linear-gradient(90deg, #06038d, #e53e3e)"
                                : "linear-gradient(90deg, #06038d, #4f46e5)"
                            }}
                          />
                        </div>
                      )}
                      <p className="text-xs text-indigo-500 mt-1">
                        如未手動確認，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Product Info */}
        {listing && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-gray-900">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "#06038d" }}>商品資訊</h2>
            <div className="flex items-start gap-3">
              {(() => {
                const imgs = listing.images
                  ? (typeof listing.images === "string"
                    ? (() => { try { return JSON.parse(listing.images as string); } catch { return null; } })()
                    : listing.images)
                  : null;
                return imgs?.[0] ? (
                  <img src={imgs[0]} alt={listing.title} className="w-16 h-20 object-contain rounded-lg border bg-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-20 rounded-lg border border-gray-200 flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06038d 0%, #0a06b5 100%)" }}>
                    <span className="text-white font-black text-xs tracking-tight text-center leading-tight">BOX<br/>IUM</span>
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{listing.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{listing.condition}</p>
                <p className="text-sm font-bold text-[#06038d] mt-1">HKD {parseFloat(listing.priceHkd as string).toFixed(2)}</p>
              </div>
              <Link href={`/marketplace/${listing.id}`}>
                <Button variant="outline" size="sm" className="text-xs flex-shrink-0 text-gray-700 border-gray-300 bg-white hover:bg-gray-50">
                  <ExternalLink className="w-3 h-3 mr-1" />查看
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Shipping Address */}
        {shippingAddr && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-gray-900">
            <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "#06038d" }}>收貨資料</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{shippingAddr.name}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{shippingAddr.phone}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>
                  {shippingAddr.address}
                  {shippingAddr.district ? `，${shippingAddr.district}` : ""}
                  {shippingAddr.region ? `，${shippingAddr.region}` : ""}
                </span>
              </div>
              {shippingAddr.sfStationCode && (
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      shippingAddr.sfStationCode.startsWith('H')
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {shippingAddr.sfStationCode.startsWith('H') ? '順豐智能櫃' : '順豐站'}
                    </span>
                    <span className="font-mono text-gray-700">{shippingAddr.sfStationCode}</span>
                    {shippingAddr.sfStationName && (
                      <span className="text-gray-500 text-xs">· {shippingAddr.sfStationName}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meetup Contact Info - shown after order completed */}
        {isMeetup && isCompleted && (isBuyer ? sellerPhone : buyerContactPhone) && (
          <div className="bg-white rounded-xl border-2 shadow-sm p-4" style={{ borderColor: '#FEDD00' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FEDD00' }}>
                <Phone className="w-3.5 h-3.5" style={{ color: '#06038D' }} />
              </div>
              <h2 className="font-bold text-sm" style={{ color: '#06038D' }}>面交聯絡資料</h2>
            </div>
            <div className="space-y-2 text-sm">
              {isBuyer && sellerPhone && (
                <div className="flex items-center justify-between p-3 bg-[#06038D]/5 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">賣家電話</p>
                    <p className="font-bold text-[#06038D] text-base">{sellerPhone}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(sellerPhone!); toast.success('已複製賣家電話'); }}
                    className="text-xs text-[#06038D] underline hover:no-underline"
                  >複製</button>
                </div>
              )}
              {isSeller && buyerContactPhone && (
                <div className="flex items-center justify-between p-3 bg-[#06038D]/5 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">買家電話</p>
                    <p className="font-bold text-[#06038D] text-base">{buyerContactPhone}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(buyerContactPhone!); toast.success('已複製買家電話'); }}
                    className="text-xs text-[#06038D] underline hover:no-underline"
                  >複製</button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">論電話僅於訂單完成後顯示，請自行與對方協商面交地點</p>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: "#06038d" }}>付款摘要</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">商品金額</span>
              <span className="text-gray-800">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">付款方式</span>
              <span className="text-gray-800 capitalize">{order.paymentMethod === "alipay_hk" ? "支付寶 HK" : "Stripe 信用卡"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">付款狀態</span>
              <span className={order.paymentStatus === "paid" ? "text-green-600 font-medium" : "text-amber-600"}>
                {order.paymentStatus === "paid" ? "已付款" : order.paymentStatus === "pending" ? "待付款" : order.paymentStatus === "refunded" ? "已退款" : order.paymentStatus}
              </span>
            </div>
            {/* P1 Fix #5: Alipay HK Refund Tracking */}
            {order.paymentMethod === 'alipay_hk' && (order as any).alipayRefundStatus && (order as any).alipayRefundStatus !== 'not_applicable' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-800">支付寶 HK 退款狀態</span>
                  <Badge variant="outline" className={
                    (order as any).alipayRefundStatus === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                    (order as any).alipayRefundStatus === 'processing' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    'bg-amber-100 text-amber-800 border-amber-200'
                  }>
                    {(order as any).alipayRefundStatus === 'completed' ? '已退款' :
                     (order as any).alipayRefundStatus === 'processing' ? '退款處理中' : '待退款'}
                  </Badge>
                </div>
                {(order as any).alipayRefundAmount && (
                  <p className="text-xs text-amber-700">退款金額：HKD {parseFloat((order as any).alipayRefundAmount).toFixed(2)}</p>
                )}
                {(order as any).alipayRefundCompletedAt && (
                  <p className="text-xs text-green-700">退款完成時間：{new Date((order as any).alipayRefundCompletedAt).toLocaleString('zh-HK')}</p>
                )}
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>總計</span>
              <span className="text-[#06038d]">HKD {parseFloat(order.subtotalHkd as string ?? "0").toFixed(2)}</span>
            </div>
            {/* Alipay proof screenshot display + re-upload */}
            {order.paymentMethod === "alipay_hk" && isBuyer && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {order.alipayProofImageUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 font-medium">支付寶 HK 付款截圖</p>
                      {order.orderStatus === "pending_payment" && !((order as any).paymentRejectionReason) && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                          <Loader2 className="w-3 h-3 animate-spin" />截圖審核中
                        </span>
                      )}
                      {order.orderStatus === "pending_payment" && (order as any).paymentRejectionReason && (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                          <XCircle className="w-3 h-3" />已被拒絕
                        </span>
                      )}
                    </div>
                    {order.orderStatus === "pending_payment" && !((order as any).paymentRejectionReason) && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                        ⏱ 通常 <strong>1-2 個工作天</strong>內確認，請耐心等候。如有疑問請聯絡客服。
                      </p>
                    )}
                    <img
                      src={order.alipayProofImageUrl}
                      alt="付款截圖"
                      className="w-full max-h-40 object-contain rounded-lg border border-gray-200 cursor-pointer"
                      onClick={() => window.open(order.alipayProofImageUrl!, "_blank")}
                    />
                    {order.orderStatus === "pending_payment" && (
                      <button
                        className="w-full text-xs text-[#06038D] border border-[#06038D]/30 rounded-lg py-2 hover:bg-[#06038D]/5 transition-colors"
                        onClick={() => { setReuploadProofUrl(""); setReuploadVerifyResult(null); setShowReuploadDialog(true); }}
                      >
                        🔄 重新上傳截圖
                      </button>
                    )}
                  </div>
                ) : order.orderStatus === "pending_payment" ? (
                  <div className="space-y-1">
                    <p className="text-xs text-amber-600">⚠️ 尚未上傳支付寶 HK 付款截圖</p>
                    <button
                      className="w-full text-xs text-[#06038D] border border-[#06038D]/30 rounded-lg py-2 hover:bg-[#06038D]/5 transition-colors"
                      onClick={() => { setReuploadProofUrl(""); setReuploadVerifyResult(null); setShowReuploadDialog(true); }}
                    >
                      📷 上傳付款截圖
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* P1 Fix #4: Order Messages */}
        {order.orderStatus !== 'pending_payment' && (
          <OrderChat orderNo={orderNo!} />
        )}
        {/* Dispute Evidence Upload — visible when order is disputed */}
        {order.orderStatus === 'disputed' && order.id && (
          <div id="dispute-evidence" className="rounded-xl overflow-hidden bg-white border border-orange-200 shadow-sm p-4">
            <DisputeMediaUpload
              orderId={order.id}
              orderNo={orderNo!}
              canUpload={true}
            />
          </div>
        )}

        {/* Order Meta */}
        <div className="text-xs text-gray-500 space-y-1 px-1">
          <p>訂單建立：{new Date(order.createdAt).toLocaleString("zh-HK")}</p>
          <p>最後更新：{new Date(order.updatedAt).toLocaleString("zh-HK")}</p>
        </div>
      </div>

      {/* Reupload Alipay Proof Dialog */}
      <Dialog open={showReuploadDialog} onOpenChange={(v) => { if (!v) { setShowReuploadDialog(false); setReuploadProofUrl(""); setReuploadVerifyResult(null); } }}>
        <DialogContent bottomSheet className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "#06038d" }}>
              {reuploadVerifyResult?.verified ? "截圖驗證成功" : "上傳支付寶 HK 截圖"}
            </DialogTitle>
          </DialogHeader>
          {reuploadVerifyResult?.verified ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="font-bold text-lg text-[#06038D]">截圖已提交！</p>
              <p className="text-sm text-gray-500">我們將在核對收款後確認你的訂單。</p>
              <Button className="w-full bg-[#06038D] hover:bg-[#0804b8] text-white" onClick={() => { setShowReuploadDialog(false); setReuploadProofUrl(""); setReuploadVerifyResult(null); utils.marketplace.getOrderByNo.invalidate({ orderNo }); }}>關閉</Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="bg-[#06038D]/5 border border-[#06038D]/20 rounded-xl p-3 text-sm">
                <p className="font-bold text-[#06038D]">付款金額：HKD {parseFloat(order?.subtotalHkd as string ?? "0").toFixed(2)}</p>
                <p className="text-gray-500 mt-1">請上傳支付寶 HK 的付款成功截圖，系統將自動驗證金額是否一致。</p>
              </div>
              <div>
                <Label>付款截圖 *</Label>
                <div className="mt-2 border-2 border-dashed border-[#06038D]/30 rounded-xl p-6 text-center">
                  {isReuploadUploading ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm">上傳中...</p>
                    </div>
                  ) : reuploadProofUrl ? (
                    <div className="space-y-3">
                      <img src={reuploadProofUrl} alt="付款截圖" className="max-h-40 mx-auto rounded object-contain" />
                      {isReuploadVerifying ? (
                        <div className="flex items-center justify-center gap-2 text-[#06038D] text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI 正在驗證付款金額...</span>
                        </div>
                      ) : reuploadVerifyResult ? (
                        <div className="rounded-xl p-3 text-sm space-y-2 bg-red-50 border border-red-200">
                          <div className="flex items-center gap-2 font-medium">
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span className="text-red-800">驗證未通過，請重新上傳</span>
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { ok: reuploadVerifyResult.payeeVerified, label: `收款方：${reuploadVerifyResult.detectedPayee ?? "未識別"}${!reuploadVerifyResult.payeeVerified ? " （需為「零度有限公司」）" : ""}` },
                              { ok: reuploadVerifyResult.amountVerified, label: `金額：${reuploadVerifyResult.currency ?? "HKD"} ${reuploadVerifyResult.detectedAmount ?? "未識別"}${!reuploadVerifyResult.amountVerified ? ` （需為 HKD ${parseFloat(order?.subtotalHkd as string ?? "0").toFixed(2)}）` : ""}` },
                              { ok: reuploadVerifyResult.statusVerified, label: `狀態：${reuploadVerifyResult.detectedStatus ?? "未識別"}${!reuploadVerifyResult.statusVerified ? " （需為「成功」）" : ""}` },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {item.ok ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                <span className={item.ok ? "text-green-700" : "text-red-700"}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <button className="mt-1 text-xs text-[#06038D] underline" onClick={() => { setReuploadProofUrl(""); setReuploadVerifyResult(null); }}>重新上傳截圖</button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <input type="file" accept="image/*" onChange={(e) => handleReuploadProof(e, order!.orderNo, order?.subtotalHkd as string ?? "0")} className="hidden" id="reupload-proof-input" />
                      <label htmlFor="reupload-proof-input" className="cursor-pointer">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-sm text-gray-500">點擊上傳截圖</p>
                        <p className="text-xs text-gray-400 mt-1">支援 JPG、PNG，最大 5MB</p>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <Button variant="outline" className="w-full text-[#06038D] border-gray-200" onClick={() => setShowReuploadDialog(false)}>關閉</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => { setShowCancelDialog(open); if (!open) setCancelReason(""); }}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" />取消訂單</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">確認要取消此訂單？取消後訂單將無法恢復。</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              只有「待付款」狀態的訂單可以取消。付款後如需退款請申請爭議。
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">取消原因（選填）</p>
              <Textarea
                placeholder="請說明取消原因，例如：誤購、不需要等"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                className="text-sm"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>保留訂單</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={buyerCancelMutation.isPending}
              onClick={() => buyerCancelMutation.mutate({ orderId: order.id, reason: cancelReason.trim() || undefined })}
            >
              {buyerCancelMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</>
                : <><XCircle className="w-4 h-4 mr-2" />確認取消</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Receipt Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader><DialogTitle>確認收貨</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">確認已收到商品後，款項將立即轉帳給賣家。此操作不可撤銷。</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              請確認商品狀態與描述相符後再確認收貨。如有問題，請先申請爭議。
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>取消</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={confirmReceiptMutation.isPending}
              onClick={() => confirmReceiptMutation.mutate({ orderId: order.id })}
            >
              {confirmReceiptMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />處理中...</>
                : <><CheckCircle className="w-4 h-4 mr-2" />確認收貨</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={(open) => { setShowDisputeDialog(open); if (!open) { setDisputeEvidenceUrls([]); setDisputeReason(""); } }}>
        <DialogContent bottomSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />申請爭議
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">請詳細描述問題，管理員將在 1-3 個工作天內處理。</p>
            <Textarea
              placeholder="請描述問題，例如：商品與描述不符、未收到商品、商品損壞等（至少 10 字）"
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              {disputeReason.trim().length < 10 && disputeReason.length > 0 ? (
                <p className="text-xs text-red-500">還需輸入 {10 - disputeReason.trim().length} 個字</p>
              ) : disputeReason.trim().length >= 10 ? (
                <p className="text-xs text-green-600">✓ 內容已符合要求</p>
              ) : (
                <p className="text-xs text-muted-foreground">至少輸入 10 個字</p>
              )}
              <span className="text-xs text-muted-foreground">{disputeReason.length}/1000</span>
            </div>
            {/* Evidence Image Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium">證據截圖（選項，最多 3 張）</p>
              <div className="flex flex-wrap gap-2">
                {disputeEvidenceUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                    <img src={url} alt={`證據 ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setDisputeEvidenceUrls(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-700"
                    >×</button>
                  </div>
                ))}
                {disputeEvidenceUrls.length < 3 && (
                  <label className={`w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors ${isUploadingEvidence ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingEvidence
                      ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : <><span className="text-2xl text-muted-foreground">+</span><span className="text-[10px] text-muted-foreground">上傳圖片</span></>}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleEvidenceUpload(e, order.id)}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">支援 JPG、PNG，單張不超過 5MB</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>取消</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={openDisputeMutation.isPending || disputeReason.trim().length < 10 || isUploadingEvidence}
              onClick={() => openDisputeMutation.mutate({ orderId: order.id, reason: disputeReason.trim(), evidenceUrls: disputeEvidenceUrls.length > 0 ? disputeEvidenceUrls : undefined })}
            >
              {openDisputeMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</>
                : <><Flag className="w-4 h-4 mr-2" />提交爭議</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />評價賣家
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">評分</p>
              <StarRating value={reviewRating} onChange={setReviewRating} />
              <p className="text-xs text-muted-foreground">
                {reviewRating === 1 && "非常不滿意"}
                {reviewRating === 2 && "不滿意"}
                {reviewRating === 3 && "一般"}
                {reviewRating === 4 && "滿意"}
                {reviewRating === 5 && "非常滿意"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">評語（選填）</p>
              <Textarea
                placeholder="分享你的購物體驗..."
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                rows={3}
                className="text-sm"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground text-right">{reviewComment.length}/500</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reviewAnonymous}
                onChange={e => setReviewAnonymous(e.target.checked)}
                className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
              />
              <span className="text-sm">匿名評價</span>
              <span className="text-xs text-muted-foreground">（賣家將不會看到你的名字）</span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>取消</Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              disabled={submitReviewMutation.isPending || reviewRating === 0}
              onClick={() => submitReviewMutation.mutate({
                orderId: order.id,
                rating: reviewRating,
                comment: reviewComment.trim() || undefined,
                isAnonymous: reviewAnonymous,
              })}
            >
              {submitReviewMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</>
                : <><MessageSquare className="w-4 h-4 mr-2" />提交評價</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
