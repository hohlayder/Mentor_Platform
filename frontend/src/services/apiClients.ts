// src/services/apiClient.ts
import { useAuth } from '../store/AuthContext';

// Базовые типы для запросов
interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseURL: string = 'http://localhost:8080/api/v1';

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const token = localStorage.getItem('access_token');
    
    // Создаем копию заголовков
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });
    
    // Обработка ошибок авторизации
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          // Пытаемся обновить токен
          const refreshResponse = await fetch(`${this.baseURL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            localStorage.setItem('access_token', data.access_token);
            
            // Повторяем оригинальный запрос с новым токеном
            headers['Authorization'] = `Bearer ${data.access_token}`;
            const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
              ...options,
              headers,
            });
            
            return await retryResponse.json();
          }
        } catch (error) {
          console.error('Ошибка обновления токена:', error);
          // Если не удалось обновить токен, редиректим на логин
          window.location.href = '/login';
          throw error;
        }
      }
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  }

  // Методы для работы с чатами
  async getChats(limit: number = 20, offset: number = 0): Promise<any> {
    return this.request(`/chats?limit=${limit}&offset=${offset}`);
  }

  async createChat(otherUserId: string): Promise<any> {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify({ other_user_id: otherUserId })
    });
  }

  async getChatMessages(chatId: string, limit: number = 50, cursor?: string): Promise<any> {
    let url = `/chats/messages?chat_id=${chatId}&limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    return this.request(url);
  }

  async markMessagesAsRead(chatId: string, messageIds: string[]): Promise<any> {
    return this.request('/chats/messages/read', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, message_ids: messageIds })
    });
  }

  async getChatById(chatId: string): Promise<any> {
    return this.request(`/chats/${chatId}`);
  }

  // Методы для работы с пользователями
  async getUserById(userId: string): Promise<any> {
    return this.request(`/users/${userId}`);
  }

  async getUserByEmail(email: string): Promise<any> {
    return this.request(`/users/email/${encodeURIComponent(email)}`);
  }

  // Методы для работы с курсами
  async getCourse(courseId: string): Promise<any> {
    return this.request(`/posts/${courseId}`);
  }

  async rateCourse(courseId: string, rating: number, userId: string, comment?: string): Promise<any> {
    return this.request(`/posts/${courseId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ 
        rate: rating, 
        user_id: userId, 
        comment 
      })
    });
  }

  // Методы для работы с сессиями
  async createSession(slotId: string, studentId: string, paymentStatus?: string): Promise<any> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        slot_id: slotId,
        student_id: studentId,
        payment_status: paymentStatus
      })
    });
  }

  // Методы для работы со слотами
  async createSlot(slotData: any): Promise<any> {
    return this.request('/slots', {
      method: 'POST',
      body: JSON.stringify(slotData)
    });
  }

  async updateSlotStatus(slotId: string, status: string): Promise<any> {
    return this.request(`/slots/${slotId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }
}

export const apiClient = new ApiClient();