import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Mail, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";

const EMAIL_TYPES = [
  { value: "welcome", label: "🎉 歡迎電郵", desc: "新用戶註冊後收到的歡迎信" },
  { value: "offer_received", label: "💬 新出價通知（賣家）", desc: "買家對商品出價時，賣家收到的通知" },
  { value: "offer_accepted", label: "✅ 出價已被接受（買家）", desc: "賣家接受出價後，買家收到的通知" },
  { value: "offer_rejected", label: "❌ 出價未獲接受（買家）", desc: "賣家拒絕出價後，買家收到的通知" },
  { value: "payment_reminder", label: "⏰ 付款提醒（買家）", desc: "出價接受後 1 小時未付款的提醒" },
  { value: "order_confirmed", label: "📋 訂單確認（買家）", desc: "付款成功後的訂單確認通知" },
  { value: "order_shipped", label: "📦 訂單已出貨（買家）", desc: "賣家上傳出貨資料後的通知" },
  { value: "order_completed", label: "🎊 訂單完成（買家）", desc: "確認收貨後的訂單完成通知" },
  { value: "order_cancelled", label: "🚫 訂單取消", desc: "訂單被取消時的通知" },
  { value: "seller_approved", label: "✅ 賣家申請批准", desc: "賣家申請獲批准時的通知" },
  { value: "seller_rejected", label: "❌ 賣家申請拒絕", desc: "賣家申請被拒絕時的通知" },
  { value: "dispute_opened_buyer", label: "⚙️ 爭議申請確認（買家）", desc: "買家提交爭議後收到的確認電郵" },
  { value: "dispute_opened_seller", label: "⚠️ 爭議開啟通知（賣家）", desc: "買家提交爭議後賣家收到的通知" },
  { value: "dispute_resolved_seller_won", label: "✅ 爭議解決 — 賣家勝訴", desc: "爭議裁定訂單完成，賣家收到的通知" },
  { value: "dispute_resolved_seller_lost", label: "📋 爭議解決 — 退款買家", desc: "爭議裁定退款給買家，賣家收到的通知" },
] as const;

type EmailType = typeof EMAIL_TYPES[number]["value"];

export default function AdminEmailTest() {
  const [to, setTo] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("welcome");
  const [lastResult, setLastResult] = useState<{ success: boolean; subject?: string; error?: string } | null>(null);

  const sendMutation = trpc.email.sendTestEmail.useMutation({
    onSuccess: (data) => {
      setLastResult({ success: true, subject: data.subject });
      toast.success(`測試電郵已發送！主旨：${data.subject}`);
    },
    onError: (err) => {
      setLastResult({ success: false, error: err.message });
      toast.error(`發送失敗：${err.message}`);
    },
  });

  const selectedType = EMAIL_TYPES.find(t => t.value === emailType);

  const handleSend = () => {
    if (!to.trim()) {
      toast.error("請輸入收件人電郵地址");
      return;
    }
    sendMutation.mutate({ to: to.trim(), emailType });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#06038d]/20 border border-[#06038d]/30">
          <FlaskConical className="w-5 h-5 text-[#FFD700]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">電郵測試工具</h2>
          <p className="text-sm text-slate-500">發送各類測試電郵到指定地址，驗證電郵樣式與內容</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Form */}
        <Card className="bg-[#12122a] border-[#2a2a4a]">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-900 text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#FFD700]" />
              發送測試電郵
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-400 text-sm">收件人電郵</Label>
              <Input
                type="email"
                placeholder="輸入收件人電郵地址..."
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-[#0a0a1a] border-[#2a2a4a] text-slate-900 placeholder:text-slate-400 focus:border-[#06038d]"
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-400 text-sm">電郵類型</Label>
              <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
                <SelectTrigger className="bg-[#0a0a1a] border-[#2a2a4a] text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#12122a] border-[#2a2a4a]">
                  {EMAIL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-slate-900 hover:bg-[#1a1a3a] focus:bg-[#1a1a3a]">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedType && (
              <div className="p-3 rounded-lg bg-[#06038d]/10 border border-[#06038d]/20">
                <p className="text-xs text-slate-500">{selectedType.desc}</p>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || !to.trim()}
              className="w-full bg-[#FFD700] hover:bg-[#e6c200] text-[#06038d] font-bold"
            >
              {sendMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-[#06038d] border-t-transparent rounded-full" />
                  發送中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  發送測試電郵
                </span>
              )}
            </Button>

            {lastResult && (
              <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                lastResult.success
                  ? "bg-emerald-50 border-green-700/30"
                  : "bg-red-50 border-red-700/30"
              }`}>
                {lastResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${lastResult.success ? "text-green-300" : "text-red-300"}`}>
                    {lastResult.success ? "發送成功" : "發送失敗"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lastResult.success ? `主旨：${lastResult.subject}` : lastResult.error}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Types Reference */}
        <Card className="bg-[#12122a] border-[#2a2a4a]">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-900 text-base">電郵類型說明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {EMAIL_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEmailType(t.value)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    emailType === t.value
                      ? "bg-[#06038d]/20 border-[#06038d]/50"
                      : "bg-[#0a0a1a] border-[#1a1a3a] hover:border-[#2a2a4a]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-900 font-medium">{t.label}</span>
                    {emailType === t.value && (
                      <Badge className="bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30 text-xs">已選</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Note */}
      <div className="p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-400">注意：</strong>
          測試電郵使用示範資料（虛構訂單號、商品名稱、金額），不會影響實際資料庫記錄，也不會觸發退訂檢查。
          建議在不同裝置和郵件客戶端（Gmail、Outlook、Apple Mail）測試顯示效果。
        </p>
      </div>
    </div>
  );
}
