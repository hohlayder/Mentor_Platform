// src/pages/SettingsPage.tsx
import React, { useState } from "react";

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    email: "ivan@example.com",
    firstName: "Иван",
    lastName: "Иванов",
    bio: "Люблю программирование и кофе",
    notifications: {
      email: true,
      push: true,
      messages: true,
      courses: false,
    },
    privacy: {
      profileVisible: true,
      showEmail: false,
      showCourses: true,
    },
    theme: "light",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextareaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggle = (category: keyof typeof settings, field: string) => {
    if (category === "notifications" || category === "privacy") {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [field]: !prev[category][field]
        }
      }));
    }
  };

  const saveSettings = () => {
    alert("Настройки сохранены!");
  };

  return (
    <div className="container">
      <h1 style={{ marginBottom: "24px" }}>⚙️ Настройки</h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Основная информация */}
        <div className="card">
          <h2 style={{ marginBottom: "16px" }}>Основная информация</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Имя</label>
              <input
                type="text"
                name="firstName"
                value={settings.firstName}
                onChange={handleInputChange}
                className="input"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Фамилия</label>
              <input
                type="text"
                name="lastName"
                value={settings.lastName}
                onChange={handleInputChange}
                className="input"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Email</label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleInputChange}
                className="input"
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>О себе</label>
              <textarea
                name="bio"
                value={settings.bio}
                onChange={handleInputChange}
                className="input"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Уведомления */}
        <div className="card">
          <h2 style={{ marginBottom: "16px" }}>🔔 Уведомления</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Object.entries(settings.notifications).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {key === "email" && "Email уведомления"}
                  {key === "push" && "Push-уведомления"}
                  {key === "messages" && "Новые сообщения"}
                  {key === "courses" && "Обновления курсов"}
                </span>
                <button
                  className="chip"
                  onClick={() => handleToggle("notifications", key)}
                  style={{
                    backgroundColor: value ? "var(--accent)" : "var(--glass)",
                    color: value ? "white" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 16px"
                  }}
                >
                  {value ? "Вкл" : "Выкл"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Приватность */}
        <div className="card">
          <h2 style={{ marginBottom: "16px" }}>🔒 Приватность</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Object.entries(settings.privacy).map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {key === "profileVisible" && "Профиль виден другим"}
                  {key === "showEmail" && "Показывать email"}
                  {key === "showCourses" && "Показывать мои курсы"}
                </span>
                <button
                  className="chip"
                  onClick={() => handleToggle("privacy", key)}
                  style={{
                    backgroundColor: value ? "var(--accent)" : "var(--glass)",
                    color: value ? "white" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 16px"
                  }}
                >
                  {value ? "Вкл" : "Выкл"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Тема */}
        <div className="card">
          <h2 style={{ marginBottom: "16px" }}>🎨 Тема</h2>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              className={`chip ${settings.theme === "light" ? "active" : ""}`}
              onClick={() => setSettings(prev => ({ ...prev, theme: "light" }))}
              style={{ flex: 1 }}
            >
              🌞 Светлая
            </button>
            <button
              className={`chip ${settings.theme === "dark" ? "active" : ""}`}
              onClick={() => setSettings(prev => ({ ...prev, theme: "dark" }))}
              style={{ flex: 1 }}
            >
              🌙 Тёмная
            </button>
          </div>
        </div>

        {/* Опасная зона */}
        <div className="card" style={{ border: "2px solid #FCA5A5" }}>
          <h2 style={{ marginBottom: "16px", color: "#DC2626" }}>⚠️ Опасная зона</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              className="btn"
              style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}
              onClick={() => alert("Удаление аккаунта...")}
            >
              Удалить аккаунт
            </button>
            <button
              className="btn"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
              onClick={() => alert("Экспорт данных...")}
            >
              Экспортировать все данные
            </button>
          </div>
        </div>

        {/* Кнопки действий */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button className="btn">Отмена</button>
          <button className="btn btn-primary" onClick={saveSettings}>
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;