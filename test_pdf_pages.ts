import { generateCardInventoryPdf } from './server/services/cardInventoryExport';
import fs from 'fs';

async function main() {
  console.log('Generating PDF...');
  const start = Date.now();
  const buf = await generateCardInventoryPdf(2026, 0);
  const elapsed = Date.now() - start;
  fs.writeFileSync('/tmp/test_output.pdf', buf);
  console.log(`Done in ${elapsed}ms, size: ${buf.length} bytes`);
  
  // Count pages using pdfinfo
  const { execSync } = await import('child_process');
  try {
    const info = execSync('pdfinfo /tmp/test_output.pdf 2>&1').toString();
    const pageMatch = info.match(/Pages:\s+(\d+)/);
    console.log('Page count:', pageMatch ? pageMatch[1] : 'unknown');
    console.log(info);
  } catch (e) {
    console.log('pdfinfo not available');
  }
}

main().catch(console.error);
