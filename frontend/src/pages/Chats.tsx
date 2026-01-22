// src/pages/Chats.tsx
import React, { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { useAuth } from '../store/AuthContext';
import { useWebSocket } from '../services/useWebSocket';
import { IncomingMessage } from '../services/websocket';
import { Link, useNavigate } from 'react-router-dom';
import Header from "../components/Header";

// Типы на основе ваших API и WebSocket документации
interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface Chat {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  last_message?: IncomingMessage;
  unread_count: number;
  other_user?: User;
}

interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
}

interface ChatMessagesResponse {
  messages: IncomingMessage[] | null;
  next_cursor?: {
    id: string;
    created_at: string;
  };
  has_more: boolean;
}

// Функция для управления темой
const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return savedTheme || 'light';
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};

// Функция для получения правильного URL аватара
const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
  if (!avatarUrl) return '';
  
  // Если URL уже полный (http или https)
  if (avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  
  // Если это имя файла
  if (avatarUrl && !avatarUrl.includes('/')) {
    return `http://localhost:8080/api/v1/files/avatar/${avatarUrl}`;
  }
  
  // Если это относительный путь
  if (avatarUrl.startsWith('/')) {
    return `http://localhost:8080${avatarUrl}`;
  }
  
  // Если это путь без префикса http
  if (avatarUrl.startsWith('files/avatar/')) {
    return `http://localhost:8080/api/v1/${avatarUrl}`;
  }
  
  return avatarUrl;
};

