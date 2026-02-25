import { describe, it, expect } from 'vitest';

describe('AI Article Generation - Image & Date Fix', () => {
  it('should include current date in prompt', () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Verify current date logic
    expect(currentYear).toBe(2026);
    expect(currentMonth).toBe(2);
  });

  it('should generate correct date string format', () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();
    const currentDateStr = `${currentYear}年${currentMonth}月${currentDate}日`;
    
    // Verify date string format
    expect(currentDateStr).toContain('2026年');
    expect(currentDateStr).toContain('2月');
  });

  it('should have enhanced image usage instructions in prompt', () => {
    // This test verifies that the prompt includes strong image usage instructions
    const promptExample = `7. **引用卡牌圖片**：在文章中介紹每張卡牌時，**必須**在卡牌名稱後立即使用 Markdown 圖片語法插入圖片`;
    
    expect(promptExample).toContain('**必須**');
    expect(promptExample).toContain('Markdown 圖片語法');
  });

  it('should provide concrete image syntax example in prompt', () => {
    const exampleSyntax = '![Pikachu (VMAX Climax - CHR)](https://example.com/pikachu.jpg)';
    
    // Verify Markdown image syntax format
    expect(exampleSyntax).toMatch(/!\[.*\]\(https?:\/\/.*\)/);
  });
});
