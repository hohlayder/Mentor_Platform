import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import axios from 'axios'
import { API_BASE } from '../api/axios'

// Типы
interface User {
  user_id: string
  email: string
  first_name: string
  last_name: string
  avatar_url?: string
  created_at: string
}

interface MentorProfile {
  user_id: string
  description?: string
  rating?: number
  withdrawal_address?: string
  created_at: string
}

interface StudentProfile {
  user_id: string
  learning_goals?: string
  preferred_learning_style?: string
  created_at: string
}

interface TeachingSkill {
  skill_id: string
  skill_name: string
  proficiency_level: string
  years_of_experience?: number
  user_id: string
  created_at: string
}

interface LearningSkill {
  skill_id: string
  skill_name: string
  proficiency_level: string
  user_id: string
  created_at: string
}

interface ProfileResponse {
  user: User
  mentor?: MentorProfile
  student?: StudentProfile
  teaching_skills?: TeachingSkill[]
  learning_skills?: LearningSkill[]
}

interface Post {
  id: string
  title: string
  content: string
  author_id: string
  status: 'draft' | 'published' | 'archived'
  tags: string[]
  average_rating?: number
  ratings_count?: number
  created_at: string
  updated_at: string
}

const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuth()

  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [mentorCourses, setMentorCourses] = useState<Post[]>([])
  const [studentCourses, setStudentCourses] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'mentor' | 'student'>('mentor')
  const [redirectAttempted, setRedirectAttempted] = useState(false)

  // Проверяем, находится ли пользователь на маршруте /profile без ID
  const isProfileRoot = location.pathname === '/profile' || location.pathname === '/profile/'

  console.log('👤 ProfilePage - Состояние AuthContext:', {
    token: token ? 'Есть' : 'Нет',
    user: user ? user.email : 'Нет',
    userId: user?.user_id
  })

  // ПРОСТАЯ логика редиректа - только один раз
  useEffect(() => {
    if (isProfileRoot) {
      console.log('👤 Находимся на /profile')
      
      if (token && user?.user_id) {
        // Есть токен и пользователь - редирект на свой профиль
        console.log(`👤 Редирект на /profile/${user.user_id}`)
        navigate(`/profile/${user.user_id}`, { replace: true })
      } else {
        // Нет токена или пользователя - на логин
        console.log('👤 Нет данных для редиректа, идем на /login')
        navigate('/login', { replace: true })
      }
    }
  }, [isProfileRoot, token, user, navigate])

  // Загрузка профиля (если есть ID в URL)
  useEffect(() => {
    if (!id || isProfileRoot) {
      return
    }

    console.log('👤 Loading profile for ID:', id)

    const loadProfile = async () => {
      setLoading(true)
      setError(null)

      try {
        // Подготавливаем заголовки
        const headers: Record<string, string> = {}
        
        // Всегда используем токен из sessionStorage для надежности
        const currentToken = token || sessionStorage.getItem('access_token')
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`
        }

        console.log('👤 Loading profile with token:', !!currentToken)
        
        // Загружаем профиль
        const profileResponse = await axios.get<ProfileResponse>(
          `${API_BASE}/profiles/${id}`,
          { 
            headers,
            timeout: 10000 // 10 секунд таймаут
          }
        )
        
        console.log('👤 Profile loaded:', profileResponse.data.user.email)
        setProfile(profileResponse.data)

        // Загружаем курсы ментора
        if (profileResponse.data.mentor) {
          try {
            console.log('👤 Loading mentor courses...')
            const coursesResponse = await axios.get<{ posts: Post[]; total_count: number }>(
              `${API_BASE}/posts`,
              {
                headers,
                params: {
                  author_id: id,
                  status: 'published',
                  page_size: 20
                },
                timeout: 10000
              }
            )
            setMentorCourses(coursesResponse.data.posts)
            console.log('👤 Mentor courses loaded:', coursesResponse.data.posts.length)
          } catch (courseErr) {
            console.error('👤 Error loading courses:', courseErr)
            setMentorCourses([])
          }
        }

        // TODO: Загрузить курсы студента
        setStudentCourses([])

      } catch (err: any) {
        console.error('👤 Profile load error:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message
        })
        
        if (err.response?.status === 401) {
          setError('Требуется авторизация')
        } else if (err.response?.status === 404) {
          setError('Профиль не найден')
        } else if (err.code === 'ECONNABORTED') {
          setError('Время ожидания истекло. Проверьте подключение к интернету.')
        } else {
          setError(err.response?.data?.message || 'Ошибка загрузки профиля')
        }
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [id, token, isProfileRoot])

  // Если на /profile и редирект не сработал, показываем загрузку
  if (isProfileRoot) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))'
          }}>
            <span>↻</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Загрузка профиля без редиректа...</p>
          <button
            className="btn btn-ghost"
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px' }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    )
  }

  // Загрузка профиля
  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))'
          }}>
            <span>⏳</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  // Ошибка загрузки профиля
  if (error) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ margin: '0 auto 20px', background: '#ef4444' }}>
            <span>⚠️</span>
          </div>
          <h3 style={{ margin: '0 0 12px 0' }}>Ошибка</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Попробовать снова
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate(-1)}
            >
              Назад
            </button>
            {error.includes('Требуется авторизация') && (
              <button
                className="btn btn-outline"
                onClick={() => navigate('/login')}
              >
                Войти
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ margin: '0 auto 20px', background: '#6b7280' }}>
            <span>❓</span>
          </div>
          <h3 style={{ margin: '0 0 12px 0' }}>Профиль не найден</h3>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(-1)}
            style={{ marginTop: '20px' }}
          >
            Назад
          </button>
        </div>
      </div>
    )
  }

  // Проверяем, просматривает ли пользователь свой профиль
  const isOwnProfile = user?.user_id === id

  // UI профиля
  return (
    <div className="container">
      {/* Кнопка назад */}
      <div style={{ marginBottom: '24px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          ← Назад
        </button>
        <h1 style={{ margin: '12px 0' }}>
          {isOwnProfile ? 'Мой профиль' : 'Профиль пользователя'}
        </h1>
      </div>

      {/* Заголовок профиля */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Аватар */}
          <div className="logo" style={{ width: '80px', height: '80px' }}>
            {profile.user.avatar_url ? (
              <img
                src={profile.user.avatar_url}
                alt={profile.user.first_name}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{ fontSize: '24px' }}>
                {profile.user.first_name?.[0]}{profile.user.last_name?.[0]}
              </span>
            )}
          </div>

          {/* Основная информация */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2 className="title" style={{ margin: '0 0 4px 0' }}>
              {profile.user.first_name} {profile.user.last_name}
            </h2>
            <p className="meta" style={{ margin: '0 0 8px 0' }}>
              {profile.user.email}
            </p>

            {/* Бейджи ролей */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {profile.mentor && (
                <span
                  className="chip"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  Ментор
                  {profile.mentor.rating && (
                    <span style={{ marginLeft: '6px' }}>
                      ⭐ {profile.mentor.rating.toFixed(1)}
                    </span>
                  )}
                </span>
              )}
              {profile.student && (
                <span
                  className="chip"
                  style={{
                    background: 'var(--accent-2)',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  Студент
                </span>
              )}
            </div>
          </div>

          {/* Кнопки действий */}
          {token && isOwnProfile && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-outline"
                onClick={() => {
                  // TODO: Редактирование профиля
                  navigate('/profile/edit')
                }}
              >
                Редактировать профиль
              </button>
              {id !== user?.user_id && user?.user_id && (
                <button 
                  className="btn btn-ghost"
                  onClick={() => navigate(`/profile/${user.user_id}`)}
                  title="Перейти к своему профилю"
                >
                  Мой профиль
                </button>
              )}
            </div>
          )}
        </div>

        {/* Описание ментора */}
        {profile.mentor?.description && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--glass)'
          }}>
            <p style={{ margin: 0, color: 'var(--text)' }}>
              {profile.mentor.description}
            </p>
          </div>
        )}
      </div>

      {/* Навыки */}
      {(profile.teaching_skills?.length || profile.learning_skills?.length) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '24px'
        }}>
          {/* Навыки преподавания */}
          {profile.teaching_skills && profile.teaching_skills.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 12px 0' }}>Навыки преподавания</h3>
              <div className="chips">
                {profile.teaching_skills.map((skill) => (
                  <div key={skill.skill_id} className="chip">
                    {skill.skill_name}
                    <span style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>
                      ({skill.proficiency_level})
                      {skill.years_of_experience && ` • ${skill.years_of_experience} лет`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Навыки обучения */}
          {profile.learning_skills && profile.learning_skills.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 12px 0' }}>Навыки обучения</h3>
              <div className="chips">
                {profile.learning_skills.map((skill) => (
                  <div key={skill.skill_id} className="chip">
                    {skill.skill_name}
                    <span style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>
                      ({skill.proficiency_level})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Вкладки курсов */}
      {(profile.mentor || profile.student) && (
        <div style={{ marginBottom: '24px' }}>
          {/* Табы */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--glass)',
            paddingBottom: '8px',
            overflowX: 'auto'
          }}>
            {profile.mentor && (
              <button
                className={`btn ${activeTab === 'mentor' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('mentor')}
                style={{ borderRadius: '8px', whiteSpace: 'nowrap' }}
              >
                Курсы, которые я веду ({mentorCourses.length})
              </button>
            )}
            {profile.student && (
              <button
                className={`btn ${activeTab === 'student' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('student')}
                style={{ borderRadius: '8px', whiteSpace: 'nowrap' }}
              >
                Курсы, которые я изучаю ({studentCourses.length})
              </button>
            )}
          </div>

          {/* Контент табов */}
          {activeTab === 'mentor' && profile.mentor && (
            <div className="card">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <h3 style={{ margin: 0 }}>Курсы, которые я веду</h3>
                {isOwnProfile && (
                  <button 
                    className="btn btn-outline" 
                    style={{ fontSize: '14px' }}
                    onClick={() => navigate('/posts/new')}
                  >
                    + Создать курс
                  </button>
                )}
              </div>

              {mentorCourses.length > 0 ? (
                <div className="courses-grid">
                  {mentorCourses.map((course) => (
                    <div 
                      key={course.id} 
                      className="course"
                      onClick={() => navigate(`/posts/${course.id}`)}
                      style={{ cursor: 'pointer' }}
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
                        <div className="title" style={{ fontSize: '16px', marginBottom: '8px' }}>
                          {course.title}
                        </div>
                        <div className="meta" style={{ fontSize: '12px', marginBottom: '8px' }}>
                          {course.tags.slice(0, 2).map(tag => `#${tag}`).join(' ')}
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span className="meta">
                            {course.average_rating
                              ? `⭐ ${course.average_rating.toFixed(1)}`
                              : 'Нет оценок'
                            }
                          </span>
                          <span className="meta" style={{ fontSize: '11px' }}>
                            {new Date(course.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'var(--muted)'
                }}>
                  {isOwnProfile
                    ? 'Вы пока не создали ни одного курса'
                    : 'Пользователь пока не создал ни одного курса'
                  }
                  {isOwnProfile && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '16px' }}
                      onClick={() => navigate('/posts/new')}
                    >
                      Создать первый курс
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'student' && profile.student && (
            <div className="card">
              <h3 style={{ margin: '0 0 16px 0' }}>Курсы, которые я изучаю</h3>
              
              {studentCourses.length > 0 ? (
                <div className="courses-grid">
                  {studentCourses.map((course) => (
                    <div 
                      key={course.id} 
                      className="course"
                      onClick={() => navigate(`/posts/${course.id}`)}
                      style={{ cursor: 'pointer' }}
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
                        <div className="title" style={{ fontSize: '16px', marginBottom: '8px' }}>
                          {course.title}
                        </div>
                        <div className="meta" style={{ fontSize: '12px', marginBottom: '8px' }}>
                          {course.tags.slice(0, 2).map(tag => `#${tag}`).join(' ')}
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span className="meta">
                            {course.average_rating
                              ? `⭐ ${course.average_rating.toFixed(1)}`
                              : 'Нет оценок'
                            }
                          </span>
                          <span className="meta" style={{ fontSize: '11px' }}>
                            Прогресс: 0%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'var(--muted)'
                }}>
                  {isOwnProfile
                    ? 'Вы пока не присоединились ни к одному курсу'
                    : 'Пользователь пока не изучает курсы'
                  }
                  {isOwnProfile && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '16px' }}
                      onClick={() => navigate('/posts')}
                    >
                      Найти курсы
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Информация о студенте */}
      {profile.student && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0' }}>Информация об обучении</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {profile.student.learning_goals && (
              <div>
                <div className="meta" style={{ marginBottom: '4px' }}>Цели обучения</div>
                <p style={{ margin: 0 }}>{profile.student.learning_goals}</p>
              </div>
            )}
            {profile.student.preferred_learning_style && (
              <div>
                <div className="meta" style={{ marginBottom: '4px' }}>Предпочтительный стиль обучения</div>
                <p style={{ margin: 0 }}>{profile.student.preferred_learning_style}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Статистика и даты */}
      <div className="card">
        <h3 style={{ margin: '0 0 16px 0' }}>Дополнительная информация</h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          {/* Дата регистрации */}
          <div>
            <div className="meta" style={{ marginBottom: '6px' }}>Дата регистрации</div>
            <div style={{ fontWeight: '500' }}>
              {new Date(profile.user.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          </div>

          {/* Ментор с */}
          {profile.mentor?.created_at && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Ментор с</div>
              <div style={{ fontWeight: '500' }}>
                {new Date(profile.mentor.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}

          {/* Студент с */}
          {profile.student?.created_at && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Студент с</div>
              <div style={{ fontWeight: '500' }}>
                {new Date(profile.student.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}

          {/* Статистика курсов */}
          <div>
            <div className="meta" style={{ marginBottom: '6px' }}>Статистика курсов</div>
            <div style={{ fontWeight: '500' }}>
              {mentorCourses.length} ведет • {studentCourses.length} изучает
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage