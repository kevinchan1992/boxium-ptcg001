import { describe, it, expect } from 'vitest';
import { ENV } from '../_core/env';

describe('Google OAuth Configuration', () => {
  it('should have valid Google OAuth credentials', () => {
    // 檢查環境變數是否存在
    expect(ENV.googleClientId).toBeDefined();
    expect(ENV.googleClientSecret).toBeDefined();
    
    // 檢查格式是否正確
    expect(ENV.googleClientId).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
    expect(ENV.googleClientSecret).toMatch(/^GOCSPX-[a-zA-Z0-9_-]+$/);
    
    // 檢查不是佔位符
    expect(ENV.googleClientId).not.toBe('your-google-client-id');
    expect(ENV.googleClientSecret).not.toBe('your-google-client-secret');
  });

  it('should have matching client IDs for frontend and backend', () => {
    // 前端和後端應該使用相同的 Client ID
    expect(ENV.googleClientId).toBe(process.env.VITE_GOOGLE_CLIENT_ID);
  });
});
