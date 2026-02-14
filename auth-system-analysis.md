# 認證系統問題分析

## 當前架構的核心問題

### 1. Cookie 清除機制不可靠

**問題**：
- 使用 `res.clearCookie()` 和 `res.cookie(name, "", { maxAge: 0 })` 無法保證瀏覽器立即清除 cookie
- 時序問題：瀏覽器在收到清除響應前就發送了新請求（帶著舊 cookie）
- 瀏覽器緩存問題：某些瀏覽器會緩存 cookie，即使收到清除指令也不會立即生效

**證據**（從日誌）：
```
[Auth] Logout called
[Auth] Cookies cleared
[Auth] authenticateRequest called  ← 緊接著的請求
[Auth] Parsed cookies: [ 'app_session_id', 'auth_token' ]  ← cookie 仍然存在！
```

### 2. 混合使用兩種認證機制

**問題**：
- 同時支持本地認證（auth_token）和 OAuth（app_session_id）
- 兩種機制使用不同的驗證邏輯和 cookie 名稱
- 登出時需要清除兩種 cookie，增加失敗概率

### 3. Cookie 安全設置不一致

**問題**：
- 登入時設置 cookie 的選項可能與登出時不同
- `secure` 屬性在開發環境中被設為 false，但生產環境應該是 true
- 這種不一致導致 cookie 無法被正確清除

### 4. 前端重定向時序問題

**問題**：
- 登出成功後立即調用 `utils.invalidate()` 觸發新的 API 請求
- 這些請求在瀏覽器處理清除 cookie 之前就發出了
- 即使添加了 100ms 延遲，仍然不夠可靠

## 根本原因

**依賴瀏覽器端的 cookie 清除是不可靠的**。正確的做法應該是：

1. **服務器端控制 token 有效性**
2. **即使 cookie 還在瀏覽器中，token 也應該失效**
3. **不依賴瀏覽器的 cookie 清除機制**

## 解決方案：Token 黑名單機制

### 架構設計

1. **數據庫表**：`revoked_tokens`
   - `token_hash`: token 的 hash 值（主鍵）
   - `revoked_at`: 撤銷時間
   - `expires_at`: token 原本的過期時間

2. **登出流程**：
   - 提取用戶的 token
   - 計算 token 的 hash 值
   - 將 hash 存入 `revoked_tokens` 表
   - 返回成功（不依賴 cookie 清除）

3. **驗證流程**：
   - 驗證 token 的簽名和過期時間
   - **檢查 token hash 是否在黑名單中**
   - 如果在黑名單中，拒絕認證

4. **清理機制**：
   - 定期清理已過期的黑名單記錄（減少數據庫大小）

### 優勢

- ✅ 不依賴瀏覽器 cookie 清除
- ✅ 服務器端完全控制 token 有效性
- ✅ 即使 cookie 還在，token 也已失效
- ✅ 支持「登出所有裝置」功能（撤銷用戶的所有 token）
- ✅ 可靠且可預測

## 實施計劃

1. 創建 `revoked_tokens` 表
2. 實作 token hash 計算函數
3. 實作黑名單檢查函數
4. 修改 `authenticateRequest` 加入黑名單檢查
5. 修改登出 API 將 token 加入黑名單
6. 測試完整流程
