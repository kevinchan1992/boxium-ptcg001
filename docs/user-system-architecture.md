# BOXIUM PTCG 用戶登入與權限管理系統架構設計

## 📋 目錄

1. [系統概述](#系統概述)
2. [當前平台功能分析](#當前平台功能分析)
3. [用戶角色定義](#用戶角色定義)
4. [認證方式設計](#認證方式設計)
5. [權限控制架構](#權限控制架構)
6. [普通用戶功能設計](#普通用戶功能設計)
7. [技術實作方案](#技術實作方案)
8. [UI/UX 設計方案](#uiux-設計方案)
9. [安全性考量](#安全性考量)
10. [實作階段規劃](#實作階段規劃)

---

## 系統概述

BOXIUM PTCG 是一個專業的寶可夢卡牌價格研究平台，整合 SNKRDUNK 和 eBay 的實時交易數據，為收藏家和投資者提供準確的市場資訊。本文檔設計一套完整的用戶認證和權限管理系統，支援多種 OAuth 登入方式，並根據用戶角色提供差異化的功能體驗。

### 核心目標

1. **無縫認證體驗**：支援 Facebook、Google、Apple ID、Email 多種登入方式
2. **角色權限分離**：管理員和普通用戶擁有不同的功能權限
3. **個人化功能**：為普通用戶提供收藏、追蹤、通知等功能
4. **安全性保障**：保護敏感數據和管理功能不被未授權訪問

---

## 當前平台功能分析

### 公開功能（無需登入）

**首頁 (Home)**
- 品牌介紹和平台價值主張
- 核心服務展示（價格追蹤、市場分析、數據整合）
- CTA 引導用戶進入搜尋頁面

**卡牌搜尋 (Research)**
- 搜尋卡牌（支援英文/日文名稱）
- 瀏覽卡牌列表
- 查看卡牌詳情頁
  - 基本資訊（名稱、編號、系列、稀有度）
  - 參考價格（PSA 10 參考價）
  - 價格歷史表格（SNKRDUNK + eBay）
  - 評級篩選（PSA 10、BGS 10、中古）
  - 價格趨勢圖表（PSA 10 歷史走勢）
  - 社交分享功能

**熱門排行 (Trending)**
- 搜尋熱度排行
- 價格飆升排行
- 價格暴跌排行
- 新上架卡牌

**定價頁面 (Pricing)**
- 圖片搜尋功能（上傳卡牌圖片查找相似卡牌）
- AI 識別卡牌資訊

### 管理員專屬功能（需要登入 + admin 角色）

**管理後台 (Admin)**
- 數據源管理
  - 批量添加 SNKRDUNK URL
  - 查看數據源列表（卡牌名稱、URL、狀態、最後更新時間）
  - 搜尋數據源
  - 批量選擇和刪除
  - 清理重複數據源
  - 清理失敗記錄
- 手動觸發更新
  - 立即更新所有數據源（只更新價格數據）
  - 暫停/繼續批量處理

### 需要為普通用戶開發的功能

根據平台特性，普通用戶需要以下功能：

1. **收藏功能**
   - 收藏喜愛的卡牌
   - 查看我的收藏列表
   - 收藏卡牌的價格變動提醒

2. **價格追蹤**
   - 設定目標價格提醒
   - 當卡牌價格達到目標時發送通知
   - 追蹤多張卡牌的價格走勢

3. **個人化儀表板**
   - 我的收藏概覽
   - 價格變動統計
   - 投資組合價值追蹤（如果收藏卡牌有當前價格）

4. **搜尋歷史**
   - 記錄用戶的搜尋歷史
   - 快速重新搜尋

5. **通知中心**
   - 價格提醒通知
   - 新卡牌上架通知（如果用戶追蹤特定系列）
   - 市場趨勢通知

---

## 用戶角色定義

### 角色層級

```
訪客 (Guest)
  └─ 普通用戶 (User)
       └─ 管理員 (Admin)
```

### 角色權限矩陣

| 功能模塊 | 訪客 | 普通用戶 | 管理員 |
|---------|------|---------|--------|
| **公開頁面** |
| 首頁 | ✅ | ✅ | ✅ |
| 卡牌搜尋 | ✅ | ✅ | ✅ |
| 卡牌詳情 | ✅ | ✅ | ✅ |
| 熱門排行 | ✅ | ✅ | ✅ |
| 定價（圖片搜尋） | ✅ | ✅ | ✅ |
| **用戶功能** |
| 收藏卡牌 | ❌ | ✅ | ✅ |
| 價格追蹤 | ❌ | ✅ | ✅ |
| 個人儀表板 | ❌ | ✅ | ✅ |
| 搜尋歷史 | ❌ | ✅ | ✅ |
| 通知中心 | ❌ | ✅ | ✅ |
| **管理功能** |
| 管理後台 | ❌ | ❌ | ✅ |
| 數據源管理 | ❌ | ❌ | ✅ |
| 批量操作 | ❌ | ❌ | ✅ |

---

## 認證方式設計

### 支援的登入方式

#### 1. Manus OAuth（主要方式）

Manus OAuth 是平台內建的認證系統，支援多種第三方 OAuth 提供商：

**支援的提供商：**
- **Google** - 最常用的登入方式
- **Facebook** - 社交媒體登入
- **Apple ID** - iOS 用戶首選
- **Email/Password** - 傳統郵箱註冊

**優勢：**
- 統一的認證流程
- 自動管理 OAuth token 和刷新
- 內建安全性保障
- 無需手動配置各個 OAuth 提供商

**認證流程：**
```
用戶點擊「登入」
  ↓
選擇登入方式（Google/Facebook/Apple/Email）
  ↓
重定向到 Manus OAuth 登入頁面
  ↓
用戶完成認證（第三方 OAuth 或郵箱登入）
  ↓
重定向回 BOXIUM PTCG
  ↓
後端驗證 OAuth callback
  ↓
創建/更新用戶記錄
  ↓
設定 session cookie
  ↓
用戶登入成功
```

### 用戶數據結構

當前 `users` 表結構：

```typescript
{
  id: number;                    // 主鍵
  openId: string;                // Manus OAuth 用戶 ID（唯一）
  email: string;                 // 郵箱（唯一）
  name: string | null;           // 顯示名稱
  loginMethod: string | null;    // 登入方式（"oauth"）
  role: "user" | "admin";        // 用戶角色
  createdAt: Date;               // 創建時間
  updatedAt: Date;               // 更新時間
  lastSignedIn: Date;            // 最後登入時間
}
```

**說明：**
- `openId` 是 Manus OAuth 提供的唯一用戶標識
- `email` 從 OAuth 提供商獲取
- `role` 默認為 "user"，管理員需要手動設定為 "admin"
- 不需要存儲密碼（OAuth 認證）

---

## 權限控制架構

### 後端權限控制

#### 1. tRPC Middleware

使用 tRPC 的 middleware 機制實現權限控制：

```typescript
// server/routers.ts

// 公開 procedure（無需認證）
export const publicProcedure = t.procedure;

// 需要登入的 procedure
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// 需要管理員權限的 procedure
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

#### 2. API 路由保護

```typescript
// 示例：收藏功能 API
export const appRouter = router({
  favorites: router({
    // 添加收藏（需要登入）
    add: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await addFavorite(ctx.user.id, input.cardId);
      }),
    
    // 獲取收藏列表（需要登入）
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await getUserFavorites(ctx.user.id);
      }),
  }),
  
  admin: router({
    // 管理員功能（需要 admin 角色）
    getDataSources: adminProcedure
      .query(async () => {
        return await getAllDataSources();
      }),
  }),
});
```

### 前端權限控制

#### 1. 路由保護

```typescript
// client/src/App.tsx

function App() {
  const { user, isLoading } = useAuth();
  
  return (
    <Routes>
      {/* 公開路由 */}
      <Route path="/" element={<Home />} />
      <Route path="/research" element={<Research />} />
      <Route path="/card/:id" element={<CardDetail />} />
      
      {/* 需要登入的路由 */}
      <Route path="/favorites" element={
        <ProtectedRoute>
          <Favorites />
        </ProtectedRoute>
      } />
      
      {/* 管理員路由 */}
      <Route path="/admin" element={
        <AdminRoute>
          <Admin />
        </AdminRoute>
      } />
    </Routes>
  );
}

// 保護路由組件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

// 管理員路由組件
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/" />;
  
  return <>{children}</>;
}
```

#### 2. UI 元素條件渲染

```typescript
// 示例：導航欄
function TopNav() {
  const { user } = useAuth();
  
  return (
    <nav>
      <Link to="/">首頁</Link>
      <Link to="/research">卡牌搜尋</Link>
      <Link to="/trending">熱門排行</Link>
      <Link to="/pricing">定價</Link>
      
      {/* 登入用戶顯示 */}
      {user && (
        <>
          <Link to="/favorites">我的收藏</Link>
          <Link to="/dashboard">個人中心</Link>
        </>
      )}
      
      {/* 管理員顯示 */}
      {user?.role === 'admin' && (
        <Link to="/admin">管理後台</Link>
      )}
      
      {/* 登入/登出按鈕 */}
      {user ? (
        <UserMenu user={user} />
      ) : (
        <Button onClick={() => window.location.href = getLoginUrl()}>
          登入/註冊
        </Button>
      )}
    </nav>
  );
}
```

---

## 普通用戶功能設計

### 1. 收藏功能

#### 數據庫 Schema

```typescript
// 已存在的 favorites 表（需要檢查是否已創建）
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: int("cardId").notNull(),
  notes: text("notes"), // 用戶備註
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

#### 功能特性

- 在卡牌詳情頁顯示「收藏」按鈕（心形圖標）
- 已收藏的卡牌顯示實心圖標，未收藏顯示空心圖標
- 點擊切換收藏狀態（樂觀更新）
- 「我的收藏」頁面顯示所有收藏的卡牌
- 支援添加備註（例如：「已購買」、「想要購買」）

### 2. 價格追蹤功能

#### 數據庫 Schema

```typescript
// 已存在的 watchlist 表
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  cardId: int("cardId").notNull(),
  targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("HKD"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

#### 功能特性

- 在卡牌詳情頁顯示「設定價格提醒」按鈕
- 用戶可以設定目標價格（例如：當 PSA 10 價格低於 HKD 500 時通知我）
- 後台定時檢查價格變動，發送通知
- 「我的追蹤」頁面顯示所有追蹤的卡牌和目標價格
- 顯示當前價格與目標價格的差距

### 3. 個人儀表板

#### 頁面結構

```
個人儀表板 (/dashboard)
├─ 用戶資訊卡片
│  ├─ 頭像（從 OAuth 獲取）
│  ├─ 名稱
│  ├─ 郵箱
│  └─ 加入日期
├─ 收藏統計
│  ├─ 收藏卡牌數量
│  ├─ 追蹤卡牌數量
│  └─ 總投資組合價值（如果有價格數據）
├─ 最近收藏
│  └─ 最近 5 張收藏的卡牌
├─ 價格提醒
│  └─ 達到目標價格的卡牌列表
└─ 搜尋歷史
   └─ 最近 10 次搜尋記錄
```

### 4. 搜尋歷史

#### 數據庫 Schema

```typescript
// 已存在的 searchStats 表（可以擴展用於個人搜尋歷史）
export const searchStats = mysqlTable("searchStats", {
  id: int("id").autoincrement().primaryKey(),
  query: text("query").notNull(),
  userId: int("userId"), // 添加 userId 欄位
  resultCount: int("resultCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

#### 功能特性

- 記錄已登入用戶的搜尋歷史
- 在搜尋框顯示最近搜尋建議
- 「搜尋歷史」頁面顯示所有搜尋記錄
- 支援清除搜尋歷史

### 5. 通知中心

#### 數據庫 Schema

```typescript
// 新增 notifications 表
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["price_alert", "new_card", "market_trend"]).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  cardId: int("cardId"), // 關聯的卡牌 ID
  isRead: int("isRead").default(0).notNull(), // 0 = 未讀, 1 = 已讀
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

#### 功能特性

- 頂部導航欄顯示通知圖標（未讀通知顯示數字徽章）
- 點擊通知圖標顯示通知列表
- 通知類型：
  - 價格提醒：「您追蹤的卡牌 [卡牌名稱] 價格已達到目標價格 HKD 500」
  - 新卡牌上架：「新增了 [系列名稱] 的卡牌」
  - 市場趨勢：「[卡牌名稱] 價格在過去 7 天上漲了 20%」
- 支援標記為已讀/未讀
- 支援清除所有通知

---

## 技術實作方案

### 階段一：認證系統整合

#### 1.1 前端登入 UI

**TopNav 組件更新：**

```typescript
// client/src/components/TopNav.tsx

export function TopNav() {
  const { user, isLoading } = useAuth();
  const loginUrl = getLoginUrl(window.location.pathname); // 登入後返回當前頁面
  
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-[#06038d] text-white">
      {/* LOGO */}
      <Link to="/">
        <img src="/boxium-logo-white.png" alt="BOXIUM" className="h-10" />
      </Link>
      
      {/* 導航連結 */}
      <div className="flex items-center gap-6">
        <Link to="/research">卡牌搜尋</Link>
        <Link to="/trending">熱門排行</Link>
        <Link to="/pricing">定價</Link>
        
        {/* 登入用戶顯示 */}
        {user && (
          <>
            <Link to="/favorites">我的收藏</Link>
            <Link to="/dashboard">個人中心</Link>
          </>
        )}
        
        {/* 管理員顯示 */}
        {user?.role === 'admin' && (
          <Link to="/admin">管理後台</Link>
        )}
        
        {/* 登入/用戶選單 */}
        {isLoading ? (
          <Skeleton className="w-24 h-10" />
        ) : user ? (
          <UserMenu user={user} />
        ) : (
          <Button asChild variant="outline">
            <a href={loginUrl}>登入/註冊</a>
          </Button>
        )}
      </div>
    </nav>
  );
}
```

**UserMenu 組件：**

```typescript
// client/src/components/UserMenu.tsx

export function UserMenu({ user }: { user: User }) {
  const logoutMutation = trpc.auth.logout.useMutation();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{user.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <span>{user.name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/dashboard">個人中心</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/favorites">我的收藏</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
          登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 1.2 OAuth 登入流程

**Manus OAuth 配置：**

當前模板已經配置好 Manus OAuth，無需額外設定。登入流程：

1. 用戶點擊「登入/註冊」按鈕
2. 重定向到 Manus OAuth 登入頁面（`getLoginUrl()` 生成）
3. 用戶選擇登入方式（Google/Facebook/Apple/Email）
4. 完成認證後重定向回 `/api/oauth/callback`
5. 後端驗證並創建/更新用戶記錄
6. 設定 session cookie
7. 重定向回原頁面

**無需修改的部分：**
- `server/_core/oauth.ts` - OAuth callback 處理
- `server/_core/context.ts` - 從 cookie 提取用戶資訊
- `client/src/const.ts` - `getLoginUrl()` 函數

### 階段二：權限控制實作

#### 2.1 後端 Middleware

```typescript
// server/routers.ts

import { TRPCError } from '@trpc/server';

// 已存在的 publicProcedure 和 protectedProcedure

// 新增 adminProcedure
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '您沒有權限訪問此功能',
    });
  }
  return next({ ctx });
});
```

#### 2.2 前端路由保護

```typescript
// client/src/components/ProtectedRoute.tsx

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }
  
  if (!user) {
    // 保存當前路徑，登入後返回
    const loginUrl = getLoginUrl(location.pathname);
    window.location.href = loginUrl;
    return null;
  }
  
  return <>{children}</>;
}

// client/src/components/AdminRoute.tsx

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }
  
  if (!user) {
    const loginUrl = getLoginUrl('/admin');
    window.location.href = loginUrl;
    return null;
  }
  
  if (user.role !== 'admin') {
    // 非管理員重定向到首頁
    navigate('/');
    return null;
  }
  
  return <>{children}</>;
}
```

### 階段三：普通用戶功能實作

#### 3.1 收藏功能

**後端 API：**

```typescript
// server/routers.ts

export const appRouter = router({
  favorites: router({
    // 添加收藏
    add: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await addFavorite(ctx.user.id, input.cardId, input.notes);
      }),
    
    // 移除收藏
    remove: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await removeFavorite(ctx.user.id, input.cardId);
      }),
    
    // 獲取收藏列表
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await getUserFavorites(ctx.user.id);
      }),
    
    // 檢查是否已收藏
    check: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await isFavorited(ctx.user.id, input.cardId);
      }),
  }),
});
```

**前端組件：**

```typescript
// client/src/components/FavoriteButton.tsx

export function FavoriteButton({ cardId }: { cardId: number }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: isFavorited } = trpc.favorites.check.useQuery(
    { cardId },
    { enabled: !!user }
  );
  
  const addMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      utils.favorites.check.invalidate({ cardId });
      toast.success('已添加到收藏');
    },
  });
  
  const removeMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      utils.favorites.check.invalidate({ cardId });
      toast.success('已移除收藏');
    },
  });
  
  if (!user) {
    return (
      <Button variant="outline" onClick={() => {
        window.location.href = getLoginUrl(window.location.pathname);
      }}>
        <Heart className="w-4 h-4 mr-2" />
        收藏
      </Button>
    );
  }
  
  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      onClick={() => {
        if (isFavorited) {
          removeMutation.mutate({ cardId });
        } else {
          addMutation.mutate({ cardId });
        }
      }}
    >
      {isFavorited ? (
        <HeartFilled className="w-4 h-4 mr-2" />
      ) : (
        <Heart className="w-4 h-4 mr-2" />
      )}
      {isFavorited ? '已收藏' : '收藏'}
    </Button>
  );
}
```

#### 3.2 價格追蹤功能

**後端 API：**

```typescript
// server/routers.ts

export const appRouter = router({
  watchlist: router({
    // 添加追蹤
    add: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        targetPrice: z.number().optional(),
        currency: z.string().default('HKD'),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await addToWatchlist(ctx.user.id, input);
      }),
    
    // 移除追蹤
    remove: protectedProcedure
      .input(z.object({ cardId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await removeFromWatchlist(ctx.user.id, input.cardId);
      }),
    
    // 更新目標價格
    updateTarget: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        targetPrice: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await updateWatchlistTarget(ctx.user.id, input.cardId, input.targetPrice);
      }),
    
    // 獲取追蹤列表
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await getUserWatchlist(ctx.user.id);
      }),
  }),
});
```

#### 3.3 通知系統

**後端定時任務：**

```typescript
// server/notificationScheduler.ts

import cron from 'node-cron';

// 每小時檢查一次價格提醒
cron.schedule('0 * * * *', async () => {
  console.log('[Notification] Checking price alerts...');
  
  const watchlist = await getAllWatchlistWithTargetPrice();
  
  for (const item of watchlist) {
    const currentPrice = await getCurrentPrice(item.cardId, 'PSA 10');
    
    if (currentPrice && item.targetPrice) {
      // 價格低於目標價格，發送通知
      if (currentPrice <= item.targetPrice) {
        await createNotification({
          userId: item.userId,
          type: 'price_alert',
          title: '價格提醒',
          message: `您追蹤的卡牌 ${item.card.name} 價格已達到目標價格 ${item.currency} ${item.targetPrice}`,
          cardId: item.cardId,
        });
      }
    }
  }
});
```

---

## UI/UX 設計方案

### 登入/註冊流程

#### 登入按鈕位置

1. **TopNav 右側**（主要入口）
   - 未登入：顯示「登入/註冊」按鈕
   - 已登入：顯示用戶頭像和下拉選單

2. **需要登入的功能觸發點**
   - 點擊「收藏」按鈕時，如果未登入，顯示登入提示
   - 點擊「設定價格提醒」時，如果未登入，重定向到登入頁面

#### 登入頁面設計

由於使用 Manus OAuth，登入頁面由 Manus 提供，支援：
- Google 登入
- Facebook 登入
- Apple ID 登入
- Email/Password 登入

**用戶流程：**
1. 點擊「登入/註冊」按鈕
2. 重定向到 Manus OAuth 登入頁面
3. 選擇登入方式
4. 完成認證
5. 自動返回 BOXIUM PTCG

### 導航結構調整

#### 未登入用戶

```
TopNav:
  - BOXIUM LOGO
  - 卡牌搜尋
  - 熱門排行
  - 定價
  - [登入/註冊] 按鈕
```

#### 已登入普通用戶

```
TopNav:
  - BOXIUM LOGO
  - 卡牌搜尋
  - 熱門排行
  - 定價
  - 我的收藏
  - [通知圖標] (未讀數字徽章)
  - [用戶頭像] 下拉選單
    - 個人中心
    - 我的收藏
    - 我的追蹤
    - 搜尋歷史
    - 登出
```

#### 已登入管理員

```
TopNav:
  - BOXIUM LOGO
  - 卡牌搜尋
  - 熱門排行
  - 定價
  - 我的收藏
  - 管理後台 (紅色高亮)
  - [通知圖標]
  - [用戶頭像] 下拉選單
    - 個人中心
    - 我的收藏
    - 我的追蹤
    - 管理後台
    - 登出
```

### 卡牌詳情頁 UI 調整

在卡牌詳情頁添加用戶互動按鈕：

```
卡牌詳情頁頂部:
  [← 返回] [收藏按鈕] [設定價格提醒] [分享]
```

**收藏按鈕：**
- 未登入：空心心形圖標 + "收藏"
- 已登入未收藏：空心心形圖標 + "收藏"
- 已登入已收藏：實心心形圖標 + "已收藏"（橙色）

**設定價格提醒按鈕：**
- 點擊彈出對話框
- 輸入目標價格
- 選擇貨幣（HKD/TWD/USD/JPY）
- 添加備註（可選）

---

## 安全性考量

### 1. 認證安全

- **OAuth Token 管理**：由 Manus OAuth 自動管理，無需手動處理
- **Session Cookie**：HttpOnly + Secure + SameSite=Strict
- **JWT Token**：短期有效（24 小時），存儲在 cookie 中
- **CSRF 保護**：tRPC 內建 CSRF 保護

### 2. 權限控制

- **後端驗證**：所有 API 都在後端驗證用戶身份和權限
- **前端隱藏**：前端只隱藏 UI 元素，不依賴前端權限控制
- **角色檢查**：每個 protected/admin procedure 都檢查用戶角色

### 3. 數據保護

- **用戶隔離**：用戶只能訪問自己的數據（收藏、追蹤、通知）
- **SQL 注入防護**：使用 Drizzle ORM 參數化查詢
- **XSS 防護**：React 自動轉義用戶輸入

### 4. 管理員保護

- **Admin 路由保護**：前端和後端雙重驗證
- **敏感操作日誌**：記錄管理員的重要操作
- **最小權限原則**：只有必要的用戶設為管理員

---

## 實作階段規劃

### 階段一：認證系統整合（2-3 小時）

**任務：**
1. ✅ 更新 TopNav 組件添加登入按鈕
2. ✅ 創建 UserMenu 下拉選單組件
3. ✅ 創建 ProtectedRoute 和 AdminRoute 組件
4. ✅ 更新 App.tsx 路由配置
5. ✅ 測試 OAuth 登入流程
6. ✅ 測試登入狀態持久化

**交付物：**
- 完整的登入/登出功能
- 用戶選單和導航
- 路由保護機制

### 階段二：權限控制實作（1-2 小時）

**任務：**
1. ✅ 添加 adminProcedure middleware
2. ✅ 更新現有 admin API 使用 adminProcedure
3. ✅ 測試非管理員訪問 admin 路由被阻止
4. ✅ 測試管理員可以正常訪問
5. ✅ 前端隱藏管理員專屬 UI 元素

**交付物：**
- 完整的權限控制系統
- 管理員和普通用戶的訪問隔離

### 階段三：收藏功能（2-3 小時）

**任務：**
1. 檢查 favorites 表是否存在，如不存在則創建
2. 實作後端 favorites API（add/remove/list/check）
3. 創建 FavoriteButton 組件
4. 在卡牌詳情頁集成 FavoriteButton
5. 創建「我的收藏」頁面
6. 測試收藏功能
7. 編寫單元測試

**交付物：**
- 完整的收藏功能
- 我的收藏頁面

### 階段四：價格追蹤功能（3-4 小時）

**任務：**
1. 檢查 watchlist 表是否存在
2. 實作後端 watchlist API（add/remove/update/list）
3. 創建「設定價格提醒」對話框組件
4. 在卡牌詳情頁集成價格提醒按鈕
5. 創建「我的追蹤」頁面
6. 實作價格檢查定時任務
7. 測試價格提醒功能

**交付物：**
- 完整的價格追蹤功能
- 我的追蹤頁面
- 價格提醒定時任務

### 階段五：通知系統（2-3 小時）

**任務：**
1. 創建 notifications 表
2. 實作後端 notifications API
3. 創建通知圖標和下拉列表組件
4. 在 TopNav 集成通知圖標
5. 創建通知中心頁面
6. 實作通知定時任務
7. 測試通知功能

**交付物：**
- 完整的通知系統
- 通知中心頁面

### 階段六：個人儀表板（2-3 小時）

**任務：**
1. 創建個人儀表板頁面
2. 顯示用戶資訊卡片
3. 顯示收藏統計
4. 顯示最近收藏
5. 顯示價格提醒
6. 顯示搜尋歷史
7. 測試儀表板功能

**交付物：**
- 完整的個人儀表板

### 階段七：搜尋歷史（1-2 小時）

**任務：**
1. 更新 searchStats 表添加 userId 欄位
2. 修改搜尋功能記錄用戶 ID
3. 實作後端搜尋歷史 API
4. 在搜尋框顯示最近搜尋建議
5. 創建搜尋歷史頁面
6. 測試搜尋歷史功能

**交付物：**
- 完整的搜尋歷史功能

### 階段八：測試和優化（2-3 小時）

**任務：**
1. 編寫所有功能的單元測試
2. 進行端到端測試
3. 修復發現的 bug
4. 優化性能（查詢優化、緩存）
5. 優化 UI/UX（響應式設計、加載狀態）
6. 編寫用戶文檔

**交付物：**
- 完整的測試套件
- 優化後的系統
- 用戶文檔

---

## 總結

本架構設計提供了一套完整的用戶認證和權限管理系統，包括：

1. **多種 OAuth 登入方式**：Google、Facebook、Apple ID、Email
2. **角色權限分離**：管理員和普通用戶的功能隔離
3. **豐富的用戶功能**：收藏、追蹤、通知、儀表板、搜尋歷史
4. **安全性保障**：前後端雙重驗證、數據隔離、敏感操作保護

**預計總開發時間：15-23 小時**

**技術棧：**
- 認證：Manus OAuth
- 後端：tRPC + Drizzle ORM + MySQL
- 前端：React + TypeScript + Tailwind CSS + shadcn/ui
- 定時任務：node-cron

**下一步：**
1. 用戶確認架構設計
2. 開始階段一：認證系統整合
3. 逐步完成各個階段的功能開發
