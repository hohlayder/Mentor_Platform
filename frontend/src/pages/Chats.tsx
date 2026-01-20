// src/pages/Chats.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { useWebSocket } from '../services/useWebSocket';
import { IncomingMessage } from '../services/websocket';

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
  messages: IncomingMessage[];
  next_cursor?: {
    id: string;
    created_at: string;
  };
  has_more: boolean;
}

const Chats: React.FC = () => {
  const { token, user } = useAuth();
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
        const chatsWithUsers = await Promise.all(
          data.chats.map(async (chat: Chat) => {
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
                return { ...chat, other_user: userData };
              }
            } catch (error) {
              console.error('Ошибка загрузки пользователя:', error);
            }
            
            return chat;
          })
        );
        
        setChats(chatsWithUsers);
      }
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    }
  }, [token, user]);

  // Загрузка сообщений чата (с пагинацией) - УПРОЩЕННАЯ ВЕРСИЯ
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
      
      // ПРОСТО ПЕРЕДАЕМ КУРСОР КАК ЕСТЬ
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
        сообщений: data.messages?.length,
        естьЕще: data.has_more,
        курсор: data.next_cursor?.id || 'нет'
      });
      
      // СОХРАНЯЕМ КУРСОР ПРОСТО КАК СТРОКУ
      setNextCursor(data.next_cursor?.id || null);
      setHasMore(data.has_more);
      
      // Добавляем сообщения
      if (isLoadMore) {
        // При подгрузке старых сообщений добавляем их в начало
        setMessages(prev => [...data.messages, ...prev]);
      } else {
        // При первой загрузке устанавливаем сообщения
        setMessages(data.messages);
      }
      
      // Помечаем как прочитанные
      const unreadMessages = data.messages
        ?.filter(msg => !msg.is_read && msg.sender_id !== user?.user_id) || [];
      
      if (unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map(msg => msg.id);
        await markAsRead(unreadIds, chatId);
      }
      
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      // Показываем пользователю ошибку
      if (!isLoadMore) {
        setMessages([]);
      }
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
        
        setFoundUser(userData);
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
    if (!token || messageIds.length === 0) return;
    
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
  };

  // Получение имени собеседника
  const getOtherUserName = (chat: Chat) => {
    if (chat.other_user) {
      return `${chat.other_user.first_name} ${chat.other_user.last_name}`;
    }
    return chat.user1_id === user?.user_id ? `User ${chat.user2_id.substring(0, 8)}` : `User ${chat.user1_id.substring(0, 8)}`;
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
    if (messages.length > 0) {
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
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  color: 'white',
                  display: 'grid',
                  placeContent: 'center',
                  fontWeight: 600
                }}>
                  {foundUser.first_name?.charAt(0) || 'U'}
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

  if (isLoading) {
    return (
      <div className="container">
        <div className="card">Загрузка чатов...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap-lg)' }}>
        <h1 style={{ margin: 0 }}>Сообщения</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateChatModal(true)}
        >
          + Новый чат
        </button>
      </div>
      
      <div className="chat-layout">
        {/* Список чатов */}
        <div className="chat-list">
          <div style={{ padding: 'var(--gap-sm)', borderBottom: '1px solid var(--glass)' }}>
            <input 
              type="text" 
              placeholder="Поиск чатов..." 
              style={{ width: '100%', marginBottom: 'var(--gap-sm)' }}
            />
            <div className="chips">
              <span className="chip active">Все</span>
            </div>
          </div>
          
          <div style={{ paddingTop: 'var(--gap-sm)' }}>
            {chats.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 'var(--gap-lg)', 
                color: 'var(--muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--gap-md)'
              }}>
                <div style={{ fontSize: '48px' }}>💬</div>
                <div>У вас пока нет чатов</div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateChatModal(true)}
                  style={{ marginTop: 'var(--gap-sm)' }}
                >
                  Создать первый чат
                </button>
              </div>
            ) : (
              chats.map(chat => (
                <div 
                  key={chat.id}
                  className={`card ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                  style={{ 
                    marginBottom: 'var(--gap-sm)', 
                    cursor: 'pointer',
                    backgroundColor: selectedChat?.id === chat.id ? 'var(--accent-light)' : '',
                    border: selectedChat?.id === chat.id ? '1px solid var(--accent)' : ''
                  }}
                  onClick={() => {
                    setSelectedChat(chat);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{getOtherUserName(chat)}</div>
                      <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>
                        {chat.last_message?.content || 'Нет сообщений'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {chat.last_message ? formatDate(chat.last_message.created_at) : ''}
                      </div>
                      {chat.unread_count > 0 && (
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
                          marginTop: '4px'
                        }}>
                          {chat.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Окно чата */}
        <div className="chat-window">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                    color: 'white',
                    display: 'grid',
                    placeContent: 'center',
                    fontWeight: 600
                  }}>
                    {getOtherUserName(selectedChat).charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{getOtherUserName(selectedChat)}</div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                      {isConnected ? 'онлайн' : 'оффлайн'}
                    </div>
                  </div>
                </div>
                <div className="header-nav">
                  <button className="btn btn-ghost">⋮</button>
                </div>
              </div>
              
              {/* Контейнер сообщений с обработкой прокрутки */}
              <div 
                className="messages" 
                ref={messagesContainerRef}
                style={{ 
                  position: 'relative',
                  overflowY: 'auto',
                  flex: 1,
                  padding: 'var(--gap-md)',
                  maxHeight: 'calc(100vh - 200px)'
                }}
              >
                {/* Кнопка для загрузки старых сообщений */}
                {hasMore && !isLoadingMore && nextCursor && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '10px',
                    marginBottom: '10px'
                  }}>
                    <button
                      className="btn btn-outline"
                      onClick={loadMoreMessages}
                      style={{ 
                        fontSize: '12px',
                        padding: '5px 10px',
                        opacity: 0.7
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
                
                {messages.length === 0 && !isLoading ? (
                  <div style={{ textAlign: 'center', padding: 'var(--gap-lg)', color: 'var(--muted)' }}>
                    Начните общение
                  </div>
                ) : (
                  messages.map(message => (
                    <div 
                      key={message.id}
                      className={`msg ${message.sender_id === user?.user_id ? 'sent' : 'received'}`}
                      style={{ 
                        maxWidth: '70%',
                        padding: '10px',
                        borderRadius: '12px',
                        marginBottom: '8px',
                        alignSelf: message.sender_id === user?.user_id ? 'flex-end' : 'flex-start',
                        backgroundColor: message.sender_id === user?.user_id ? 'var(--accent)' : 'var(--surface)',
                        color: message.sender_id === user?.user_id ? 'white' : 'var(--text)',
                      }}
                    >
                      {message.reply_to && (
                        <div style={{
                          fontSize: '12px',
                          color: message.sender_id === user?.user_id ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                          borderLeft: '2px solid var(--accent)',
                          paddingLeft: '8px',
                          marginBottom: '4px'
                        }}>
                          Ответ на сообщение
                        </div>
                      )}
                      
                      <div>{message.content}</div>
                      
                      {message.attachments?.map(attachment => (
                        <div key={attachment.id} style={{ marginTop: '8px' }}>
                          {attachment.type === 'image' ? (
                            <img 
                              src={attachment.url} 
                              alt={attachment.name} 
                              style={{ 
                                maxWidth: '100%', 
                                borderRadius: '8px',
                                maxHeight: '200px'
                              }}
                            />
                          ) : (
                            <div style={{
                              padding: '8px',
                              backgroundColor: message.sender_id === user?.user_id ? 'rgba(255,255,255,0.1)' : 'var(--accent-light)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span>📎</span>
                              <span>{attachment.name}</span>
                              <span style={{ 
                                fontSize: '12px', 
                                color: message.sender_id === user?.user_id ? 'rgba(255,255,255,0.7)' : 'var(--muted)' 
                              }}>
                                ({Math.round((attachment.size || 0) / 1024)} KB)
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: message.sender_id === user?.user_id ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                        marginTop: '4px'
                      }}>
                        <span>{formatDate(message.created_at)}</span>
                        {message.sender_id === user?.user_id && (
                          <span>{message.is_read ? '✓✓' : '✓'}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: 'var(--gap-sm)', 
                alignItems: 'flex-end',
                borderTop: '1px solid var(--glass)',
                paddingTop: 'var(--gap-sm)'
              }}>
                <button 
                  className="btn btn-ghost"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flexShrink: 0 }}
                >
                  📎
                </button>
                
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
                    placeholder="Введите сообщение..."
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      maxHeight: '120px',
                      padding: '12px',
                      paddingRight: '60px',
                      borderRadius: '24px',
                      border: '1px solid var(--glass)',
                      backgroundColor: 'transparent',
                      color: 'var(--text)',
                      resize: 'none',
                      fontFamily: 'inherit',
                      fontSize: '14px'
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
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      padding: 0,
                      display: 'grid',
                      placeContent: 'center'
                    }}
                  >
                    ↗
                  </button>
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
              color: 'var(--muted)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: 'var(--gap-md)' }}>💬</div>
              <h3>Выберите чат</h3>
              <p style={{ textAlign: 'center', maxWidth: '300px' }}>
                Выберите существующий чат из списка или создайте новый
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateChatModal(true)}
                style={{ marginTop: 'var(--gap-md)' }}
              >
                + Создать чат
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
        padding: '8px 12px',
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--glass)',
        fontSize: '14px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#10B981' : '#EF4444',
          animation: isConnected ? 'pulse 2s infinite' : 'none'
        }} />
        {isConnected ? 'Подключено' : 'Отключено'}
      </div>
    </div>
  );
};

export default Chats;