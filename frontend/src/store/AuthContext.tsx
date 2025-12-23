// store/authcontext.tsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react'
import { websocketService } from '../services/websocket';

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Инициализируем из sessionStorage
  const [token, setTokenState] = useState<string | null>(() => {
    return sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  });
  
  const [user, setUserState] = useState<User | null>(() => {
    const savedUser = sessionStorage.getItem('user_data') || localStorage.getItem('user_data');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // При монтировании проверяем валидность токена
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔐 AuthContext: Инициализация из sessionStorage');
      if (token) {
        // Можно добавить проверку валидности токена через API
        // Например, сделать запрос к защищенному эндпоинту
        console.log('🔐 Токен найден в sessionStorage');
      }
      setIsLoading(false);
      console.log('🔐 AuthContext: Инициализация завершена', {
        hasToken: !!token,
        hasUser: !!user,
        userEmail: user?.email
      });
    };
    
    initializeAuth();
  }, []);

  // Кастомный setToken с сохранением в sessionStorage
  const setToken = useCallback((newToken: string | null) => {
    console.log('🔐 setToken:', newToken ? 'Установлен' : 'Очищен');
    
    if (newToken) {
      sessionStorage.setItem('access_token', newToken);
      localStorage.setItem('access_token', newToken);
    } else {
      sessionStorage.removeItem('access_token');
      localStorage.removeItem('access_token');
    }
    
    setTokenState(newToken);
  }, []);

  // Кастомный setUser с сохранением в sessionStorage
  const setUser = useCallback((newUser: User | null) => {
    console.log('🔐 setUser:', newUser ? newUser.email : 'Очищен');
    
    if (newUser) {
      sessionStorage.setItem('user_data', JSON.stringify(newUser));
      localStorage.setItem('user_data', JSON.stringify(newUser));
    } else {
      sessionStorage.removeItem('user_data');
      localStorage.removeItem('user_data');
    }
    
    setUserState(newUser);
  }, []);

  // Метод login который сохраняет все
  const login = useCallback((newToken: string, newUser: User) => {
    console.log('🔐 login:', newUser.email);
    
    // Сохраняем в sessionStorage
    sessionStorage.setItem('access_token', newToken);
    localStorage.setItem('access_token', newToken);
    sessionStorage.setItem('user_data', JSON.stringify(newUser));
    localStorage.setItem('user_data', JSON.stringify(newUser));
    
    // Обновляем состояние
    setTokenState(newToken);
    setUserState(newUser);

    websocketService.setToken(newToken);
    websocketService.connect();
    
    console.log('🔐 Данные сохранены в sessionStorage');
  }, []);

  // Метод logout с очисткой
  const logout = useCallback(async () => {
    console.log('🔐 logout: Начало');
    
    try {
      // Если есть токен, отправляем запрос на сервер для logout
      if (token) {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (refreshToken) {
          await fetch("http://localhost:8080/api/v1/auth/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }).catch(err => {
            console.warn('🔐 Ошибка при logout на сервере:', err);
            // Продолжаем даже если запрос не удался
          });
        }
      }
    } catch (error) {
      console.error('🔐 Ошибка при logout:', error);
    } finally {
      // Всегда очищаем клиентские данные
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user_data');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      
      setTokenState(null);
      setUserState(null);
      websocketService.disconnect();
      
      console.log('🔐 logout: Данные очищены');
      
      // Редирект на главную
      window.location.href = '/';
    }
  }, [token]);

  // Метод для обновления токена
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        console.log('🔐 Нет refresh токена');
        logout();
        return null;
      }

      console.log('🔐 Обновление токена...');
      
      const response = await fetch('http://localhost:8080/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔐 Токен успешно обновлен');
        
        // Сохраняем новый токен
        localStorage.setItem('access_token', data.access_token);
        sessionStorage.setItem('access_token', data.access_token);
        
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        
        setToken(data.access_token);
        return data.access_token;
      } else {
        console.log('🔐 Ошибка при обновлении токена:', response.status);
        logout();
        return null;
      }
      
    } catch (err) {
      console.error('🔐 Ошибка обновления токена:', err);
      logout();
      return null;
    }
  }, [token, logout, setToken]);

  const value: AuthContextType = {
    token,
    user,
    isLoading,
    setToken,
    setUser,
    login,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};