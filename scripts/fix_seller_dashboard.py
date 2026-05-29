path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

replacements = [
    # Image uploader
    ('在新標籤頁開啟原圖', '{t("seller.openOriginalImage")}'),
    ('toast.error(`最多上傳 ${maxImages} 張圖片`)', 'toast.error(t("seller.maxImagesError", { max: maxImages }))'),
    ('toast.error(`${file.name} 不是圖片`)', 'toast.error(t("seller.notImageError", { name: file.name }))'),
    ('toast.error(`${file.name} 超過 10MB`)', 'toast.error(t("seller.fileTooLargeError", { name: file.name }))'),
    ('throw new Error("上傳失敗")', 'throw new Error(t("seller.uploadFailed"))'),
    ('toast.success(`已上傳 ${uploaded.length} 張圖片`)', 'toast.success(t("seller.uploadSuccess", { count: uploaded.length }))'),
    ('toast.error(e.message || "圖片上傳失敗")', 'toast.error(e.message || t("seller.imageUploadFailed"))'),
    ('alt={`商品圖 ${idx + 1}`}', 'alt={t("seller.productImageAlt", { num: idx + 1 })}'),
    
    # Grade options
    ('{ value: "psa8_below", label: "PSA 8 以下" }', '{ value: "psa8_below", label: t("seller.grade.psa8Below") }'),
    ('{ value: "bgs8_below", label: "BGS 8 以下" }', '{ value: "bgs8_below", label: t("seller.grade.bgs8Below") }'),
    ('{ value: "tag9_below", label: "TAG 9 以下" }', '{ value: "tag9_below", label: t("seller.grade.tag9Below") }'),
    ('{ group: "Raw 卡", items: [', '{ group: t("seller.grade.rawGroup"), items: ['),
    ('{ value: "raw_a", label: "A品" }', '{ value: "raw_a", label: t("seller.grade.rawA") }'),
    ('{ value: "raw_b", label: "B品" }', '{ value: "raw_b", label: t("seller.grade.rawB") }'),
    ('{ value: "raw_c", label: "C品" }', '{ value: "raw_c", label: t("seller.grade.rawC") }'),
    ('{ value: "raw_d", label: "D品" }', '{ value: "raw_d", label: t("seller.grade.rawD") }'),
    
    # Order status map
    ('pending_payment: { label: "待付款", color: "bg-yellow-100 text-yellow-800" }', 'pending_payment: { label: t("seller.status.pendingPayment"), color: "bg-yellow-100 text-yellow-800" }'),
    ('paid_held: { label: "已付款，請出貨", color: "bg-blue-100 text-blue-800" }', 'paid_held: { label: t("seller.status.paidHeld"), color: "bg-blue-100 text-blue-800" }'),
    ('payment_received: { label: "已收款，請出貨", color: "bg-blue-100 text-blue-800" }', 'payment_received: { label: t("seller.status.paymentReceived"), color: "bg-blue-100 text-blue-800" }'),
    ('processing: { label: "處理中，請出貨", color: "bg-purple-100 text-purple-800" }', 'processing: { label: t("seller.status.processing"), color: "bg-purple-100 text-purple-800" }'),
    ('shipped: { label: "已寄出", color: "bg-indigo-100 text-indigo-800" }', 'shipped: { label: t("seller.status.shipped"), color: "bg-indigo-100 text-indigo-800" }'),
    ('delivered: { label: "已送達", color: "bg-teal-100 text-teal-800" }', 'delivered: { label: t("seller.status.delivered"), color: "bg-teal-100 text-teal-800" }'),
    ('completed: { label: "已完成", color: "bg-green-100 text-green-800" }', 'completed: { label: t("seller.status.completed"), color: "bg-green-100 text-green-800" }'),
    ('cancelled: { label: "已取消", color: "bg-red-100 text-red-800" }', 'cancelled: { label: t("seller.status.cancelled"), color: "bg-red-100 text-red-800" }'),
    ('disputed: { label: "爭議中", color: "bg-orange-100 text-orange-800" }', 'disputed: { label: t("seller.status.disputed"), color: "bg-orange-100 text-orange-800" }'),
    
    # Shipping proof
    ('alt="出貨憑證"', 'alt={t("seller.shippingProofAlt")}'),
    
    # Status helpers
    ("if (s === 'pending_payment') return '待買家付款';", "if (s === 'pending_payment') return t('seller.statusHelper.pendingPayment');"),
    ("if (s === 'payment_review' || s === 'payment_submitted' || s === 'alipay_pending') return '付款審核中';", "if (s === 'payment_review' || s === 'payment_submitted' || s === 'alipay_pending') return t('seller.statusHelper.paymentReview');"),
    ("if (s === 'paid' || s === 'paid_held' || s === 'payment_received' || s === 'processing') return '已收款，請出貨';", "if (s === 'paid' || s === 'paid_held' || s === 'payment_received' || s === 'processing') return t('seller.statusHelper.paidShipNow');"),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"✓ {old[:70]}...")
    else:
        print(f"✗ Not found: {old[:70]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! {count}/{len(replacements)} replacements made")
