import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { connectDB } from "./db";
import { verifyToken } from "./utils/jwt";
import { wsManager } from "./utils/websocket";
import authRoutes from "./routes/auth";
import categoryRoutes from "./routes/categories";
import postRoutes from "./routes/posts";
import replyRoutes from "./routes/replies";
import messageRoutes from "./routes/messages";
import userRoutes from "./routes/users";
import type { Server, IncomingMessage } from "http";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Type"],
    credentials: true,
  }),
);

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.route("/api/auth", authRoutes);
app.route("/api/categories", categoryRoutes);
app.route("/api/posts", postRoutes);
app.route("/api/replies", replyRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/users", userRoutes);

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

app.onError((err, c) => {
  console.error("Application error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = parseInt(process.env.PORT || "3000");

const startServer = async () => {
  await connectDB();

  const httpServer = serve({
    fetch: app.fetch,
    port,
  });

  const wss = new WebSocketServer({ noServer: true });

  (httpServer as Server).on("upgrade", (req, socket, head) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    if (url.pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");

    if (!token) {
      console.log("WebSocket upgrade rejected: No token provided");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.log("WebSocket upgrade rejected: Invalid token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const userId = payload.userId;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, userId);
    });
  });

  wss.on(
    "connection",
    (ws: WebSocket, _req: IncomingMessage, userId: string) => {
      console.log(`WebSocket connection established for user: ${userId}`);
      wsManager.addConnection(userId, ws);

      ws.send(
        JSON.stringify({
          type: "connected",
          data: { userId, message: "WebSocket connected successfully" },
        }),
      );

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`Received message from user ${userId}:`, message.type);

          if (message.type === "ping") {
            ws.send(
              JSON.stringify({ type: "pong", data: { timestamp: Date.now() } }),
            );
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      ws.on("close", (code, reason) => {
        console.log(
          `WebSocket closed for user ${userId}. Code: ${code}, Reason: ${reason}`,
        );
        wsManager.removeConnection(userId, ws);
      });

      ws.on("error", (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        wsManager.removeConnection(userId, ws);
      });
    },
  );

  console.log(`Server is running on port ${port}`);
  console.log(`HTTP server: http://localhost:${port}`);
  console.log(`WebSocket server: ws://localhost:${port}/ws`);
};

startServer();

export default app;
