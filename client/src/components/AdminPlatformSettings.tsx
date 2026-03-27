import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, Percent, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

export default function AdminPlatformSettings() {
  const [feeRateInput, setFeeRateInput] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading, refetch } = trpc.system.getPlatformSettings.useQuery(undefined);

  useEffect(() => {
    if (settings && !isEditing) {
      setFeeRateInput(settings.platformFeeRatePercent.toString());
    }
  }, [settings, isEditing]);

  const updateMutation = trpc.system.updatePlatformFeeRate.useMutation({
    onSuccess: (data) => {
      toast.success(`平台費率已更新為 ${data.feeRatePercent}%`);
      setIsEditing(false);
      refetch();
    },
    onError: (err) => {
      toast.error(`更新失敗：${err.message}`);
    },
  });

  const handleSave = () => {
    const val = parseFloat(feeRateInput);
    if (isNaN(val) || val < 0 || val > 30) {
      toast.error("費率必須在 0% 至 30% 之間");
      return;
    }
    updateMutation.mutate({ feeRatePercent: val });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (settings) {
      setFeeRateInput(settings.platformFeeRatePercent.toString());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-yellow-400" />
        <div>
          <h2 className="text-xl font-bold text-white">平台設定</h2>
          <p className="text-sm text-gray-400">管理平台費率及其他系統設定</p>
        </div>
      </div>

      {/* Platform Fee Rate Card */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-yellow-400" />
              <CardTitle className="text-white text-lg">平台交易費率</CardTitle>
            </div>
            {!isLoading && settings && (
              <Badge
                variant="outline"
                className="border-yellow-500 text-yellow-400 text-sm px-3 py-1"
              >
                當前：{settings.platformFeeRatePercent}%
              </Badge>
            )}
          </div>
          <CardDescription className="text-gray-400">
            適用於所有 C2C 二手市集交易。平台費率從每筆訂單的成交金額中扣除，並在賣家放款時生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>載入中...</span>
            </div>
          ) : (
            <>
              {/* Info Box */}
              <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-300 space-y-1">
                    <p>費率變更<strong>僅影響新建立的訂單</strong>，已存在的訂單不受影響。</p>
                    <p>例如：費率設為 5%，成交金額 HK$1,000，平台費 = HK$50，賣家實收 HK$950。</p>
                  </div>
                </div>
              </div>

              {/* Fee Rate Input */}
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">費率（%）</Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-40">
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      step="0.1"
                      value={feeRateInput}
                      onChange={(e) => {
                        setFeeRateInput(e.target.value);
                        setIsEditing(true);
                      }}
                      className="bg-gray-800 border-gray-600 text-white pr-8 focus:border-yellow-500"
                      placeholder="5.0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                        size="sm"
                      >
                        {updateMutation.isPending ? (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            儲存中...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            儲存
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        取消
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">有效範圍：0% 至 30%，支援小數點（例如 4.5）</p>
              </div>

              <Separator className="bg-gray-700" />

              {/* Preview calculation */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400 font-medium">費率預覽計算</p>
                <div className="grid grid-cols-3 gap-3">
                  {[500, 1000, 2000].map((amount) => {
                    const rate = parseFloat(feeRateInput) || 0;
                    const fee = Math.round(amount * (rate / 100));
                    const sellerReceives = amount - fee;
                    return (
                      <div key={amount} className="bg-gray-800 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-1">成交 HK${amount}</p>
                        <p className="text-yellow-400 text-sm font-semibold">費 HK${fee}</p>
                        <p className="text-green-400 text-xs">賣家收 HK${sellerReceives}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Future settings placeholder */}
      <Card className="bg-gray-900 border-gray-700 opacity-60">
        <CardHeader>
          <CardTitle className="text-gray-500 text-base">更多設定（即將推出）</CardTitle>
          <CardDescription className="text-gray-500">
            最低出售金額、最高出價折扣上限、自動完成訂單天數等設定將在此管理。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
