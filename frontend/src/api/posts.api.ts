import axios from 'axios';
import { ListPostsResponse } from '../types';

const API_BASE_URL = 'http://localhost:8080/api/v1';

export const postsApi = {
  // Получить курсы (посты) с фильтрацией
  getPosts: async (params?: {
    author_id?: string;
    status?: string;
    tags?: string[];
    search?: string;
    page_size?: number;
    page_token?: string;
  }, token?: string): Promise<ListPostsResponse> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.get(`${API_BASE_URL}/posts`, {
      headers,
      params: {
        ...params,
        tags: params?.tags?.join(','),
      },
    });
    return response.data;
  },

  // Получить курсы, которые ведет пользователь (ментор)
  getMentorCourses: async (userId: string, token?: string): Promise<ListPostsResponse> => {
    return postsApi.getPosts({ author_id: userId, status: 'published' }, token);
  },

  // Получить курсы, к которым присоединился пользователь (студент)
  // Note: В будущем нужно будет через sessions или другую логику
  getStudentCourses: async (userId: string, token?: string): Promise<ListPostsResponse> => {
    // Временная реализация - пока возвращаем пустой массив
    // TODO: Реализовать через sessions API
    return { posts: [], total_count: 0 };
  },
};