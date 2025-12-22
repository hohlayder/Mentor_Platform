import axios from 'axios';
import { ProfileResponse } from '../types';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export const profileApi = {
  // Получить профиль по ID
  getProfile: async (id: string, token?: string): Promise<ProfileResponse> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.get(`${API_BASE_URL}/profiles/${id}`, { headers });
    return response.data;
  },

  // Обновить профиль
  updateProfile: async (id: string, data: any, token: string): Promise<void> => {
    const response = await axios.put(
      `${API_BASE_URL}/profiles/${id}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },
};