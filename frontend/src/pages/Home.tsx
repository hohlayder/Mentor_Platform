import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import placeholderImg from "../assets/placeholder.svg";

// Типы на основе Swagger
interface Course {
  id: string;
  title: string;
  content: string;
  author_id: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  average_rating?: number;
  ratings_count?: number;
  created_at: string;
  updated_at: string;
}

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

export const Home: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState({
    courses: true,
    teachers: true
  });
  const [error, setError] = useState<string | null>(null);

  const { token, user, logout } = useAuth();

  // При монтировании читаем тему из localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);
    document.body.dataset.theme = savedTheme ?? "light";
  }, []);

  // Загружаем курсы
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const params = new URLSearchParams({
          status: 'published',
          page_size: '6',
          sort_field: 'created_at',
          sort_order: 'desc'
        });

        const response = await fetch(`http://localhost:8080/api/v1/posts?${params}`);
        
        if (!response.ok) {
          throw new Error(`Ошибка загрузки курсов: ${response.status}`);
        }

        const data = await response.json();
        setCourses(data.posts || []);
      } catch (err: any) {
        console.error('Ошибка загрузки курсов:', err);
        setError('Не удалось загрузить курсы');
      } finally {
        setLoading(prev => ({ ...prev, courses: false }));
      }
    };

    fetchCourses();
  }, []);

  // Загружаем менторов (пользователей с ролью ментора)
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        // Поскольку в API нет прямого эндпоинта для менторов,
        // мы можем получить несколько пользователей или сделать по-другому
        // Для примера возьмем авторов опубликованных курсов
        const uniqueAuthorIds = [...new Set(courses.map(course => course.author_id))];
        
        if (uniqueAuthorIds.length > 0) {
          // Загружаем информацию о первых 6 авторах
          const teachersPromises = uniqueAuthorIds.slice(0, 6).map(async (authorId) => {
            const response = await fetch(`http://localhost:8080/api/v1/users/${authorId}`);
            if (response.ok) {
              return await response.json();
            }
            return null;
          });

          const teachersData = await Promise.all(teachersPromises);
          setTeachers(teachersData.filter(Boolean));
        }
      } catch (err: any) {
        console.error('Ошибка загрузки менторов:', err);
      } finally {
        setLoading(prev => ({ ...prev, teachers: false }));
      }
    };

    if (courses.length > 0) {
      fetchTeachers();
    } else {
      setLoading(prev => ({ ...prev, teachers: false }));
    }
  }, [courses]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.body.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Ошибка при выходе:', err);
    }
  };

  // Функция для форматирования даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Функция для получения рейтинга в виде звезд
  const renderRating = (rating?: number) => {
    if (!rating) return 'Нет оценок';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <span>
        {'★'.repeat(fullStars)}
        {hasHalfStar && '½'}
        {'☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0))}
        <span style={{ marginLeft: '4px' }}>{rating.toFixed(1)}</span>
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="header">
        <Link to="/" className="brand">
          <div className="logo">M</div>Mentor Fellowship
        </Link>
        <div className="header-nav">
          <button onClick={toggleTheme} className="btn btn-ghost">
            {theme === 'light' ? '🌙' : '☀️'} Тема
          </button>
          {token && user ? (
            <>
              <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">
                {user.first_name || 'Профиль'}
              </Link>
              <button onClick={handleLogout} className="btn btn-ghost">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Войти</Link>
              <Link to="/signup" className="btn btn-primary">Регистрация</Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container">
        {/* Hero Section */}
        <div className="hero">
          <div className="hero-left">
            <h1>Добро пожаловать в Mentor Fellowship</h1>
            <p className="lead">
              {user 
                ? `Привет, ${user.first_name}! Развивайтесь вместе с нами.\n` 
                : 'Платформа для обучения и преподавания. Найдите своего ментора или станьте им.\n\n'
              }
            </p>
            {user ? (
              <Link to={`/profile/${user.user_id}`} className="btn btn-primary">
                Перейти в профиль
              </Link>
            ) : (
              <Link to="/signup" className="btn btn-primary">
                Начать пользоваться
              </Link>
            )}
          </div>
          <img
            src={placeholderImg}
            alt="Hero"
            style={{ width: 400, height: 250, borderRadius: 12 }}
          />
        </div>

        {/* Top Courses */}
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>Популярные курсы</h2>
            <Link to="/courses" className="btn btn-ghost">Все курсы →</Link>
          </div>
          
          {loading.courses ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="logo" style={{ margin: '0 auto', animation: 'pulse 1.5s infinite' }}>
                <span>⏳</span>
              </div>
              <p style={{ color: 'var(--muted)' }}>Загрузка курсов...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <p>{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="btn btn-ghost"
                style={{ marginTop: '10px' }}
              >
                Попробовать снова
              </button>
            </div>
          ) : courses.length > 0 ? (
            <div className="courses-grid">
              {courses.map((course) => (
                <Link 
                  key={course.id} 
                  to={`/courses/${course.id}`}
                  className="course"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="thumb"
                    style={{
                      background: `linear-gradient(135deg, var(--accent), var(--accent-2))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '24px'
                    }}
                  >
                    {course.title[0]}
                  </div>
                  <div className="c-body">
                    <div className="title">{course.title}</div>
                    <div className="meta" style={{ marginBottom: '8px' }}>
                      {course.tags.slice(0, 3).map(tag => `#${tag}`).join(' ')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="meta">
                        {renderRating(course.average_rating)}
                      </span>
                      <span className="meta" style={{ fontSize: '12px' }}>
                        {formatDate(course.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <p>Пока нет доступных курсов</p>
              {token && (
                <Link to="/courses/new" className="btn btn-primary" style={{ marginTop: '10px' }}>
                  Создать первый курс
                </Link>
              )}
            </div>
          )}
        </div>


        {/* Статистика для зарегистрированных пользователей */}
        {token && user && (
          <div className="section card" style={{ background: 'var(--surface)', padding: '20px' }}>
            <h3>Ваша активность</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '16px',
              marginTop: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {courses.filter(c => c.author_id === user.user_id).length}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Ваших курсов</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-2)' }}>
                  {courses.filter(c => c.author_id === user.user_id).length}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Изучаете курсов</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {new Date().getFullYear() - new Date(user.created_at).getFullYear()}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Лет с нами</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-stats">
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{courses.length}</div>
              <div>Курсов на сайте</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{teachers.length}</div>
              <div>Активных менторов</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Долбанный бекенд</div>
              <div>Пользователей</div>
            </div>
          </div>
          <div className="footer-grid">
            <div>
              <h4>Полезные ссылки</h4>
              <Link to="/">Главная страница</Link>
              <Link to="/courses">Поиск курсов</Link>
              <Link to="/profile">Профиль</Link>
              <Link to="/notifications">Уведомления</Link>
            </div>
            <div>
              <h4>Топ категории</h4>
              {courses.length > 0 && (
                <>
                  {Array.from(new Set(courses.flatMap(c => c.tags)))
                    .slice(0, 3)
                    .map(tag => (
                      <a key={tag} href={`/courses?tags=${tag}`}>#{tag}</a>
                    ))}
                </>
              )}
            </div>
            <div>
              <h4>Поддержка</h4>
              <a href="#">Частые вопросы</a>
              <a href="#">Связаться с нами</a>
            </div>
            <div className="socials">
              <div>VK</div>
              <div>Tg</div>
              <div>X</div>
              <div>Max</div>
            </div>
          </div>
          <div style={{ 
            marginTop: '20px', 
            paddingTop: '20px', 
            borderTop: '1px solid var(--glass)',
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '14px'
          }}>
            © 2025 Mentor Fellowship. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;