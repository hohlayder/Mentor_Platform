// src/pages/CoursePage.tsx (упрощенная версия)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Хук для управления темой (без изменений)
const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return savedTheme || 'light';
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};

// Типы (обновлены в соответствии с документацией)
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  status: string;
  tags: string[];
  average_rating?: number;
  ratings_count?: number;
  created_at: string;
  updated_at: string;
}

interface PostUpdate {
  id: string;
  title?: string;
  content?: string;
  status?: string;
  tags?: string[];
}

interface UpdatePostRequest {
  post: PostUpdate;
}

interface UpdatePostResponse {
  post: Post;
}

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

interface ProfileResponse {
  user: User;
  mentor?: {
    user_id: string;
    description?: string;
    rating?: number;
    created_at: string;
  };
  student?: {
    user_id: string;
    learning_goals?: string;
    preferred_learning_style?: string;
    created_at: string;
  };
}

interface RatePostRequest {
  rate: number;
  user_id: string;
  comment?: string;
}

// Вспомогательная функция для работы с API
const apiFetch = async <T,>(
  url: string, 
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: 'Ошибка сервера',
      error: 'Server Error',
      details: response.statusText
    }));
    
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

const CoursePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [course, setCourse] = useState<Post | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Функция для нормализации статуса
  const normalizeStatus = (status: string): 'published' | 'draft' | 'archived' => {
    if (!status) return 'draft';
    
    const normalized = status.toLowerCase().trim();
    
    if (normalized.includes('publish') || normalized === 'опубликован') {
      return 'published';
    }
    
    if (normalized.includes('draft') || normalized === 'черновик') {
      return 'draft';
    }
    
    if (normalized.includes('archive') || normalized === 'архив') {
      return 'archived';
    }
    
    return 'draft';
  };

  // Функция для получения информации о статусе
  const getStatusInfo = (status: string) => {
    const normalizedStatus = normalizeStatus(status);
    
    switch (normalizedStatus) {
      case 'published':
        return {
          text: 'Опубликован',
          display: 'Опубликован',
          color: 'var(--accent)',
          emoji: '✅',
          canArchive: true,
          canPublish: false
        };
      case 'draft':
        return {
          text: 'Черновик',
          display: 'Черновик',
          color: 'var(--muted)',
          emoji: '✏️',
          canArchive: true,
          canPublish: true
        };
      case 'archived':
        return {
          text: 'В архиве',
          display: 'В архиве',
          color: '#6b7280',
          emoji: '📦',
          canArchive: false,
          canPublish: true
        };
      default:
        return {
          text: status,
          display: status,
          color: '#ef4444',
          emoji: '❓',
          canArchive: false,
          canPublish: false
        };
    }
  };

  // ========== ЗАГРУЗКА ДАННЫХ ==========
  useEffect(() => {
    if (!id) {
      navigate('/courses');
      return;
    }

    const loadCourse = async () => {
      setLoading(true);
      setError(null);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // 1. Загружаем курс по документации: GET /posts/{id}
        const courseData = await apiFetch<{ post: Post }>(
          `http://localhost:8080/api/v1/posts/${id}`,
          { headers }
        );
        
        const loadedCourse = courseData.post;
        setCourse(loadedCourse);

        // 2. Загружаем информацию об авторе по документации: GET /users/{id}
        try {
          const authorData = await apiFetch<User>(
            `http://localhost:8080/api/v1/users/${loadedCourse.author_id}`,
            { headers }
          );
          setAuthor(authorData);
        } catch (err) {
          console.warn('Не удалось загрузить информацию об авторе:', err);
        }

        // 3. Загружаем профиль автора по документации: GET /profiles/{id}
        try {
          const profileData = await apiFetch<ProfileResponse>(
            `http://localhost:8080/api/v1/profiles/${loadedCourse.author_id}`,
            { headers }
          );
          setProfile(profileData);
        } catch (err) {
          console.warn('Не удалось загрузить профиль автора:', err);
        }

      } catch (err: any) {
        console.error('Ошибка загрузки курса:', err);
        setError(err.message || 'Ошибка загрузки курса');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id, token, navigate]);

  // Проверяем, является ли пользователь автором курса
  const isAuthor = user?.user_id === course?.author_id;
  const canEdit = isAuthor && token;
  const canRate = !isAuthor && token;
  const statusInfo = course ? getStatusInfo(course.status) : getStatusInfo('');

  // Функции для работы с курсом
  const updateCourseStatus = async (newStatus: 'draft' | 'published' | 'archived') => {
    if (!token || !course) return;

    const action = newStatus === 'archived' ? 'архивации' : 
                   newStatus === 'published' ? 'публикации' : 'перевода в черновик';
    
    if (!window.confirm(`Вы уверены, что хотите ${action} курс "${course.title}"?`)) {
      return;
    }

    try {
      const data = await apiFetch<UpdatePostResponse>(
        `http://localhost:8080/api/v1/posts/${course.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            post: {
              id: course.id,
              status: newStatus
            }
          } as UpdatePostRequest)
        }
      );

      setCourse(data.post);
      
      const successMessage = newStatus === 'archived' ? 'Курс перемещен в архив' :
                             newStatus === 'published' ? 'Курс опубликован' : 
                             'Курс переведен в черновик';
      alert(`✅ ${successMessage}!`);
    } catch (err: any) {
      console.error(`Ошибка ${action} курса:`, err);
      setError(err.message || `Не удалось ${action} курс`);
    }
  };

  const submitRating = async () => {
    if (!token || !user || !course || rating < 1 || rating > 5) return;

    setSubmittingRating(true);
    try {
      const data = await apiFetch<{ post: Post }>(
        `http://localhost:8080/api/v1/posts/${course.id}/rate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rate: rating,
            user_id: user.user_id,
            comment: review.trim() || undefined
          } as RatePostRequest)
        }
      );

      setCourse(data.post);
      setRating(0);
      setReview('');
      setActiveTab('reviews');
    } catch (err: any) {
      console.error('Ошибка оценки курса:', err);
      setError(err.message || 'Не удалось оценить курс');
    } finally {
      setSubmittingRating(false);
    }
  };

  const deleteCourse = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот курс? Это действие нельзя отменить.')) {
      return;
    }

    if (!token || !course) return;

    try {
      await apiFetch(
        `http://localhost:8080/api/v1/posts/${course.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      navigate('/courses');
    } catch (err: any) {
      console.error('Ошибка удаления курса:', err);
      setError(err.message || 'Не удалось удалить курс');
    }
  };

  const handleLogout = () => {
    logout();
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Генерация тегов
  const renderTags = () => {
    if (!course?.tags || course.tags.length === 0) return null;
    
    return (
      <div className="chips" style={{ marginTop: '12px' }}>
        {course.tags.map(tag => (
          <span key={tag} className="chip" style={{ fontSize: '13px' }}>
            #{tag}
          </span>
        ))}
      </div>
    );
  };

  // Рейтинг звездами
  const renderStars = (rating?: number) => {
    if (!rating) return 'Нет оценок';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {'★'.repeat(fullStars)}
        {hasHalfStar && '½'}
        {'☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0))}
        <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 600 }}>
          {rating.toFixed(1)}
        </span>
        {course?.ratings_count && (
          <span style={{ marginLeft: '4px', fontSize: '13px', color: 'var(--muted)' }}>
            ({course.ratings_count})
          </span>
        )}
      </div>
    );
  };

  // ========== ФУНКЦИЯ ЗАПИСИ НА КУРС ==========
  const handleEnroll = () => {
    // Если пользователь не авторизован, перенаправляем на страницу входа
    if (!token) {
      navigate('/login', { state: { returnTo: `/course/${id}` } });
      return;
    }
    
    // Если пользователь является автором курса (ментором)
    if (isAuthor) {
      alert('Вы являетесь автором этого курса. Создайте слоты для студентов на отдельной странице');
      return;
    }
    
    // Если пользователь студент, перенаправляем на страницу записи
    navigate(`/course/${id}/enroll`);
  };

  // ========== РЕНДЕРИНГ ==========
  if (loading) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        {/* Header */}
        <header className="header" style={{ padding: '12px 0' }}>
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
        
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: '3px solid var(--glass)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            margin: '0 auto 20px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'var(--muted)' }}>Загрузка курса...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        {/* Header */}
        <header className="header" style={{ padding: '12px 0' }}>
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
        
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>😞</div>
          <h3 style={{ margin: '0 0 12px 0' }}>Ошибка</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            {error || 'Курс не найден'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/courses')}
            >
              К списку курсов
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate(-1)}
            >
              Назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
      {/* Header */}
      <header className="header" style={{ padding: '12px 0' }}>
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

      {/* Хлебные крошки */}
      <nav style={{ margin: '24px 0', fontSize: '14px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <Link to="/courses" style={{ color: 'var(--muted)' }}>Курсы</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>{course.title}</span>
      </nav>

      {/* Hero секция курса */}
      <div className="hero" style={{ 
        flexDirection: 'row', 
        alignItems: 'flex-start', 
        gap: '32px',
        marginBottom: '32px'
      }}>
        {/* Изображение курса */}
        <div style={{ 
          width: '350px', 
          height: '200px', 
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          display: 'grid',
          placeContent: 'center',
          color: '#fff',
          fontSize: '48px',
          fontWeight: 700,
          flexShrink: 0
        }}>
          {course.title[0]}
        </div>

        {/* Информация о курсе */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 700 }}>
                {course.title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span className="chip" style={{ 
                  background: statusInfo.color,
                  color: '#fff',
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>{statusInfo.emoji}</span>
                  <span>{statusInfo.display}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderStars(course.average_rating)}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                  Обновлен: {formatDate(course.updated_at)}
                </div>
              </div>
            </div>

            {/* Кнопки действий */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {canEdit && (
                <>
                  {/* Кнопки изменения статуса */}
                  {statusInfo.canArchive && (
                    <button 
                      className="btn btn-ghost"
                      onClick={() => updateCourseStatus('archived')}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 16px',
                        color: '#f59e0b',
                        borderColor: 'rgba(245, 158, 11, 0.2)'
                      }}
                      title="Переместить в архив"
                    >
                      📦 В архив
                    </button>
                  )}
                  
                  {statusInfo.canPublish && normalizeStatus(course.status) === 'archived' && (
                    <button 
                      className="btn btn-ghost"
                      onClick={() => updateCourseStatus('published')}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 16px',
                        color: '#10b981',
                        borderColor: 'rgba(16, 185, 129, 0.2)'
                      }}
                      title="Опубликовать из архива"
                    >
                      ✅ Опубликовать
                    </button>
                  )}
                  
                  {statusInfo.canPublish && normalizeStatus(course.status) === 'draft' && (
                    <button 
                      className="btn btn-ghost"
                      onClick={() => updateCourseStatus('published')}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 16px',
                        color: '#10b981',
                        borderColor: 'rgba(16, 185, 129, 0.2)'
                      }}
                      title="Опубликовать черновик"
                    >
                      📢 Опубликовать
                    </button>
                  )}
                  
                  {statusInfo.canPublish && normalizeStatus(course.status) === 'published' && (
                    <button 
                      className="btn btn-ghost"
                      onClick={() => updateCourseStatus('draft')}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 16px',
                        color: '#6b7280',
                        borderColor: 'rgba(107, 114, 128, 0.2)'
                      }}
                      title="Вернуть в черновик"
                    >
                      ✏️ В черновик
                    </button>
                  )}
                  
                  {/* Кнопка создания слотов (только для автора) */}
                  {isAuthor && (
                    <button 
                      className="btn btn-outline"
                      onClick={() => navigate(`/course/${id}/create-slots`, { 
                        state: { 
                          courseTitle: course.title,
                          authorId: course.author_id 
                        } 
                      })}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        border: 'none',
                        color: '#fff'
                      }}
                    >
                      📅 Создать слоты
                    </button>
                  )}
                  
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate(`/course/edit/${course.id}`)}
                    style={{ fontSize: '14px', padding: '8px 16px' }}
                  >
                    Редактировать
                  </button>
                  
                  <button 
                    className="btn btn-ghost"
                    onClick={deleteCourse}
                    style={{ color: '#ef4444', fontSize: '14px', padding: '8px 16px' }}
                  >
                    Удалить
                  </button>
                </>
              )}
              
              {/* Кнопка записи на курс для не-авторов */}
              {!isAuthor && (
                <button 
                  className="btn btn-primary"
                  onClick={handleEnroll}
                  style={{ 
                    fontSize: '14px', 
                    padding: '8px 20px',
                    background: 'linear-gradient(135deg, var(--accent-2), #10b981)'
                  }}
                >
                  🎓 Записаться на курс
                </button>
              )}
            </div>
          </div>

          <p className="lead" style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            {course.content.length > 200 
              ? `${course.content.substring(0, 200)}...` 
              : course.content}
          </p>

          {renderTags()}
        </div>
      </div>

      {/* Информация о менторе */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Автор Курса</h2>
        {author ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%',
                overflow: 'hidden',
                background: author.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'grid',
                placeContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '20px',
                flexShrink: 0
              }}>
                {author.avatar_url ? (
                  <img 
                    src={author.avatar_url} 
                    alt={author.first_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{author.first_name?.[0]}{author.last_name?.[0]}</span>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>
                    {author.first_name} {author.last_name}
                  </h3>
                  {profile?.mentor?.rating && (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '14px',
                      color: 'var(--accent)',
                      fontWeight: 600
                    }}>
                      ⭐ {profile.mentor.rating.toFixed(1)}
                    </span>
                  )}
                  {profile?.mentor && (
                    <span className="chip" style={{ 
                      background: 'rgba(79, 70, 229, 0.1)',
                      color: 'var(--accent)',
                      fontSize: '12px'
                    }}>
                      Преподаватель
                    </span>
                  )}
                </div>
                
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
                  {author.email}
                </div>
                
                {profile?.mentor?.description && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: 1.5 }}>
                    {profile.mentor.description}
                  </p>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button 
                  className="btn btn-outline"
                  onClick={() => navigate(`/profile/${author.user_id}`)}
                  style={{ fontSize: '14px' }}
                >
                  Профиль
                </button>
                {user?.user_id !== author.user_id && token && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate(`/chats?mentor=${author.user_id}`)}
                    style={{ fontSize: '14px' }}
                  >
                    Написать
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: 'var(--muted)', margin: 0 }}>Информация о менторе недоступна</p>
          </div>
        )}
      </div>

      {/* Табы с содержанием курса */}
      <div style={{ marginBottom: '32px' }}>
        {/* Навигация табов */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '20px',
          borderBottom: '1px solid var(--glass)',
          paddingBottom: '8px',
          overflowX: 'auto'
        }}>
          <button
            className={`btn ${activeTab === 'description' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('description')}
            style={{ whiteSpace: 'nowrap', fontSize: '14px', padding: '10px 16px' }}
          >
            📖 Описание
          </button>
          <button
            className={`btn ${activeTab === 'reviews' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('reviews')}
            style={{ whiteSpace: 'nowrap', fontSize: '14px', padding: '10px 16px' }}
          >
            ⭐ Отзывы ({course.ratings_count || 0})
          </button>
        </div>

        {/* Контент табов */}
        <div className="card" style={{ minHeight: '300px', padding: '24px' }}>
          {activeTab === 'description' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Подробное описание курса</h3>
              <div style={{ 
                fontSize: '16px', 
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap'
              }}>
                {course.content}
              </div>
              
              {renderTags()}
              
              <div style={{ 
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid var(--glass)',
                fontSize: '14px',
                color: 'var(--muted)'
              }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Статус курса</div>
                    <div>{normalizeStatus(course.status) === 'published' ? 'Доступен для записи' : 
                           normalizeStatus(course.status) === 'draft' ? 'В разработке' : 'Архивирован'}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Создан</div>
                    <div>{formatDate(course.created_at)}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Обновлен</div>
                    <div>{formatDate(course.updated_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Отзывы о курсе</h3>
              
              {/* Форма оценки */}
              {canRate && (
                <div className="card" style={{ 
                  marginBottom: '24px',
                  background: 'var(--glass)',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Оставьте свой отзыв</h4>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ marginBottom: '8px', fontWeight: 500 }}>Ваша оценка:</div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          style={{
                            fontSize: '24px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: star <= rating ? 'var(--accent)' : 'var(--glass)',
                            padding: '0',
                            lineHeight: 1
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <textarea
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      placeholder="Расскажите о своем опыте обучения..."
                      style={{ 
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass)',
                        background: 'transparent',
                        color: 'var(--text)',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  <button
                    className="btn btn-primary"
                    onClick={submitRating}
                    disabled={submittingRating || rating < 1}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    {submittingRating ? 'Отправка...' : 'Опубликовать отзыв'}
                  </button>
                </div>
              )}
              
              {/* Список отзывов */}
              <div>
                {course.ratings_count && course.ratings_count > 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⭐</div>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '18px' }}>
                      Средняя оценка: {course.average_rating?.toFixed(1)}/5
                    </h4>
                    <p>На основе {course.ratings_count} отзывов</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '18px' }}>Пока нет отзывов</h4>
                    <p>Будьте первым, кто оставит отзыв об этом курсе</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className="card" style={{ marginBottom: '32px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>📋 Дополнительная информация</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '24px'
        }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              Автор курса
            </div>
            <div style={{ fontWeight: 600 }}>
              {author ? `${author.first_name} ${author.last_name}` : 'Неизвестно'}
              {profile?.mentor && ' (Преподаватель)'}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              Дата создания
            </div>
            <div style={{ fontWeight: 600 }}>{formatDate(course.created_at)}</div>
          </div>
          
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              Статус
            </div>
            <div style={{ fontWeight: 600 }}>
              {normalizeStatus(course.status) === 'published' ? 'Открыт для записи' :
               normalizeStatus(course.status) === 'draft' ? 'Черновик' : 'Архивирован'}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              Рейтинг
            </div>
            <div style={{ fontWeight: 600 }}>
              {course.average_rating ? `${course.average_rating.toFixed(1)}/5` : 'Нет оценок'}
              {course.ratings_count && ` (${course.ratings_count} оценок)`}
            </div>
          </div>
        </div>
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div className="card" style={{ 
          marginBottom: '24px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          padding: '16px'
        }}>
          {error}
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CoursePage;