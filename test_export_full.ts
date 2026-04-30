import { generateCardInventoryExcel, generateCardInventoryPdf } from './server/services/cardInventoryExport';

async function main() {
  const year = 2026;
  const month = 0; // full year
  
  console.log('Testing Excel export...');
  const start1 = Date.now();
  const excelBuf = await generateCardInventoryExcel(year, month);
  console.log(`Excel done: ${Date.now() - start1}ms, size: ${excelBuf.length} bytes`);
  
  console.log('Testing PDF export...');
  const start2 = Date.now();
  const pdfBuf = await generateCardInventoryPdf(year, month);
  console.log(`PDF done: ${Date.now() - start2}ms, size: ${pdfBuf.length} bytes`);
}

main().catch(console.error);
