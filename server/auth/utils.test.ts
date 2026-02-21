import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, isValidEmail, isValidPassword, generateRandomToken } from './utils';

describe('Authentication Utils', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword456';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should validate strong password', () => {
      expect(isValidPassword('TestPassword123')).toBe(true);
      expect(isValidPassword('Abcd1234')).toBe(true);
    });

    it('should reject weak password', () => {
      expect(isValidPassword('short')).toBe(false); // Too short
      expect(isValidPassword('alllowercase123')).toBe(false); // No uppercase
      expect(isValidPassword('ALLUPPERCASE123')).toBe(false); // No lowercase
      expect(isValidPassword('NoNumbers')).toBe(false); // No numbers
    });
  });

  describe('Token Generation', () => {
    it('should generate random token', () => {
      const token1 = generateRandomToken();
      const token2 = generateRandomToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2); // Should be different
      expect(token1.length).toBeGreaterThan(0);
    });
  });
});
