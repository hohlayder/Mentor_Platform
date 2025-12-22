// src/pages/NotificationsPage.tsx
import React, { useState } from "react";

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState([
    { 
      id: "1", 
      title: "Новый отзыв", 
      message: "Иван оставил отзыв на ваш курс React", 
      time: "10 минут назад", 
      read: false,
      type: "review"
    },
    { 
      id: "2", 
      title: "Новое сообщение", 
      message: "Анна написала вам в чате", 
      time: "1 час назад", 
      read: false,
      type: "message"
    },
    { 
      id: "3", 
      title: "Курс обновлен", 
      message: "Курс TypeScript был обновлен", 
      time: "Вчера", 
      read: true,
      type: "update"
    },
    { 
      id: "4", 
      title: "Оплата получена", 
      message: "Получена оплата за курс JavaScript", 
      time: "2 дня назад", 
      read: true,
      type: "payment"
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1>🔔 Уведомления</h1>
        {unreadCount > 0 && (
          <button className="btn" onClick={markAllAsRead}>
            Отметить все как прочитанные ({unreadCount})
          </button>
        )}
      </div>

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Нет уведомлений</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div 
              key={notification.id} 
              className={`notification ${notification.read ? "read" : "unread"}`}
              onClick={() => markAsRead(notification.id)}
              style={{ cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  backgroundColor: notification.type === "review" ? "var(--accent-light)" :
                                  notification.type === "message" ? "#E0F2FE" :
                                  notification.type === "update" ? "#DCFCE7" : "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {notification.type === "review" && "⭐"}
                  {notification.type === "message" && "💬"}
                  {notification.type === "update" && "🔄"}
                  {notification.type === "payment" && "💰"}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <strong>{notification.title}</strong>
                    {!notification.read && (
                      <span style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "var(--accent)",
                        borderRadius: "50%"
                      }}></span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0", color: "var(--text)" }}>{notification.message}</p>
                  <div className="time">{notification.time}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <button 
          className="btn" 
          onClick={() => setNotifications([])}
          style={{ backgroundColor: "var(--accent-light)", color: "var(--accent-dark)" }}
        >
          Очистить все уведомления
        </button>
      </div>
    </div>
  );
};

export default NotificationsPage;