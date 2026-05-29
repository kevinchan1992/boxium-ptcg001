import re

path = "/home/ubuntu/boxium-ptcg/client/src/components/MessageCenter.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('const ROLE_LABELS: Record<string, string> = { buyer: "買家", seller: "賣家", admin: "管理員" };',
     'const getRoleLabels = (t: (k: string) => string): Record<string, string> => ({ buyer: t("common.buyer"), seller: t("common.seller"), admin: t("common.admin") });'),
    
    ('  pending_payment: "待付款",\n  paid: "已付款",\n  processing: "處理中",\n  shipped: "已出貨",\n  delivered: "已送達",\n  completed: "已完成",\n  cancelled: "已取消",\n  refunded: "已退款",\n  disputed: "爭議中",',
     '  pending_payment: "pendingPayment",\n  paid: "paid",\n  processing: "processing",\n  shipped: "shipped",\n  delivered: "delivered",\n  completed: "completed",\n  cancelled: "cancelled",\n  refunded: "refunded",\n  disputed: "disputed",'),
    
    ('{thread.listingTitle ?? `訂單 ${thread.orderNo}`}',
     '{thread.listingTitle ?? `${t("common.order")} ${thread.orderNo}`}'),
    
    ('{thread.counterpartyName ? `與 ${thread.counterpartyName}` : ""}',
     '{thread.counterpartyName ? `${t("common.with")} ${thread.counterpartyName}` : ""}'),
    
    ('onError: (e: any) => toast.error(e.message || "發送失敗"),',
     'onError: (e: any) => toast.error(e.message || t("common.sendFailed")),'),
    
    ('if (file.size > 5 * 1024 * 1024) { toast.error("圖片不能超過 5MB"); return; }',
     'if (file.size > 5 * 1024 * 1024) { toast.error(t("common.imageTooLarge")); return; }'),
    
    ('content: message.trim() || (imageFile ? "[圖片]" : ""),',
     'content: message.trim() || (imageFile ? "[image]" : ""),'),
    
    ('          訂單 {orderNo}\n',
     '          {t("common.order")} {orderNo}\n'),
    
    ('          查看訂單',
     '          {t("common.viewOrder")}'),
    
    ('<p className="text-xs">暫無訊息</p>',
     '<p className="text-xs">{t("messageCenter.noMessages")}</p>'),
    
    ('alt="圖片"',
     'alt={t("common.image")}'),
    
    ('{msg.content && msg.content !== "[圖片]" && (',
     '{msg.content && msg.content !== "[image]" && ('),
    
    ('alt="預覽"',
     'alt={t("common.preview")}'),
    
    ('placeholder="輸入訊息… (Enter 發送)"',
     'placeholder={t("messageCenter.inputPlaceholder")}'),
    
    ('aria-label="訊息中心"',
     'aria-label={t("messageCenter.title")}'),
    
    ('<span className="font-semibold text-sm">訊息中心</span>',
     '<span className="font-semibold text-sm">{t("messageCenter.title")}</span>'),
    
    ('<p className="text-xs text-center">暫無訊息記錄</p>',
     '<p className="text-xs text-center">{t("messageCenter.noHistory")}</p>'),
    
    ('<p className="text-[10px] text-center text-gray-300">購買或出售商品後，可在此與對方溝通</p>',
     '<p className="text-[10px] text-center text-gray-300">{t("messageCenter.noHistoryDesc")}</p>'),
    
    ('<p className="text-sm">選擇一個對話</p>',
     '<p className="text-sm">{t("messageCenter.selectChat")}</p>'),
    
    ('<p className="text-xs text-gray-300">從左側選擇訂單訊息</p>',
     '<p className="text-xs text-gray-300">{t("messageCenter.selectChatDesc")}</p>'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"✓ Replaced: {old[:50]}...")
    else:
        print(f"✗ Not found: {old[:50]}...")

# Fix STATUS_LABELS usage - need to make it use t() function
# Find the STATUS_LABELS const and update usage
content = content.replace(
    'const STATUS_LABELS: Record<string, string> = {',
    'const STATUS_LABEL_KEYS: Record<string, string> = {'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
