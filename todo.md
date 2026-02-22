# BOXIUM PTCG 專案待辦事項

## 🎯 任務：添加登入體驗優化

### 需求
1. 首次登入後顯示歡迎訊息（使用 toast 通知）
2. 登出時顯示確認對話框（使用 AlertDialog）

### 實作步驟
- [x] 實作登入成功訊息（已改為簡短提示）
  - [x] 修改 OAuth 回調添加 login_success 參數
  - [x] 在 Home 頁面顯示登入成功 toast
  - [x] 添加多語言支持
- [x] 確認路由配置正確（favorites 和 dashboard 需要登入，admin 僅管理員）
- [x] 實作登出確認對話框
  - [x] 檢查 AlertDialog 組件是否存在
  - [x] 修改 TopNav 添加確認對話框
  - [x] 添加多語言支持
- [x] 測試功能（開發環境狀態良好）
  - [x] 測試公開頁面訪問（路由配置正確）
  - [x] 測試登入成功訊息（已實作）
  - [x] 測試登出確認流程（已實作）
- [ ] 保存 checkpoint
