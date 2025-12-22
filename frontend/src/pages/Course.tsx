// src/pages/CoursePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Типы на основе Swagger
interface Post {
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

interface ProfileResponse {
  user: User;
  mentor?: {
    user_id: string;
    description?: string;
    rating?: number;
    created_at: string;
  };
}

interface RatePostRequest {
  rate: number;
  user_id: string;
  comment?: string;
}

const CoursePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [course, setCourse] = useState<Post | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [mentorProfile, setMentorProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'curriculum'>('description');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Загрузка курса и информации об авторе
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

        // 1. Загружаем курс
        const courseResponse = await fetch(`http://localhost:8080/api/v1/posts/${id}`, { headers });
        
        if (!courseResponse.ok) {
          if (courseResponse.status === 404) {
            throw new Error('Курс не найден');
          }
          throw new Error('Не удалось загрузить курс');
        }

        const courseData = await courseResponse.json();
        const loadedCourse: Post = courseData.post;
        setCourse(loadedCourse);

        // 2. Загружаем информацию об авторе
        const authorResponse = await fetch(`http://localhost:8080/api/v1/users/${loadedCourse.author_id}`, { headers });
        
        if (authorResponse.ok) {
          const authorData: User = await authorResponse.json();
          setAuthor(authorData);
        }

        // 3. Загружаем профиль ментора (если есть)
        const profileResponse = await fetch(`http://localhost:8080/api/v1/profiles/${loadedCourse.author_id}`, { headers });
        
        if (profileResponse.ok) {
          const profileData: ProfileResponse = await profileResponse.json();
          setMentorProfile(profileData);
        }

        // 4. Проверяем, записан ли пользователь на курс
        // TODO: Добавить проверку через API, когда будет endpoint
        // Пока предполагаем, что пользователь не записан
        setIsEnrolled(false);

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
  const canRate = !isAuthor && token && isEnrolled;
  const canEnroll = !isAuthor && token && !isEnrolled && course?.status === 'published';

  // Оценка курса
  const submitRating = async () => {
    if (!token || !user || !course || rating < 1 || rating > 5) return;

    setSubmittingRating(true);
    try {
      const response = await fetch(`http://localhost:8080/api/v1/posts/${course.id}/rate`, {
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
      });

      if (response.ok) {
        const data = await response.json();
        setCourse(data.post);
        setRating(0);
        setReview('');
        setActiveTab('reviews');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при оценке курса');
      }
    } catch (err: any) {
      console.error('Ошибка оценки курса:', err);
      setError(err.message || 'Не удалось оценить курс');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Запись на курс
  const enrollInCourse = async () => {
    if (!token || !course) return;

    // TODO: Реализовать запись на курс через API
    // Пока просто меняем состояние
    setIsEnrolled(true);
    
    // В реальности здесь был бы запрос к API:
    // await fetch('/api/enroll', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${token}` },
    //   body: JSON.stringify({ course_id: course.id })
    // });
    
    alert(`Вы успешно записались на курс "${course.title}"!`);
  };

  // Удаление курса
  const deleteCourse = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот курс? Это действие нельзя отменить.')) {
      return;
    }

    if (!token || !course) return;

    try {
      const response = await fetch(`http://localhost:8080/api/v1/posts/${course.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        navigate('/courses');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при удалении курса');
      }
    } catch (err: any) {
      console.error('Ошибка удаления курса:', err);
      setError(err.message || 'Не удалось удалить курс');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite'
          }}>
            <span>📚</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Загрузка курса...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ margin: '0 auto 20px', background: '#ef4444' }}>
            <span>⚠️</span>
          </div>
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
    if (!course.tags || course.tags.length === 0) return null;
    
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
        {course.ratings_count && (
          <span style={{ marginLeft: '4px', fontSize: '13px', color: 'var(--muted)' }}>
            ({course.ratings_count})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      {/* Хлебные крошки */}
      <nav style={{ marginBottom: '24px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <Link to="/courses" style={{ color: 'var(--muted)' }}>Курсы</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>{course.title}</span>
      </nav>

      {/* Hero секция курса */}
      <div className="hero" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '32px' }}>
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
                  background: course.status === 'published' ? 'var(--accent)' : 
                             course.status === 'draft' ? 'var(--muted)' : '#6b7280',
                  color: '#fff'
                }}>
                  {course.status === 'published' ? 'Опубликован' : 
                   course.status === 'draft' ? 'Черновик' : 'В архиве'}
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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {canEdit && (
                <>
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate(`/course/edit/${course.id}`)}
                  >
                    Редактировать
                  </button>
                  <button 
                    className="btn btn-ghost"
                    onClick={deleteCourse}
                    style={{ color: '#ef4444' }}
                  >
                    Удалить
                  </button>
                </>
              )}
              
              {canEnroll && (
                <button 
                  className="btn btn-primary"
                  onClick={enrollInCourse}
                >
                  Записаться на курс
                </button>
              )}
              
              {isEnrolled && (
                <button 
                  className="btn btn-outline"
                  disabled
                  style={{ cursor: 'default' }}
                >
                  Вы записаны ✓
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
        <h2 style={{ margin: '0 0 16px 0' }}>👨‍🏫 Ментор</h2>
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
                  {mentorProfile?.mentor?.rating && (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '14px',
                      color: 'var(--accent)',
                      fontWeight: 600
                    }}>
                      ⭐ {mentorProfile.mentor.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
                  {author.email}
                </div>
                
                {mentorProfile?.mentor?.description && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: 1.5 }}>
                    {mentorProfile.mentor.description}
                  </p>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button 
                  className="btn btn-outline"
                  onClick={() => navigate(`/profile/${author.user_id}`)}
                >
                  Профиль
                </button>
                {user?.user_id !== author.user_id && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      // Создать чат с ментором
                      navigate(`/chats?mentor=${author.user_id}`);
                    }}
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
            style={{ whiteSpace: 'nowrap' }}
          >
            📖 Описание
          </button>
          <button
            className={`btn ${activeTab === 'curriculum' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('curriculum')}
            style={{ whiteSpace: 'nowrap' }}
          >
            📚 Учебный план
          </button>
          <button
            className={`btn ${activeTab === 'reviews' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('reviews')}
            style={{ whiteSpace: 'nowrap' }}
          >
            ⭐ Отзывы ({course.ratings_count || 0})
          </button>
        </div>

        {/* Контент табов */}
        <div className="card" style={{ minHeight: '200px' }}>
          {activeTab === 'description' && (
            <div>
              <h3 style={{ margin: '0 0 16px 0' }}>Подробное описание курса</h3>
              <div style={{ 
                fontSize: '16px', 
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap'
              }}>
                {course.content}
              </div>
              
              {renderTags()}
              
              <div style={{ 
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--glass)',
                fontSize: '14px',
                color: 'var(--muted)'
              }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Статус курса</div>
                    <div>{course.status === 'published' ? 'Доступен для записи' : 
                           course.status === 'draft' ? 'В разработке' : 'Архивирован'}</div>
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

          {activeTab === 'curriculum' && (
            <div>
              <h3 style={{ margin: '0 0 16px 0' }}>Учебный план</h3>
              <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
                {isEnrolled 
                  ? 'Начните обучение с первого урока'
                  : 'Запишитесь на курс, чтобы увидеть детальный учебный план'}
              </p>
              
              <div style={{ 
                padding: '16px',
                background: 'var(--glass)',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px',
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'grid',
                    placeContent: 'center',
                    fontWeight: 600
                  }}>
                    1
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Введение в курс</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Основные концепции и цели курса</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px',
                    background: 'var(--glass)',
                    color: 'var(--text)',
                    display: 'grid',
                    placeContent: 'center',
                    fontWeight: 600
                  }}>
                    2
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Основы предмета</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Фундаментальные знания</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px',
                    background: 'var(--glass)',
                    color: 'var(--text)',
                    display: 'grid',
                    placeContent: 'center',
                    fontWeight: 600
                  }}>
                    3
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Практические задания</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Применение знаний на практике</div>
                  </div>
                </div>
              </div>
              
              {!isEnrolled && (
                <button 
                  className="btn btn-primary"
                  onClick={enrollInCourse}
                  disabled={!canEnroll}
                >
                  Записаться, чтобы увидеть полный план
                </button>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              <h3 style={{ margin: '0 0 16px 0' }}>Отзывы о курсе</h3>
              
              {/* Форма оценки (только для записавшихся пользователей) */}
              {canRate && (
                <div className="card" style={{ 
                  marginBottom: '24px',
                  background: 'var(--glass)'
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
                    style={{ width: '100%' }}
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
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)' }}>
                      Средняя оценка: {course.average_rating?.toFixed(1)}/5
                    </h4>
                    <p>На основе {course.ratings_count} отзывов</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)' }}>Пока нет отзывов</h4>
                    <p>Будьте первым, кто оставит отзыв об этом курсе</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📋 Дополнительная информация</h3>
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
              {course.status === 'published' ? 'Открыт для записи' :
               course.status === 'draft' ? 'Черновик' : 'Архивирован'}
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
          color: '#ef4444'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default CoursePage;