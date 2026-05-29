import re

path = "client/src/pages/Profile.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # ORDER_STATUS_CONFIG labels (module-level, need to become function or use t() inside component)
    ('label: "待付款"', 'label: t("orders.status.pending_payment")'),
    ('label: "已付款，等待出貨"', 'label: t("orders.status.paid_held")'),
    ('label: "已收款"', 'label: t("orders.status.payment_received")'),
    ('label: "已出貨"', 'label: t("orders.status.shipped")'),
    ('label: "已送達"', 'label: t("orders.status.delivered")'),
    ('label: "已完成"', 'label: t("orders.status.completed")'),
    ('label: "已取消"', 'label: t("orders.status.cancelled")'),
    ('label: "爭議中"', 'label: t("orders.status.disputed")'),
    # Tab labels
    ('label: "交換記錄"', 'label: t("profile.tradesTab")'),
    # SEO title/description
    ('title={user?.name ? `${user.name} 的個人頁面 - BOXIUM TCG` : \'個人頁面 - BOXIUM TCG\'}', 'title={user?.name ? `${user.name} ${t("profile.seoTitle")}` : t("profile.seoTitleDefault")}'),
    ('description="管理您的 BOXIUM TCG 帳戶、查看收藏、關注清單及交易記錄。"', 'description={t("profile.seoDescription")}'),
    # Back button
    ('>返回<', '>{t("common.back")}<'),
    # Delete account
    ('toast.success("帳號已成功刪除")', 'toast.success(t("profile.accountDeletedSuccess"))'),
    ('toast.error(`刪除失敗：${err.message}`)', 'toast.error(`${t("profile.deleteFailed")}：${err.message}`)'),
    ('toast.error("請輸入您的電子郵件地址以確認")', 'toast.error(t("profile.enterEmailToConfirm"))'),
    ('<Trash2 className="w-4 h-4 mr-1.5" /> 刪除帳號', '<Trash2 className="w-4 h-4 mr-1.5" /> {t("profile.deleteAccount")}'),
    ('<AlertTriangle className="w-5 h-5" /> 刪除帳號', '<AlertTriangle className="w-5 h-5" /> {t("profile.deleteAccount")}'),
    ('此操作無法復原。刪除後，您的所有個人資料、觀察清單、通知及相關記錄將被永久移除。', '{t("profile.deleteWarning")}'),
    ('<p className="font-semibold mb-1">請注意：</p>', '<p className="font-semibold mb-1">{t("profile.pleaseNote")}</p>'),
    ('<li>觀察清單與瀏覽記錄將被刪除</li>', '<li>{t("profile.deleteNote1")}</li>'),
    ('<li>通知記錄將被刪除</li>', '<li>{t("profile.deleteNote2")}</li>'),
    ('<li>出價與出價記錄將被刪除</li>', '<li>{t("profile.deleteNote3")}</li>'),
    ('<li>購物車與收藏清單將被清空</li>', '<li>{t("profile.deleteNote4")}</li>'),
    ('<li>您的帳號將無法恢復</li>', '<li>{t("profile.deleteNote5")}</li>'),
    # Change password
    ('toast.success("密碼已成功修改")', 'toast.success(t("profile.passwordChangedSuccess"))'),
    ('toast.error(`修改失敗：${err.message}`)', 'toast.error(`${t("profile.changeFailed")}：${err.message}`)'),
    ('if (!currentPw || !newPw || !confirmPw) { toast.error("請填寫所有欄位"); return; }', 'if (!currentPw || !newPw || !confirmPw) { toast.error(t("common.fillAllFields")); return; }'),
    ('if (newPw.length < 8) { toast.error("新密碼至少需要 8 個字元"); return; }', 'if (newPw.length < 8) { toast.error(t("profile.passwordMinLength")); return; }'),
    ('if (newPw !== confirmPw) { toast.error("新密碼與確認密碼不一致"); return; }', 'if (newPw !== confirmPw) { toast.error(t("profile.passwordMismatch")); return; }'),
    ('<Lock className="w-4 h-4 mr-1.5" /> 修改密碼', '<Lock className="w-4 h-4 mr-1.5" /> {t("profile.changePassword")}'),
    ('<DialogTitle style={{ color: "#111827" }}>修改密碼</DialogTitle>', '<DialogTitle style={{ color: "#111827" }}>{t("profile.changePassword")}</DialogTitle>'),
    ('<DialogDescription style={{ color: "#6b7280" }}>請輸入現有密碼及新密碼以完成修改</DialogDescription>', '<DialogDescription style={{ color: "#6b7280" }}>{t("profile.changePasswordDesc")}</DialogDescription>'),
    ('<Label style={{ color: "#374151" }}>現有密碼</Label>', '<Label style={{ color: "#374151" }}>{t("profile.currentPassword")}</Label>'),
    ('placeholder="請輸入現有密碼"', 'placeholder={t("profile.currentPasswordPlaceholder")}'),
    ('placeholder="至少 8 個字元"', 'placeholder={t("profile.newPasswordPlaceholder")}'),
    ('placeholder="再次輸入新密碼"', 'placeholder={t("profile.confirmPasswordPlaceholder")}'),
    ('{changePassword.isPending ? "修改中..." : "確認修改"}', '{changePassword.isPending ? t("common.saving") : t("profile.confirmChange")}'),
    # Profile edit
    ('toast.success("個人資料已更新")', 'toast.success(t("profile.profileUpdated"))'),
    ('toast.error(`更新失敗：${err.message}`)', 'toast.error(`${t("profile.updateFailed")}：${err.message}`)'),
    ('<span className="text-sm font-bold text-gray-900">個人資料</span>', '<span className="text-sm font-bold text-gray-900">{t("profile.profileInfo")}</span>'),
    ('<Edit2 className="w-3.5 h-3.5" />編輯', '<Edit2 className="w-3.5 h-3.5" />{t("common.edit")}'),
    ('{updateProfile.isPending ? "儲存中..." : "儲存"}', '{updateProfile.isPending ? t("common.saving") : t("common.save")}'),
    ('placeholder="輸入姓名"', 'placeholder={t("profile.namePlaceholder")}'),
    ('<span className="text-sm text-gray-500">電話</span>', '<span className="text-sm text-gray-500">{t("profile.phone")}</span>'),
    ('{user.phone || <span className="text-gray-400 text-xs">未設定</span>}', '{user.phone || <span className="text-gray-400 text-xs">{t("profile.notSet")}</span>}'),
    # Danger zone
    ('<span className="text-sm font-bold" style={{ color: "#ef4444" }}>危險區域</span>', '<span className="text-sm font-bold" style={{ color: "#ef4444" }}>{t("profile.dangerZone")}</span>'),
    ('<p className="text-sm font-medium text-gray-800">刪除帳號</p>', '<p className="text-sm font-medium text-gray-800">{t("profile.deleteAccount")}</p>'),
    ('<p className="text-xs text-gray-500 mt-0.5">此操作無法復原，所有資料將被永久刪除</p>', '<p className="text-xs text-gray-500 mt-0.5">{t("profile.deleteAccountDesc")}</p>'),
    # Wishlist
    ('toast.success(res.wishlisted ? "已加入收藏" : "已移除收藏")', 'toast.success(res.wishlisted ? t("common.addedToWishlist") : t("common.removedFromWishlist"))'),
    ('>卡牌追蹤<', '>{t("profile.cardTracking")}<'),
    ('>收藏商品<', '>{t("profile.wishlistTab")}<'),
    ('<p className="text-gray-500 mb-5 text-base">尚未收藏任何商品</p>', '<p className="text-gray-500 mb-5 text-base">{t("profile.noWishlist")}</p>'),
    ('>前往市集瀏覽<', '>{t("profile.goToMarketplace")}<'),
    ('{ value: "time_desc" as const, label: "最新收藏" }', '{ value: "time_desc" as const, label: t("profile.sortNewest") }'),
    ('{ value: "time_asc" as const, label: "最早收藏" }', '{ value: "time_asc" as const, label: t("profile.sortOldest") }'),
    ('>在售<', '>{t("profile.statusActive")}<'),
    ('>已售出<', '>{t("profile.statusSold")}<'),
    ('>已下架<', '>{t("profile.statusRemoved")}<'),
    ('>加入購物車<', '>{t("common.addToCart")}<'),
    ('>尋找同款<', '>{t("profile.findSimilar")}<'),
    # Address
    ('{ label: "預設地址", addressType: "normal" as "normal" | "sf_station", recipientName: "", ', '{ label: t("profile.defaultAddressLabel"), addressType: "normal" as "normal" | "sf_station", recipientName: "", '),
    ('toast.success("地址已刪除")', 'toast.success(t("profile.addressDeleted"))'),
    ('toast.success("預設地址已更新")', 'toast.success(t("profile.defaultAddressUpdated"))'),
    ('setForm({ label: "預設地址", addressType: "normal"', 'setForm({ label: t("profile.defaultAddressLabel"), addressType: "normal"'),
    ('toast.error("請輸入收件人姓名")', 'toast.error(t("profile.enterRecipientName"))'),
    ('toast.error("請輸入聯繫電話")', 'toast.error(t("profile.enterPhone"))'),
    ('toast.error("請選擇順豐自提站")', 'toast.error(t("profile.selectSFStation"))'),
    ('toast.error(sfValidation.message || "順豐站點編號格式不正確")', 'toast.error(sfValidation.message || t("profile.sfStationInvalid"))'),
    ('toast.error("請輸入地址")', 'toast.error(t("profile.enterAddress"))'),
    ('<p className="text-sm text-gray-500">管理您的收貨地址，付款時可快速帶入</p>', '<p className="text-sm text-gray-500">{t("profile.manageAddresses")}</p>'),
    ('<Plus className="w-3.5 h-3.5" /> 新增地址', '<Plus className="w-3.5 h-3.5" /> {t("profile.addAddress")}'),
    ('{type === "normal" ? "普通地址" : "順豐自提"}', '{type === "normal" ? t("profile.normalAddress") : t("profile.sfPickup")}'),
    ('<Label className="text-xs font-semibold text-gray-700">聯繫電話</Label>', '<Label className="text-xs font-semibold text-gray-700">{t("profile.contactPhone")}</Label>'),
    ('[\'all\', \'全部\']', '[\'all\', t("common.all")]'),
    ('[\'station\', \'順豐站\']', '[\'station\', t("profile.sfStation")]'),
    ('[\'locker\', \'智能櫃\']', '[\'locker\', t("profile.sfLocker")]'),
    ('<Label className="text-xs font-semibold text-gray-700">搜尋站點 / 智能櫃</Label>', '<Label className="text-xs font-semibold text-gray-700">{t("profile.searchStation")}</Label>'),
    ('<Label className="text-xs font-semibold text-gray-700">地區篩選</Label>', '<Label className="text-xs font-semibold text-gray-700">{t("profile.regionFilter")}</Label>'),
    ('<option value="">全部地區</option>', '<option value="">{t("profile.allRegions")}</option>'),
    ('<Label className="text-xs font-semibold text-gray-700">或直接輸入站點編號</Label>', '<Label className="text-xs font-semibold text-gray-700">{t("profile.orEnterStationCode")}</Label>'),
    ('{editingId ? "儲存更改" : "新增地址"}', '{editingId ? t("profile.saveChanges") : t("profile.addAddress")}'),
    # Orders
    ('<p className="font-medium text-gray-500">暫無訂單記錄</p>', '<p className="font-medium text-gray-500">{t("profile.noOrders")}</p>'),
    ('>前往商城購物<', '>{t("profile.goShopping")}<'),
    ('{ id: "active", label: "進行中"', '{ id: "active", label: t("profile.activeOrders")'),
    ('placeholder="搜尋訂單號或商品名稱..."', 'placeholder={t("profile.searchOrderPlaceholder")}'),
    ('{searchQuery ? `找不到「${searchQuery}」的訂單` : "此狀態暫無訂單"}', '{searchQuery ? `${t("profile.noOrdersFound")}「${searchQuery}」` : t("profile.noOrdersInStatus")}'),
    ('共 {filtered.length} 筆訂單', '{t("profile.totalOrders", { count: filtered.length })}'),
    # Notifications
    ('toast.success("已標記所有通知為已讀")', 'toast.success(t("profile.allNotificationsRead"))'),
    ('{unreadCount} 則未讀', '{t("profile.unreadCount", { count: unreadCount })}'),
    ('<CheckCheck className="w-3.5 h-3.5 mr-1" />全部已讀', '<CheckCheck className="w-3.5 h-3.5 mr-1" />{t("profile.markAllRead")}'),
    ('{ value: true, label: "未讀" }', '{ value: true, label: t("profile.unread") }'),
    ('{ value: undefined, label: "所有類型" }', '{ value: undefined, label: t("profile.allTypes") }'),
    ('{ value: "trade", label: "交易" }', '{ value: "trade", label: t("profile.notifTrade") }'),
    ('{ value: "offer", label: "出價" }', '{ value: "offer", label: t("profile.notifOffer") }'),
    ('{ value: "shipping", label: "物流" }', '{ value: "shipping", label: t("profile.notifShipping") }'),
    ('{ value: "dispute", label: "爭議" }', '{ value: "dispute", label: t("profile.notifDispute") }'),
    ('{ value: "system", label: "系統" }', '{ value: "system", label: t("profile.notifSystem") }'),
    ('{unreadOnly ? "沒有未讀通知" : "暫無通知"}', '{unreadOnly ? t("profile.noUnreadNotifs") : t("profile.noNotifs")}'),
    ('>查看詳情 →<', '>{t("profile.viewDetails")} →<'),
    # Batch order
    ('訂單批次 · {orders.length} 件商品', '{t("profile.batchOrders", { count: orders.length })}'),
    ('{order.listingTitle ?? \'商品\'}', '{order.listingTitle ?? t("common.product")}'),
    ('<span className="text-sm font-semibold text-gray-700">合計（不含運費）</span>', '<span className="text-sm font-semibold text-gray-700">{t("cart.subtotalExclShipping")}</span>'),
    ('>前往購物車付款<', '>{t("profile.goToCart")}<'),
    # Order row
    ('>前往市集<', '>{t("profile.goToMarket")}<'),
    ('<div className="font-medium mb-1">爭議原因：</div>', '<div className="font-medium mb-1">{t("profile.disputeReason")}：</div>'),
    ('<div className="font-medium mb-1 text-green-700">處理結果：</div>', '<div className="font-medium mb-1 text-green-700">{t("profile.resolutionResult")}：</div>'),
    ('{order.shippingMethod ?? "快遞"}', '{order.shippingMethod ?? t("profile.courier")}'),
    ('追蹤號：<span className="font-mono font-medium">', '{t("profile.trackingNo")}：<span className="font-mono font-medium">'),
    ('>收起詳情</>', '>{t("profile.collapseDetails")}</>'),
    ('<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>收貨資料</p>', '<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>{t("profile.shippingInfo")}</p>'),
    ('<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>付款資料</p>', '<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND_BLUE }}>{t("profile.paymentInfo")}</p>'),
    ('<span className="text-gray-500">商品金額</span>', '<span className="text-gray-500">{t("cart.itemTotal")}</span>'),
    ('<span className="text-gray-800">總計</span>', '<span className="text-gray-800">{t("cart.total")}</span>'),
    # Confirm receipt dialog
    ('<DialogTitle className="text-lg font-bold text-gray-900">確認收貨</DialogTitle>', '<DialogTitle className="text-lg font-bold text-gray-900">{t("profile.confirmReceipt")}</DialogTitle>'),
    ('<p className="text-sm text-gray-600 py-2">確認已收到商品並且狀態良好？確認後款項將轉帳給賣家，此操作無法撤銷。</p>', '<p className="text-sm text-gray-600 py-2">{t("profile.confirmReceiptDesc")}</p>'),
    ('{confirmReceiptMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />確認中...</> : <><Chec', '{confirmReceiptMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.confirming")}...</> : <><Chec'),
    # Dispute dialog
    ('<DialogTitle className="text-lg font-bold text-red-700 flex items-center gap-2"><Flag className="w-5 h-5" />', '<DialogTitle className="text-lg font-bold text-red-700 flex items-center gap-2"><Flag className="w-5 h-5" />'),
    ('<Label className="text-sm font-medium">爭議原因（至少 10 個字）</Label>', '<Label className="text-sm font-medium">{t("profile.disputeReasonLabel")}</Label>'),
    ('<Label className="text-sm font-medium">上傳佐證（選填，最多 3 個）</Label>', '<Label className="text-sm font-medium">{t("profile.uploadEvidence")}</Label>'),
    ('{openDisputeMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : <><Flag cl', '{openDisputeMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.submitting")}...</> : <><Flag cl'),
    # Review dialog
    ('<p className="text-sm font-medium">評分</p>', '<p className="text-sm font-medium">{t("profile.rating")}</p>'),
    ('{reviewRating === 1 && "非常不滿意"}{reviewRating === 2 && "不滿意"}{reviewRating === 3 && "一般"}{reviewRating ==', '{reviewRating === 1 && t("profile.ratingVeryBad")}{reviewRating === 2 && t("profile.ratingBad")}{reviewRating === 3 && t("profile.ratingOk")}{reviewRating =='),
    ('<p className="text-sm font-medium">評語（選填）</p>', '<p className="text-sm font-medium">{t("profile.reviewComment")}</p>'),
    ('{submitReviewMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : <><Messag', '{submitReviewMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("common.submitting")}...</> : <><Messag'),
    # Offers
    ('toast.success("出價已取消")', 'toast.success(t("profile.offerCancelled"))'),
    ('pending: { label: "待回覆"', 'pending: { label: t("profile.offerPending")'),
    ('<p className="font-medium text-gray-500">暫無出價記錄</p>', '<p className="font-medium text-gray-500">{t("profile.noOffers")}</p>'),
    ('{offer.message && <p className="text-sm text-gray-500 mt-1">留言: {offer.message}</p>}', '{offer.message && <p className="text-sm text-gray-500 mt-1">{t("profile.offerMessage")}: {offer.message}</p>}'),
    ('{offer.rejectionReason && <p className="text-sm text-red-500 mt-1">拒絕原因: {offer.rejectionReason}</p>}', '{offer.rejectionReason && <p className="text-sm text-red-500 mt-1">{t("profile.rejectionReason")}: {offer.rejectionReason}</p>}'),
    ('{offer.status === "pending" && <p className="text-xs text-amber-600 mt-1">到期: {new Date(offer.expiresAt).t', '{offer.status === "pending" && <p className="text-xs text-amber-600 mt-1">{t("profile.expires")}: {new Date(offer.expiresAt).t'),
    ('>取消出價<', '>{t("profile.cancelOffer")}<'),
    # Bids
    ('setTimeLeft("已結標")', 'setTimeLeft(t("profile.auctionEnded"))'),
    ('>前往市集<', '>{t("profile.goToMarket")}<'),
    ('>🏆 領先中<', '>{t("profile.bidLeading")}<'),
    ('>⚠️ 被超越<', '>{t("profile.bidOutbid")}<'),
    ('>✅ 得標<', '>{t("profile.bidWon")}<'),
    ('>未得標<', '>{t("profile.bidLost")}<'),
    ('>查看訂單 <ChevronRight className="w-3 h-3" /></>', '>{t("profile.viewOrder")} <ChevronRight className="w-3 h-3" /></>'),
    ('>點擊前往拍賣頁面再次出價<', '>{t("profile.clickToBidAgain")}<'),
    # Auto complete
    ('如未確認收貨，系統將於 {new Date(order.autoCompleteAt).toLocaleDateString("zh-HK")} 自動完成訂單', '{t("profile.autoCompleteNote", { date: new Date(order.autoCompleteAt).toLocaleDateString() })}'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f"NOT FOUND: {old[:80]}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done! {count} replacements made")
