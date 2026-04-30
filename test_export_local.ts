import { generateCardInventoryExcel } from './server/services/cardInventoryExport';
import fs from 'fs';

async function main() {
  console.log('Starting Excel generation...');
  try {
    const buf = await generateCardInventoryExcel(2025, 0);
    console.log('Excel buffer size:', buf.length);
    fs.writeFileSync('/tmp/test_export.xlsx', buf);
    console.log('SUCCESS - Saved to /tmp/test_export.xlsx');
  } catch (err: any) {
    console.error('FAILED:', err.message);
    console.error(err.stack?.split('\n').slice(0,5).join('\n'));
  }
}
main();
