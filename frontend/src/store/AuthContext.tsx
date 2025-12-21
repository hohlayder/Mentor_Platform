// store/authcontext.tsx
import React, { createContext, useState, useContext } from 'react'

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

interface AuthContextType {
  // Состояние
  token: string | null;
  user: User | null;
  // Методы для обновления состояния
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  // Удобный метод для обновления всего сразу
  login: (token: string, user: User) => void;
  logout: () => void;
}

// Создаем контекст с пустыми значениями
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Хук для использования контекста
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Провайдер
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // СОСТОЯНИЕ - только React state, без sessionStorage
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  console.log('🔐 AuthContext render:', { 
    token: token ? 'Есть' : 'Нет', 
    user: user ? user.email : 'Нет' 
  })

  // Методы для обновления состояния
  const login = (newToken: string, newUser: User) => {
    console.log('🔐 login() called:', newUser.email)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    console.log('🔐 logout() called')
    setToken(null)
    setUser(null)
  }

  // Значение контекста
  const value: AuthContextType = {
    token,
    user,
    setToken,
    setUser,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}