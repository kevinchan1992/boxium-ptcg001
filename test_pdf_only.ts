// Test PDF generation only (no Excel/ExcelJS)
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const FONT_DIR = path.join(process.cwd(), 'server/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSansTC-Regular.otf');
const FONT_BOLD = path.join(FONT_DIR, 'NotoSansTC-Bold.otf');

async function main() {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', autoFirstPage: false });
  doc.on('data', (c: Buffer) => chunks.push(c));
  
  let pageCount = 0;
  doc.on('pageAdded', () => {
    pageCount++;
    const err = new Error('pageAdded');
    const stack = err.stack?.split('\n').slice(1, 4).join(' | ') || '';
    console.log(`[PAGE ADDED #${pageCount}] doc.y=${doc.y} | ${stack}`);
  });
  
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold', FONT_BOLD);
  
  doc.addPage({ size: 'A4', layout: 'landscape' });
  console.log('After addPage, doc.y:', doc.y);
  
  const pageH = doc.page.height;
  const pageW = doc.page.width;
  const margin = 40;
  
  // Header bar
  doc.rect(0, 0, pageW, 72).fill('#06038D');
  
  // Title text
  doc.fillColor('white').font('Bold').fontSize(18)
    .text('Test Title', margin + 155, 16, { lineBreak: false });
  console.log('After title text, doc.y:', doc.y);
  doc.y = 16;
  console.log('After doc.y=16:', doc.y);
  
  // Subtitle
  doc.fillColor('white').font('Regular').fontSize(11)
    .text('Subtitle text here', margin + 155, 42, { lineBreak: false });
  console.log('After subtitle, doc.y:', doc.y);
  doc.y = 42;
  
  // Stats
  const sy = 84;
  for (let i = 0; i < 4; i++) {
    const sx = margin + i * 185;
    doc.rect(sx, sy, 175, 44).fill('#f8f9fa');
    doc.fillColor('#6b7280').font('Regular').fontSize(9)
      .text(`Label ${i}`, sx + 8, sy + 8, { width: 159, lineBreak: false });
    console.log(`After stat ${i} label, doc.y:`, doc.y);
    doc.y = sy;
    doc.fillColor('black').font('Bold').fontSize(14)
      .text(`Value ${i}`, sx + 8, sy + 22, { width: 159, lineBreak: false });
    console.log(`After stat ${i} value, doc.y:`, doc.y);
    doc.y = sy;
  }
  doc.y = sy + 44;
  console.log('After all stats, doc.y:', doc.y);
  
  // Table header
  const tableTop = sy + 60;
  console.log('tableTop:', tableTop, 'pageH:', pageH, 'pageH-margin:', pageH - margin);
  doc.rect(margin, tableTop, 762, 22).fill('#06038D');
  const cols = [40, 60, 34, 148, 72, 50, 72, 68, 42, 66, 60, 50];
  let cx = margin;
  cols.forEach((w, i) => {
    doc.fillColor('white').font('Bold').fontSize(8)
      .text(`C${i}`, cx + 4, tableTop + 7, { width: w - 8, lineBreak: false });
    doc.y = tableTop;
    cx += w;
  });
  console.log('After table header, doc.y:', doc.y);
  
  // Rows
  let rowY = tableTop + 22;
  for (let i = 0; i < 12; i++) {
    if (rowY + 44 > pageH - margin) {
      console.log(`Manual page break at row ${i}, rowY=${rowY}`);
      doc.addPage({ size: 'A4', layout: 'landscape' });
      rowY = margin;
      // Redraw header
      doc.rect(margin, rowY, 762, 22).fill('#06038D');
      rowY += 22;
    }
    
    console.log(`Row ${i}: rowY=${rowY}`);
    doc.rect(margin, rowY, 762, 44).fill(i % 2 === 0 ? 'white' : '#f9fafb');
    
    cx = margin;
    cols.forEach((w, ci) => {
      doc.fillColor('black').font('Regular').fontSize(7.5)
        .text(`R${i}C${ci}`, cx + 3, rowY + 15, { width: w - 6, lineBreak: false });
      doc.y = rowY;
      cx += w;
    });
    console.log(`  After row ${i} cells, doc.y:`, doc.y);
    rowY += 44;
  }
  
  doc.end();
  
  await new Promise<void>(resolve => doc.on('end', () => {
    const buf = Buffer.concat(chunks);
    fs.writeFileSync('/tmp/test_pdf_only.pdf', buf);
    const info = execSync('pdfinfo /tmp/test_pdf_only.pdf').toString();
    console.log('Final Pages:', info.match(/Pages:\s+(\d+)/)?.[1]);
    resolve();
  }));
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
