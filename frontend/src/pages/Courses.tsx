// src/pages/CoursesPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const CoursesPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const categories = [
    { id: "all", name: "Все" },
    { id: "programming", name: "Программирование" },
    { id: "design", name: "Дизайн" },
    { id: "business", name: "Бизнес" },
    { id: "marketing", name: "Маркетинг" },
    { id: "language", name: "Языки" },
  ];

  const courses = [
    { id: "1", title: "React с нуля", category: "programming", rating: 4.8, students: 1245, duration: "12 часов", price: "$49", author: "Иван Иванов" },
    { id: "2", title: "TypeScript для продвинутых", category: "programming", rating: 4.9, students: 856, duration: "8 часов", price: "$39", author: "Анна Петрова" },
    { id: "3", title: "UI/UX дизайн", category: "design", rating: 4.7, students: 2100, duration: "15 часов", price: "$59", author: "Мария С." },
    { id: "4", title: "JavaScript основы", category: "programming", rating: 4.6, students: 3500, duration: "10 часов", price: "$29", author: "Алексей К." },
    { id: "5", title: "SMM маркетинг", category: "marketing", rating: 4.5, students: 980, duration: "6 часов", price: "$45", author: "Ольга В." },
    { id: "6", title: "Деловой английский", category: "language", rating: 4.8, students: 1750, duration: "20 часов", price: "$69", author: "John Smith" },
  ];

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(search.toLowerCase()) ||
                         course.author.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container">
      <h1 style={{ marginBottom: "8px" }}>🎓 Курсы</h1>
      <p className="lead" style={{ marginBottom: "24px" }}>Найдите подходящий курс для обучения</p>
      
      {/* Поиск */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Поиск курсов..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ width: "100%", marginBottom: "16px" }}
        />
        
        {/* Категории */}
        <div className="chips">
          {categories.map(category => (
            <button
              key={category.id}
              className={`chip ${selectedCategory === category.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Результаты */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2>Найдено курсов: {filteredCourses.length}</h2>
          <select className="input" style={{ width: "auto" }}>
            <option>По популярности</option>
            <option>По рейтингу</option>
            <option>По цене</option>
            <option>По новизне</option>
          </select>
        </div>
        
        {filteredCourses.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Курсы не найдены</p>
          </div>
        ) : (
          <div className="courses-grid">
            {filteredCourses.map(course => (
              <Link key={course.id} to={`/courses/${course.id}`} className="course">
                <div style={{
                  height: "140px",
                  backgroundColor: course.category === "programming" ? "var(--accent-light)" :
                                  course.category === "design" ? "#FCE7F3" :
                                  course.category === "marketing" ? "#FEF3C7" : "#DCFCE7",
                  borderRadius: "12px 12px 0 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px"
                }}>
                  {course.category === "programming" && "💻"}
                  {course.category === "design" && "🎨"}
                  {course.category === "marketing" && "📈"}
                  {course.category === "business" && "💼"}
                  {course.category === "language" && "🌐"}
                </div>
                <div className="c-body">
                  <div className="title">{course.title}</div>
                  <div className="meta">
                    {categories.find(c => c.id === course.category)?.name} • {course.rating} ⭐ • {course.students} студентов
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <span style={{ fontWeight: "bold", color: "var(--accent)" }}>{course.price}</span>
                    <span style={{ fontSize: "14px", color: "var(--muted)" }}>{course.duration}</span>
                  </div>
                  <div style={{ fontSize: "14px", color: "var(--muted)", marginTop: "4px" }}>
                    Автор: {course.author}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Пагинация */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "32px" }}>
        <button className="btn">←</button>
        <button className="btn btn-primary">1</button>
        <button className="btn">2</button>
        <button className="btn">3</button>
        <button className="btn">→</button>
      </div>
    </div>
  );
};

export default CoursesPage;