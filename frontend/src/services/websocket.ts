// src/services/websocket.ts
interface WebSocketMessage {
  type: 'message' | 'notification' | 'error' | 'ping' | 'pong';
  data: any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private connectionHandlers: ((connected: boolean) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  setToken(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `${this.url}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyConnection(true);
        
        // Отправляем ping каждые 30 секунд для поддержания соединения
        setInterval(() => {
          if (this.isConnected()) {
            this.send({ type: 'ping', data: {} });
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.notifyConnection(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.attemptReconnect();
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  send(message: WebSocketMessage) {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  sendMessage(chatId: string, content: string, messageType: string = 'text') {
    const message = {
      type: 'message' as const,
      data: {
        content,
        chat_id: chatId,
        message_type: messageType
      }
    };
    this.send(message);
  }

  onMessage(type: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  offMessage(type: string, handler: (data: any) => void) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.push(handler);
  }

  offConnectionChange(handler: (connected: boolean) => void) {
    const index = this.connectionHandlers.indexOf(handler);
    if (index > -1) {
      this.connectionHandlers.splice(index, 1);
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.data));
    }
  }

  private notifyConnection(connected: boolean) {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected()) {
        this.connect();
      }
    }, delay);
  }
}

// Создаем глобальный экземпляр WebSocket сервиса
// Замени URL на реальный адрес твоего WebSocket сервера
const WS_URL = 'ws://localhost:8080/api/v1/ws';
export const websocketService = new WebSocketService(WS_URL);