import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InvoiceScanService } from '../src/modules/invoice-scan/invoice-scan.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const result = await app.get(InvoiceScanService).migrateLegacyBucket();
    console.log(`Invoice-scan migration complete: ${result.migrated} migrated, ${result.failed} failed.`);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
