import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Settings, Percent, AlertCircle, CheckCircle2, RefreshCw, ChevronRight,
  Clock, ShoppingCart, Tag, Shield, MessageSquare, Truck
} from "lucide-react";

interface TierState {
  tier1Max: string;
  tier1Rate: string;
  tier2Max: string;
  tier2Rate: string;
  tier3Rate: string;
}

interface MoreSettings {
  autoCompleteDays: number;
  minListingPriceHkd: number;
  cartRetentionDays: number;
  cartExpiryReminderDays: number;
  maxOffersPerDay: number;
  alipayReviewSlaHours: number;
  disputeSlaHours: number;
  paymentTimeoutMinutes: number;
  offerPaymentTimeoutHours: number;
  paymentReminderMinutes: number;
}

function calcFeeForAmount(amount: number, tiers: TierState): number {
  const t1Max  = parseFloat(tiers.tier1Max)  || 5000;
  const t1Rate = parseFloat(tiers.tier1Rate) || 5;
  const t2Max  = parseFloat(tiers.tier2Max)  || 10000;
  const t2Rate = parseFloat(tiers.tier2Rate) || 4;
  const t3Rate = parseFloat(tiers.tier3Rate) || 3;
  let rate: number;
  if (amount <= t1Max) rate = t1Rate;
  else if (amount <= t2Max) rate = t2Rate;
  else rate = t3Rate;
  return Math.round(amount * (rate / 100) * 100) / 100;
}

function SettingField({
  label, hint, value, onChange, min, max, step = 1, suffix, prefix
}: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void;
  min?: number; max?: number; step?: number;
  suffix?: string; prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-gray-300 text-sm font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-gray-400 text-sm pointer-events-none">{prefix}</span>}
        <Input
          type="number" min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`bg-gray-700 border-gray-600 text-white focus:border-yellow-500 ${prefix ? "pl-10" : ""} ${suffix ? "pr-14" : ""}`}
        />
        {suffix && <span className="absolute right-3 text-gray-400 text-sm pointer-events-none">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function AdminPlatformSettings() {
  const [tiers, setTiers] = useState<TierState>({
    tier1Max: "5000", tier1Rate: "5",
    tier2Max: "10000", tier2Rate: "4",
    tier3Rate: "3",
  });
  const [isEditing, setIsEditing] = useState(false);

  // More settings state
  const [more, setMore] = useState<Record<keyof MoreSettings, string>>({
    autoCompleteDays: "14",
    minListingPriceHkd: "4",
    cartRetentionDays: "14",
    cartExpiryReminderDays: "3",
    maxOffersPerDay: "3",
    alipayReviewSlaHours: "24",
    disputeSlaHours: "72",
    paymentTimeoutMinutes: "30",
    offerPaymentTimeoutHours: "24",
    paymentReminderMinutes: "60",
  });
  const [isMoreEditing, setIsMoreEditing] = useState(false);

  const { data: settings, isLoading, refetch } = trpc.system.getPlatformSettings.useQuery(undefined);
  const { data: moreData, isLoading: moreLoading, refetch: moreRefetch } = trpc.system.getMoreSettings.useQuery(undefined);

  useEffect(() => {
    if (settings && !isEditing) {
      setTiers({
        tier1Max:  (settings.tier1Max  ?? 5000).toString(),
        tier1Rate: (((settings.tier1Rate ?? 0.05) * 100)).toString(),
        tier2Max:  (settings.tier2Max  ?? 10000).toString(),
        tier2Rate: (((settings.tier2Rate ?? 0.04) * 100)).toString(),
        tier3Rate: (((settings.tier3Rate ?? 0.03) * 100)).toString(),
      });
    }
  }, [settings, isEditing]);

  useEffect(() => {
    if (moreData && !isMoreEditing) {
      setMore({
        autoCompleteDays: moreData.autoCompleteDays.toString(),
        minListingPriceHkd: moreData.minListingPriceHkd.toString(),
        cartRetentionDays: moreData.cartRetentionDays.toString(),
        cartExpiryReminderDays: moreData.cartExpiryReminderDays.toString(),
        maxOffersPerDay: moreData.maxOffersPerDay.toString(),
        alipayReviewSlaHours: moreData.alipayReviewSlaHours.toString(),
        disputeSlaHours: moreData.disputeSlaHours.toString(),
        paymentTimeoutMinutes: moreData.paymentTimeoutMinutes.toString(),
        offerPaymentTimeoutHours: moreData.offerPaymentTimeoutHours.toString(),
        paymentReminderMinutes: moreData.paymentReminderMinutes.toString(),
      });
    }
  }, [moreData, isMoreEditing]);

  const updateMutation = trpc.system.updatePlatformFeeRate.useMutation({
    onSuccess: () => {
      toast.success("三級費率已成功更新");
      setIsEditing(false);
      refetch();
    },
    onError: (err) => {
      toast.error(`更新失敗：${err.message}`);
    },
  });

  const updateMoreMutation = trpc.system.updateMoreSettings.useMutation({
    onSuccess: () => {
      toast.success("更多設定已成功儲存，系統即時生效");
      setIsMoreEditing(false);
      moreRefetch();
    },
    onError: (err) => {
      toast.error(`更新失敗：${err.message}`);
    },
  });

  const handleSave = () => {
    const t1Max  = parseFloat(tiers.tier1Max);
    const t1Rate = parseFloat(tiers.tier1Rate);
    const t2Max  = parseFloat(tiers.tier2Max);
    const t2Rate = parseFloat(tiers.tier2Rate);
    const t3Rate = parseFloat(tiers.tier3Rate);
    if ([t1Max, t1Rate, t2Max, t2Rate, t3Rate].some(isNaN)) {
      toast.error("所有欄位必須填寫有效數字");
      return;
    }
    if (t1Max >= t2Max) {
      toast.error("第一級上限必須小於第二級上限");
      return;
    }
    if ([t1Rate, t2Rate, t3Rate].some(v => v < 0 || v > 30)) {
      toast.error("費率必須在 0% 至 30% 之間");
      return;
    }
    updateMutation.mutate({ tier1Max: t1Max, tier1Rate: t1Rate, tier2Max: t2Max, tier2Rate: t2Rate, tier3Rate: t3Rate });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (settings) {
      setTiers({
        tier1Max:  (settings.tier1Max  ?? 5000).toString(),
        tier1Rate: (((settings.tier1Rate ?? 0.05) * 100)).toString(),
        tier2Max:  (settings.tier2Max  ?? 10000).toString(),
        tier2Rate: (((settings.tier2Rate ?? 0.04) * 100)).toString(),
        tier3Rate: (((settings.tier3Rate ?? 0.03) * 100)).toString(),
      });
    }
  };

  const handleMoreSave = () => {
    const parsed = {
      autoCompleteDays: parseInt(more.autoCompleteDays),
      minListingPriceHkd: parseFloat(more.minListingPriceHkd),
      cartRetentionDays: parseInt(more.cartRetentionDays),
      cartExpiryReminderDays: parseInt(more.cartExpiryReminderDays),
      maxOffersPerDay: parseInt(more.maxOffersPerDay),
      alipayReviewSlaHours: parseInt(more.alipayReviewSlaHours),
      disputeSlaHours: parseInt(more.disputeSlaHours),
      paymentTimeoutMinutes: parseInt(more.paymentTimeoutMinutes),
      offerPaymentTimeoutHours: parseInt(more.offerPaymentTimeoutHours),
      paymentReminderMinutes: parseInt(more.paymentReminderMinutes),
    };
    if (Object.values(parsed).some(isNaN)) {
      toast.error("所有欄位必須填寫有效數字");
      return;
    }
    updateMoreMutation.mutate(parsed);
  };

  const handleMoreCancel = () => {
    setIsMoreEditing(false);
    if (moreData) {
      setMore({
        autoCompleteDays: moreData.autoCompleteDays.toString(),
        minListingPriceHkd: moreData.minListingPriceHkd.toString(),
        cartRetentionDays: moreData.cartRetentionDays.toString(),
        cartExpiryReminderDays: moreData.cartExpiryReminderDays.toString(),
        maxOffersPerDay: moreData.maxOffersPerDay.toString(),
        alipayReviewSlaHours: moreData.alipayReviewSlaHours.toString(),
        disputeSlaHours: moreData.disputeSlaHours.toString(),
        paymentTimeoutMinutes: moreData.paymentTimeoutMinutes.toString(),
        offerPaymentTimeoutHours: moreData.offerPaymentTimeoutHours.toString(),
        paymentReminderMinutes: moreData.paymentReminderMinutes.toString(),
      });
    }
  };

  const updateTier = (key: keyof TierState, value: string) => {
    setTiers(prev => ({ ...prev, [key]: value }));
    setIsEditing(true);
  };

  const updateMoreField = (key: keyof MoreSettings, value: string) => {
    setMore(prev => ({ ...prev, [key]: value }));
    setIsMoreEditing(true);
  };

  const previewAmounts = [500, 2000, 5000, 6000, 10000, 15000];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-yellow-400" />
        <div>
          <h2 className="text-xl font-bold text-white">平台設定</h2>
          <p className="text-sm text-gray-400">管理平台費率及其他系統設定</p>
        </div>
      </div>

      {/* Tiered Fee Rate Card */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-yellow-400" />
              <CardTitle className="text-white text-lg">平台交易費率（三級制）</CardTitle>
            </div>
            {!isLoading && settings && (
              <div className="flex gap-2">
                <Badge variant="outline" className="border-yellow-500 text-yellow-400 text-xs px-2 py-0.5">
                  ≤HK${(settings.tier1Max ?? 5000).toLocaleString()}: {((settings.tier1Rate ?? 0.05) * 100).toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-400 text-xs px-2 py-0.5">
                  ≤HK${(settings.tier2Max ?? 10000).toLocaleString()}: {((settings.tier2Rate ?? 0.04) * 100).toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="border-green-500 text-green-400 text-xs px-2 py-0.5">
                  其他: {((settings.tier3Rate ?? 0.03) * 100).toFixed(1)}%
                </Badge>
              </div>
            )}
          </div>
          <CardDescription className="text-gray-400">
            適用於所有 C2C 二手市集交易。費率按成交金額自動套用對應等級，並在賣家放款時生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>載入中...</span>
            </div>
          ) : (
            <>
              <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-300 space-y-1">
                    <p>費率變更<strong>僅影響新建立的訂單</strong>，已存在的訂單不受影響。</p>
                    <p>每筆訂單按<strong>該訂單的成交金額</strong>套用對應等級費率（非累進計算）。</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-800/60 rounded-xl p-4 border border-yellow-900/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
                      <span className="text-yellow-400 text-xs font-bold">1</span>
                    </div>
                    <span className="text-yellow-400 font-semibold text-sm">第一級</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-400 text-xs">成交金額上限（HKD）</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">HK$</span>
                        <Input type="number" min="1" step="100" value={tiers.tier1Max}
                          onChange={e => updateTier("tier1Max", e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white pl-10 focus:border-yellow-500" />
                      </div>
                      <p className="text-xs text-gray-500">HK$1 至此金額</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-400 text-xs">費率（%）</Label>
                      <div className="relative">
                        <Input type="number" min="0" max="30" step="0.1" value={tiers.tier1Rate}
                          onChange={e => updateTier("tier1Rate", e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white pr-8 focus:border-yellow-500" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ChevronRight className="w-4 h-4 text-gray-600 rotate-90" />
                </div>

                <div className="bg-gray-800/60 rounded-xl p-4 border border-blue-900/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                      <span className="text-blue-400 text-xs font-bold">2</span>
                    </div>
                    <span className="text-blue-400 font-semibold text-sm">第二級</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-400 text-xs">成交金額上限（HKD）</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">HK$</span>
                        <Input type="number" min="1" step="100" value={tiers.tier2Max}
                          onChange={e => updateTier("tier2Max", e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white pl-10 focus:border-blue-500" />
                      </div>
                      <p className="text-xs text-gray-500">超過第一級至此金額</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-400 text-xs">費率（%）</Label>
                      <div className="relative">
                        <Input type="number" min="0" max="30" step="0.1" value={tiers.tier2Rate}
                          onChange={e => updateTier("tier2Rate", e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white pr-8 focus:border-blue-500" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ChevronRight className="w-4 h-4 text-gray-600 rotate-90" />
                </div>

                <div className="bg-gray-800/60 rounded-xl p-4 border border-green-900/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                      <span className="text-green-400 text-xs font-bold">3</span>
                    </div>
                    <span className="text-green-400 font-semibold text-sm">第三級（最高級）</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-gray-400 text-xs">適用範圍</Label>
                      <div className="bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-gray-400 text-sm">
                        超過 HK${(parseFloat(tiers.tier2Max) || 10000).toLocaleString()} 以上
                      </div>
                      <p className="text-xs text-gray-500">無上限</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-gray-400 text-xs">費率（%）</Label>
                      <div className="relative">
                        <Input type="number" min="0" max="30" step="0.1" value={tiers.tier3Rate}
                          onChange={e => updateTier("tier3Rate", e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white pr-8 focus:border-green-500" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSave} disabled={updateMutation.isPending}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold">
                    {updateMutation.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />儲存中...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" />儲存三級費率</>
                    )}
                  </Button>
                  <Button onClick={handleCancel} variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700">取消</Button>
                </div>
              )}

              <Separator className="bg-gray-700" />

              <div className="space-y-3">
                <p className="text-sm text-gray-400 font-medium">費率預覽計算</p>
                <div className="grid grid-cols-3 gap-2">
                  {previewAmounts.map((amount) => {
                    const fee = calcFeeForAmount(amount, tiers);
                    const sellerReceives = amount - fee;
                    const t1Max = parseFloat(tiers.tier1Max) || 5000;
                    const t2Max = parseFloat(tiers.tier2Max) || 10000;
                    const tierLabel = amount <= t1Max ? "第一級" : amount <= t2Max ? "第二級" : "第三級";
                    const tierColor = amount <= t1Max ? "text-yellow-400" : amount <= t2Max ? "text-blue-400" : "text-green-400";
                    return (
                      <div key={amount} className="bg-gray-800 rounded-lg p-3 text-center">
                        <p className={`text-xs mb-0.5 font-medium ${tierColor}`}>{tierLabel}</p>
                        <p className="text-xs text-gray-500 mb-1">成交 HK${amount.toLocaleString()}</p>
                        <p className="text-yellow-400 text-sm font-semibold">費 HK${fee.toLocaleString()}</p>
                        <p className="text-green-400 text-xs">賣家收 HK${sellerReceives.toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* More Settings Card */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-white text-lg">更多設定</CardTitle>
          </div>
          <CardDescription className="text-gray-400">
            訂單時限、商品出價、購物車、SLA 等系統行為設定。修改後即時生效，無需重啟服務。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {moreLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>載入中...</span>
            </div>
          ) : (
            <>
              {/* Info Box */}
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-purple-300">
                    所有設定修改後<strong>即時生效</strong>，影響後續新建立的訂單及操作，不影響已存在的訂單。
                  </p>
                </div>
              </div>

              {/* Section 1: Order Lifecycle */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-300">訂單生命週期</h3>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/60 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SettingField
                    label="出貨後自動完成天數"
                    hint="賣家出貨後，買家 N 天內未確認收貨，訂單自動完成"
                    value={more.autoCompleteDays}
                    onChange={v => updateMoreField("autoCompleteDays", v)}
                    min={1} max={90} suffix="天"
                  />

                  <SettingField
                    label="待付款自動取消時限"
                    hint="訂單建立後 N 分鐘內未付款，自動取消"
                    value={more.paymentTimeoutMinutes}
                    onChange={v => updateMoreField("paymentTimeoutMinutes", v)}
                    min={5} max={1440} suffix="分鐘"
                  />
                </div>
              </div>

              {/* Section 2: Offer Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-yellow-300">出價設定</h3>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingField
                    label="每商品每買家每日最多出價次數"
                    hint="同一商品 24 小時內，同一買家最多出價 N 次"
                    value={more.maxOffersPerDay}
                    onChange={v => updateMoreField("maxOffersPerDay", v)}
                    min={1} max={20} suffix="次"
                  />
                  <SettingField
                    label="接受出價後付款時限"
                    hint="賣家接受出價後，買家須在 N 小時內完成付款"
                    value={more.offerPaymentTimeoutHours}
                    onChange={v => updateMoreField("offerPaymentTimeoutHours", v)}
                    min={1} max={168} suffix="小時"
                  />
                </div>
              </div>

              {/* Section 3: Listing Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-400" />
                  <h3 className="text-sm font-semibold text-green-300">商品上架設定</h3>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/60 grid grid-cols-1 md:grid-cols-1 gap-4">
                  <SettingField
                    label="最低出售金額"
                    hint="賣家上架商品的最低定價限制"
                    value={more.minListingPriceHkd}
                    onChange={v => updateMoreField("minListingPriceHkd", v)}
                    min={0.01} max={9999} step={0.5} prefix="HK$"
                  />
                </div>
              </div>

              {/* Section 4: Cart Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-orange-300">購物車設定</h3>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingField
                    label="購物車商品保留天數"
                    hint="商品加入購物車後保留 N 天，到期自動移除"
                    value={more.cartRetentionDays}
                    onChange={v => updateMoreField("cartRetentionDays", v)}
                    min={1} max={90} suffix="天"
                  />
                  <SettingField
                    label="到期提醒提前天數"
                    hint="購物車商品到期前 N 天發送提醒通知"
                    value={more.cartExpiryReminderDays}
                    onChange={v => updateMoreField("cartExpiryReminderDays", v)}
                    min={1} max={30} suffix="天"
                  />
                </div>
              </div>

              {/* Section 5: SLA Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-red-300">SLA 時限設定</h3>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/60 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SettingField
                    label="Alipay 審核 SLA"
                    hint="Alipay 付款憑證審核時限"
                    value={more.alipayReviewSlaHours}
                    onChange={v => updateMoreField("alipayReviewSlaHours", v)}
                    min={1} max={168} suffix="小時"
                  />
                  <SettingField
                    label="爭議處理 SLA"
                    hint="訂單爭議處理時限"
                    value={more.disputeSlaHours}
                    onChange={v => updateMoreField("disputeSlaHours", v)}
                    min={1} max={720} suffix="小時"
                  />
                  <SettingField
                    label="付款提醒發送時機"
                    hint="訂單建立後 N 分鐘發送付款提醒郵件"
                    value={more.paymentReminderMinutes}
                    onChange={v => updateMoreField("paymentReminderMinutes", v)}
                    min={5} max={1440} suffix="分鐘"
                  />
                </div>
              </div>

              {/* Save / Cancel Buttons */}
              {isMoreEditing && (
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleMoreSave} disabled={updateMoreMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold">
                    {updateMoreMutation.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />儲存中...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" />儲存所有設定</>
                    )}
                  </Button>
                  <Button onClick={handleMoreCancel} variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700">取消</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
