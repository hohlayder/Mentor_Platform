// src/pages/ChatPage.tsx (обновленная версия)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { websocketService } from '../services/websocket';

// Типы
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
  is_edited: boolean;
  read_at?: string;
}

interface ChatInfo {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
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

const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Обработчик входящих сообщений WebSocket
  const handleWebSocketMessage = useCallback((data: WebSocketMessageData) => {
    // Проверяем, что сообщение для текущего чата
    if (data.chat_id !== id) return;

    const newMessage: Message = {
      id: data.id,
      content: data.content,
      sender_id: data.sender_id,
      chat_id: data.chat_id,
      created_at: data.created_at,
      is_read: data.sender_id === user?.user_id, // Наши сообщения сразу прочитаны
      message_type: data.message_type as 'text' | 'image' | 'file' | 'voice',
      is_edited: data.is_edited || false
    };

    // Добавляем сообщение в список
    setMessages(prev => [...prev, newMessage]);

    // Если сообщение не наше, помечаем как прочитанное
    if (data.sender_id !== user?.user_id) {
      markMessagesAsRead([data.id]);
    }
  }, [id, user?.user_id]);

  // Загрузка информации о чате и сообщений
  useEffect(() => {
    if (!token || !user || !id) {
      navigate('/login');
      return;
    }

    // Устанавливаем токен для WebSocket
    websocketService.setToken(token);
    
    // Подключаемся к WebSocket
    websocketService.connect();

    // Подписываемся на входящие сообщения
    websocketService.onMessage('message', handleWebSocketMessage);
    
    // Следим за состоянием соединения
    websocketService.onConnectionChange(setWsConnected);

    const loadChat = async () => {
      setLoading(true);
      setError(null);

      try {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // 1. Загружаем информацию о чате
        const chatResponse = await fetch(`http://localhost:8080/api/v1/chats/${id}`, { headers });
        
        if (!chatResponse.ok) {
          if (chatResponse.status === 404) {
            throw new Error('Чат не найден');
          }
          throw new Error('Не удалось загрузить чат');
        }

        const chatData: { chat: ChatInfo } = await chatResponse.json();
        setChatInfo(chatData.chat);

        // 2. Определяем ID другого пользователя и загружаем его данные
        const otherUserId = chatData.chat.user1_id === user.user_id 
          ? chatData.chat.user2_id 
          : chatData.chat.user1_id;

        const userResponse = await fetch(`http://localhost:8080/api/v1/users/${otherUserId}`, { headers });
        
        if (userResponse.ok) {
          const userData: User = await userResponse.json();
          setOtherUser(userData);
        }

        // 3. Загружаем сообщения
        await loadMessages();

        // 4. Помечаем сообщения как прочитанные
        await markAllMessagesAsRead();

      } catch (err: any) {
        console.error('Ошибка загрузки чата:', err);
        setError(err.message || 'Ошибка загрузки чата');
      } finally {
        setLoading(false);
      }
    };

    loadChat();

    // Отписка при размонтировании
    return () => {
      websocketService.offMessage('message', handleWebSocketMessage);
      websocketService.offConnectionChange(setWsConnected);
    };
  }, [id, token, user, navigate, handleWebSocketMessage]);

