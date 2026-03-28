import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { authController } from './auth';
import { roomsController } from './rooms';

// Initialize embedded SQLite database
const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

const app = new Hono();

// Global middlewares
app.use('*', logger()); // Logs all requests and their status codes
app.use('*', cors());   // Allows frontend to make requests without CORS errors

app.get('/', (c) => {
  return c.json({ message: 'TeamHub API is running!' });
});

app.route('/auth', authController);
app.route('/rooms', roomsController);

export default {
  port: 3001,
  fetch: app.fetch,
};
