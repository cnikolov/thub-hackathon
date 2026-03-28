import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { populateSampleData } from './seed-data';

async function seed() {
  console.log('🌱 Seeding database (reset + sample data)...');

  const sqlite = new Database('dev.db');
  const db = drizzle(sqlite);

  const result = await populateSampleData(db, { clearFirst: true });
  console.log('Inserted:', result);
  console.log('✅ Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
