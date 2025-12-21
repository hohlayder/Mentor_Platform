// src/pages/CourseDetailPage.tsx
import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";

const CourseDetailPage: React.FC = () => {
  const { id } = useParams();
  const [enrolled, setEnrolled] = useState(false);
  
  const course = {
    id: "1",
    title: "React с нуля до профи",
    description: "Научитесь создавать современные веб-приложения с помощью React. Этот курс охватывает все основные концепции от основ до продвинутых тем.",
    category: "Программирование",
    rating: 4.8,
    reviews: 245,
    students: 1245,
    duration: "12 часов",
    price: "$49",
    author: {
      name: "Иван Иванов",
      bio: "Senior Frontend Developer с 8-летним опытом",
      rating: 4.9,
    },
    modules: [
      { id: "1", title: "Введение в React", duration: "45 мин", completed: true },
      { id: "2", title: "Компоненты и Props", duration: "1 час", completed: true },
      { id: "3", title: "Состояние и хуки", duration: "1.5 часа", completed: false },
      { id: "4", title: "Роутинг с React Router", duration: "1 час", completed: false },
      { id: "5", title: "Работа с API", duration: "2 часа", completed: false },
      { id: "6", title: "Оптимизация производительности", duration: "1.5 часа", completed: false },
    ],
    requirements: ["Базовые знания HTML/CSS", "Основы JavaScript", "Готовность учиться"],
    learnings: ["Создавать React приложения", "Работать с хуками", "Интегрировать API", "Деплоить приложения"],
  };

  return (
    <div className="container">
      <div style={{ marginBottom: "24px" }}>
        <Link to="/courses" style={{ color: "var(--accent)", textDecoration: "none" }}>← Все курсы</Link>
      </div>

      <div className="courses-container">
        {/* Основной контент */}
        <div style={{ flex: 1 }}>
          <div className="card" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <span className="chip" style={{ marginBottom: "12px" }}>{course.category}</span>
                <h1 style={{ marginBottom: "12px" }}>{course.title}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ color: "#F59E0B" }}>⭐</span>
                    <strong>{course.rating}</strong>
                    <span style={{ color: "var(--muted)" }}>({course.reviews} отзывов)</span>
                  </div>
                  <div>👥 {course.students} студентов</div>
                  <div>⏱️ {course.duration}</div>
                </div>
              </div>
              
              <div className="card" style={{ padding: "20px", minWidth: "200px" }}>
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "var(--accent)", marginBottom: "8px" }}>
                  {course.price}
                </div>
                <button 
                  className={`btn ${enrolled ? "btn-primary" : ""}`} 
                  style={{ width: "100%", marginBottom: "12px" }}
                  onClick={() => setEnrolled(!enrolled)}
                >
                  {enrolled ? "Продолжить обучение" : "Записаться на курс"}
                </button>
                <div style={{ fontSize: "14px", color: "var(--muted)", textAlign: "center" }}>
                  Гарантия возврата 30 дней
                </div>
              </div>
            </div>
            
            <p style={{ lineHeight: "1.6", marginBottom: "24px" }}>{course.description}</p>
          </div>

          {/* Что вы узнаете */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <h2 style={{ marginBottom: "16px" }}>🎯 Чему вы научитесь</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {course.learnings.map((learning, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--accent)" }}>✓</span>
                  <span>{learning}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Программа курса */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <h2 style={{ marginBottom: "16px" }}>📚 Программа курса</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {course.modules.map(module => (
                <div 
                  key={module.id} 
                  className="card" 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    backgroundColor: module.completed ? "var(--accent-lightest)" : "var(--surface)",
                    borderLeft: module.completed ? "4px solid var(--accent)" : "none"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{module.title}</div>
                    <div style={{ fontSize: "14px", color: "var(--muted)" }}>{module.duration}</div>
                  </div>
                  {module.completed ? (
                    <span style={{ color: "var(--accent)" }}>✅</span>
                  ) : (
                    <button className="btn">Начать</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Боковая панель */}
        <div className="sidebar">
          <div className="card" style={{ marginBottom: "20px" }}>
            <h3 style={{ marginBottom: "12px" }}>👨‍🏫 Автор</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold"
              }}>
                {course.author.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: "bold" }}>{course.author.name}</div>
                <div style={{ fontSize: "14px", color: "var(--muted)" }}>{course.author.rating} ⭐</div>
              </div>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text)" }}>{course.author.bio}</p>
            <button className="btn" style={{ width: "100%", marginTop: "12px" }}>
              Написать сообщение
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: "12px" }}>📋 Требования</h3>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {course.requirements.map((req, index) => (
                <li key={index} style={{ marginBottom: "8px", color: "var(--text)" }}>{req}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;