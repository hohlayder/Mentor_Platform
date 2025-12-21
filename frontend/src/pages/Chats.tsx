// src/pages/ChatsPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const ChatsPage: React.FC = () => {
  const [chats] = useState([
    { id: "1", name: "Анна Петрова", lastMessage: "Привет! Как дела?", time: "10:30", unread: 2 },
    { id: "2", name: "Иван Сидоров", lastMessage: "Спасибо за помощь с проектом!", time: "Вчера", unread: 0 },
    { id: "3", name: "Мария Иванова", lastMessage: "Когда следующий урок?", time: "2 дня назад", unread: 1 },
    { id: "4", name: "Алексей К.", lastMessage: "Договорились на завтра", time: "3 дня назад", unread: 0 },
  ]);

  return (
    <div className="container">
      <h1 style={{ marginBottom: "24px" }}>💬 Чаты</h1>
      
      <div className="chat-layout">
        {/* Список чатов */}
        <div className="chat-list">
          <div style={{ padding: "12px", borderBottom: "1px solid var(--glass)" }}>
            <input 
              type="text" 
              placeholder="Поиск чатов..." 
              className="input"
              style={{ width: "100%" }}
            />
          </div>
          
          {chats.map(chat => (
            <Link 
              key={chat.id} 
              to={`/chats/${chat.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="notification" style={{ 
                margin: "8px", 
                cursor: "pointer",
                borderLeft: chat.unread > 0 ? "4px solid var(--accent)" : "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{chat.name}</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{chat.time}</span>
                </div>
                <p style={{ 
                  margin: "4px 0", 
                  fontSize: "14px",
                  color: chat.unread > 0 ? "var(--text)" : "var(--muted)"
                }}>
                  {chat.lastMessage}
                </p>
                {chat.unread > 0 && (
                  <span style={{
                    backgroundColor: "var(--accent)",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px"
                  }}>
                    {chat.unread}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Окно чата */}
        <div className="chat-window">
          <div className="chat-header">
            <div>Анна Петрова</div>
            <div style={{ fontSize: "14px", color: "var(--muted)" }}>Online</div>
          </div>
          
          <div className="messages">
            <div className="msg received">
              Привет! Как твой проект по React?
            </div>
            <div className="msg sent">
              Привет! Всё отлично, уже почти закончил
            </div>
            <div className="msg received">
              Круто! Можешь помочь мне с TypeScript?
            </div>
            <div className="msg sent">
              Конечно! Когда удобно встретиться?
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <input 
              type="text" 
              placeholder="Напишите сообщение..." 
              className="input"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary">Отправить</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatsPage;