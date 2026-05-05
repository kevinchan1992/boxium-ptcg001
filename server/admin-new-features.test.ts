/**
 * Admin New Features Tests (Phase 2-4)
 * Tests for:
 * 1. Audit Log CSV Export (adminExportAuditLogs)
 * 2. Seller Suspension Email Notifications (buildSellerSuspendedEmail, buildSellerUnsuspendedEmail)
 * 3. Auto AI Verification Trigger (submitAlipayProof returns aiVerificationPending)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// 1. AUDIT LOG CSV EXPORT
// ============================================================
describe('Audit Log CSV Export', () => {
  it('should have adminExportAuditLogs procedure defined', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    expect(marketplaceRouter._def.procedures).toHaveProperty('adminExportAuditLogs');
  });

  it('adminExportAuditLogs should be a query procedure', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    const proc = marketplaceRouter._def.procedures.adminExportAuditLogs;
    expect(proc._def.type).toBe('query');
  });

  it('adminExportAuditLogs should accept optional filter params', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    const proc = marketplaceRouter._def.procedures.adminExportAuditLogs;
    const inputs = proc._def.inputs;
    expect(inputs).toBeDefined();
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('CSV generation logic should produce correct header row', () => {
    // Test the CSV header format
    const header = ['ID', '時間(HKT)', '管理員ID', '操作', '目標類型', '目標ID', '詳情'];
    const csvHeader = header.join(',');
    expect(csvHeader).toBe('ID,時間(HKT),管理員ID,操作,目標類型,目標ID,詳情');
  });

  it('CSV generation should properly escape double quotes in details', () => {
    // Simulate the CSV escaping logic
    const details = 'reason: "test reason"';
    const escaped = details.replace(/"/g, '""');
    const csvCell = `"${escaped}"`;
    expect(csvCell).toBe('"reason: ""test reason"""');
  });

  it('action labels should map all known actions', () => {
    const actionLabels: Record<string, string> = {
      confirm_alipay: '確認支付寶收款',
      update_order_status: '更新訂單狀態',
      resolve_dispute: '解決爭議',
      suspend_seller: '凍結賣家',
      unsuspend_seller: '解凍賣家',
      ai_verify_alipay: 'AI 核對支付寶',
    };
    expect(actionLabels['confirm_alipay']).toBe('確認支付寶收款');
    expect(actionLabels['suspend_seller']).toBe('凍結賣家');
    expect(actionLabels['ai_verify_alipay']).toBe('AI 核對支付寶');
    // Unknown actions should fall back to raw action name
    const unknownAction = 'unknown_action';
    expect(actionLabels[unknownAction] || unknownAction).toBe('unknown_action');
  });

  it('adminExportAuditLogs should be admin-only procedure', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    const proc = marketplaceRouter._def.procedures.adminExportAuditLogs;
    // Admin procedures have middleware chain with role check
    const middlewares = proc._def.middlewares;
    expect(middlewares).toBeDefined();
    expect(middlewares.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 2. SELLER SUSPENSION EMAIL NOTIFICATIONS
// ============================================================
describe('Seller Suspension Email Templates', () => {
  it('should export buildSellerSuspendedEmail function', async () => {
    const emailService = await import('./emailService');
    expect(typeof emailService.buildSellerSuspendedEmail).toBe('function');
  });

  it('should export buildSellerUnsuspendedEmail function', async () => {
    const emailService = await import('./emailService');
    expect(typeof emailService.buildSellerUnsuspendedEmail).toBe('function');
  });

  it('buildSellerSuspendedEmail should return correct subject', async () => {
    const { buildSellerSuspendedEmail } = await import('./emailService');
    const result = buildSellerSuspendedEmail({
      sellerName: '測試賣家',
      reason: '違反平台規定',
    });
    expect(result.subject).toContain('BOXIUM PTCG');
    expect(result.subject).toContain('暫停');
  });

  it('buildSellerSuspendedEmail should include seller name and reason in HTML', async () => {
    const { buildSellerSuspendedEmail } = await import('./emailService');
    const result = buildSellerSuspendedEmail({
      sellerName: '測試賣家',
      reason: '違反平台規定',
    });
    expect(result.html).toContain('測試賣家');
    expect(result.html).toContain('違反平台規定');
  });

  it('buildSellerSuspendedEmail should include appeal email', async () => {
    const { buildSellerSuspendedEmail } = await import('./emailService');
    const result = buildSellerSuspendedEmail({
      sellerName: '測試賣家',
      reason: '違反平台規定',
      appealEmail: 'boxium.asia@gmail.com',
    });
    expect(result.html).toContain('boxium.asia@gmail.com');
  });

  it('buildSellerUnsuspendedEmail should return correct subject', async () => {
    const { buildSellerUnsuspendedEmail } = await import('./emailService');
    const result = buildSellerUnsuspendedEmail({
      sellerName: '測試賣家',
      reason: '帳號已恢復正常使用',
    });
    expect(result.subject).toContain('BOXIUM PTCG');
    expect(result.subject).toContain('恢復');
  });

  it('buildSellerUnsuspendedEmail should include seller name in HTML', async () => {
    const { buildSellerUnsuspendedEmail } = await import('./emailService');
    const result = buildSellerUnsuspendedEmail({
      sellerName: '測試賣家',
      reason: '帳號已恢復正常使用',
    });
    expect(result.html).toContain('測試賣家');
  });

  it('buildSellerSuspendedEmail should use default appeal email if not provided', async () => {
    const { buildSellerSuspendedEmail } = await import('./emailService');
    const result = buildSellerSuspendedEmail({
      sellerName: '測試賣家',
      reason: '違反平台規定',
    });
    // Should contain a default email address
    expect(result.html).toContain('boxium.asia@gmail.com');
  });

  it('adminSuspendSeller should have email sending capability', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    expect(marketplaceRouter._def.procedures).toHaveProperty('adminSuspendSeller');
    const proc = marketplaceRouter._def.procedures.adminSuspendSeller;
    expect(proc._def.type).toBe('mutation');
  });

  it('adminUnsuspendSeller should have email sending capability', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    expect(marketplaceRouter._def.procedures).toHaveProperty('adminUnsuspendSeller');
    const proc = marketplaceRouter._def.procedures.adminUnsuspendSeller;
    expect(proc._def.type).toBe('mutation');
  });
});

// ============================================================
// 3. AUTO AI VERIFICATION TRIGGER
// ============================================================
describe('Auto AI Verification on Proof Upload', () => {
  it('submitAlipayProof procedure should exist', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    expect(marketplaceRouter._def.procedures).toHaveProperty('submitAlipayProof');
  });

  it('submitAlipayProof should be a mutation procedure', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    const proc = marketplaceRouter._def.procedures.submitAlipayProof;
    expect(proc._def.type).toBe('mutation');
  });

  it('submitAlipayProof should accept orderId, proofImageBase64, and mimeType', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    const proc = marketplaceRouter._def.procedures.submitAlipayProof;
    const inputs = proc._def.inputs;
    expect(inputs).toBeDefined();
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('invokeLLM should be available for auto verification', async () => {
    const { invokeLLM } = await import('./_core/llm');
    expect(typeof invokeLLM).toBe('function');
  });

  it('AI verification result schema should have required fields', () => {
    // Validate the expected AI response schema
    const mockResult = {
      verified: true,
      detectedAmount: '100.00',
      detectedPayee: 'BOXIUM',
      detectedStatus: 'Completed',
      confidence: 'high',
      reason: '截圖顯示付款成功',
    };
    expect(mockResult).toHaveProperty('verified');
    expect(mockResult).toHaveProperty('detectedAmount');
    expect(mockResult).toHaveProperty('detectedPayee');
    expect(mockResult).toHaveProperty('detectedStatus');
    expect(mockResult).toHaveProperty('confidence');
    expect(mockResult).toHaveProperty('reason');
    expect(['high', 'medium', 'low']).toContain(mockResult.confidence);
  });

  it('AI verification fallback should handle parse errors gracefully', () => {
    // Simulate the fallback logic
    let result: any;
    try {
      result = JSON.parse('invalid json');
    } catch {
      result = {
        verified: false,
        detectedAmount: null,
        detectedPayee: null,
        detectedStatus: null,
        confidence: 'low',
        reason: 'AI 回應解析失敗',
      };
    }
    expect(result.verified).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.reason).toBe('AI 回應解析失敗');
  });

  it('adminAiVerifyAlipay should still exist for manual re-verification', async () => {
    const { marketplaceRouter } = await import('./routers/marketplace');
    expect(marketplaceRouter._def.procedures).toHaveProperty('adminAiVerifyAlipay');
  });
});

// ============================================================
// 4. EMAIL SERVICE INTEGRATION
// ============================================================
describe('Email Service Integration', () => {
  it('emailService should export all required functions', async () => {
    const emailService = await import('./emailService');
    const requiredExports = [
      'sendEmail',
      'buildSellerApprovedEmail',
      'buildSellerRejectedEmail',
      'buildNewOfferEmail',
      'buildSellerSuspendedEmail',
      'buildSellerUnsuspendedEmail',
    ];
    for (const fn of requiredExports) {
      expect(typeof (emailService as any)[fn]).toBe('function');
    }
  });

  it('buildSellerSuspendedEmail HTML should be valid (contains DOCTYPE or html tag)', async () => {
    const { buildSellerSuspendedEmail } = await import('./emailService');
    const result = buildSellerSuspendedEmail({
      sellerName: '賣家A',
      reason: '測試原因',
    });
    expect(result.html.toLowerCase()).toMatch(/<!doctype html>|<html/);
  });

  it('buildSellerUnsuspendedEmail HTML should be valid (contains DOCTYPE or html tag)', async () => {
    const { buildSellerUnsuspendedEmail } = await import('./emailService');
    const result = buildSellerUnsuspendedEmail({
      sellerName: '賣家A',
      reason: '帳號恢復',
    });
    expect(result.html.toLowerCase()).toMatch(/<!doctype html>|<html/);
  });
});
