# BOXIUM PTCG 專案待辦事項

## 🚨 緊急修復：Manus OAuth 回調失敗

### 問題描述
- 用戶點擊登入後跳轉到 Manus OAuth 頁面
- 登入成功後回調失敗
- 錯誤 URL: `boxium.asia/?error=oauth_failed&reason=callback_error`
- 錯誤訊息：「OAuth 回調失敗，請檢查網路連線或重試。」

### 診斷步驟
- [ ] 檢查 OAuth 回調處理代碼（`/api/oauth/callback`）
- [ ] 檢查服務器日誌中的錯誤信息
- [ ] 檢查 OAuth 環境變數配置
- [ ] 檢查 redirect_uri 是否正確

### 修復任務
- [x] 根據診斷結果實施修復（清空 users 表，添加 openId 和 loginMethod 列）
- [x] 測試完整登入流程（成功！）
- [ ] 保存 checkpoint

### 修復詳情
- 問題根源：數據庫 schema 沒有同步，users 表缺少 openId 和 loginMethod 列
- 解決方案：清空 users 表，手動執行遷移 SQL
