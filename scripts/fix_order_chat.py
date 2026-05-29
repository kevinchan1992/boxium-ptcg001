import re

path = "/home/ubuntu/boxium-ptcg/client/src/components/OrderChat.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('  buyer: "買家",\n  seller: "賣家",\n  admin: "管理員",',
     '  buyer: "buyer",\n  seller: "seller",\n  admin: "admin",'),
    
    ('onError: (e: any) => toast.error(e.message || "發送失敗"),',
     'onError: (e: any) => toast.error(e.message || t("common.sendFailed")),'),
    
    ('      toast.error("圖片不能超過 5MB");',
     '      toast.error(t("common.imageTooLarge"));'),
    
    ('content: message.trim() || (imageFile ? "[圖片]" : ""),',
     'content: message.trim() || (imageFile ? "[image]" : ""),'),
    
    ('<span className="font-semibold text-sm text-gray-800">訂單訊息</span>',
     '<span className="font-semibold text-sm text-gray-800">{t("orderChat.title")}</span>'),
    
    ('<span className="text-xs">{expanded ? "收起" : "展開"}</span>',
     '<span className="text-xs">{expanded ? t("common.collapse") : t("common.expand")}</span>'),
    
    ('                    暫無訊息。你可以在此與{" "}\n                    <span className="text-emerald-600 font-semibold">賣家</span> 或{" "}\n                    <span className="text-violet-600 font-semibold">管理員</span> 溝通。',
     '                    {t("orderChat.noMessages")}{" "}\n                    <span className="text-emerald-600 font-semibold">{t("common.seller")}</span> {t("common.or")}{" "}\n                    <span className="text-violet-600 font-semibold">{t("common.admin")}</span> {t("orderChat.noMessagesSuffix")}'),
    
    ('alt="附圖"',
     'alt={t("common.attachment")}'),
    
    ('已讀 {new Date(earliestReadAt).toLocaleTimeString(\'zh-HK\', { hour: \'2-digit\', minute: \'2-digit\' })}',
     '{t("orderChat.read")} {new Date(earliestReadAt).toLocaleTimeString(\'zh-HK\', { hour: \'2-digit\', minute: \'2-digit\' })}'),
    
    ('alt="預覽"',
     'alt={t("common.preview")}'),
    
    ('placeholder="輸入訊息..."',
     'placeholder={t("orderChat.inputPlaceholder")}'),
    
    ('<p className="text-[10px] text-gray-400 text-center">按 Enter 發送 · Shift+Enter 換行</p>',
     '<p className="text-[10px] text-gray-400 text-center">{t("orderChat.inputHint")}</p>'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"✓ Replaced: {old[:60]}...")
    else:
        print(f"✗ Not found: {old[:60]}...")

# Fix ROLE_LABELS usage - need to use t() 
content = content.replace(
    'const ROLE_LABELS: Record<string, string> = {',
    'const ROLE_LABEL_KEYS: Record<string, string> = {'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
