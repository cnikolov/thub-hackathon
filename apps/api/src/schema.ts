import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('ownerId').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requirements: text('requirements').notNull(),
  systemPrompt: text('systemPrompt').notNull(),
  shareCode: text('shareCode').unique().notNull(),
  status: text('status', { enum: ['open', 'closed'] }).default('open'),
  interviewType: text('interviewType', { enum: ['intro', 'technical'] }).default('intro'),
  durationMinutes: integer('durationMinutes').default(15),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const candidates = sqliteTable('candidates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('jobId').notNull().references(() => jobs.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  score: integer('score'),
  notes: text('notes'),
  transcript: text('transcript'),
  strengths: text('strengths', { mode: 'json' }).$type<string[]>(),
  weaknesses: text('weaknesses', { mode: 'json' }).$type<string[]>(),
  status: text('status', { enum: ['pending', 'interviewed', 'shortlisted', 'rejected'] }).default('pending'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
