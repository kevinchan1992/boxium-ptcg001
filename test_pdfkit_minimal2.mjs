import PDFDocument from 'pdfkit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Use logo as test image
const logoPath = path.join(process.cwd(), 'server/fonts/boxium-logo-pdf.png');
const imgBuf = fs.readFileSync(logoPath);
console.log('Image size:', imgBuf.length, 'bytes');

// Test PDFKit
const doc = new PDFDocument({ size: 'A4', layout: 'landscape', bufferPages: true, autoFirstPage: false });
doc.addPage({ size: 'A4', layout: 'landscape' });

let pageCount = 1;
doc.on('pageAdded', () => {
  pageCount++;
  console.log(`PAGE ADDED! Now at page ${pageCount}, doc.y = ${doc.y}`);
});

const chunks = [];
doc.on('data', c => chunks.push(c));
doc.on('end', () => {
  const buf = Buffer.concat(chunks);
  fs.writeFileSync('/tmp/minimal_test2.pdf', buf);
  const info = execSync('pdfinfo /tmp/minimal_test2.pdf').toString();
  console.log('Pages:', info.match(/Pages:\s+(\d+)/)?.[1]);
});

// Simulate 15 rows
const pageH = doc.page.height;
const margin = 40;
const ROW_H = 44;
const IMG_COL_W = 40;
let rowY = 100;

console.log(`pageH=${pageH}, pageH-margin=${pageH-margin}`);

for (let i = 0; i < 15; i++) {
  if (rowY + ROW_H > pageH - margin) {
    console.log(`Manual page break at row ${i}, rowY=${rowY}`);
    doc.addPage({ size: 'A4', layout: 'landscape' });
    rowY = margin;
  }
  
  const imgX = margin + 3;
  const imgY = rowY + 2;
  const imgW = IMG_COL_W - 6;
  const imgH = ROW_H - 4;
  
  console.log(`Row ${i}: rowY=${rowY}`);
  
  const savedY = doc.y;
  doc.image(imgBuf, imgX, imgY, { width: imgW, height: imgH });
  console.log(`  After image: doc.y=${doc.y} (was ${savedY})`);
  doc.y = rowY;
  
  doc.fillColor('black').fontSize(8).text('Test text', margin + IMG_COL_W + 3, rowY + 15, { width: 100, lineBreak: false });
  console.log(`  After text: doc.y=${doc.y}`);
  doc.y = rowY;
  
  rowY += ROW_H;
}

doc.end();