const Chats: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { 
    isConnected, 
    connect, 
    disconnect, 
    sendTextMessage, 
    onChatMessage 
  } = useWebSocket();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Состояния для создания чата по email
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Подключение WebSocket при наличии токена
  useEffect(() => {
    if (token) {
      connect(token);
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Обработка входящих сообщений через WebSocket
  useEffect(() => {
    const unsubscribe = onChatMessage((message: IncomingMessage) => {
      console.log('Получено сообщение через WebSocket:', message);
      
      // Проверяем, что это сообщение для текущего чата
      if (selectedChat?.id === message.chat_id) {
        // Добавляем новое сообщение в конец списка
        setMessages(prev => [...prev, message]);
        
        // Помечаем как прочитанное, если оно от другого пользователя
        if (message.sender_id !== user?.user_id) {
          markAsRead([message.id], message.chat_id);
        }
      }
      
      // Обновляем список чатов
      setChats(prev => prev.map(chat => {
        if (chat.id === message.chat_id) {
          return { 
            ...chat, 
            last_message: message,
            updated_at: new Date().toISOString(),
            unread_count: chat.id === selectedChat?.id ? chat.unread_count : chat.unread_count + 1
          };
        }
        return chat;
      }));
    });

    return unsubscribe;
  }, [selectedChat, user, onChatMessage]);

  // Загрузка списка чатов
  const loadChats = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('http://localhost:8080/api/v1/chats?limit=20&offset=0', {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // ВАЖНО: Защита от null/undefined
        const chatsData = Array.isArray(data.chats) ? data.chats : [];
        
        const chatsWithUsers = await Promise.all(
          chatsData.map(async (chat: Chat) => {
            // Определяем ID собеседника
            const otherUserId = chat.user1_id === user?.user_id ? chat.user2_id : chat.user1_id;
            
            // Загружаем данные пользователя
            try {
              const userResponse = await fetch(`http://localhost:8080/api/v1/users/${otherUserId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              
              if (userResponse.ok) {
                const userData = await userResponse.json();
                return { 
                  ...chat, 
                  other_user: {
                    ...userData,
                    avatar_url: getAvatarUrl(userData.avatar_url)
                  }
                };
              }
            } catch (error) {
              console.error('Ошибка загрузки пользователя:', error);
            }
            
            return chat;
          })
        );
        
        setChats(chatsWithUsers);
      } else {
        // При ошибке устанавливаем пустой массив
        setChats([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
      setChats([]);
    }
  }, [token, user]);

  // Загрузка сообщений чата (с пагинацией)
  const loadMessages = useCallback(async (chatId: string, cursor?: string | null, isLoadMore: boolean = false) => {
    if (!token) return;
    
    console.log('Загрузка сообщений:', { chatId, cursor: cursor || 'нет', isLoadMore });
    
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // Формируем URL запроса
      let url = `http://localhost:8080/api/v1/chats/messages?chat_id=${chatId}&limit=50`;
      
      if (cursor) {
        url += `&cursor=${cursor}`;
      }
      
      console.log('Запрос по URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: ChatMessagesResponse = await response.json();
      console.log('Получены данные:', { 
        сообщений: data.messages?.length || 0,
        естьЕще: data.has_more,
        курсор: data.next_cursor?.id || 'нет'
      });
      
      // ВАЖНО: Убеждаемся, что messages всегда массив
      const messagesArray = Array.isArray(data.messages) ? data.messages : [];
      
      setNextCursor(data.next_cursor?.id || null);
      setHasMore(data.has_more);
      
      // Добавляем сообщения
      if (isLoadMore) {
        setMessages(prev => [...messagesArray, ...prev]);
      } else {
        setMessages(messagesArray);
      }
      
      // Помечаем как прочитанные
      const unreadMessages = messagesArray
        .filter(msg => !msg.is_read && msg.sender_id !== user?.user_id);
      
      if (unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map(msg => msg.id);
        await markAsRead(unreadIds, chatId);
      }
      
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      // Всегда устанавливаем пустой массив при ошибке
      setMessages([]);
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [token, user]);

  // Подгрузка старых сообщений при прокрутке вверх
  const loadMoreMessages = useCallback(() => {
    if (!selectedChat || !hasMore || !nextCursor || isLoadingMore) {
      return;
    }
    
    console.log('Загружаем старые сообщения с курсором:', nextCursor);
    loadMessages(selectedChat.id, nextCursor, true);
  }, [selectedChat, hasMore, nextCursor, isLoadingMore, loadMessages]);

  // Обработчик прокрутки контейнера сообщений
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMore || !hasMore) {
      return;
    }
    
    // Если прокрутили близко к верху (первые 200px)
    if (container.scrollTop < 200) {
      loadMoreMessages();
    }
  }, [isLoadingMore, hasMore, loadMoreMessages]);

  // Добавляем обработчик прокрутки
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Поиск пользователя по email
  const searchUserByEmail = async (email: string) => {
    if (!token || !email.trim()) return;
    
    setIsSearchingUser(true);
    setCreateChatError(null);
    setFoundUser(null);
    
    try {
      const response = await fetch(`http://localhost:8080/api/v1/users/email/${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // Проверяем, что это не текущий пользователь
        if (userData.user_id === user?.user_id) {
          setCreateChatError('Нельзя создать чат с самим собой');
          return;
        }
        
        // Проверяем, не существует ли уже чат с этим пользователем
        const existingChat = chats.find(chat => 
          (chat.user1_id === userData.user_id && chat.user2_id === user?.user_id) ||
          (chat.user2_id === userData.user_id && chat.user1_id === user?.user_id)
        );
        
        if (existingChat) {
          setCreateChatError('Чат с этим пользователем уже существует');
          return;
        }
        
        setFoundUser({
          ...userData,
          avatar_url: getAvatarUrl(userData.avatar_url)
        });
      } else if (response.status === 404) {
        setCreateChatError('Пользователь с таким email не найден');
      } else {
        setCreateChatError('Ошибка при поиске пользователя');
      }
    } catch (error) {
      console.error('Ошибка поиска пользователя:', error);
      setCreateChatError('Ошибка соединения с сервером');
    } finally {
      setIsSearchingUser(false);
    }
  };

  // Создание нового чата с пользователем
  const createNewChat = async () => {
    if (!token || !foundUser) return;
    
    setCreateChatError(null);
    
    try {
      const response = await fetch('http://localhost:8080/api/v1/chats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          other_user_id: foundUser.user_id,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Добавляем новый чат в список
        const newChat: Chat = {
          id: data.chat_id,
          user1_id: user!.user_id,
          user2_id: foundUser.user_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unread_count: 0,
          other_user: foundUser,
        };
        
        setChats(prev => [newChat, ...prev]);
        setSelectedChat(newChat);
        setShowCreateChatModal(false);
        setNewChatEmail('');
        setFoundUser(null);
        
        // Загружаем сообщения для нового чата
        loadMessages(data.chat_id);
      } else {
        const errorData = await response.json();
        setCreateChatError(errorData.message || 'Ошибка создания чата');
      }
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      setCreateChatError('Ошибка соединения с сервером');
    }
  };

  // Пометить как прочитанное
  const markAsRead = async (messageIds: string[], chatId: string) => {
    if (!token || !Array.isArray(messageIds) || messageIds.length === 0) return;
    
    try {
      await fetch('http://localhost:8080/api/v1/chats/messages/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_ids: messageIds,
        }),
      });
      
      // Обновляем локальное состояние
      setMessages(prev => prev.map(msg =>
        messageIds.includes(msg.id) ? { ...msg, is_read: true, read_at: new Date().toISOString() } : msg
      ));
      
      setChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, unread_count: Math.max(0, chat.unread_count - messageIds.length) } : chat
      ));
    } catch (error) {
      console.error('Ошибка отметки сообщений:', error);
    }
  };

  // Отправка сообщения через WebSocket
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !isConnected || !user) return;
    
    // Создаем временное сообщение для немедленного отображения
    const tempMessage: IncomingMessage = {
      id: `temp-${Date.now()}`,
      chat_id: selectedChat.id,
      sender_id: user.user_id,
      content: newMessage,
      message_type: 'text',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_edited: false,
      is_read: true,
    };
    
    // Добавляем временное сообщение в список
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    
    // Прокручиваем к последнему сообщению
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    // Отправляем сообщение через WebSocket
    try {
      sendTextMessage(selectedChat.id, newMessage);
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      
      // Показываем ошибку пользователю
      setMessages(prev => prev.map(msg =>
        msg.id === tempMessage.id 
          ? { ...msg, content: `${msg.content} (не доставлено)` }
          : msg
      ));
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffHours < 168) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      }
    } catch (error) {
      return '';
    }
  };

  // Получение имени собеседника
  const getOtherUserName = (chat: Chat) => {
    if (!chat) return 'Unknown User';
    
    if (chat.other_user) {
      return `${chat.other_user.first_name || ''} ${chat.other_user.last_name || ''}`.trim() || 
             chat.other_user.email || 
             `User ${chat.user1_id === user?.user_id ? chat.user2_id?.substring(0, 8) || 'unknown' : chat.user1_id?.substring(0, 8) || 'unknown'}`;
    }
    return `User ${chat.user1_id === user?.user_id ? chat.user2_id?.substring(0, 8) || 'unknown' : chat.user1_id?.substring(0, 8) || 'unknown'}`;
  };

  // Получение инициалов собеседника
  const getOtherUserInitials = (chat: Chat) => {
    if (!chat) return 'U';
    
    if (chat.other_user) {
      return `${chat.other_user.first_name?.[0] || ''}${chat.other_user.last_name?.[0] || ''}` || 
             chat.other_user.email?.[0]?.toUpperCase() || 'U';
    }
    return 'U';
  };

  // Обработка нажатия Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Загрузка начальных данных
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await loadChats();
      setIsLoading(false);
    };
    
    initialize();
  }, [loadChats]);

  // Прокрутка к последнему сообщению при загрузке новых сообщений
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Сброс состояния при смене чата
  useEffect(() => {
    if (selectedChat) {
      console.log('Смена чата, сбрасываем состояние');
      setNextCursor(null);
      setHasMore(true);
      // Загружаем сообщения без курсора (первые 50)
      loadMessages(selectedChat.id);
    }
  }, [selectedChat?.id, loadMessages]);

  // Модальное окно создания чата
  const renderCreateChatModal = () => {
    if (!showCreateChatModal) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div className="card" style={{ 
          width: '90%',
          maxWidth: '400px',
          padding: 'var(--gap-lg)',
        }}>
          <h3 style={{ marginTop: 0 }}>Создать новый чат</h3>
          
          <div style={{ marginBottom: 'var(--gap-md)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--gap-sm)' }}>
              Email пользователя:
            </label>
            <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
              <input
                type="email"
                value={newChatEmail}
                onChange={(e) => {
                  setNewChatEmail(e.target.value);
                  setFoundUser(null);
                  setCreateChatError(null);
                }}
                placeholder="user@example.com"
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  backgroundColor: 'transparent',
                  color: 'var(--text)',
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => searchUserByEmail(newChatEmail)}
                disabled={!newChatEmail.trim() || isSearchingUser}
                style={{ flexShrink: 0 }}
              >
                {isSearchingUser ? 'Поиск...' : 'Найти'}
              </button>
            </div>
          </div>
          
          {foundUser && (
            <div className="card" style={{ 
              marginBottom: 'var(--gap-md)',
              padding: 'var(--gap-md)',
              backgroundColor: 'var(--accent-light)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: foundUser.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'grid',
                  placeContent: 'center',
                  flexShrink: 0
                }}>
                  {foundUser.avatar_url ? (
                    <img
                      src={foundUser.avatar_url}
                      alt={`${foundUser.first_name} ${foundUser.last_name}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const span = document.createElement('span');
                          span.style.fontSize = '16px';
                          span.style.color = '#fff';
                          span.style.fontWeight = '600';
                          span.textContent = foundUser.first_name?.[0] || 'U';
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '16px', color: '#fff', fontWeight: 600 }}>
                      {foundUser.first_name?.[0] || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {foundUser.first_name} {foundUser.last_name}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                    {foundUser.email}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {createChatError && (
            <div style={{
              padding: 'var(--gap-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              borderRadius: '8px',
              marginBottom: 'var(--gap-md)',
              fontSize: '14px',
            }}>
              {createChatError}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowCreateChatModal(false);
                setNewChatEmail('');
                setFoundUser(null);
                setCreateChatError(null);
              }}
            >
              Отмена
            </button>
            
            <button
              className="btn btn-primary"
              onClick={createNewChat}
              disabled={!foundUser}
            >
              Создать чат
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Стили для элементов чата с hover эффектом
  const chatItemStyle: CSSProperties = {
    marginBottom: '8px',
    cursor: 'pointer',
    padding: '12px',
    borderRadius: '12px',
    transition: 'all var(--transition)'
  };

  const getChatItemStyle = (chat: Chat): CSSProperties => {
    const isSelected = selectedChat?.id === chat.id;
    return {
      ...chatItemStyle,
      backgroundColor: isSelected ? 'var(--accent-light)' : '',
      border: isSelected ? '1px solid var(--accent)' : '',
    };
  };

  const chatItemHoverStyle: CSSProperties = {
    backgroundColor: 'var(--accent-light)'
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <Header theme={theme} toggleTheme={toggleTheme} />

        <nav style={{ marginBottom: '24px', marginTop: '20px' }}>
          <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--accent)' }}>Чаты</span>
        </nav>

        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid var(--glass)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            margin: '0 auto 20px',
            animation: 'spin 1s linear infinite'
          }} />
          <h3 style={{ marginBottom: '12px' }}>Загружаем чаты...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
      {/* Header */}
      <Header theme={theme} toggleTheme={toggleTheme} />

      {/* Хлебные крошки */}
      <nav style={{ marginBottom: '24px', marginTop: '20px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>Чаты</span>
      </nav>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--gap-lg)',
        padding: '16px 20px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Сообщения</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateChatModal(true)}
          style={{ 
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          + Новый чат
        </button>
      </div>
      
      <div className="chat-layout" style={{ 
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
        gap: '24px',
        marginTop: '16px'
      }}>
        {/* Список чатов */}
        <div className="chat-list" style={{ 
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--glass)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Заголовок списка чатов */}
          <div style={{ 
            padding: '16px',
            borderBottom: '1px solid var(--glass)',
            background: 'var(--accent-lightest)'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
              Мои чаты ({chats.length})
            </div>
            <input 
              type="text" 
              placeholder="Поиск чатов или пользователей..." 
              style={{ 
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--glass)',
                backgroundColor: 'transparent',
                color: 'var(--text)',
                fontSize: '14px'
              }}
            />
          </div>
          
          {/* Контейнер чатов */}
          <div style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: '8px'
          }}>
            {!chats || chats.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px', 
                color: 'var(--muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ fontSize: '48px' }}>💬</div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>У вас пока нет чатов</div>
                <div style={{ fontSize: '14px', maxWidth: '300px', lineHeight: '1.5' }}>
                  Начните общение, создав новый чат
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateChatModal(true)}
                  style={{ marginTop: '8px', padding: '10px 20px' }}
                >
                  Создать первый чат
                </button>
              </div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.id}
                  className={`card ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                  style={getChatItemStyle(chat)}
                  onClick={() => {
                    setSelectedChat(chat);
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget;
                    if (selectedChat?.id !== chat.id) {
                      target.style.backgroundColor = 'var(--accent-light)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget;
                    if (selectedChat?.id !== chat.id) {
                      target.style.backgroundColor = '';
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Аватар */}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: chat.other_user?.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                      display: 'grid',
                      placeContent: 'center',
                      flexShrink: 0
                    }}>
                      {chat.other_user?.avatar_url ? (
                        <img
                          src={chat.other_user.avatar_url}
                          alt={getOtherUserName(chat)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const span = document.createElement('span');
                              span.style.fontSize = '18px';
                              span.style.color = '#fff';
                              span.style.fontWeight = '600';
                              span.textContent = getOtherUserInitials(chat);
                              parent.appendChild(span);
                            }
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '18px', color: '#fff', fontWeight: 600 }}>
                          {getOtherUserInitials(chat)}
                        </span>
                      )}
                    </div>
                    
                    {/* Информация о чате */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontWeight: 600, 
                            fontSize: '14px',
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            marginBottom: '4px'
                          }}>
                            {getOtherUserName(chat)}
                          </div>
                          <div style={{ 
                            fontSize: '13px', 
                            color: 'var(--muted)', 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            lineHeight: '1.4'
                          }}>
                            {chat.last_message?.content || 'Начните общение'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '60px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {chat.last_message ? formatDate(chat.last_message.created_at) : ''}
                          </div>
                          {(chat.unread_count || 0) > 0 && (
                            <div style={{
                              backgroundColor: 'var(--accent)',
                              color: 'white',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: '600',
                              marginTop: '4px',
                              marginLeft: 'auto'
                            }}>
                              {chat.unread_count}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Окно чата */}
        <div className="chat-window" style={{ 
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--glass)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {selectedChat ? (
            <>
              {/* Заголовок чата */}
              <div style={{ 
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--accent-lightest)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: selectedChat.other_user?.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                    display: 'grid',
                    placeContent: 'center',
                    flexShrink: 0
                  }}>
                    {selectedChat.other_user?.avatar_url ? (
                      <img
                        src={selectedChat.other_user.avatar_url}
                        alt={getOtherUserName(selectedChat)}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const span = document.createElement('span');
                            span.style.fontSize = '18px';
                            span.style.color = '#fff';
                            span.style.fontWeight = '600';
                            span.textContent = getOtherUserInitials(selectedChat);
                            parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '18px', color: '#fff', fontWeight: 600 }}>
                        {getOtherUserInitials(selectedChat)}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{getOtherUserName(selectedChat)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* кнопки на верхней панели чата*/}
                </div>
              </div>
              
              {/* Контейнер сообщений */}
              <div 
                ref={messagesContainerRef}
                style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  maxHeight: 'calc(100vh - 300px)'
                }}
              >
                {/* Кнопка для загрузки старых сообщений */}
                {hasMore && !isLoadingMore && nextCursor && (
                  <div style={{ 
                    textAlign: 'center', 
                    marginBottom: '16px'
                  }}>
                    <button
                      className="btn btn-outline"
                      onClick={loadMoreMessages}
                      style={{ 
                        fontSize: '13px',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid var(--glass)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        cursor: 'pointer'
                      }}
                    >
                      Загрузить предыдущие сообщения
                    </button>
                  </div>
                )}
                
                {/* Индикатор загрузки старых сообщений */}
                {isLoadingMore && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '10px',
                    color: 'var(--muted)',
                    fontSize: '14px'
                  }}>
                    Загрузка предыдущих сообщений...
                  </div>
                )}
                
                {(!messages || messages.length === 0) && !isLoading ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px', 
                    color: 'var(--muted)',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Начните общение</h3>
                    <p style={{ 
                      fontSize: '14px', 
                      maxWidth: '300px',
                      lineHeight: '1.5'
                    }}>
                      Отправьте первое сообщение, чтобы начать диалог с {getOtherUserName(selectedChat)}
                    </p>
                  </div>
                ) : (
                  (messages || []).map(message => {
                    const isOwnMessage = message.sender_id === user?.user_id;
                    
                    return (
                      <div 
                        key={message.id}
                        style={{ 
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'flex-start',
                          flexDirection: isOwnMessage ? 'row-reverse' : 'row'
                        }}
                      >
                        {/* Аватарка для входящих сообщений */}
                        {!isOwnMessage && selectedChat.other_user && (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: selectedChat.other_user?.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent-2), var(--accent-3))',
                            display: 'grid',
                            placeContent: 'center',
                            flexShrink: 0,
                            marginTop: '4px'
                          }}>
                            {selectedChat.other_user?.avatar_url ? (
                              <img
                                src={selectedChat.other_user.avatar_url}
                                alt={getOtherUserName(selectedChat)}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
                                {getOtherUserInitials(selectedChat)}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Сообщение */}
                        <div 
                          style={{ 
                            maxWidth: '70%',
                            padding: '12px 16px',
                            borderRadius: '20px',
                            backgroundColor: isOwnMessage ? 'var(--accent)' : 'var(--accent-light)',
                            color: isOwnMessage ? 'white' : 'var(--text)',
                            border: !isOwnMessage ? '1px solid var(--glass)' : 'none',
                            alignSelf: 'flex-start',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          {message.reply_to && (
                            <div style={{
                              fontSize: '12px',
                              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                              borderLeft: '2px solid var(--accent)',
                              paddingLeft: '8px',
                              marginBottom: '6px'
                            }}>
                              Ответ на сообщение
                            </div>
                          )}
                          
                          <div style={{ 
                            wordBreak: 'break-word',
                            fontSize: '14px',
                            lineHeight: '1.5'
                          }}>{message.content}</div>
                          
                          {(message.attachments || []).map(attachment => (
                            <div key={attachment.id} style={{ marginTop: '8px' }}>
                              {attachment.type === 'image' ? (
                                <img 
                                  src={attachment.url} 
                                  alt={attachment.name} 
                                  style={{ 
                                    maxWidth: '100%', 
                                    borderRadius: '12px',
                                    maxHeight: '200px'
                                  }}
                                />
                              ) : (
                                <div style={{
                                  padding: '8px 12px',
                                  backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '14px'
                                }}>
                                  <span>📎</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{attachment.name}</div>
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'var(--muted)' 
                                    }}>
                                      {Math.round((attachment.size || 0) / 1024)} KB
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                            marginTop: '6px',
                            gap: '8px'
                          }}>
                            <span>{formatDate(message.created_at)}</span>
                            {isOwnMessage && (
                              <span style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '2px',
                                fontSize: '11px'
                              }}>
                                {message.is_read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Пустой блок для выравнивания исходящих сообщений */}
                        {isOwnMessage && (
                          <div style={{ width: '36px', flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Панель ввода сообщения */}
              <div style={{ 
                padding: '16px 20px',
                borderTop: '1px solid var(--glass)',
                backgroundColor: 'var(--accent-lightest)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'flex-end'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Здесь могут быть вложения файлов*/}
                  </div>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        console.log('Выбран файл:', file);
                      }
                      e.target.value = '';
                    }}
                  />
                  
                  <div style={{ flex: 1, position: 'relative' }}>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={`Сообщение для ${getOtherUserName(selectedChat)}...`}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        maxHeight: '120px',
                        padding: '12px 16px',
                        paddingRight: '50px',
                        borderRadius: '22px',
                        border: '1px solid var(--glass)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        resize: 'none',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        transition: 'border-color var(--transition)'
                      }}
                      onFocus={(e) => {
                        e.target.style.outline = 'none';
                        e.target.style.borderColor = 'var(--accent)';
                        e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--glass)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    
                    <button
                      className="btn btn-primary"
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || !isConnected}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        bottom: '8px',
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        padding: 0,
                        display: 'grid',
                        placeContent: 'center',
                        backgroundColor: isConnected ? 'var(--accent)' : 'var(--muted)',
                        border: 'none',
                        cursor: newMessage.trim() && isConnected ? 'pointer' : 'not-allowed',
                        opacity: newMessage.trim() && isConnected ? 1 : 0.6
                      }}
                    >
                      ↗
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              color: 'var(--muted)',
              padding: '40px 20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>💬</div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Выберите чат</h3>
              <p style={{ 
                fontSize: '14px', 
                maxWidth: '300px',
                lineHeight: '1.5',
                marginBottom: '24px'
              }}>
                Выберите существующий чат из списка или создайте новый для начала общения
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateChatModal(true)}
                style={{ 
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                + Создать новый чат
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Модальное окно создания чата */}
      {renderCreateChatModal()}
      
      {/* Статус подключения */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: 'var(--surface)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--glass)',
        fontSize: '14px',
        zIndex: 100,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#10B981' : '#EF4444',
          animation: isConnected ? 'pulse 2s infinite' : 'none'
        }} />
        {isConnected ? 'Подключено к чатам' : 'Отключено от сервера'}
      </div>

      {/* CSS стили */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .chat-layout {
          min-height: calc(100vh - 200px);
        }
        
        /* Адаптивность */
        @media (max-width: 1200px) {
          .chat-layout {
            grid-template-columns: 320px 1fr !important;
          }
        }
        
        @media (max-width: 992px) {
          .chat-layout {
            grid-template-columns: 1fr !important;
          }
          
          .chat-list {
            height: 300px !important;
            margin-bottom: 24px;
          }
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 0 16px !important;
          }
          
          .header-nav {
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Chats;
