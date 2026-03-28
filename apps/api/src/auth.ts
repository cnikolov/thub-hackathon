import { Hono } from 'hono';
import { jwt, sign } from 'hono/jwt';

export const authController = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || 'hackathon-super-secret-key';

authController.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const email = emailRaw || 'user@teamhub.local';
  const displayName = email.includes('@') ? email.split('@')[0]! : 'User';

  const payload = {
    sub: 'user-123',
    email,
    displayName,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  };

  const token = await sign(payload, JWT_SECRET);
  return c.json({
    token,
    user: { id: 'user-123', email, displayName },
  });
});

authController.use('/me', jwt({ secret: JWT_SECRET, alg: 'HS256' }));
authController.get('/me', (c) => {
  const payload = c.get('jwtPayload');
  return c.json({ user: payload });
});
