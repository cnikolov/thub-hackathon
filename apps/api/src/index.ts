import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { authController } from './auth';

// Initialize embedded SQLite database
const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'TeamHub API is running!' });
});

app.route('/auth', authController);

export default {
  port: 3001,
  fetch: app.fetch,
};
