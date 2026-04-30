import PDFDocument from 'pdfkit';
import https from 'https';
import sharp from 'sharp';
import { execSync } from 'child_process';
import fs from 'fs';

// Fetch one image
const url = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eq38-card-image-1745592007.webp';

const rawBuf = await new Promise((resolve) => {
  https.get(url, { timeout: 8000 }, (res) => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', () => resolve(null));
  });
});

const imgBuf = await sharp(rawBuf).resize(100, 140, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png({ compressionLevel: 6 }).toBuffer();
console.log('Image size:', imgBuf.length, 'bytes');

// Test PDFKit
const doc = new PDFDocument({ size: 'A4', layout: 'landscape', bufferPages: true, autoFirstPage: false });
doc.addPage({ size: 'A4', layout: 'landscape' });

let pageCount = 1;
doc.on('pageAdded', () => {
  pageCount++;
  console.log(`PAGE ADDED! Now at page ${pageCount}, doc.y = ${doc.y}`);
  // Print stack trace
  const err = new Error('page added');
  console.log(err.stack.split('\n').slice(1, 5).join('\n'));
});

const chunks = [];
doc.on('data', c => chunks.push(c));
doc.on('end', () => {
  const buf = Buffer.concat(chunks);
  fs.writeFileSync('/tmp/minimal_test.pdf', buf);
  const info = execSync('pdfinfo /tmp/minimal_test.pdf').toString();
  console.log('Pages:', info.match(/Pages:\s+(\d+)/)?.[1]);
});

// Simulate 15 rows
const pageH = doc.page.height;
const margin = 40;
const ROW_H = 44;
const IMG_COL_W = 40;
let rowY = 100; // start after header

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
  
  console.log(`Row ${i}: rowY=${rowY}, imgY=${imgY}, imgH=${imgH}, pageH=${pageH}`);
  
  const savedY = doc.y;
  doc.image(imgBuf, imgX, imgY, { width: imgW, height: imgH });
  console.log(`  After image: doc.y=${doc.y} (was ${savedY})`);
  doc.y = rowY;
  
  // Text
  doc.fillColor('black').fontSize(8).text('Test text', margin + IMG_COL_W + 3, rowY + 15, { width: 100, lineBreak: false });
  doc.y = rowY;
  
  rowY += ROW_H;
}

doc.end();
