# 批量更新控制功能說明

## 功能概述

本次更新為排程管理頁面添加了批量更新的暫停/繼續控制和錯誤詳情查看功能，提升了批量更新操作的可控性和可追溯性。

## 新增功能

### 1. 暫停/繼續按鈕

在批量更新進度條旁邊添加了動態控制按鈕：

- **暫停按鈕**：當批量更新正在運行時顯示，點擊可暫停當前更新操作
- **繼續按鈕**：當批量更新已暫停時顯示，點擊可恢復更新操作
- **狀態指示**：進度條下方會顯示「已暫停」狀態標籤

#### 使用場景

- 系統資源緊張時，可暫停批量更新以釋放資源
- 發現數據異常時，可暫停更新進行檢查
- 需要優先處理其他任務時，可暫停批量更新

### 2. 錯誤詳情查看

當批量更新完成後，如果有失敗的卡牌，會顯示錯誤詳情面板：

- **錯誤摘要**：顯示失敗卡牌總數
- **展開/收起**：點擊按鈕可展開或收起錯誤詳情列表
- **詳細信息**：每個失敗項目顯示：
  - 卡牌 ID
  - 卡牌名稱（如果有）
  - 錯誤原因

#### 使用場景

- 批量更新完成後，檢查是否有失敗的卡牌
- 查看具體的錯誤原因，以便針對性修復
- 追蹤和記錄批量更新的問題

## 技術實現

### 前端組件

**文件**：`client/src/components/AdminScheduleManagement.tsx`

#### 暫停/繼續功能

```typescript
// 暫停批量更新
const pauseUpdate = trpc.admin.pauseBatchUpdate.useMutation({
  onSuccess: () => {
    toast.success("批量更新已暫停");
  },
});

// 繼續批量更新
const resumeUpdate = trpc.admin.resumeBatchUpdate.useMutation({
  onSuccess: () => {
    toast.success("批量更新已繼續");
  },
});
```

#### UI 結構

- 進度條右側顯示當前處理進度和控制按鈕
- 根據 `progress.isPaused` 狀態動態切換按鈕
- 暫停時顯示綠色「繼續」按鈕
- 運行時顯示橙色「暫停」按鈕

#### 錯誤詳情面板

```typescript
// 本地狀態管理
const [showErrorDetails, setShowErrorDetails] = useState(false);

// 條件渲染
{progress?.failureCount && progress.failureCount > 0 && !progress?.isRunning && (
  <div className="space-y-2 p-4 bg-red-900/20 border border-red-800 rounded-lg">
    {/* 錯誤詳情內容 */}
  </div>
)}
```

### 後端 API

**文件**：`server/routers.ts`

#### 暫停/繼續端點

```typescript
pauseBatchUpdate: publicProcedure
  .mutation(async () => {
    batchUpdateProgress.pauseBatchUpdate();
    return { success: true };
  }),

resumeBatchUpdate: publicProcedure
  .mutation(async () => {
    batchUpdateProgress.resumeBatchUpdate();
    return { success: true };
  }),
```

#### 進度追蹤模塊

**文件**：`server/batchUpdateProgress.ts`

```typescript
export interface BatchUpdateProgress {
  isRunning: boolean;
  isPaused: boolean;
  totalCards: number;
  processedCards: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    cardId: number;
    cardName: string;
    error: string;
  }>;
  // ...
}
```

## 使用指南

### 訪問排程管理頁面

1. 登入管理後台：`/admin`
2. 點擊「排程管理」標籤

### 使用暫停/繼續功能

1. 點擊「立即更新所有 SNKRDUNK 卡牌」或「立即更新所有 eBay 卡牌」按鈕
2. 批量更新開始後，進度條會顯示實時進度
3. 點擊「暫停」按鈕可暫停更新
4. 點擊「繼續」按鈕可恢復更新
5. 更新完成後進度條自動消失

### 查看錯誤詳情

1. 批量更新完成後，如果有失敗的卡牌，會顯示紅色錯誤面板
2. 點擊「查看錯誤詳情」按鈕展開錯誤列表
3. 查看每個失敗卡牌的詳細信息
4. 點擊按鈕可收起錯誤列表

## 注意事項

1. **暫停功能**：暫停後當前正在處理的卡牌會完成，然後停止處理下一張卡牌
2. **錯誤持久化**：錯誤信息僅在當前批量更新會話中保存，新的批量更新會清空舊的錯誤記錄
3. **並發限制**：同一時間只能運行一個批量更新任務（SNKRDUNK 或 eBay）
4. **自動輪詢**：進度條每 3 秒自動更新一次，無需手動刷新

## 未來改進方向

1. **錯誤持久化**：將錯誤信息保存到數據庫，支持歷史錯誤查詢
2. **重試機制**：為失敗的卡牌提供單獨重試功能
3. **批量操作**：支持批量重試所有失敗的卡牌
4. **通知功能**：批量更新完成後發送通知給管理員
5. **進度導出**：支持導出批量更新報告（成功/失敗統計）

## 相關文件

- `client/src/components/AdminScheduleManagement.tsx` - 排程管理頁面組件
- `server/routers.ts` - 後端 API 路由
- `server/batchUpdateProgress.ts` - eBay 批量更新進度追蹤
- `server/snkrdunkBatchUpdateProgress.ts` - SNKRDUNK 批量更新進度追蹤
- `PRICING_SCHEDULER_GUIDE.md` - 價格更新排程器使用指南

## 版本信息

- **功能版本**：v1.0
- **更新日期**：2026-02-22
- **相關 Checkpoint**：待保存
