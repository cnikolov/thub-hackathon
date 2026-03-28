import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { authController } from './auth';
import { roomsController } from './rooms';
import { dashboardController } from './dashboard';
import { projectsController } from './projects';
import { jobsController } from './jobs';
import { candidatesController } from './candidates';
import { aiController } from './ai';
import { devController } from './dev';
import { websocketHandler, type WsData } from './interview';

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
app.route('/dashboard', dashboardController);
app.route('/projects', projectsController);
app.route('/jobs', jobsController);
app.route('/candidates', candidatesController);
app.route('/ai', aiController);
app.route('/dev', devController);

export { app };

export default {
  port: 3001,
  fetch(req: Request, server: import('bun').Server) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/ws/interview/')) {
      const sessionId = url.pathname.slice('/ws/interview/'.length);
      if (sessionId && server.upgrade<WsData>(req, { data: { sessionId } })) {
        return undefined;
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    return app.fetch(req, server);
  },
  websocket: websocketHandler,
};
