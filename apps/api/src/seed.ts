import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { projects, jobs, candidates } from './schema';

async function seed() {
  console.log('🌱 Starting database seeding...');
  
  const sqlite = new Database('dev.db');
  const db = drizzle(sqlite);

  // 1. Create a Demo Project
  console.log('Creating demo project...');
  const [project] = await db.insert(projects).values({
    name: 'Hackathon Project',
    description: 'Seed data generated for the hackathon prototype.',
    ownerId: 'user-123',
  }).returning();

  // 2. Create a Demo Job
  console.log('Creating demo job...');
  const [job] = await db.insert(jobs).values({
    projectId: project.id,
    title: 'Senior React Developer',
    description: 'Looking for a Senior React Developer to join our core team.',
    requirements: '5+ years of React experience, Strong TypeScript skills.',
    systemPrompt: 'You are an HR recruiter. Gather answers for key requirements.',
    shareCode: 'HACK24',
    status: 'open',
    interviewType: 'technical',
    durationMinutes: 30,
  }).returning();

  // 3. Create a Demo Candidate
  console.log('Creating demo candidate...');
  await db.insert(candidates).values({
    jobId: job.id,
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    score: 85,
    notes: 'Very strong React knowledge. Recommended to proceed.',
    transcript: 'AI: Hello, are you ready? User: Yes, I am...',
    strengths: ['React Profiler', 'Custom Hooks', 'Type safety'],
    weaknesses: ['Has not used Bun much'],
    status: 'interviewed',
  });

  console.log('✅ Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
