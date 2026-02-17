import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
// Using window.alert for notifications instead of toast
import { Clock, RefreshCw, Calendar } from "lucide-react";

export function AdminSchedule() {
  
  // Fetch schedule config
  const { data: config, refetch } = trpc.priceSchedule.getConfig.useQuery();
  
  // Local state for form inputs
  const [snkrdunkEnabled, setSnkrdunkEnabled] = useState(false);
  const [snkrdunkUpdateTime, setSnkrdunkUpdateTime] = useState("09:00");
  const [ebayEnabled, setEbayEnabled] = useState(false);
  const [ebayUpdateTime, setEbayUpdateTime] = useState("21:00");

  // Update local state when config is loaded
  useEffect(() => {
    if (config) {
      setSnkrdunkEnabled(config.snkrdunkEnabled);
      setSnkrdunkUpdateTime(config.snkrdunkUpdateTime);
      setEbayEnabled(config.ebayEnabled);
      setEbayUpdateTime(config.ebayUpdateTime);
    }
  }, [config]);

  // Update config mutation
  const updateConfig = trpc.priceSchedule.updateConfig.useMutation({
    onSuccess: () => {
      alert("設定已儲存：價格更新排程設定已成功更新");
      refetch();
    },
    onError: (error) => {
      alert(`儲存失敗：${error.message}`);
    },
  });

  // Manual trigger mutations
  const triggerSnkrdunk = trpc.priceSchedule.triggerSnkrdunkUpdate.useMutation({
    onSuccess: () => {
      alert("更新完成：SNKRDUNK 價格更新已完成");
      refetch();
    },
    onError: (error) => {
      alert(`更新失敗：${error.message}`);
    },
  });

  const triggerEbay = trpc.priceSchedule.triggerEbayUpdate.useMutation({
    onSuccess: () => {
      alert("更新完成：eBay 價格更新已完成");
      refetch();
    },
    onError: (error) => {
      alert(`更新失敗：${error.message}`);
    },
  });

  const handleSaveConfig = () => {
    const data = {
      snkrdunkEnabled,
      snkrdunkUpdateTime,
      ebayEnabled,
      ebayUpdateTime,
    };
    updateConfig.mutate(data);
  };

  const formatLastExecutedTime = (timestamp: Date | null | undefined) => {
    if (!timestamp) return "從未執行";
    return new Date(timestamp).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">價格更新排程</h2>
        <p className="text-gray-600">設定每日自動更新 SNKRDUNK 和 eBay 價格的時間</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SNKRDUNK Schedule Card */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Clock className="w-5 h-5 text-blue-600" />
              SNKRDUNK 實際成交價
            </CardTitle>
            <CardDescription className="text-gray-600">
              設定每日自動更新 SNKRDUNK 卡牌價格的時間
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable/Disable Switch */}
            <div className="flex items-center justify-between">
              <Label htmlFor="snkrdunk-enabled" className="text-gray-900">啟用自動更新</Label>
            <Switch
              id="snkrdunk-enabled"
              checked={snkrdunkEnabled}
              onCheckedChange={(checked) => {
                console.log('[AdminSchedule] SNKRDUNK switch changed:', checked);
                setSnkrdunkEnabled(checked);
              }}
            />
            </div>

            {/* Update Time Input */}
            <div className="space-y-2">
              <Label htmlFor="snkrdunk-time" className="text-gray-900">更新時間 (HH:mm)</Label>
              <Input
                id="snkrdunk-time"
                type="time"
                value={snkrdunkUpdateTime}
                onChange={(e) => setSnkrdunkUpdateTime(e.target.value)}
                disabled={!snkrdunkEnabled}
                className="bg-white text-gray-900"
              />
            </div>

            {/* Last Execution Time */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>上次執行：</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatLastExecutedTime(config?.snkrdunkLastExecutedAt)}
              </p>
            </div>

            {/* Manual Trigger Button */}
            <Button
              onClick={() => triggerSnkrdunk.mutate()}
              disabled={triggerSnkrdunk.isPending}
              variant="outline"
              className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${triggerSnkrdunk.isPending ? 'animate-spin' : ''}`} />
              {triggerSnkrdunk.isPending ? "更新中..." : "立即手動更新"}
            </Button>
          </CardContent>
        </Card>

        {/* eBay Schedule Card */}
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Clock className="w-5 h-5 text-yellow-600" />
              eBay 市場掛牌價
            </CardTitle>
            <CardDescription className="text-gray-600">
              設定每日自動更新 eBay 卡牌價格的時間
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable/Disable Switch */}
            <div className="flex items-center justify-between">
              <Label htmlFor="ebay-enabled" className="text-gray-900">啟用自動更新</Label>
            <Switch
              id="ebay-enabled"
              checked={ebayEnabled}
              onCheckedChange={(checked) => {
                console.log('[AdminSchedule] eBay switch changed:', checked);
                setEbayEnabled(checked);
              }}
            />
            </div>

            {/* Update Time Input */}
            <div className="space-y-2">
              <Label htmlFor="ebay-time" className="text-gray-900">更新時間 (HH:mm)</Label>
              <Input
                id="ebay-time"
                type="time"
                value={ebayUpdateTime}
                onChange={(e) => setEbayUpdateTime(e.target.value)}
                disabled={!ebayEnabled}
                className="bg-white text-gray-900"
              />
            </div>

            {/* Last Execution Time */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>上次執行：</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatLastExecutedTime(config?.ebayLastExecutedAt)}
              </p>
            </div>

            {/* Manual Trigger Button */}
            <Button
              onClick={() => triggerEbay.mutate()}
              disabled={triggerEbay.isPending}
              variant="outline"
              className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${triggerEbay.isPending ? 'animate-spin' : ''}`} />
              {triggerEbay.isPending ? "更新中..." : "立即手動更新"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Save Configuration Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveConfig}
          disabled={updateConfig.isPending}
          className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white px-8"
        >
          {updateConfig.isPending ? "儲存中..." : "儲存設定"}
        </Button>
      </div>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">i</span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">排程說明：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>系統會在每天設定的時間自動執行價格更新</li>
                <li>SNKRDUNK 更新：抓取所有卡牌的實際成交價格數據</li>
                <li>eBay 更新：抓取所有卡牌的市場掛牌價格數據</li>
                <li>建議將兩個更新時間設定在不同時段，避免同時執行</li>
                <li>您也可以隨時使用「立即手動更新」按鈕來測試更新功能</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
