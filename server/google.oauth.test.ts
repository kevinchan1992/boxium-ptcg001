import { describe, it, expect } from 'vitest';

describe('Google OAuth credentials', () => {
  it('GOOGLE_CLIENT_ID should be set and valid format', () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId, 'GOOGLE_CLIENT_ID is not set').toBeTruthy();
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it('GOOGLE_CLIENT_SECRET should be set and non-empty', () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret, 'GOOGLE_CLIENT_SECRET is not set').toBeTruthy();
    expect(clientSecret!.length).toBeGreaterThan(10);
  });
});
