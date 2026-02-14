# 認證系統清理計劃

## 目標

移除所有自定義認證系統，統一使用 Manus OAuth 平台認證。

## 需要移除的部分

### 1. 數據庫表

- `revoked_tokens` - Token 黑名單表
- `password_reset_tokens` - 密碼重置 token 表
- `email_verification_tokens` - 郵箱驗證 token 表
- `users` 表中的字段：
  - `password` - 密碼 hash
  - `username` - 用戶名（本地認證用）
  - `emailVerified` - 郵箱驗證狀態

### 2. 服務器端代碼

- `server/auth.ts` - 本地認證邏輯（hashPassword, comparePassword, generateToken）
- `server/tokenBlacklist.ts` - Token 黑名單管理
- `server/emailService.ts` - 郵件服務（密碼重置、郵箱驗證）
- `server/routers.ts` 中的 API：
  - `auth.register` - 註冊
  - `auth.login` - 登入
  - `auth.logout` - 登出（簡化為只清除 OAuth cookie）
  - `auth.requestPasswordReset` - 請求密碼重置
  - `auth.resetPassword` - 重置密碼
  - `auth.verifyEmail` - 驗證郵箱
  - `auth.resendVerificationEmail` - 重發驗證郵件

### 3. 前端頁面

- `client/src/pages/Login.tsx` - 登入頁（移除本地認證表單）
- `client/src/pages/Register.tsx` - 註冊頁（完全移除）
- `client/src/pages/ForgotPassword.tsx` - 忘記密碼頁（完全移除）
- `client/src/pages/ResetPassword.tsx` - 重置密碼頁（完全移除）
- `client/src/pages/VerifyEmail.tsx` - 驗證郵箱頁（完全移除）

### 4. 認證邏輯簡化

- `server/_core/sdk.ts` 的 `authenticateRequest` 函數：
  - 移除本地認證 token 驗證
  - 移除黑名單檢查
  - 只保留 OAuth session 驗證

## 保留的部分

### 1. 數據庫表

- `users` 表保留字段：
  - `id`
  - `openId` - OAuth 用戶 ID
  - `email`
  - `name`
  - `loginMethod` - 固定為 "oauth"
  - `role`
  - `createdAt`
  - `updatedAt`
  - `lastSignedIn`

### 2. 認證流程

1. **登入**：重定向到 Manus OAuth 登入頁
2. **回調**：`/api/oauth/callback` 處理 OAuth 回調
3. **驗證**：使用 `authenticateRequest` 驗證 session
4. **登出**：清除 OAuth session cookie

### 3. 前端頁面

- 主頁：顯示「使用 Manus 登入」按鈕
- 個人資料頁：顯示 OAuth 用戶信息
- 所有需要認證的頁面：使用 `useAuth()` 檢查登入狀態

## 實施步驟

1. 移除數據庫表和字段
2. 刪除服務器端認證相關文件
3. 簡化 `authenticateRequest` 函數
4. 簡化 `auth.logout` API
5. 刪除前端認證相關頁面
6. 更新主頁和導航，只保留 OAuth 登入
7. 測試完整的 OAuth 登入/登出流程
