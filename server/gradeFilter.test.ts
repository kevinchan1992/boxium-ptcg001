import { describe, it, expect } from 'vitest';
import { parseGradeFilter } from './db';

describe('parseGradeFilter', () => {
  it('detects bgs9.5', () => {
    const result = parseGradeFilter('bgs9.5');
    expect(result.gradeFilter).toEqual(['BGS9.5', 'BGS 9.5']);
    expect(result.gradeLabel).toBe('BGS 9.5');
    expect(result.cleanQuery).toBe('');
  });

  it('detects bgs 9.5 with spaces', () => {
    const result = parseGradeFilter('bgs 9.5 pikachu');
    expect(result.gradeFilter).toEqual(['BGS9.5', 'BGS 9.5']);
    expect(result.cleanQuery).toBe('pikachu');
  });

  it('detects psa10', () => {
    const result = parseGradeFilter('psa10 リザードン');
    expect(result.gradeFilter).toEqual(['PSA10', 'PSA 10']);
    expect(result.gradeLabel).toBe('PSA 10');
    expect(result.cleanQuery).toBe('リザードン');
  });

  it('detects psa 10 with space', () => {
    const result = parseGradeFilter('psa 10');
    expect(result.gradeFilter).toEqual(['PSA10', 'PSA 10']);
    expect(result.cleanQuery).toBe('');
  });

  it('detects bgs10', () => {
    const result = parseGradeFilter('bgs10');
    expect(result.gradeFilter).toEqual(['BGS10 GL', 'BGS10 BL', 'BGS 10 GL', 'BGS 10 BL']);
    expect(result.gradeLabel).toBe('BGS 10');
  });

  it('detects psa9', () => {
    const result = parseGradeFilter('psa9');
    expect(result.gradeFilter).toEqual(['PSA9', 'PSA 9']);
    expect(result.gradeLabel).toBe('PSA 9');
  });

  it('does NOT match psa9 when input is psa9.5 (no such grade, just ensure no false positive)', () => {
    // psa9.5 doesn't exist in our map, so should return null
    const result = parseGradeFilter('psa9.5');
    expect(result.gradeFilter).toBeNull();
  });

  it('detects ars10', () => {
    const result = parseGradeFilter('ars10');
    expect(result.gradeFilter).toEqual(['ARS10', 'ARS10+']);
    expect(result.gradeLabel).toBe('ARS 10');
  });

  it('returns null for plain card name', () => {
    const result = parseGradeFilter('pikachu');
    expect(result.gradeFilter).toBeNull();
    expect(result.cleanQuery).toBe('pikachu');
    expect(result.gradeLabel).toBeNull();
  });

  it('handles uppercase input', () => {
    const result = parseGradeFilter('PSA10');
    expect(result.gradeFilter).toEqual(['PSA10', 'PSA 10']);
  });

  it('detects grade:a', () => {
    const result = parseGradeFilter('grade:a');
    expect(result.gradeFilter).toEqual(['A']);
    expect(result.gradeLabel).toBe('中古 A');
  });
});
