// src/components/TeacherCoursesSection.tsx
import React from 'react';
import { Link } from 'react-router-dom';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  rating: number;
  thumbnail_url?: string;
  student_count: number;
}

interface TeacherCoursesSectionProps {
  courses: Course[];
  loading: boolean;
  userId: string;
  isOwner: boolean;
  onReload: () => void;
}

export const TeacherCoursesSection: React.FC<TeacherCoursesSectionProps> = ({
  courses,
  loading,
  userId,
  isOwner,
  onReload
}) => {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2>Мои курсы</h2>
        <button 
          className="btn" 
          onClick={onReload}
          disabled={loading}
          style={{ fontSize: "14px", padding: "6px 12px" }}
        >
          {loading ? "Обновление..." : "🔄 Обновить"}
        </button>
      </div>
      
      {loading ? (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p>Загрузка курсов...</p>
        </div>
      ) : courses.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
          {courses.map(course => (
            <Link 
              key={course.id} 
              to={`/courses/${course.id}`}
              className="card" 
              style={{ textDecoration: "none", padding: 12 }}
            >
              {/* ... содержимое карточки курса ... */}
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: "var(--muted)", marginBottom: 12 }}>У вас пока нет созданных курсов</p>
          {isOwner && (
            <Link to="/courses/create" className="btn btn-primary">
              Создать первый курс
            </Link>
          )}
        </div>
      )}
    </div>
  );
};