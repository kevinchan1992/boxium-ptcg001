path = "/home/ubuntu/boxium-ptcg/client/src/pages/SellerDashboard.tsx"
with open(path, encoding='utf-8') as f:
    content = f.read()

# Replace conditionOptions constant with a function
old_condition = '''const conditionOptions = [
  { group: "PSA", items: [
    { value: "psa10", label: "PSA 10" },
    { value: "psa9", label: "PSA 9" },
    { value: "psa8_below", label: t("seller.grade.psa8Below") },
  ]},
  { group: "BGS", items: [
    { value: "bgs10", label: "BGS 10" },
    { value: "bgs9", label: "BGS 9" },
    { value: "bgs8_below", label: t("seller.grade.bgs8Below") },
  ]},
  { group: "TAG", items: [
    { value: "tag10", label: "TAG 10" },
    { value: "tag9_below", label: t("seller.grade.tag9Below") },
  ]},
  { group: t("seller.grade.rawGroup"), items: [
    { value: "raw_a", label: t("seller.grade.rawA") },
    { value: "raw_b", label: t("seller.grade.rawB") },
    { value: "raw_c", label: t("seller.grade.rawC") },
    { value: "raw_d", label: t("seller.grade.rawD") },
  ]},
];'''

new_condition = '''function getConditionOptions(t: (key: string) => string) {
  return [
    { group: "PSA", items: [
      { value: "psa10", label: "PSA 10" },
      { value: "psa9", label: "PSA 9" },
      { value: "psa8_below", label: t("seller.grade.psa8Below") },
    ]},
    { group: "BGS", items: [
      { value: "bgs10", label: "BGS 10" },
      { value: "bgs9", label: "BGS 9" },
      { value: "bgs8_below", label: t("seller.grade.bgs8Below") },
    ]},
    { group: "TAG", items: [
      { value: "tag10", label: "TAG 10" },
      { value: "tag9_below", label: t("seller.grade.tag9Below") },
    ]},
    { group: t("seller.grade.rawGroup"), items: [
      { value: "raw_a", label: t("seller.grade.rawA") },
      { value: "raw_b", label: t("seller.grade.rawB") },
      { value: "raw_c", label: t("seller.grade.rawC") },
      { value: "raw_d", label: t("seller.grade.rawD") },
    ]},
  ];
}'''

old_status = '''const orderStatusLabel: Record<string, { label: string; color: string }> = {
  pending_payment: { label: t("seller.status.pendingPayment"), color: "bg-yellow-100 text-yellow-800" },
  paid_held: { label: t("seller.status.paidHeld"), color: "bg-blue-100 text-blue-800" },
  payment_received: { label: t("seller.status.paymentReceived"), color: "bg-blue-100 text-blue-800" },
  processing: { label: t("seller.status.processing"), color: "bg-purple-100 text-purple-800" },
  shipped: { label: t("seller.status.shipped"), color: "bg-indigo-100 text-indigo-800" },
  delivered: { label: t("seller.status.delivered"), color: "bg-teal-100 text-teal-800" },
  completed: { label: t("seller.status.completed"), color: "bg-green-100 text-green-800" },
  cancelled: { label: t("seller.status.cancelled"), color: "bg-red-100 text-red-800" },
  disputed: { label: t("seller.status.disputed"), color: "bg-orange-100 text-orange-800" },
};'''

new_status = '''function getOrderStatusLabel(t: (key: string) => string): Record<string, { label: string; color: string }> {
  return {
    pending_payment: { label: t("seller.status.pendingPayment"), color: "bg-yellow-100 text-yellow-800" },
    paid_held: { label: t("seller.status.paidHeld"), color: "bg-blue-100 text-blue-800" },
    payment_received: { label: t("seller.status.paymentReceived"), color: "bg-blue-100 text-blue-800" },
    processing: { label: t("seller.status.processing"), color: "bg-purple-100 text-purple-800" },
    shipped: { label: t("seller.status.shipped"), color: "bg-indigo-100 text-indigo-800" },
    delivered: { label: t("seller.status.delivered"), color: "bg-teal-100 text-teal-800" },
    completed: { label: t("seller.status.completed"), color: "bg-green-100 text-green-800" },
    cancelled: { label: t("seller.status.cancelled"), color: "bg-red-100 text-red-800" },
    disputed: { label: t("seller.status.disputed"), color: "bg-orange-100 text-orange-800" },
  };
}'''

if old_condition in content:
    content = content.replace(old_condition, new_condition)
    print("✓ conditionOptions -> getConditionOptions(t)")
else:
    print("✗ conditionOptions not found")

if old_status in content:
    content = content.replace(old_status, new_status)
    print("✓ orderStatusLabel -> getOrderStatusLabel(t)")
else:
    print("✗ orderStatusLabel not found")

# Now add const conditionOptions = getConditionOptions(t); and const orderStatusLabel = getOrderStatusLabel(t);
# after const { t } = useTranslation(); in the main component
old_hook = '''  const { t } = useTranslation();
  // ── Maintenance mode check (query placed before other hooks, guard after all hooks) ──'''
new_hook = '''  const { t } = useTranslation();
  const conditionOptions = getConditionOptions(t);
  const orderStatusLabel = getOrderStatusLabel(t);
  // ── Maintenance mode check (query placed before other hooks, guard after all hooks) ──'''

if old_hook in content:
    content = content.replace(old_hook, new_hook)
    print("✓ Added conditionOptions and orderStatusLabel inside main component")
else:
    print("✗ Hook pattern not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
