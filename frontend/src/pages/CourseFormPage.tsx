// src/pages/CourseFormPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Типы на основе Swagger
interface Post {
  id: string;
  title: string;
  content: string;
  status: string;
  tags: string[];
  author_id: string;
  average_rating: number;
  ratings_count: number;
  created_at: string;
  updated_at: string;
}

interface CreatePostRequest {
  title: string;
  content: string;
  status?: string;
  tags?: string[];
}

interface UpdatePostRequest {
  post: {
    id: string;
    title?: string;
    content?: string;
    status?: string;
    tags?: string[];
  };
}

interface ProfileResponse {
  user: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  mentor?: {
    user_id: string;
    description: string;
    rating: number;
    created_at: string;
  };
  student?: {
    user_id: string;
    learning_goals: string;
    preferred_learning_style: string;
  };
}

const CourseFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { token, user } = useAuth();
  
  const isEditMode = !!id;
  
  const [formData, setFormData] = useState<CreatePostRequest>({
    title: '',
    content: '',
    status: 'draft',
    tags: []
  });
  
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMentor, setIsMentor] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [course, setCourse] = useState<Post | null>(null);
  const [isCourseOwner, setIsCourseOwner] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Проверяем, является ли пользователь ментором и владельцем курса (если редактирование)
  useEffect(() => {
    const initializePage = async () => {
      if (!token || !user) {
        navigate('/login', { state: { from: location.pathname } });
        return;
      }

      try {
        // 1. Получаем профиль пользователя
        const profileResponse = await fetch(`http://localhost:8080/api/v1/profiles/${user.user_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!profileResponse.ok) {
          throw new Error('Не удалось загрузить профиль пользователя');
        }

        const profileData: ProfileResponse = await profileResponse.json();
        setProfile(profileData);
        
        // Проверяем, есть ли у пользователя mentor данные
        if (profileData.mentor) {
          setIsMentor(true);
          
          // 2. Если режим редактирования, загружаем курс и проверяем владельца
          if (isEditMode) {
            const courseResponse = await fetch(`http://localhost:8080/api/v1/posts/${id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (courseResponse.ok) {
              const courseData = await courseResponse.json();
              const loadedCourse: Post = courseData.post;
              setCourse(loadedCourse);
              
              // Проверяем, является ли пользователь автором курса
              if (loadedCourse.author_id === user.user_id) {
                setIsCourseOwner(true);
                // Заполняем форму данными курса
                setFormData({
                  title: loadedCourse.title,
                  content: loadedCourse.content,
                  status: loadedCourse.status === 'archived' ? 'draft' : loadedCourse.status,
                  tags: loadedCourse.tags || []
                });
              } else {
                setError('Вы не являетесь автором этого курса');
              }
            } else {
              setError('Курс не найден');
            }
          }
        } else {
          setError('Только менторы могут создавать и редактировать курсы. Пожалуйста, обновите профиль до ментора.');
        }
      } catch (err: any) {
        console.error('Ошибка инициализации:', err);
        setError(err.message || 'Ошибка при загрузке данных');
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [token, user, navigate, id, isEditMode, location.pathname]);

  // Обработка изменения полей формы
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Добавление тега
  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  // Удаление тега
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  // Обработка отправки формы с определенным статусом
  // src/pages/CourseFormPage.tsx (исправленная часть)

// Обработка отправки формы с определенным статусом
const handleSubmit = async (status: 'draft' | 'published' | 'archived') => {
  if (!isMentor) {
    setError('Только менторы могут создавать курсы');
    return;
  }
  
  if (isEditMode && !isCourseOwner) {
    setError('Вы не являетесь автором этого курса');
    return;
  }
  
  setError(null);
  setIsSubmitting(true);

  try {
    // Валидация
    if (!formData.title.trim()) {
      throw new Error('Введите название курса');
    }
    if (!formData.content.trim()) {
      throw new Error('Введите описание курса');
    }

    let response;
    
    if (isEditMode) {
      // Редактирование существующего курса - ПРАВИЛЬНО: PUT /posts/{id}
      const updateData: UpdatePostRequest = {
        post: {
          id: id!,
          title: formData.title,
          content: formData.content,
          status: status,
          tags: formData.tags
        }
      };
      
      response = await fetch(`http://localhost:8080/api/v1/posts/${id}`, {
        method: 'PUT', // ✅ ПРАВИЛЬНЫЙ МЕТОД
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });
    } else {
      // Создание нового курса - POST /posts
      const createData: CreatePostRequest = {
        title: formData.title,
        content: formData.content,
        status: status === 'archived' ? 'draft' : status, // Невозможно сразу создать архивный курс
        tags: formData.tags
      };
      
      response = await fetch('http://localhost:8080/api/v1/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createData)
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Ошибка при ${isEditMode ? 'обновлении' : 'создании'} курса`);
    }

    const data = await response.json();
    console.log(`Курс ${status === 'draft' ? 'сохранен как черновик' : status === 'published' ? 'опубликован' : 'архивирован'}:`, data);
    
    // Редирект на страницу курса
    navigate(`/courses/${isEditMode ? id : data.post.id}`);
    
  } catch (err: any) {
    console.error('Ошибка:', err);
    setError(err.message || `Произошла ошибка при ${isEditMode ? 'обновлении' : 'создании'} курса`);
  } finally {
    setIsSubmitting(false);
    setShowArchiveConfirm(false);
  }
};

  // Удаление курса
  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот курс? Это действие нельзя отменить.')) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`http://localhost:8080/api/v1/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при удалении курса');
      }

      navigate('/courses');
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      setError(err.message || 'Произошла ошибка при удалении курса');
      setIsSubmitting(false);
    }
  };

  // Показываем загрузку
  if (isLoading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid var(--glass)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            margin: '0 auto 20px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  // Показываем сообщение об ошибке доступа
  if (!isMentor || (isEditMode && !isCourseOwner)) {
    return (
      <div className="container">
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ 
              fontSize: '48px',
              marginBottom: '20px',
              color: 'var(--muted)'
            }}>
              {!isMentor ? '🔒' : '🚫'}
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
              {!isMentor ? 'Доступ ограничен' : 'Нет прав доступа'}
            </h2>
            <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
              {error || 
                (!isMentor 
                  ? 'Только менторы могут создавать и редактировать курсы на платформе.' 
                  : 'Вы не являетесь автором этого курса.')}
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/courses')}
                className="btn btn-outline"
              >
                К курсам
              </button>
              {!isMentor && (
                <button
                  onClick={() => navigate(`/profile/${user?.user_id}/edit`)}
                  className="btn btn-primary"
                >
                  Стать ментором
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Хлебные крошки */}
        <nav style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: 'var(--muted)' }}>Главная</a>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <a href="/courses" style={{ color: 'var(--muted)' }}>Курсы</a>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--accent)' }}>
            {isEditMode ? 'Редактирование курса' : 'Создание курса'}
          </span>
        </nav>

        {/* Заголовок с информацией о менторе */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            marginBottom: '16px' 
          }}>
            {profile?.user.avatar_url ? (
              <img 
                src={profile.user.avatar_url} 
                alt="Аватар" 
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'grid',
                placeContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '20px'
              }}>
                {profile?.user.first_name?.[0]}{profile?.user.last_name?.[0]}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>
                {isEditMode ? 'Редактировать курс' : 'Создать новый курс'}
              </h1>
              <p style={{ color: 'var(--muted)' }}>
                {isEditMode 
                  ? `Вы редактируете курс как ментор: ${profile?.user.first_name} ${profile?.user.last_name}`
                  : `Вы создаете курс как ментор: ${profile?.user.first_name} ${profile?.user.last_name}`}
              </p>
            </div>
          </div>
          
          {isEditMode && course && (
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              padding: '12px',
              background: course.status === 'published' ? 'var(--accent-lightest)' : 
                        course.status === 'draft' ? '#FEF3C7' : '#F3F4F6',
              borderRadius: '10px',
              marginTop: '12px'
            }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Текущий статус:</div>
                <div style={{ 
                  fontWeight: 600,
                  color: course.status === 'published' ? 'var(--accent)' : 
                         course.status === 'draft' ? '#D97706' : '#6B7280'
                }}>
                  {course.status === 'published' ? '✅ Опубликован' : 
                   course.status === 'draft' ? '✏️ Черновик' : '📦 В архиве'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Создан:</div>
                <div>{new Date(course.created_at).toLocaleDateString('ru-RU')}</div>
              </div>
              {course.updated_at !== course.created_at && (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Обновлен:</div>
                  <div>{new Date(course.updated_at).toLocaleDateString('ru-RU')}</div>
                </div>
              )}
              {course.status === 'published' && (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Оценок:</div>
                  <div>{course.ratings_count} ({course.average_rating.toFixed(1)}★)</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Форма */}
        <div>
          {/* Карточка формы */}
          <div className="card" style={{ marginBottom: '24px' }}>
            {/* Основная информация */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                Основная информация
              </h2>
              
              {/* Название */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Название курса *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Введите название курса"
                  style={{ width: '100%' }}
                  maxLength={255}
                  required
                />
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                  {formData.title.length}/255 символов
                </div>
              </div>

              {/* Теги */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Теги
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Введите тег и нажмите Добавить"
                    style={{ flex: 1 }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="btn btn-outline"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Добавить
                  </button>
                </div>
                
                {/* Список тегов */}
                {formData.tags && formData.tags.length > 0 && (
                  <div className="chips" style={{ marginTop: '12px' }}>
                    {formData.tags.map(tag => (
                      <div 
                        key={tag} 
                        className="chip"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: '0',
                            fontSize: '18px',
                            lineHeight: 1
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Описание курса */}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
                Описание курса *
              </h2>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="Опишите ваш курс: цели, содержание, требования к студентам..."
                style={{ 
                  width: '100%', 
                  minHeight: '200px',
                  resize: 'vertical'
                }}
                required
              />
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                {formData.content.length}/10000 символов
              </div>
            </div>
          </div>

          {/* Сообщение об ошибке */}
          {error && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '24px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444'
            }}>
              {error}
            </div>
          )}

          {/* Кнопки действий */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'space-between',
            borderTop: '1px solid var(--glass)',
            paddingTop: '24px'
          }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-ghost"
                disabled={isSubmitting}
              >
                Отмена
              </button>
              
              {isEditMode && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  Удалить курс
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {isEditMode && course?.status === 'published' && (
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                  style={{ color: '#6B7280', borderColor: '#D1D5DB' }}
                >
                  📦 В архив
                </button>
              )}
              
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                className="btn btn-outline"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Сохранение...' : 
                  isEditMode ? 'Сохранить черновик' : 'Сохранить как черновик'}
              </button>
              
              <button
                type="button"
                onClick={() => handleSubmit('published')}
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Публикация...' : 
                  isEditMode ? 'Обновить и опубликовать' : 'Опубликовать курс'}
              </button>
            </div>
          </div>
        </div>

        {/* Модальное окно подтверждения архивации */}
        {showArchiveConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div className="card" style={{ 
              maxWidth: '500px',
              width: '100%',
              padding: '24px'
            }}>
              <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>
                📦
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, textAlign: 'center', marginBottom: '12px' }}>
                Отправить курс в архив?
              </h3>
              <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: '24px' }}>
                Архивный курс:
                <br />• Не будет виден в общем списке курсов
                <br />• Останется доступен только вам в разделе "Мои курсы"
                <br />• Студенты больше не смогут записываться
                <br />• Можно восстановить в любое время
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className="btn btn-ghost"
                  disabled={isSubmitting}
                  style={{ padding: '10px 20px' }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('archived')}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                  style={{ 
                    padding: '10px 20px',
                    color: '#6B7280',
                    borderColor: '#D1D5DB'
                  }}
                >
                  {isSubmitting ? 'Архивация...' : 'Да, в архив'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Информация о менторе */}
        {profile?.mentor && (
          <div className="card" style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
              👨‍🏫 Информация о менторе
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '16px',
              color: 'var(--muted)'
            }}>
              <div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>Имя:</div>
                <div style={{ fontWeight: 500 }}>
                  {profile.user.first_name} {profile.user.last_name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>Email:</div>
                <div style={{ fontWeight: 500 }}>{profile.user.email}</div>
              </div>
              {profile.mentor.description && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>Описание:</div>
                  <div>{profile.mentor.description}</div>
                </div>
              )}
              {profile.mentor.rating > 0 && (
                <div>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>Рейтинг:</div>
                  <div style={{ fontWeight: 500, color: 'var(--accent)' }}>
                    {profile.mentor.rating.toFixed(1)} ★
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Стиль для спиннера */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CourseFormPage;