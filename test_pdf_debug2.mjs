import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);
const PDFDocument = require('/home/ubuntu/boxium-ptcg/node_modules/.pnpm/pdfkit@0.18.0/node_modules/pdfkit/js/pdfkit.js');

const FONT_DIR = '/home/ubuntu/boxium-ptcg/server/fonts';
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSansTC-Regular.otf');
const FONT_BOLD = path.join(FONT_DIR, 'NotoSansTC-Bold.otf');

const chunks = [];
// KEY FIX: margin: 0 prevents PDFKit from auto page-breaking
const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape', autoFirstPage: false, bufferPages: true });
doc.on('data', c => chunks.push(c));

let pageCount = 0;
doc.on('pageAdded', () => {
  pageCount++;
  const err = new Error('pageAdded');
  const stack = err.stack?.split('\n').slice(1, 4).join(' | ') || '';
  console.log(`[PAGE ADDED #${pageCount}] doc.y=${doc.y} | ${stack}`);
});

doc.registerFont('Regular', FONT_REGULAR);
doc.registerFont('Bold', FONT_BOLD);

doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
const pageH = doc.page.height;
const pageW = doc.page.width;
const margin = 40;
const contentW = pageW - margin * 2;

console.log(`pageH=${pageH}, pageW=${pageW}, page.maxY=${doc.page.maxY()}`);

const cols = [40, 60, 34, 148, 72, 50, 72, 68, 42, 66, 60, 50];

// Simulate row at rowY=474 (last row before page break)
let rowY = 474;
console.log(`Simulating row at rowY=${rowY}, pageH-margin=${pageH-margin}`);
doc.rect(margin, rowY, contentW, 44).fill('white');

let cx = margin + 40;
const textCols = cols.slice(1);
textCols.forEach((w, ci) => {
  const textY = rowY + (44 - 14) / 2;
  doc.fillColor('black').font('Regular').fontSize(7.5)
    .text(`Long text overflow test ${ci}`, cx + 3, textY, { width: w - 6, lineBreak: false, ellipsis: true });
  doc.y = rowY;
  cx += w;
});

console.log(`After row, doc.y=${doc.y}`);

doc.end();
await new Promise(resolve => doc.on('end', () => {
  const buf = Buffer.concat(chunks);
  fs.writeFileSync('/tmp/test_pdf_debug2.pdf', buf);
  const info = execSync('pdfinfo /tmp/test_pdf_debug2.pdf').toString();
  console.log('Final Pages:', info.match(/Pages:\s+(\d+)/)?.[1]);
  resolve();
}));
