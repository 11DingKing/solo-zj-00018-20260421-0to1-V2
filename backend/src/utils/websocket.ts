import { WebSocket } from "ws";
import { Types } from "mongoose";

interface ConnectionInfo {
  userId: string;
  ws: WebSocket;
}

class WebSocketManager {
  private connections: Map<string, Set<WebSocket>> = new Map();

  addConnection(userId: string, ws: WebSocket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);
    console.log(
      `User ${userId} connected via WebSocket. Total connections: ${this.connections.get(userId)!.size}`,
    );
  }

  removeConnection(userId: string, ws: WebSocket) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      console.log(
        `User ${userId} disconnected. Remaining connections: ${userConnections.size}`,
      );
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  sendToUser(
    userId: string | Types.ObjectId,
    message: Record<string, unknown>,
  ) {
    const userIdStr = userId.toString();
    const userConnections = this.connections.get(userIdStr);
    if (userConnections && userConnections.size > 0) {
      const messageStr = JSON.stringify(message);
      console.log(
        `Broadcasting to user ${userIdStr}: ${messageStr.substring(0, 100)}...`,
      );
      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
      return true;
    }
    console.log(`No active connections for user ${userIdStr}`);
    return false;
  }

  isUserOnline(userId: string | Types.ObjectId): boolean {
    const userIdStr = userId.toString();
    const userConnections = this.connections.get(userIdStr);
    return userConnections !== undefined && userConnections.size > 0;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.connections.keys());
  }
}

export const wsManager = new WebSocketManager();
