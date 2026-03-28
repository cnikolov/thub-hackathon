import { Hono } from 'hono';
import { jwt, sign } from 'hono/jwt';

export const authController = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || 'hackathon-super-secret-key';

authController.post('/login', async (c) => {
  const { email } = await c.req.json();
  
  // Basic mock login for hackathon velocity
  const payload = {
    sub: 'user-123',
    email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  
  const token = await sign(payload, JWT_SECRET);
  return c.json({ token, user: { email, id: 'user-123' } });
});

authController.use('/me', jwt({ secret: JWT_SECRET, alg: 'HS256' }));
authController.get('/me', (c) => {
  const payload = c.get('jwtPayload');
  return c.json({ user: payload });
});
