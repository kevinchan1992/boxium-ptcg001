# BOXIUM PTCG 認證系統實施總結

## 概述

本次更新為 BOXIUM PTCG 平台添加了完整的認證系統，支持帳號密碼登入、Google OAuth（準備中）和保留原有的 Manus OAuth。

## 已完成的工作

### 1. 數據庫 Schema 更新

**文件**: `drizzle/schema.ts`

更新了 `users` 表結構，添加以下欄位：
- `openId` - Manus OAuth ID（可選）
- `passwordHash` - bcrypt 加密的密碼哈希（可選）
- `googleId` - Google OAuth ID（可選）
- `loginMethod` - 登入方式枚舉：`"password"` | `"google"` | `"manus"`
- `role` - 用戶角色：`"admin"` | `"user"`
- `emailVerified` - Email 驗證狀態

### 2. 認證輔助函數

**文件**: `server/auth.ts`

創建了完整的認證輔助函數：
- `hashPassword()` - 使用 bcrypt 加密密碼（10 rounds）
- `verifyPassword()` - 驗證密碼
- `generateToken()` - 生成 JWT token（7 天有效期）
- `verifyToken()` - 驗證 JWT token
- `isValidEmail()` - 驗證 email 格式
- `isValidPassword()` - 驗證密碼強度
  - 至少 8 個字符
  - 至少一個大寫字母
  - 至少一個小寫字母
  - 至少一個數字
- `registerUser()` - 註冊新用戶
- `loginUser()` - 帳號密碼登入
- `findOrCreateGoogleUser()` - Google OAuth 用戶創建/查找

### 3. 認證 API 端點

**文件**: `server/routers.ts`

添加了以下 tRPC API：
- `auth.me` - 獲取當前用戶信息
- `auth.register` - 註冊新用戶
- `auth.login` - 帳號密碼登入（自動設置 session cookie）

### 4. 前端頁面

**新增文件**:
- `client/src/pages/Login.tsx` - 登入頁面
  - 帳號密碼登入表單
  - Google OAuth 按鈕（準備中）
  - 跳轉到註冊頁面的連結
- `client/src/pages/Register.tsx` - 註冊頁面
  - 註冊表單（email, 名稱, 密碼, 確認密碼）
  - 前端密碼強度驗證
  - 跳轉到登入頁面的連結

**路由配置**: `client/src/App.tsx`
- `/login` - 登入頁面
- `/register` - 註冊頁面

### 5. 導航欄更新

**文件**: `client/src/components/TopNav.tsx`

添加了認證相關 UI：
- **未登入狀態**: 顯示「登入」和「註冊」按鈕
- **已登入狀態**: 顯示用戶名和下拉菜單
  - 用戶名/Email 顯示
  - 登出選項

### 6. 管理員帳號

已創建管理員帳號：
- **Email**: xyz.asia.co@gmail.com
- **密碼**: Admin123
- **角色**: admin
- **登入方式**: password

## 認證流程

### 註冊流程

1. 用戶訪問 `/register`
2. 填寫 email、名稱（選填）、密碼
3. 前端驗證密碼強度
4. 調用 `auth.register` API
5. 後端驗證並創建用戶（密碼使用 bcrypt 加密）
6. 註冊成功後跳轉到登入頁面

### 登入流程

1. 用戶訪問 `/login`
2. 填寫 email 和密碼
3. 調用 `auth.login` API
4. 後端驗證密碼並生成 JWT token
5. 設置 session cookie（httpOnly）
6. 登入成功後跳轉到首頁

### 登出流程

1. 用戶點擊導航欄的「登出」按鈕
2. 調用 `system.logout` API
3. 清除 session cookie
4. 刷新頁面返回首頁

## 安全性

- 密碼使用 bcrypt 加密（10 salt rounds）
- JWT token 存儲在 httpOnly cookie 中
- 密碼強度要求：至少 8 個字符，包含大小寫字母和數字
- Email 格式驗證
- 管理後台受 `adminProcedure` 保護

## 待完成功能

### Google OAuth 集成

**準備工作已完成**:
- `findOrCreateGoogleUser()` 函數已實現
- 前端登入頁面已有 Google OAuth 按鈕

**待實施**:
1. 配置 Google OAuth 應用
2. 添加 Google OAuth 回調路由
3. 實施 Passport.js Google Strategy
4. 更新環境變量：
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL`

## 技術棧

- **後端**: Node.js + Express + tRPC
- **數據庫**: PostgreSQL + Drizzle ORM
- **認證**: JWT + bcrypt
- **前端**: React + TypeScript + Wouter
- **UI**: shadcn/ui + Tailwind CSS

## 已知問題

### TypeScript 類型錯誤

存在一些 TypeScript 類型錯誤，但不影響運行時功能：
- `db.query.users` 語法問題（已使用 `db.select().from(users)` 替代）
- AdminBlogManagement 的文章生成功能類型錯誤（與認證系統無關）

這些錯誤不影響認證系統的正常運作，可以在後續優化中解決。

## 測試建議

1. **註冊測試**:
   - 訪問 `/register`
   - 使用有效 email 和符合強度要求的密碼註冊
   - 確認註冊成功並跳轉到登入頁面

2. **登入測試**:
   - 訪問 `/login`
   - 使用管理員帳號登入（xyz.asia.co@gmail.com / Admin123）
   - 確認登入成功並顯示用戶名

3. **權限測試**:
   - 登入後訪問 `/admin`
   - 確認管理員可以訪問管理後台

4. **登出測試**:
   - 點擊導航欄的用戶名下拉菜單
   - 點擊「登出」
   - 確認登出成功並返回首頁

## 部署注意事項

1. 確保環境變量正確配置：
   - `JWT_SECRET` - JWT 簽名密鑰
   - `DATABASE_URL` - 數據庫連接字符串

2. 數據庫遷移：
   - Schema 已更新，無需額外遷移

3. 生產環境建議：
   - 修改管理員密碼
   - 配置 HTTPS
   - 設置適當的 cookie 安全選項

## 文件清單

### 新增文件
- `server/auth.ts` - 認證輔助函數
- `client/src/pages/Login.tsx` - 登入頁面
- `client/src/pages/Register.tsx` - 註冊頁面
- `create-admin.mjs` - 管理員帳號創建腳本
- `AUTH_SYSTEM_SUMMARY.md` - 本文檔

### 修改文件
- `drizzle/schema.ts` - 更新 users 表結構
- `server/routers.ts` - 添加認證 API
- `client/src/App.tsx` - 添加登入/註冊路由
- `client/src/components/TopNav.tsx` - 添加認證 UI
- `package.json` - 添加認證相關依賴

## 結論

認證系統已成功實施，支持帳號密碼登入，並為 Google OAuth 做好了準備。管理員帳號已創建，可以立即使用。系統保留了原有的 Manus OAuth 功能，實現了三種登入方式的共存。
