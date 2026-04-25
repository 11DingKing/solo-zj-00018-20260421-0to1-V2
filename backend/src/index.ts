import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { connectDB } from './db';
import { verifyToken } from './utils/jwt';
import { wsManager } from './utils/websocket';
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import postRoutes from './routes/posts';
import replyRoutes from './routes/replies';
import messageRoutes from './routes/messages';
import userRoutes from './routes/users';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type'],
  credentials: true,
}));

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.route('/api/auth', authRoutes);
app.route('/api/categories', categoryRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/replies', replyRoutes);
app.route('/api/messages', messageRoutes);
app.route('/api/users', userRoutes);

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

const port = parseInt(process.env.PORT || '3000');

const startServer = async () => {
  await connectDB();

  const server = createServer();
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.log('WebSocket connection rejected: No token provided');
      ws.close(1008, 'Unauthorized: No token provided');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.log('WebSocket connection rejected: Invalid token');
      ws.close(1008, 'Unauthorized: Invalid token');
      return;
    }

    const userId = payload.userId;
    console.log(`WebSocket connection established for user: ${userId}`);
    wsManager.addConnection(userId, ws);

    ws.send(JSON.stringify({
      type: 'connected',
      data: { userId, message: 'WebSocket connected successfully' },
    }));

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`Received message from user ${userId}:`, message.type);

        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket closed for user ${userId}. Code: ${code}, Reason: ${reason}`);
      wsManager.removeConnection(userId, ws);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      wsManager.removeConnection(userId, ws);
    });
  });

  server.on('request', (req, res) => {
    app.fetch(req, { incoming: req.raw, outgoing: res.raw } as unknown as any);
  });

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`HTTP server: http://localhost:${port}`);
    console.log(`WebSocket server: ws://localhost:${port}/ws`);
  });
};

startServer();

export default app;
