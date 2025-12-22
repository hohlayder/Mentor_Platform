// src/pages/ChatsPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { websocketService } from '../services/websocket';

// Типы на основе Swagger
interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  is_read: boolean;
  message_type: 'text' | 'image' | 'file' | 'voice';
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

// Тип для входящих сообщений WebSocket
interface WebSocketMessageData {
  id: string;
  content: string;
  sender_id: string;
  chat_id: string;
  created_at: string;
  message_type: string;
  is_edited: boolean;
}

const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [chats, setChats] = useState<ChatWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  
  // Ref для фокуса на поле ввода email
  const emailInputRef = useRef<HTMLInputElement>(null);

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
      // Обновляем список чатов при новом сообщении
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(chat => chat.id === data.chat_id);
        
        if (chatIndex === -1) {
          // Если это новый чат, загружаем заново
          loadChats();
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
          message_type: data.message_type as 'text' | 'image' | 'file' | 'voice'
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

    websocketService.onMessage('message', handleNewMessage);

    // Обновляем чаты каждые 60 секунд на случай проблем с WebSocket
    const interval = setInterval(loadChats, 60000);

    // Отписка при размонтировании
    return () => {
      clearInterval(interval);
      websocketService.offMessage('message', handleNewMessage);
      websocketService.offConnectionChange(setWsConnected);
    };
  }, [token, user, navigate]);

  // Функция загрузки чатов
  const loadChats = async () => {
    if (!token || !user) return;

    setLoading(true);
    setError(null);

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Загружаем список чатов
      const chatsResponse = await fetch('http://localhost:8080/api/v1/chats?limit=50', { headers });
      
      if (!chatsResponse.ok) {
        throw new Error('Не удалось загрузить чаты');
      }

      const chatsData: { chats: ChatResponse[] } = await chatsResponse.json();
      
      // Для каждого чата загружаем информацию о втором пользователе
      const chatsWithUsers: ChatWithUser[] = [];
      
      for (const chat of chatsData.chats) {
        const otherUserId = chat.user1_id === user.user_id ? chat.user2_id : chat.user1_id;
        
        try {
          // Загружаем информацию о пользователе
          const userResponse = await fetch(`http://localhost:8080/api/v1/users/${otherUserId}`, { headers });
          
          if (userResponse.ok) {
            const otherUser: User = await userResponse.json();
            
            chatsWithUsers.push({
              ...chat,
              otherUser,
              otherUserId
            });
          }
        } catch (userErr) {
          console.error(`Ошибка загрузки пользователя ${otherUserId}:`, userErr);
        }
      }

      // Сортируем по дате последнего сообщения (новые сверху)
      const sortedChats = chatsWithUsers.sort((a, b) => {
        const dateA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at).getTime();
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

  // Создание нового чата
  const createNewChat = async () => {
    if (!newChatEmail.trim() || !token) return;

    setCreatingChat(true);
    setError(null);

    try {
      // 1. Находим пользователя по email
      const userResponse = await fetch(`http://localhost:8080/api/v1/users/email/${newChatEmail}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userResponse.ok) {
        throw new Error('Пользователь не найден');
      }

      const otherUser: User = await userResponse.json();

      // 2. Проверяем, нет ли уже чата с этим пользователем
      const existingChat = chats.find(chat => 
        chat.otherUserId === otherUser.user_id
      );

      if (existingChat) {
        // Переходим в существующий чат
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // 3. Создаем чат
      const chatResponse = await fetch('http://localhost:8080/api/v1/chats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          other_user_id: otherUser.user_id
        })
      });

      if (!chatResponse.ok) {
        throw new Error('Не удалось создать чат');
      }

      const chatData = await chatResponse.json();
      
      // 4. Перенаправляем в новый чат
      navigate(`/chat/${chatData.chat_id}`);

    } catch (err: any) {
      setError(err.message || 'Ошибка создания чата');
    } finally {
      setCreatingChat(false);
      setNewChatEmail('');
    }
  };

  // Функция для фокуса на поле ввода email
  const focusEmailInput = () => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  };

  // Фильтрация чатов по поиску
  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const userName = `${chat.otherUser.first_name} ${chat.otherUser.last_name}`.toLowerCase();
    const userEmail = chat.otherUser.email.toLowerCase();
    const lastMessage = chat.last_message?.content.toLowerCase() || '';
    
    return userName.includes(searchLower) || 
           userEmail.includes(searchLower) ||
           lastMessage.includes(searchLower);
  });

  // Форматирование времени
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Вчера';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  // Подсчет непрочитанных сообщений
  const totalUnreadCount = chats.reduce((total, chat) => total + chat.unread_count, 0);

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
            
            {/* Поиск */}
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
                  disabled={creatingChat || !newChatEmail.trim()}
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                >
                  {creatingChat ? '...' : '+'}
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Введите email пользователя для создания чата
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
                    Непрочитанных: {totalUnreadCount}
                  </span>
                )}
              </div>
            )}

            {filteredChats.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: 'var(--muted)'
              }}>
                {searchQuery ? 'Чаты не найдены' : 'Нет активных чатов'}
                <div style={{ marginTop: '16px' }}>
                  <button 
                    className="btn btn-outline"
                    onClick={focusEmailInput}
                  >
                    Начать новый диалог
                  </button>
                </div>
              </div>
            ) : (
              filteredChats.map(chat => {
                const isActive = window.location.pathname.includes(`/chat/${chat.id}`);
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

                const hoverStyle = {
                  background: 'var(--glass)'
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
                        e.currentTarget.style.background = hoverStyle.background;
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
                        fontWeight: 600
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
                          {chat.last_message && (
                            <span style={{ 
                              fontSize: '12px', 
                              color: 'var(--muted)',
                              flexShrink: 0,
                              marginLeft: '8px'
                            }}>
                              {formatTime(chat.last_message.created_at)}
                            </span>
                          )}
                        </div>

                        {/* Последнее сообщение */}
                        <div style={{ 
                          fontSize: '13px',
                          color: chat.unread_count > 0 ? 'var(--text)' : 'var(--muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: chat.unread_count > 0 ? 500 : 400
                        }}>
                          {chat.last_message ? (
                            <>
                              {chat.last_message.sender_id === user?.user_id ? (
                                <span style={{ color: 'var(--accent)' }}>Вы: </span>
                              ) : null}
                              {chat.last_message.content.length > 40
                                ? `${chat.last_message.content.substring(0, 40)}...`
                                : chat.last_message.content}
                            </>
                          ) : (
                            'Нет сообщений'
                          )}
                        </div>
                      </div>

                      {/* Индикатор непрочитанных */}
                      {chat.unread_count > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontSize: '11px',
                          display: 'grid',
                          placeContent: 'center',
                          fontWeight: 600,
                          padding: '0 6px'
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

          {/* Информация о текущем пользователе внизу */}
          {user && (
            <div style={{ 
              padding: '16px',
              borderTop: '1px solid var(--glass)',
              background: 'var(--surface)'
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
                  style={{ padding: '4px', fontSize: '12px' }}
                  title="Мой профиль"
                >
                  👤
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Основное окно чата (пустое или с приветствием) */}
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'column' }}>
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
              {wsConnected ? 'Выберите чат для общения' : 'Соединение...'}
            </h3>
            <p style={{ margin: '0 0 20px 0', maxWidth: '400px' }}>
              {wsConnected 
                ? 'Начните новый диалог или продолжите общение в существующем чате'
                : 'Пытаемся подключиться к серверу...'}
            </p>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                className="btn btn-outline"
                onClick={focusEmailInput}
                disabled={!wsConnected}
              >
                Новый чат
              </button>
              <button 
                className="btn btn-ghost"
                onClick={() => navigate('/courses')}
              >
                Найти менторов
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

            {/* Советы по использованию чата */}
            <div style={{ 
              marginTop: '32px',
              padding: '16px',
              background: 'var(--glass)',
              borderRadius: '12px',
              maxWidth: '400px',
              textAlign: 'left'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text)' }}>
                💡 Советы по использованию чата
              </h4>
              <ul style={{ 
                margin: 0, 
                paddingLeft: '20px',
                fontSize: '13px',
                color: 'var(--muted)'
              }}>
                <li>Используйте поиск для быстрого нахождения чатов</li>
                <li>Новые сообщения появляются в реальном времени</li>
                <li>Начните диалог с ментором по его email</li>
                <li>Сообщения сохраняются в истории чата</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ChatsPage;