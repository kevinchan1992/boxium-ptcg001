import { playwrightPool } from "./playwrightPool";
import fs from "fs";
import path from "path";

// Read BOXIUM logo as base64 (PNG format)
function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), "client/public/boxium-logo.png");
    const buf = fs.readFileSync(logoPath);
    return buf.toString("base64");
  } catch {
    return "";
  }
}

function fmt(amount: number): string {
  return `HKD ${amount.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  return `${year}年${parseInt(month)}月`;
}

interface SalesReport {
  monthly: Array<{
    yearMonth: string;
    totalSalesHkd: number;
    orderCount: number;
    stripeCount: number;
    alipayCount: number;
    platformSalesHkd: number;
    sellerSalesHkd: number;
    sellerFeesHkd: number;
    platformIncomeHkd: number;
    refundedCount: number;
    cancelledCount: number;
    refundedAmountHkd: number;
    netRevenueHkd: number;
  }>;
  overall: {
    totalSalesHkd: number;
    totalFeesHkd: number;
    totalOrders: number;
    platformSalesHkd: number;
    sellerSalesHkd: number;
    sellerReceivableTotalHkd: number;
    stripeCount: number;
    alipayCount: number;
    stripeSalesHkd: number;
    alipaySalesHkd: number;
    stripePlatformSalesHkd: number;
    alipayPlatformSalesHkd: number;
    stripeSellerFeesHkd: number;
    alipaySellerFeesHkd: number;
    refundedCount: number;
    cancelledCount: number;
    refundedAmountHkd: number;
    netRevenueHkd: number;
    platformIncomeHkd: number;
    paidOutHkd: number;
    pendingPayoutHkd: number;
    pendingPayoutCount: number;
    paidOutCount: number;
    platformNetProfitHkd: number;
  };
}

function buildHtml(report: SalesReport, months: number, generatedAt: string, logoB64: string): string {
  const { overall, monthly } = report;
  const logoSrc = logoB64 ? `data:image/png;base64,${logoB64}` : "";

  const monthlyRows = [...monthly].reverse().map((m) => {
    const isPositive = m.netRevenueHkd >= 0;
    return `
      <tr>
        <td>${fmtDate(m.yearMonth)}</td>
        <td class="num">${fmt(m.totalSalesHkd)}</td>
        <td class="num red">${m.refundedAmountHkd > 0 ? `-${fmt(m.refundedAmountHkd)}` : "—"}</td>
        <td class="num ${isPositive ? "green" : "red"}">${fmt(m.netRevenueHkd)}</td>
        <td class="num">${fmt(m.platformSalesHkd)}</td>
        <td class="num">${fmt(m.sellerSalesHkd)}</td>
        <td class="num accent">${fmt(m.sellerFeesHkd)}</td>
        <td class="num bold accent">${fmt(m.platformIncomeHkd)}</td>
        <td class="num center">${m.orderCount}</td>
      </tr>`;
  }).join("");

  const stripePercent = overall.totalSalesHkd > 0
    ? ((overall.stripeSalesHkd / overall.totalSalesHkd) * 100).toFixed(1)
    : "0.0";
  const alipayPercent = overall.totalSalesHkd > 0
    ? ((overall.alipaySalesHkd / overall.totalSalesHkd) * 100).toFixed(1)
    : "0.0";

  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BOXIUM PTCG 財務報告</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
    font-size: 12px;
    color: #1a1a2e;
    background: #f8f9fc;
    line-height: 1.6;
  }

  /* ── Cover Page ── */
  .cover {
    width: 100%;
    min-height: 297mm;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -100px; right: -100px;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%);
    border-radius: 50%;
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -80px;
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
  .cover-logo {
    width: 220px;
    margin-bottom: 40px;
    filter: drop-shadow(0 4px 20px rgba(255,215,0,0.3));
    position: relative; z-index: 1;
  }
  .cover-title {
    font-size: 36px;
    font-weight: 700;
    color: #FFD700;
    letter-spacing: 4px;
    text-align: center;
    margin-bottom: 12px;
    position: relative; z-index: 1;
  }
  .cover-subtitle {
    font-size: 18px;
    font-weight: 300;
    color: rgba(255,255,255,0.8);
    letter-spacing: 2px;
    text-align: center;
    margin-bottom: 60px;
    position: relative; z-index: 1;
  }
  .cover-divider {
    width: 80px;
    height: 3px;
    background: linear-gradient(90deg, transparent, #FFD700, transparent);
    margin: 0 auto 60px;
    position: relative; z-index: 1;
  }
  .cover-meta {
    display: flex;
    gap: 60px;
    position: relative; z-index: 1;
  }
  .cover-meta-item {
    text-align: center;
  }
  .cover-meta-label {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .cover-meta-value {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
  }
  .cover-badge {
    position: absolute;
    bottom: 40px;
    right: 60px;
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    letter-spacing: 1px;
    z-index: 1;
  }

  /* ── Content Pages ── */
  .page {
    background: white;
    padding: 40px 50px;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* Page Header */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 2px solid #1a1a2e;
    margin-bottom: 28px;
  }
  .page-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .page-header-logo {
    width: 80px;
    opacity: 0.9;
  }
  .page-header-title {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: 1px;
  }
  .page-header-subtitle {
    font-size: 11px;
    color: #888;
    margin-top: 2px;
  }
  .page-header-right {
    text-align: right;
    font-size: 10px;
    color: #aaa;
  }

  /* Section */
  .section {
    margin-bottom: 32px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 16px;
    background: #FFD700;
    border-radius: 2px;
  }

  /* KPI Grid */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 28px;
  }
  .kpi-card {
    background: #f8f9fc;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 16px;
    position: relative;
    overflow: hidden;
  }
  .kpi-card.primary {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    border-color: #1a1a2e;
    color: white;
  }
  .kpi-card.gold {
    background: linear-gradient(135deg, #92400e, #78350f);
    border-color: #92400e;
    color: white;
  }
  .kpi-card.green {
    background: linear-gradient(135deg, #065f46, #064e3b);
    border-color: #065f46;
    color: white;
  }
  .kpi-card.blue {
    background: linear-gradient(135deg, #1e3a5f, #1a3050);
    border-color: #1e3a5f;
    color: white;
  }
  .kpi-label {
    font-size: 10px;
    color: #888;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .kpi-card.primary .kpi-label,
  .kpi-card.gold .kpi-label,
  .kpi-card.green .kpi-label,
  .kpi-card.blue .kpi-label { color: rgba(255,255,255,0.6); }
  .kpi-value {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
  }
  .kpi-card.primary .kpi-value { color: #FFD700; }
  .kpi-card.gold .kpi-value,
  .kpi-card.green .kpi-value,
  .kpi-card.blue .kpi-value { color: white; }
  .kpi-sub {
    font-size: 10px;
    color: #aaa;
    margin-top: 4px;
  }
  .kpi-card.primary .kpi-sub,
  .kpi-card.gold .kpi-sub,
  .kpi-card.green .kpi-sub,
  .kpi-card.blue .kpi-sub { color: rgba(255,255,255,0.5); }

  /* P&L Table */
  .pl-table {
    width: 100%;
    border-collapse: collapse;
  }
  .pl-table tr { border-bottom: 1px solid #f0f0f0; }
  .pl-table tr:last-child { border-bottom: none; }
  .pl-table td {
    padding: 10px 12px;
    font-size: 12px;
  }
  .pl-table .row-label { color: #555; }
  .pl-table .row-value {
    text-align: right;
    font-weight: 600;
    color: #1a1a2e;
    font-variant-numeric: tabular-nums;
  }
  .pl-table .row-indent { padding-left: 28px; color: #777; }
  .pl-table .row-total {
    background: #f8f9fc;
    font-weight: 700;
  }
  .pl-table .row-total td { color: #1a1a2e; }
  .pl-table .row-profit { background: linear-gradient(90deg, #f0fdf4, #dcfce7); }
  .pl-table .row-profit td { color: #065f46; font-weight: 700; }
  .pl-table .row-section-header td {
    background: #1a1a2e;
    color: #FFD700;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.5px;
    padding: 8px 12px;
  }
  .green { color: #059669 !important; }
  .red { color: #dc2626 !important; }

  /* Payment Split */
  .payment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .payment-card {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
  }
  .payment-card-header {
    padding: 12px 16px;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.5px;
  }
  .payment-card-header.stripe { background: #635bff; color: white; }
  .payment-card-header.alipay { background: #1677ff; color: white; }
  .payment-card-body { padding: 14px 16px; }
  .payment-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid #f5f5f5;
    font-size: 11px;
  }
  .payment-row:last-child { border-bottom: none; }
  .payment-row-label { color: #666; }
  .payment-row-value { font-weight: 600; color: #1a1a2e; }

  /* Monthly Table */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .data-table thead tr {
    background: #1a1a2e;
    color: white;
  }
  .data-table thead th {
    padding: 10px 10px;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .data-table thead th.num { text-align: right; }
  .data-table thead th.center { text-align: center; }
  .data-table tbody tr { border-bottom: 1px solid #f0f0f0; }
  .data-table tbody tr:nth-child(even) { background: #fafafa; }
  .data-table tbody tr:last-child {
    background: #f0f4ff;
    font-weight: 700;
    border-top: 2px solid #1a1a2e;
  }
  .data-table td {
    padding: 9px 10px;
    color: #333;
  }
  .data-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .data-table td.center { text-align: center; }
  .data-table td.bold { font-weight: 700; }
  .data-table td.accent { color: #1a1a2e; font-weight: 600; }
  .data-table td.green { color: #059669; }
  .data-table td.red { color: #dc2626; }

  /* Footer */
  .report-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    color: #aaa;
  }
  .footer-note { max-width: 60%; line-height: 1.5; }

  /* Two-col layout */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

  @media print {
    body { background: white; }
    .page { box-shadow: none; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- COVER PAGE                                                   -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="cover">
  ${logoSrc ? `<img src="${logoSrc}" class="cover-logo" alt="BOXIUM">` : `<div style="font-size:32px;font-weight:900;color:#FFD700;letter-spacing:6px;margin-bottom:40px;">BOXIUM</div>`}
  <div class="cover-title">財務報告</div>
  <div class="cover-subtitle">Financial Report · PTCG Marketplace</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <div class="cover-meta-label">報告期間</div>
      <div class="cover-meta-value">最近 ${months} 個月</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">生成日期</div>
      <div class="cover-meta-value">${generatedAt}</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">訂單總數</div>
      <div class="cover-meta-value">${overall.totalOrders} 筆</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">平台淨利潤</div>
      <div class="cover-meta-value" style="color:#FFD700">${fmt(overall.platformNetProfitHkd)}</div>
    </div>
  </div>
  <div class="cover-badge">BOXIUM PTCG · 財務審核用途</div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 1: KPI OVERVIEW + P&L STATEMENT                        -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      ${logoSrc ? `<img src="${logoSrc}" class="page-header-logo" alt="BOXIUM">` : ""}
      <div>
        <div class="page-header-title">財務總覽</div>
        <div class="page-header-subtitle">Financial Overview · 最近 ${months} 個月</div>
      </div>
    </div>
    <div class="page-header-right">
      <div>生成日期：${generatedAt}</div>
      <div>BOXIUM PTCG · 財務審核用途</div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="section">
    <div class="section-title">核心指標</div>
    <div class="kpi-grid">
      <div class="kpi-card primary">
        <div class="kpi-label">平台淨利潤</div>
        <div class="kpi-value">${fmt(overall.platformNetProfitHkd)}</div>
        <div class="kpi-sub">收入 − 退款</div>
      </div>
      <div class="kpi-card gold">
        <div class="kpi-label">GMV（總交易額）</div>
        <div class="kpi-value">${fmt(overall.totalSalesHkd)}</div>
        <div class="kpi-sub">${overall.totalOrders} 筆已付款訂單</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">平台總收入</div>
        <div class="kpi-value">${fmt(overall.platformIncomeHkd)}</div>
        <div class="kpi-sub">直售 + C2C 手續費</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-label">淨收入</div>
        <div class="kpi-value">${fmt(overall.netRevenueHkd)}</div>
        <div class="kpi-sub">GMV − 退款 ${fmt(overall.refundedAmountHkd)}</div>
      </div>
    </div>
  </div>

  <!-- P&L Statement -->
  <div class="section">
    <div class="section-title">損益表</div>
    <table class="pl-table">
      <tr class="row-section-header"><td colspan="2">INCOME（收入）</td></tr>
      <tr>
        <td class="row-label row-indent">平台直售收入（Platform Sales）</td>
        <td class="row-value green">${fmt(overall.platformSalesHkd)}</td>
      </tr>
      <tr>
        <td class="row-label row-indent">C2C 手續費收入（Commission Fees）</td>
        <td class="row-value green">${fmt(overall.totalFeesHkd)}</td>
      </tr>
      <tr class="row-total">
        <td class="row-label">小計：平台總收入</td>
        <td class="row-value green">${fmt(overall.platformIncomeHkd)}</td>
      </tr>

      <tr class="row-section-header"><td colspan="2">OUTCOME（支出）</td></tr>
      <tr>
        <td class="row-label row-indent">已放款給賣家（Seller Payouts Completed）</td>
        <td class="row-value red">−${fmt(overall.paidOutHkd)}</td>
      </tr>
      <tr>
        <td class="row-label row-indent">退款（Refunds）</td>
        <td class="row-value red">−${fmt(overall.refundedAmountHkd)}</td>
      </tr>
      <tr class="row-total">
        <td class="row-label">小計：總支出</td>
        <td class="row-value red">−${fmt(overall.paidOutHkd + overall.refundedAmountHkd)}</td>
      </tr>

      <tr class="row-section-header"><td colspan="2">PENDING（待結算）</td></tr>
      <tr>
        <td class="row-label row-indent">待放款給賣家（Pending Payouts）</td>
        <td class="row-value" style="color:#d97706">−${fmt(overall.pendingPayoutHkd)}</td>
      </tr>

      <tr class="row-profit">
        <td class="row-label" style="font-size:13px">平台淨利潤（Net Platform Profit）</td>
        <td class="row-value green" style="font-size:15px">${fmt(overall.platformNetProfitHkd)}</td>
      </tr>
    </table>
  </div>

  <div class="report-footer">
    <div class="footer-note">本報告由系統自動生成，數據截至 ${generatedAt}。已付款訂單（payment_received / processing / shipped / delivered / completed）。退款/取消統計獨立計算。</div>
    <div>BOXIUM PTCG · 財務審核用途</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 2: PAYMENT METHOD ANALYSIS                             -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      ${logoSrc ? `<img src="${logoSrc}" class="page-header-logo" alt="BOXIUM">` : ""}
      <div>
        <div class="page-header-title">付款方式分析</div>
        <div class="page-header-subtitle">Payment Method Breakdown</div>
      </div>
    </div>
    <div class="page-header-right">
      <div>生成日期：${generatedAt}</div>
      <div>BOXIUM PTCG · 財務審核用途</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">付款方式概覽</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Stripe 交易額</div>
        <div class="kpi-value">${fmt(overall.stripeSalesHkd)}</div>
        <div class="kpi-sub">${overall.stripeCount} 筆 · ${stripePercent}% 佔比</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">支付寶 HK 交易額</div>
        <div class="kpi-value">${fmt(overall.alipaySalesHkd)}</div>
        <div class="kpi-sub">${overall.alipayCount} 筆 · ${alipayPercent}% 佔比</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stripe 平台收入</div>
        <div class="kpi-value">${fmt(overall.stripePlatformSalesHkd + overall.stripeSellerFeesHkd)}</div>
        <div class="kpi-sub">直售 ${fmt(overall.stripePlatformSalesHkd)} + 手續費 ${fmt(overall.stripeSellerFeesHkd)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">支付寶 HK 平台收入</div>
        <div class="kpi-value">${fmt(overall.alipayPlatformSalesHkd + overall.alipaySellerFeesHkd)}</div>
        <div class="kpi-sub">直售 ${fmt(overall.alipayPlatformSalesHkd)} + 手續費 ${fmt(overall.alipaySellerFeesHkd)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">付款方式詳細拆分</div>
    <div class="payment-grid">
      <div class="payment-card">
        <div class="payment-card-header stripe">Stripe 信用卡付款</div>
        <div class="payment-card-body">
          <div class="payment-row">
            <span class="payment-row-label">交易筆數</span>
            <span class="payment-row-value">${overall.stripeCount} 筆</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">總交易額（GMV）</span>
            <span class="payment-row-value">${fmt(overall.stripeSalesHkd)}</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">平台直售收入</span>
            <span class="payment-row-value">${fmt(overall.stripePlatformSalesHkd)}</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">C2C 手續費收入</span>
            <span class="payment-row-value">${fmt(overall.stripeSellerFeesHkd)}</span>
          </div>
          <div class="payment-row" style="border-top:2px solid #635bff;margin-top:4px;padding-top:10px">
            <span class="payment-row-label" style="font-weight:700">Stripe 平台總收入</span>
            <span class="payment-row-value" style="color:#635bff;font-size:13px">${fmt(overall.stripePlatformSalesHkd + overall.stripeSellerFeesHkd)}</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">佔總 GMV 比例</span>
            <span class="payment-row-value">${stripePercent}%</span>
          </div>
        </div>
      </div>
      <div class="payment-card">
        <div class="payment-card-header alipay">支付寶 HK（手動核對）</div>
        <div class="payment-card-body">
          <div class="payment-row">
            <span class="payment-row-label">交易筆數</span>
            <span class="payment-row-value">${overall.alipayCount} 筆</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">總交易額（GMV）</span>
            <span class="payment-row-value">${fmt(overall.alipaySalesHkd)}</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">平台直售收入</span>
            <span class="payment-row-value">${fmt(overall.alipayPlatformSalesHkd)}</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">C2C 手續費收入</span>
            <span class="payment-row-value">${fmt(overall.alipaySellerFeesHkd)}</span>
          </div>
          <div class="payment-row" style="border-top:2px solid #1677ff;margin-top:4px;padding-top:10px">
            <span class="payment-row-label" style="font-weight:700">支付寶 HK 平台總收入</span>
            <span class="payment-row-value" style="color:#1677ff;font-size:13px">${fmt(overall.alipayPlatformSalesHkd + overall.alipaySellerFeesHkd)}</span>
          </div>
          <div class="payment-row">
            <span class="payment-row-label">佔總 GMV 比例</span>
            <span class="payment-row-value">${alipayPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Payout Status -->
  <div class="section">
    <div class="section-title">放款狀態</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">待放款金額</div>
        <div class="kpi-value" style="color:#d97706">${fmt(overall.pendingPayoutHkd)}</div>
        <div class="kpi-sub">${overall.pendingPayoutCount} 筆待處理</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">已放款金額</div>
        <div class="kpi-value" style="color:#059669">${fmt(overall.paidOutHkd)}</div>
        <div class="kpi-sub">${overall.paidOutCount} 筆已完成</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">賣家應收款總額</div>
        <div class="kpi-value">${fmt(overall.sellerReceivableTotalHkd)}</div>
        <div class="kpi-sub">C2C 訂單賣家應得</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">退款總額</div>
        <div class="kpi-value" style="color:#dc2626">${fmt(overall.refundedAmountHkd)}</div>
        <div class="kpi-sub">${overall.refundedCount} 筆退款 · ${overall.cancelledCount} 筆取消</div>
      </div>
    </div>
  </div>

  <div class="report-footer">
    <div class="footer-note">付款方式分析基於已付款訂單。支付寶 HK 為人工核對付款，金額以 Admin 確認為準。</div>
    <div>BOXIUM PTCG · 財務審核用途</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 3: MONTHLY BREAKDOWN TABLE                             -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <div class="page-header-left">
      ${logoSrc ? `<img src="${logoSrc}" class="page-header-logo" alt="BOXIUM">` : ""}
      <div>
        <div class="page-header-title">月度明細</div>
        <div class="page-header-subtitle">Monthly Breakdown · 最近 ${months} 個月</div>
      </div>
    </div>
    <div class="page-header-right">
      <div>生成日期：${generatedAt}</div>
      <div>BOXIUM PTCG · 財務審核用途</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">逐月財務數據</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>月份</th>
          <th class="num">GMV</th>
          <th class="num">退款</th>
          <th class="num">淨收入</th>
          <th class="num">平台直售</th>
          <th class="num">C2C 銷售</th>
          <th class="num">手續費</th>
          <th class="num">平台收入</th>
          <th class="center">訂單數</th>
        </tr>
      </thead>
      <tbody>
        ${monthlyRows}
        <tr>
          <td class="bold">合計</td>
          <td class="num bold">${fmt(overall.totalSalesHkd)}</td>
          <td class="num bold red">−${fmt(overall.refundedAmountHkd)}</td>
          <td class="num bold green">${fmt(overall.netRevenueHkd)}</td>
          <td class="num bold">${fmt(overall.platformSalesHkd)}</td>
          <td class="num bold">${fmt(overall.sellerSalesHkd)}</td>
          <td class="num bold accent">${fmt(overall.totalFeesHkd)}</td>
          <td class="num bold accent">${fmt(overall.platformIncomeHkd)}</td>
          <td class="num bold center">${overall.totalOrders}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="report-footer">
    <div class="footer-note">本報告由系統自動生成，數據截至 ${generatedAt}。已付款訂單（payment_received / processing / shipped / delivered / completed）。退款/取消統計獨立計算。</div>
    <div>BOXIUM PTCG · 財務審核用途</div>
  </div>
</div>

</body>
</html>`;
}

export async function generateFinancialReportPdf(report: SalesReport, months: number): Promise<Buffer> {
  const logoB64 = getLogoBase64();
  const now = new Date();
  const generatedAt = now.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Hong_Kong",
  });

  const html = buildHtml(report, months, generatedAt, logoB64);

  const browser = await playwrightPool.getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
    // Wait for fonts to load
    await page.waitForTimeout(1500);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}
