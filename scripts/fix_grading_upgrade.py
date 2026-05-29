path = "/home/ubuntu/boxium-ptcg/client/src/pages/GradingOrderDetail.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    ("您的申請已升級至 <strong>{(submission as any).upgradeNewTierName ?? '新層級'}</strong>，\n                        需補付差價 <strong className=\"text-orange-900\">HK${parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString()}</strong>。",
     "{t(\"grading.upgradedToTier\", { tier: (submission as any).upgradeNewTierName ?? t(\"grading.newTier\") })}\n                        {t(\"grading.surchargeDiffAmount\", { amount: parseFloat((submission as any).upgradeDiffFeeHkd || '0').toLocaleString() })}"),
    ('<span className="text-xs font-semibold text-orange-900">支付寶 HK</span>',
     '<span className="text-xs font-semibold text-orange-900">{t("grading.alipayHK")}</span>'),
    ('<><CreditCard className="h-4 w-4 mr-2" />信用卡補付差價</>',
     '<><CreditCard className="h-4 w-4 mr-2" />{t("grading.creditCardSurcharge")}</>'),
    ('      支付寶 HK 補付差價\n                    </Button>',
     '      {t("grading.alipayHKSurcharge")}\n                    </Button>'),
    ('支付寶 HK 補付差價 HK${parseFloat((submission as any).upgradeDiffFeeHkd',
     '{t("grading.alipayHKSurchargeAmount", { amount: parseFloat((submission as any).upgradeDiffFeeHkd'),
    ("|| '0').toLocaleString()}</p>",
     "|| '0').toLocaleString() })}</p>"),
    ('<span className="font-bold text-gray-900">支付寶 HK 付款</span>',
     '<span className="font-bold text-gray-900">{t("grading.alipayHKPayment")}</span>'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"Replaced: {old[:60]}")
    else:
        print(f"NOT FOUND: {old[:60]}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! {count} replacements made")
