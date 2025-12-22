// src/pages/ChatsPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authcontext';
import { websocketService } from '../services/websocket';
import { fetchWithAuth } from '../utils/api';

// Типы на основе Swagger документации
interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  url: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  created_at: string;
}

type MessageType = 'text' | 'image' | 'file' | 'voice';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  updated_at?: string;
  is_read: boolean;
  read_at?: string;
  is_edited?: boolean;
  deleted_at?: string;
  message_type: MessageType;
  reply_to?: string;
  attachments?: Attachment[];
}

interface ChatResponse {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
  last_message?: Message;
}

interface ChatWithUser extends ChatResponse {
  otherUser: User;
  otherUserId: string;
}

interface GetUserChatsResponse {
  chats: ChatResponse[];
}

interface UserResponse {
  user: User;
}

interface CreateChatRequest {
  other_user_id: string;
}

interface CreateChatResponse {
  chat_id: string;
}

interface WebSocketMessageData {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  message_type: string;
  is_edited: boolean;
  attachments?: Attachment[];
  chat?: ChatResponse;
}

interface SearchUsersResponse {
  users: User[];
}

const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, logout } = useAuth();
  
  const [chats, setChats] = useState<ChatWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [newChatUser, setNewChatUser] = useState<User | null>(null);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  
  const emailInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Загрузка чатов при монтировании
  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }

    loadChats();

    // Настраиваем WebSocket
    websocketService.setToken(token);
    websocketService.connect();
    websocketService.onConnectionChange(setWsConnected);

    // Подписываемся на новые сообщения через WebSocket
    const handleNewMessage = (data: WebSocketMessageData) => {
      console.log('Новое сообщение через WS:', data);
      
      // Обновляем список чатов при новом сообщении
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(chat => chat.id === data.chat_id);
        
        if (chatIndex === -1) {
          // Если это новый чат, возможно он есть в данных чата
          if (data.chat) {
            // Добавляем новый чат в список
            const otherUserId = data.chat.user1_id === user.user_id 
              ? data.chat.user2_id 
              : data.chat.user1_id;
            
            // Нужно загрузить информацию о пользователе
            loadUserInfo(otherUserId).then(otherUser => {
              if (otherUser) {
                const newChatWithUser: ChatWithUser = {
                  ...data.chat,
                  otherUser,
                  otherUserId
                };
                setChats(prev => [newChatWithUser, ...prev]);
              }
            });
          } else {
            // Перезагружаем чаты если это новый чат
            loadChats();
          }
          return prevChats;
        }

        const updatedChats = [...prevChats];
        const chat = updatedChats[chatIndex];
        
        // Обновляем последнее сообщение
        const newMessage: Message = {
          id: data.id,
          content: data.content,
          sender_id: data.sender_id,
          chat_id: data.chat_id,
          created_at: data.created_at,
          is_read: data.sender_id === user.user_id,
          message_type: data.message_type as MessageType,
          attachments: data.attachments,
          is_edited: data.is_edited
        };

        // Обновляем unread_count если сообщение не от нас
        const unreadCount = data.sender_id === user.user_id 
          ? chat.unread_count 
          : chat.unread_count + 1;

        updatedChats[chatIndex] = {
          ...chat,
          last_message: newMessage,
          unread_count: unreadCount,
          updated_at: new Date().toISOString()
        };

        // Сортируем по дате обновления (новые сверху)
        return updatedChats.sort((a, b) => {
          const dateA = new Date(a.updated_at).getTime();
          const dateB = new Date(b.updated_at).getTime();
          return dateB - dateA;
        });
      });
    };

    // Подписываемся на уведомления о прочтении
    const handleMessagesRead = (data: { chat_id: string; message_ids: string[] }) => {
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(chat => chat.id === data.chat_id);
        if (chatIndex === -1) return prevChats;

        const updatedChats = [...prevChats];
        const chat = updatedChats[chatIndex];
        
        // Если это текущий пользователь прочитал сообщения, сбрасываем счетчик
        if (chat.last_message && !chat.last_message.is_read && 
            chat.last_message.sender_id !== user?.user_id) {
          updatedChats[chatIndex] = {
            ...chat,
            unread_count: Math.max(0, chat.unread_count - data.message_ids.length),
            last_message: {
              ...chat.last_message,
              is_read: true
            }
          };
        }
        
        return updatedChats;
      });
    };

    websocketService.onMessage('message', handleNewMessage);
    websocketService.onMessage('messages_read', handleMessagesRead);

    // Обновляем чаты каждые 30 секунд на случай проблем с WebSocket
    const interval = setInterval(loadChats, 30000);

    // Отписка при размонтировании
    return () => {
      clearInterval(interval);
      websocketService.offMessage('message', handleNewMessage);
      websocketService.offMessage('messages_read', handleMessagesRead);
      websocketService.offConnectionChange(setWsConnected);
    };
  }, [token, user, navigate]);

  // Загрузка информации о пользователе
  const loadUserInfo = async (userId: string): Promise<User | null> => {
    try {
      const response = await fetchWithAuth(`/users/${userId}`);
      if (response.ok) {
        const data: UserResponse = await response.json();
        return data.user;
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
    }
    return null;
  };

  // Функция загрузки чатов
  const loadChats = async () => {
    if (!token || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Загружаем список чатов
      const response = await fetchWithAuth('/chats?limit=50');
      
      if (!response.ok) {
        throw new Error(`Не удалось загрузить чаты: ${response.status}`);
      }

      const data: GetUserChatsResponse = await response.json();
      
      // Для каждого чата загружаем информацию о втором пользователе
      const chatsWithUsers: ChatWithUser[] = [];
      
      for (const chat of data.chats) {
        const otherUserId = chat.user1_id === user.user_id ? chat.user2_id : chat.user1_id;
        
        const otherUser = await loadUserInfo(otherUserId);
        if (otherUser) {
          chatsWithUsers.push({
            ...chat,
            otherUser,
            otherUserId
          });
        }
      }

      // Сортируем по дате последнего сообщения (новые сверху)
      const sortedChats = chatsWithUsers.sort((a, b) => {
        const dateA = a.last_message?.created_at 
          ? new Date(a.last_message.created_at).getTime() 
          : new Date(a.created_at).getTime();
        const dateB = b.last_message?.created_at 
          ? new Date(b.last_message.created_at).getTime() 
          : new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setChats(sortedChats);

    } catch (err: any) {
      console.error('Ошибка загрузки чатов:', err);
      setError(err.message || 'Ошибка загрузки чатов');
    } finally {
      setLoading(false);
    }
  };

  // Поиск пользователей по email или имени
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !token) {
      setSearchResults([]);
      return;
    }

    setLoadingUsers(true);
    try {
      // Попробуем найти пользователя по email
      const response = await fetchWithAuth(`/users/email/${query}`);
      
      if (response.ok) {
        const userData: User = await response.json();
        setSearchResults([userData]);
      } else {
        // Если не найден по email, ищем через API поиска (если есть)
        // В вашем API нет эндпоинта поиска, поэтому пока просто очищаем
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
      setSearchResults([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  // Обработчик изменения поискового запроса
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchUsers(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchUsers]);

  // Выбор пользователя для нового чата
  const selectUserForChat = (selectedUser: User) => {
    setNewChatEmail(selectedUser.email);
    setNewChatUser(selectedUser);
    setSearchQuery('');
    setSearchResults([]);
    setShowUserSearch(false);
    
    // Фокусируемся на поле ввода
    setTimeout(() => {
      if (emailInputRef.current) {
        emailInputRef.current.focus();
      }
    }, 100);
  };

  // Создание нового чата
  const createNewChat = async () => {
    if (!newChatUser || !token) return;

    setCreatingChat(true);
    setError(null);

    try {
      // Проверяем, нет ли уже чата с этим пользователем
      const existingChat = chats.find(chat => 
        chat.otherUserId === newChatUser.user_id
      );

      if (existingChat) {
        // Переходим в существующий чат
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Создаем чат
      const response = await fetchWithAuth('/chats', {
        method: 'POST',
        body: JSON.stringify({
          other_user_id: newChatUser.user_id
        } as CreateChatRequest)
      });

      if (!response.ok) {
        throw new Error('Не удалось создать чат');
      }

      const data: CreateChatResponse = await response.json();
      
      // Перенаправляем в новый чат
      navigate(`/chat/${data.chat_id}`);

    } catch (err: any) {
      setError(err.message || 'Ошибка создания чата');
    } finally {
      setCreatingChat(false);
      setNewChatEmail('');
      setNewChatUser(null);
    }
  };

  // Форматирование времени
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'только что';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} мин`;
    } else if (diffHours < 24) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Вчера';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  // Форматирование текста сообщения для предпросмотра
  const formatMessagePreview = (message?: Message) => {
    if (!message) return 'Нет сообщений';
    
    let preview = '';
    
    switch (message.message_type) {
      case 'text':
        preview = message.content.length > 40
          ? `${message.content.substring(0, 40)}...`
          : message.content;
        break;
      case 'image':
        preview = '📷 Фото';
        break;
      case 'file':
        preview = '📎 Файл';
        break;
      case 'voice':
        preview = '🎤 Голосовое сообщение';
        break;
      default:
        preview = 'Сообщение';
    }
    
    return message.sender_id === user?.user_id ? `Вы: ${preview}` : preview;
  };

  // Фильтрация чатов по поиску
  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const userName = `${chat.otherUser.first_name} ${chat.otherUser.last_name}`.toLowerCase();
    const userEmail = chat.otherUser.email.toLowerCase();
    
    return userName.includes(searchLower) || 
           userEmail.includes(searchLower);
  });

  // Подсчет непрочитанных сообщений
  const totalUnreadCount = chats.reduce((total, chat) => total + chat.unread_count, 0);

  // Выход из системы
  const handleLogout = async () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      await logout();
    }
  };

  if (loading && chats.length === 0) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite'
          }}>
            <span>💬</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Загрузка чатов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="chat-layout">
        {/* Боковая панель со списком чатов */}
        <div className="chat-list">
          {/* Заголовок и поиск */}
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid var(--glass)',
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>💬 Чаты</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%',
                  background: wsConnected ? 'var(--accent)' : 'var(--muted)',
                  animation: wsConnected ? 'pulse 2s infinite' : 'none'
                }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {wsConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            
            {/* Поиск чатов */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Поиск чатов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Создание нового чата */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                marginBottom: '8px'
              }}>
                <input
                  ref={emailInputRef}
                  type="email"
                  placeholder="Email пользователя..."
                  value={newChatEmail}
                  onChange={(e) => setNewChatEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createNewChat()}
                  style={{ 
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass)',
                    background: 'transparent',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={createNewChat}
                  disabled={creatingChat || !newChatUser}
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                >
                  {creatingChat ? '...' : '+'}
                </button>
              </div>
              
              {/* Поиск пользователей */}
              {showUserSearch && (
                <div style={{ 
                  position: 'relative',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--glass)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {loadingUsers ? (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--muted)' }}>
                        Поиск...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(resultUser => (
                        <div
                          key={resultUser.user_id}
                          onClick={() => selectUserForChat(resultUser)}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--glass)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--glass)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: resultUser.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                            display: 'grid',
                            placeContent: 'center',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}>
                            {resultUser.avatar_url ? (
                              <img 
                                src={resultUser.avatar_url} 
                                alt={resultUser.first_name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span>{resultUser.first_name?.[0]}{resultUser.last_name?.[0]}</span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '14px' }}>
                              {resultUser.first_name} {resultUser.last_name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              {resultUser.email}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : searchQuery.trim() && (
                      <div style={{ padding: '12px', color: 'var(--muted)' }}>
                        Пользователь не найден
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {newChatUser 
                    ? `Выбран: ${newChatUser.first_name} ${newChatUser.last_name}`
                    : 'Введите email пользователя'}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowUserSearch(!showUserSearch)}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  {showUserSearch ? 'Скрыть поиск' : 'Найти пользователя'}
                </button>
              </div>
            </div>
          </div>

          {/* Список чатов */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {error && (
              <div style={{ 
                padding: '12px', 
                margin: '16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '14px'
              }}>
                {error}
                <button 
                  onClick={loadChats}
                  style={{ 
                    marginTop: '8px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                >
                  Повторить
                </button>
              </div>
            )}

            {/* Статистика */}
            {chats.length > 0 && (
              <div style={{ 
                padding: '12px 16px', 
                borderBottom: '1px solid var(--glass)',
                fontSize: '13px',
                color: 'var(--muted)',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Чаты: {chats.length}</span>
                {totalUnreadCount > 0 && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {totalUnreadCount} непрочитано
                  </span>
                )}
              </div>
            )}

            {loading && chats.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: 'var(--muted)'
              }}>
                Загрузка чатов...
              </div>
            ) : filteredChats.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: 'var(--muted)'
              }}>
                {searchQuery ? 'Чаты не найдены' : 'Нет активных чатов'}
                <div style={{ marginTop: '16px' }}>
                  <button 
                    className="btn btn-outline"
                    onClick={() => setShowUserSearch(true)}
                  >
                    Начать новый диалог
                  </button>
                </div>
              </div>
            ) : (
              filteredChats.map(chat => {
                const isActive = location.pathname.includes(`/chat/${chat.id}`);
                const chatStyle = {
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--glass)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isActive ? 'var(--accent-lightest)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  position: 'relative' as const
                };

                return (
                  <Link
                    key={chat.id}
                    to={`/chat/${chat.id}`}
                    style={{ 
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block'
                    }}
                  >
                    <div
                      style={chatStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--glass)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isActive ? 'var(--accent-lightest)' : 'transparent';
                      }}
                    >
                      {/* Аватар */}
                      <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: chat.otherUser.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                        display: 'grid',
                        placeContent: 'center',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}>
                        {chat.otherUser.avatar_url ? (
                          <img 
                            src={chat.otherUser.avatar_url} 
                            alt={chat.otherUser.first_name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span>{chat.otherUser.first_name?.[0]}{chat.otherUser.last_name?.[0]}</span>
                        )}
                      </div>

                      {/* Информация о чате */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          marginBottom: '4px'
                        }}>
                          <strong style={{ 
                            fontSize: '15px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {chat.otherUser.first_name} {chat.otherUser.last_name}
                          </strong>
                          <span style={{ 
                            fontSize: '11px', 
                            color: 'var(--muted)',
                            flexShrink: 0,
                            marginLeft: '8px'
                          }}>
                            {formatTime(chat.last_message?.created_at || chat.updated_at)}
                          </span>
                        </div>

                        {/* Последнее сообщение */}
                        <div style={{ 
                          fontSize: '13px',
                          color: chat.unread_count > 0 ? 'var(--text)' : 'var(--muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: chat.unread_count > 0 ? 500 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {chat.last_message ? formatMessagePreview(chat.last_message) : 'Нет сообщений'}
                        </div>
                      </div>

                      {/* Индикатор непрочитанных */}
                      {chat.unread_count > 0 && (
                        <div style={{
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontSize: '11px',
                          display: 'grid',
                          placeContent: 'center',
                          fontWeight: 600,
                          padding: '0 6px',
                          flexShrink: 0
                        }}>
                          {chat.unread_count > 9 ? '9+' : chat.unread_count}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Информация о текущем пользователе */}
          {user && (
            <div style={{ 
              padding: '16px',
              borderTop: '1px solid var(--glass)',
              background: 'var(--surface)',
              position: 'sticky',
              bottom: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: user.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'grid',
                  placeContent: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.first_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span>{user.first_name?.[0]}{user.last_name?.[0]}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '14px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: 'var(--muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {user.email}
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate(`/profile/${user.user_id}`)}
                  style={{ padding: '4px' }}
                  title="Профиль"
                >
                  👤
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={handleLogout}
                  style={{ padding: '4px' }}
                  title="Выйти"
                >
                  🚪
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Основное окно чата */}
        <div className="chat-window" style={{ 
          display: 'flex', 
          flexDirection: 'column',
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-secondary) 100%)'
        }}>
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--muted)'
          }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%',
              background: 'var(--glass)',
              display: 'grid',
              placeContent: 'center',
              margin: '0 auto 20px',
              fontSize: '32px'
            }}>
              {wsConnected ? '💬' : '📴'}
            </div>
            <h3 style={{ margin: '0 0 12px 0', color: 'var(--text)' }}>
              {wsConnected ? 'Добро пожаловать в чаты!' : 'Соединение...'}
            </h3>
            <p style={{ margin: '0 0 20px 0', maxWidth: '400px' }}>
              {wsConnected 
                ? 'Выберите чат из списка слева или начните новый диалог'
                : 'Пытаемся подключиться к серверу...'}
            </p>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline"
                onClick={() => setShowUserSearch(true)}
                disabled={!wsConnected}
              >
                Новый чат
              </button>
              <button 
                className="btn btn-ghost"
                onClick={loadChats}
              >
                Обновить список
              </button>
              {!wsConnected && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    websocketService.setToken(token!);
                    websocketService.connect();
                  }}
                >
                  Переподключиться
                </button>
              )}
            </div>

            {/* Статистика */}
            {chats.length > 0 && (
              <div style={{ 
                marginTop: '32px',
                padding: '16px',
                background: 'var(--glass)',
                borderRadius: '12px',
                maxWidth: '400px',
                textAlign: 'left'
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text)' }}>
                  📊 Ваша статистика
                </h4>
                <div style={{ 
                  fontSize: '13px',
                  color: 'var(--muted)',
                  lineHeight: '1.6'
                }}>
                  <div>Активных чатов: <strong>{chats.length}</strong></div>
                  <div>Непрочитанных сообщений: <strong>{totalUnreadCount}</strong></div>
                  <div>Последняя активность: <strong>{chats[0]?.last_message ? formatTime(chats[0].last_message.created_at) : 'Нет'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .chat-layout {
          display: grid;
          grid-template-columns: 380px 1fr;
          height: calc(100vh - 80px);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        
        .chat-list {
          background: var(--surface);
          border-right: 1px solid var(--glass);
          display: flex;
          flex-direction: column;
        }
        
        .chat-window {
          background: var(--surface-secondary);
        }
        
        @media (max-width: 768px) {
          .chat-layout {
            grid-template-columns: 1fr;
          }
          .chat-list {
            display: ${location.pathname.includes('/chat/') ? 'none' : 'flex'};
          }
          .chat-window {
            display: ${!location.pathname.includes('/chat/') ? 'none' : 'flex'};
          }
        }
      `}</style>
    </div>
  );
};

export default ChatsPage;