  // Загрузка сообщений из API
  const loadMessages = async (loadMore = false) => {
    if (!token || !id) return;

    try {
      const params = new URLSearchParams({
        chat_id: id,
        limit: '50'
      });

      if (loadMore && cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`http://localhost:8080/api/v1/chats/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (loadMore) {
          setMessages(prev => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
        }
        
        setHasMore(data.has_more);
        setCursor(data.next_cursor?.id || null);
      }
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
    }
  };

  // Пометить все сообщения как прочитанные
  const markAllMessagesAsRead = async () => {
    if (!token || !id || !messages.length) return;

    const unreadMessageIds = messages
      .filter(msg => !msg.is_read && msg.sender_id !== user?.user_id)
      .map(msg => msg.id);

    if (unreadMessageIds.length === 0) return;

    await markMessagesAsRead(unreadMessageIds);
  };

  // Пометить конкретные сообщения как прочитанные
  const markMessagesAsRead = async (messageIds: string[]) => {
    if (!token || !id || messageIds.length === 0) return;

    try {
      await fetch('http://localhost:8080/api/v1/chats/messages/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: id,
          message_ids: messageIds
        })
      });

      // Обновляем локально
      setMessages(prev => prev.map(msg => 
        messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg
      ));

    } catch (err) {
      console.error('Ошибка отметки сообщений как прочитанных:', err);
    }
  };

  // Отправка сообщения через WebSocket
  const sendMessage = async () => {
    if (!newMessage.trim() || !id || sending) return;

    setSending(true);
    setError(null);

    try {
      // Создаем временное сообщение для немедленного отображения
      const tempMessage: Message = {
        id: `temp_${Date.now()}`,
        content: newMessage,
        sender_id: user!.user_id,
        chat_id: id,
        created_at: new Date().toISOString(),
        is_read: true, // Наши сообщения сразу прочитаны
        message_type: 'text',
        is_edited: false
      };

      // Добавляем временное сообщение
      setMessages(prev => [...prev, tempMessage]);
      
      // Отправляем через WebSocket
      websocketService.sendMessage(id, newMessage, 'text');
      
      // Очищаем поле ввода
      setNewMessage('');

    } catch (err: any) {
      console.error('Ошибка отправки сообщения:', err);
      setError('Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  // Удаляем временное сообщение при получении реального от сервера
  useEffect(() => {
    // Ищем временные сообщения и заменяем их реальными
    const tempMessages = messages.filter(msg => msg.id.startsWith('temp_'));
    if (tempMessages.length > 0) {
      // В реальности здесь была бы логика замены временных сообщений на реальные
      // когда они придут от сервера через WebSocket
    }
  }, [messages]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    if (messagesEndRef.current && !loading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Загрузка старых сообщений при скролле вверх
  const handleScroll = () => {
    if (!messagesContainerRef.current || !hasMore || loading) return;

    const container = messagesContainerRef.current;
    if (container.scrollTop === 0) {
      loadMessages(true);
    }
  };

  // Форматирование времени сообщения
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  // Форматирование даты для разделителя
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Группировка сообщений по отправителю и времени
  const groupMessages = (messages: Message[]) => {
    const groups: Message[][] = [];
    let currentGroup: Message[] = [];

    messages.forEach((message, index) => {
      if (index === 0) {
        currentGroup.push(message);
      } else {
        const prevMessage = messages[index - 1];
        const timeDiff = new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime();
        
        // Группируем если:
        // 1. Тот же отправитель
        // 2. Разница во времени меньше 5 минут
        if (message.sender_id === prevMessage.sender_id && timeDiff < 300000) {
          currentGroup.push(message);
        } else {
          groups.push([...currentGroup]);
          currentGroup = [message];
        }
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite'
          }}>
            <span>💬</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Загрузка чата...</p>
        </div>
      </div>
    );
  }

  if (error || !chatInfo || !otherUser) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ margin: '0 auto 20px', background: '#ef4444' }}>
            <span>⚠️</span>
          </div>
          <h3 style={{ margin: '0 0 12px 0' }}>Ошибка</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            {error || 'Чат не найден'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/chats')}
            >
              К списку чатов
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessages(messages);

  return (
    <div className="container">
      <div className="chat-layout">
        {/* Боковая панель */}
        <div className="chat-list" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid var(--glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/chats')}
              style={{ padding: '8px' }}
            >
              ←
            </button>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Чаты</h3>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {messages.length} сообщений
                {wsConnected ? ' · Online' : ' · Offline'}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            <button
              className="btn btn-outline"
              style={{ width: '100%', marginBottom: '12px', fontSize: '14px' }}
              onClick={() => navigate('/chats')}
            >
              Все чаты
            </button>
          </div>
        </div>

        {/* Основное окно чата */}
        <div className="chat-window">
          {/* Заголовок чата */}
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%',
                overflow: 'hidden',
                background: otherUser.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'grid',
                placeContent: 'center',
                color: '#fff',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {otherUser.avatar_url ? (
                  <img 
                    src={otherUser.avatar_url} 
                    alt={otherUser.first_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{otherUser.first_name?.[0]}{otherUser.last_name?.[0]}</span>
                )}
              </div>
              <div>
                <strong style={{ fontSize: '16px' }}>
                  {otherUser.first_name} {otherUser.last_name}
                </strong>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {otherUser.email}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Индикатор подключения WebSocket */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '13px',
                color: wsConnected ? 'var(--accent)' : 'var(--muted)'
              }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%',
                  background: wsConnected ? 'var(--accent)' : 'var(--muted)',
                  animation: wsConnected ? 'pulse 2s infinite' : 'none'
                }} />
                {wsConnected ? 'Online' : 'Offline'}
              </div>
              
              <button
                className="btn btn-ghost"
                onClick={() => {
                  // Действия с чатом
                }}
                style={{ fontSize: '14px' }}
              >
                ⋮
              </button>
            </div>
          </div>

          {/* Область сообщений */}
          <div 
            ref={messagesContainerRef}
            className="messages"
            onScroll={handleScroll}
            style={{ position: 'relative' }}
          >
            {hasMore && (
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <button 
                  className="btn btn-ghost"
                  onClick={() => loadMessages(true)}
                  disabled={loading}
                  style={{ fontSize: '13px' }}
                >
                  {loading ? 'Загрузка...' : 'Загрузить старые сообщения'}
                </button>
              </div>
            )}

            {/* Группировка сообщений по дням */}
            {(() => {
              const groupsByDate: { [key: string]: Message[] } = {};
              
              messages.forEach(message => {
                const date = formatMessageDate(message.created_at);
                if (!groupsByDate[date]) groupsByDate[date] = [];
                groupsByDate[date].push(message);
              });

              return Object.entries(groupsByDate).map(([date, dateMessages]) => {
                const dateMessageGroups = groupMessages(dateMessages);
                
                return (
                  <React.Fragment key={date}>
                    {/* Разделитель даты */}
                    <div style={{ 
                      textAlign: 'center', 
                      margin: '16px 0',
                      position: 'relative'
                    }}>
                      <div style={{ 
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: 'var(--glass)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--muted)'
                      }}>
                        {date}
                      </div>
                    </div>

                    {/* Сообщения этого дня */}
                    {dateMessageGroups.map((group, groupIndex) => {
                      const isMyGroup = group[0].sender_id === user?.user_id;
                      
                      return (
                        <div key={groupIndex} style={{ 
                          marginBottom: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMyGroup ? 'flex-end' : 'flex-start'
                        }}>
                          {/* Аватар для группы (только для чужих сообщений и только у первой группы в день) */}
                          {!isMyGroup && groupIndex === 0 && (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'flex-end',
                              gap: '8px',
                              marginBottom: '4px'
                            }}>
                              <div style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: otherUser.avatar_url ? 'transparent' : 'var(--glass)',
                                display: 'grid',
                                placeContent: 'center',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '12px',
                                flexShrink: 0
                              }}>
                                {otherUser.avatar_url ? (
                                  <img 
                                    src={otherUser.avatar_url} 
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <span>{otherUser.first_name?.[0]}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                                {otherUser.first_name}
                              </div>
                            </div>
                          )}

                          {/* Сообщения группы */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: isMyGroup ? 'flex-end' : 'flex-start',
                            maxWidth: '80%'
                          }}>
                            {group.map((message, msgIndex) => (
                              <div 
                                key={message.id} 
                                className={`msg ${isMyGroup ? 'sent' : 'received'}`}
                                style={{ 
                                  marginBottom: '2px',
                                  borderRadius: isMyGroup ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                  position: 'relative'
                                }}
                              >
                                {/* Временное сообщение имеет особый стиль */}
                                {message.id.startsWith('temp_') && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: isMyGroup ? '-8px' : 'auto',
                                    left: isMyGroup ? 'auto' : '-8px',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: 'var(--accent)',
                                    display: 'grid',
                                    placeContent: 'center',
                                    fontSize: '10px',
                                    color: '#fff'
                                  }}>
                                    ↻
                                  </div>
                                )}
                                
                                {message.content}
                                
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: isMyGroup ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: isMyGroup ? 'flex-end' : 'flex-start',
                                  gap: '4px'
                                }}>
                                  {formatMessageTime(message.created_at)}
                                  {isMyGroup && message.is_read && (
                                    <span>✓✓</span>
                                  )}
                                  {message.id.startsWith('temp_') && (
                                    <span style={{ fontStyle: 'italic' }}>отправка...</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}

            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода сообщения */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--glass)'
          }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Введите сообщение..."
              style={{ 
                flex: 1,
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--glass)',
                background: 'transparent',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '14px'
              }}
              disabled={sending || !wsConnected}
            />
            <button
              className="btn btn-primary"
              onClick={sendMessage}
              disabled={sending || !newMessage.trim() || !wsConnected}
              style={{ padding: '12px 20px' }}
            >
              {sending ? '...' : 'Отправить'}
            </button>
          </div>

          {/* Информация о подключении */}
          {!wsConnected && (
            <div style={{ 
              padding: '12px', 
              marginTop: '12px',
              borderRadius: '8px',
              background: 'rgba(250, 204, 21, 0.1)',
              border: '1px solid rgba(250, 204, 21, 0.2)',
              color: '#ca8a04',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div>⚠️</div>
              <div>
                <div style={{ fontWeight: 600 }}>Нет подключения</div>
                <div style={{ fontSize: '13px' }}>Сообщения будут отправлены при восстановлении связи</div>
              </div>
            </div>
          )}

          {/* Сообщение об ошибке */}
          {error && (
            <div style={{ 
              padding: '12px', 
              marginTop: '12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ChatPage;