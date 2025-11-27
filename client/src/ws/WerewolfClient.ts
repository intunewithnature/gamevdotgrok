import { ClientMessage, ServerMessage } from "../types";

type MessageHandler = (msg: ServerMessage) => void;

export class WerewolfClient {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private url: string;

  constructor(url: string = "ws://localhost:3000") {
    this.url = url;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.socket = new WebSocket(this.url);

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.notify(msg);
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    };

    this.socket.onclose = () => {
      console.log("Disconnected from server");
      // Optional: Auto-reconnect logic could go here
    };

    this.socket.onerror = (err) => {
      console.error("WebSocket error", err);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(msg: ClientMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      console.warn("Socket not open, cannot send", msg);
    }
  }

  addListener(handler: MessageHandler) {
    this.listeners.add(handler);
  }

  removeListener(handler: MessageHandler) {
    this.listeners.delete(handler);
  }

  private notify(msg: ServerMessage) {
    this.listeners.forEach(handler => handler(msg));
  }
}

export const wsClient = new WerewolfClient();
