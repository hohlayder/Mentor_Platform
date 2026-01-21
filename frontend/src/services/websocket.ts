// src/services/websocket.ts

// Сообщение, которое мы отправляем на сервер
export interface OutgoingMessage {
  chat_id: string;
  content: string;
  reply_to?: string;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments?: Attachment[];
}

// Сообщение, которое мы получаем от сервера
export interface IncomingMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  reply_to?: string;
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  is_edited: boolean;
  is_read: boolean;
  read_at?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
}

// WebSocket сообщения, которые мы получаем (обертка)
interface WebSocketIncomingWrapper {
  type: 'message' | 'notification' | 'error' | 'ping' | 'pong';
  data: IncomingMessage | any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private isManualDisconnect = false;

  constructor(url: string) {
    this.url = url;
  }

  setToken(token: string) {
    this.token = token;
  }

  connect() {
    if (this.isConnected()) {
      console.log('WebSocket уже подключен');
      return;
    }

    this.isManualDisconnect = false;
    
    // Очищаем предыдущий таймаут реконнекта
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const wsUrl = `${this.url}?token=${this.token}`;
      console.log('Подключаемся к WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket подключен успешно');
        this.reconnectAttempts = 0;
        this.notifyConnection(true);
        
        // Запускаем ping каждые 30 секунд
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketIncomingWrapper = JSON.parse(event.data);
          console.log('Получено WebSocket сообщение типа:', message.type, 'данные:', message.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Ошибка парсинга WebSocket сообщения:', error, 'raw:', event.data);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket отключен. Код:', event.code, 'Причина:', event.reason);
        this.cleanup();
        this.notifyConnection(false);
        
        if (!this.isManualDisconnect) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
      };

    } catch (error) {
      console.error('Ошибка подключения WebSocket:', error);
      this.cleanup();
      
      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    }
  }

  disconnect() {
    console.log('Ручное отключение WebSocket');
    this.isManualDisconnect = true;
    this.cleanup();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Отправка сообщения в формате, который ожидает сервер
  sendMessage(message: OutgoingMessage) {
    if (this.isConnected()) {
      try {
        // Важно: отправляем просто JSON объект OutgoingMessage, без обертки type/data!
        console.log('Отправляем сообщение на сервер:', message);
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
      }
    } else {
      console.warn('WebSocket не подключен, невозможно отправить сообщение');
    }
  }

  // Вспомогательный метод для отправки текстового сообщения
  sendTextMessage(chatId: string, content: string, replyTo?: string) {
    const message: OutgoingMessage = {
      chat_id: chatId,
      content: content,
      message_type: 'text',
      ...(replyTo && { reply_to: replyTo })
    };
    this.sendMessage(message);
  }

  onMessage(type: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  // Специальные методы для типов сообщений
  onChatMessage(handler: (message: IncomingMessage) => void) {
    this.onMessage('message', handler);
  }

  onNotification(handler: (notification: any) => void) {
    this.onMessage('notification', handler);
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

  private handleMessage(message: WebSocketIncomingWrapper) {
    console.log('Обрабатываем WebSocket сообщение типа:', message.type);
    
    // Обработка ping/pong
    if (message.type === 'ping') {
      this.sendPong();
      return;
    }
    
    if (message.type === 'pong') {
      // Pong получен, соединение активно
      return;
    }

    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.data));
    }
  }

  private sendPong() {
    if (this.isConnected()) {
      try {
        // Отправляем pong в формате, который ожидает сервер
        this.ws!.send(JSON.stringify({ type: 'pong', data: {} }));
      } catch (error) {
        console.error('Ошибка отправки pong:', error);
      }
    }
  }

  private notifyConnection(connected: boolean) {
    console.log('Состояние WebSocket соединения:', connected ? 'подключено' : 'отключено');
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  private startPingInterval() {
    // Очищаем предыдущий интервал
    this.stopPingInterval();
    
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected()) {
        console.log('Отправляем ping');
        try {
          // Отправляем ping в формате, который ожидает сервер
          this.ws!.send(JSON.stringify({ type: 'ping', data: {} }));
        } catch (error) {
          console.error('Ошибка отправки ping:', error);
        }
      }
    }, 30000);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanup() {
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      
      this.ws = null;
    }
  }

  private attemptReconnect() {
    if (this.isManualDisconnect) {
      console.log('Ручное отключение, пропускаем реконнект');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Достигнуто максимальное количество попыток реконнекта');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // Максимальная задержка 30 секунд
    );
    
    console.log(`Попытка реконнекта через ${delay}мс (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      if (!this.isConnected() && !this.isManualDisconnect) {
        this.connect();
      }
    }, delay);
  }
}

// Создаем глобальный экземпляр WebSocket сервиса
const WS_URL = 'ws://localhost:8080/api/v1/ws';
export const websocketService = new WebSocketService(WS_URL);