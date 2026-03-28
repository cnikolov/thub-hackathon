import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { projects } from './schema';
import { eq } from 'drizzle-orm';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

export const projectsController = new Hono();

// Get all projects for testing/mock user
projectsController.get('/', async (c) => {
  try {
    const allProjects = await db.select().from(projects);
    return c.json({ success: true, data: allProjects });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create a new project
projectsController.post('/', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.ownerId) {
      return c.json({ success: false, error: 'Name and ownerId are required' }, 400);
    }
    
    const newProject = await db.insert(projects).values({
      name: body.name,
      description: body.description || '',
      ownerId: body.ownerId,
      createdAt: new Date()
    }).returning();
    
    return c.json({ success: true, data: newProject[0] });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});
