# BrandButton 使用說明

## 簡介

`BrandButton` 是一個統一品牌風格的按鈕組件，用於確保全站按鈕顏色和交互效果的一致性。

## 特點

- **品牌顏色**：深藍色 #06038d（與 BOXIUM 品牌色調一致）
- **Hover 效果**：滑鼠懸停時稍微變亮（#0804b3）
- **Active 效果**：按下時變暗（#050270）
- **文字顏色**：白色，確保良好的對比度
- **完整支持**：支持所有原本 Button 組件的 variant 和 size

## 使用方法

### 1. 導入組件

```typescript
import { BrandButton } from "@/components/ui/brand-button";
```

### 2. 基本使用

```tsx
<BrandButton onClick={handleClick}>
  點擊我
</BrandButton>
```

### 3. 設置大小

```tsx
<BrandButton size="sm">小按鈕</BrandButton>
<BrandButton size="default">默認按鈕</BrandButton>
<BrandButton size="lg">大按鈕</BrandButton>
<BrandButton size="icon">
  <Icon className="w-4 h-4" />
</BrandButton>
```

### 4. 不同變體

```tsx
{/* 默認品牌色（深藍色） */}
<BrandButton variant="default">品牌按鈕</BrandButton>

{/* 危險操作（紅色） */}
<BrandButton variant="destructive">刪除</BrandButton>

{/* 輪廓按鈕 */}
<BrandButton variant="outline">取消</BrandButton>

{/* 次要按鈕 */}
<BrandButton variant="secondary">次要操作</BrandButton>

{/* 幽靈按鈕 */}
<BrandButton variant="ghost">幽靈按鈕</BrandButton>

{/* 鏈接樣式 */}
<BrandButton variant="link">鏈接</BrandButton>
```

### 5. 禁用狀態

```tsx
<BrandButton disabled>禁用按鈕</BrandButton>
```

### 6. 添加圖標

```tsx
<BrandButton>
  <Icon className="w-4 h-4 mr-2" />
  帶圖標的按鈕
</BrandButton>
```

## 何時使用

### ✅ 應該使用 BrandButton 的場景

1. **主要操作按鈕**：
   - 提交表單
   - 確認操作
   - 導航到重要頁面
   - 開始重要流程

2. **品牌相關操作**：
   - 「比較價格」按鈕（CardDetail 頁面）
   - 「清除緩存」按鈕（Admin 頁面）
   - 「搜索」按鈕
   - 「查看詳情」按鈕

### ❌ 不應該使用 BrandButton 的場景

1. **次要操作**：使用 `variant="outline"` 或 `variant="ghost"` 的普通 Button
2. **危險操作**：使用 `variant="destructive"` 的普通 Button（除非需要品牌色）
3. **已有特定顏色需求的按鈕**：例如社交媒體登錄按鈕

## 已應用的頁面

- ✅ CardDetail.tsx - 「比較價格」按鈕
- ✅ AdminCacheManagement.tsx - 「清除緩存」按鈕

## 待應用的頁面

建議在以下頁面的主要操作按鈕中使用 BrandButton：

1. **PricingDetail.tsx** - 「Buy Now」按鈕
2. **AdminBlogManagement.tsx** - 「發布文章」按鈕
3. **AdminUserManagement.tsx** - 主要操作按鈕
4. **SearchResults.tsx** - 「查看詳情」按鈕

## 顏色規範

| 狀態 | 顏色代碼 | 說明 |
|------|---------|------|
| 默認 | #06038d | 深藍色（品牌主色） |
| Hover | #0804b3 | 稍微變亮（約 20% 亮度提升） |
| Active | #050270 | 按下時變暗（約 20% 亮度降低） |
| 文字 | white | 白色，確保對比度 |

## 無障礙性

- ✅ 符合 WCAG AA 標準（白色文字在深藍色背景上的對比度 > 4.5:1）
- ✅ 支持鍵盤導航（focus-visible 樣式）
- ✅ 禁用狀態有明確視覺反饋（opacity: 0.5）

## 注意事項

1. **不要混用**：在同一頁面中，主要操作應統一使用 BrandButton 或普通 Button，避免混用
2. **保持一致**：同類操作應使用相同的按鈕樣式
3. **適度使用**：不要在一個頁面中使用過多的品牌色按鈕，會降低視覺層次

## 未來改進

- [ ] 添加加載狀態（loading spinner）
- [ ] 添加按鈕組（ButtonGroup）支持
- [ ] 添加更多顏色變體（如成功、警告等）
