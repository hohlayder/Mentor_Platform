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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'mentor' | 'student'>('mentor')
  const [redirectAttempted, setRedirectAttempted] = useState(false)

  // Проверяем, находится ли пользователь на маршруте /profile без ID
  const isProfileRoot = location.pathname === '/profile' || location.pathname === '/profile/'

  // ПРОСТАЯ логика редиректа - только один раз
  useEffect(() => {
    if (isProfileRoot) {
      if (token && user?.user_id) {
        navigate(`/profile/${user.user_id}`, { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }
  }, [isProfileRoot, token, user, navigate])

  // Загрузка профиля и курсов
  useEffect(() => {
    if (!id || isProfileRoot) {
      return
    }

    const loadProfile = async () => {
      setLoading(true)
      setError(null)

      try {
        // Подготавливаем заголовки
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }
        
        const currentToken = token || sessionStorage.getItem('access_token')
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`
        }

        // 1. Загружаем профиль
        const profileResponse = await fetch(
          `http://localhost:8080/api/v1/profiles/${id}`,
          { 
            headers,
            method: 'GET'
          }
        )
        
        if (!profileResponse.ok) {
          throw new Error(`HTTP ${profileResponse.status}`)
        }
        
        const profileData: ProfileResponse = await profileResponse.json()
        setProfile(profileData)

        // 2. Загружаем курсы ментора (если он ментор)
        if (profileData.mentor) {
          try {
            // Параметры запроса согласно Swagger
            const params = new URLSearchParams({
              author_id: id,
              status: 'published',
              page_size: '20',
              sort_field: 'created_at',
              sort_order: 'desc'
            })

            const coursesResponse = await fetch(
              `http://localhost:8080/api/v1/posts?${params}`,
              { headers }
            )

            if (coursesResponse.ok) {
              const coursesData = await coursesResponse.json()
              setMentorCourses(coursesData.posts || [])
            }
          } catch (courseErr) {
            console.error('Error loading courses:', courseErr)
          }
        }

      } catch (err: any) {
        console.error('Profile load error:', err)
        
        if (err.message?.includes('401')) {
          setError('Требуется авторизация')
        } else if (err.message?.includes('404')) {
          setError('Профиль не найден')
        } else {
          setError('Ошибка загрузки профиля')
        }
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [id, token, isProfileRoot])

  // Если на /profile и редирект не сработал
  if (isProfileRoot) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite'
          }}>
            <span>↻</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Перенаправление...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            animation: 'pulse 1.5s infinite'
          }}>
            <span>⏳</span>
          </div>
          <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ margin: '0 auto 20px', background: '#ef4444' }}>
            <span>⚠️</span>
          </div>
          <h3 style={{ margin: '0 0 12px 0' }}>Ошибка</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            {error || 'Профиль не найден'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Попробовать снова
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/')}
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Проверяем, просматривает ли пользователь свой профиль
  const isOwnProfile = user?.user_id === id
  const isMentor = !!profile.mentor
  const isStudent = !!profile.student

  return (
    <div className="container">
      {/* Кнопка назад */}
      <div style={{ marginBottom: '24px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate("/", {replace: true})}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          ← На Главную
        </button>
        <h1 style={{ margin: '12px 0' }}>
          {isOwnProfile ? 'Мой профиль' : 'Профиль пользователя'}
        </h1>
      </div>

      {/* Заголовок профиля */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Аватар */}
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%',
            overflow: 'hidden',
            background: profile.user.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'grid',
            placeContent: 'center'
          }}>
            {profile.user.avatar_url ? (
              <img
                src={profile.user.avatar_url}
                alt={profile.user.first_name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{ fontSize: '24px', color: '#fff', fontWeight: 600 }}>
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

            {/* Бейджи ролей и действия */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {isMentor && (
                  <span className="chip" style={{ background: 'var(--accent)', color: '#fff' }}>
                    Ментор {profile.mentor?.rating && `⭐ ${profile.mentor.rating.toFixed(1)}`}
                  </span>
                )}
                {isStudent && (
                  <span className="chip" style={{ background: 'var(--accent-2)', color: '#fff' }}>
                    Студент
                  </span>
                )}
              </div>

              {/* Кнопки действий */}
              {isOwnProfile && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate(`/profile/${id}/edit`)}
                  >
                    Редактировать профиль
                  </button>
                  {isMentor && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigate('/course/create')}
                    >
                      + Создать курс
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Описание ментора */}
        {profile.mentor?.description && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass)' }}>
            <p style={{ margin: 0, color: 'var(--text)' }}>
              {profile.mentor.description}
            </p>
          </div>
        )}
      </div>

      {/* Навыки */}
      {(profile.teaching_skills?.length || profile.learning_skills?.length) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
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

      {/* Курсы ментора */}
      {isMentor && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>
              Курсы {isOwnProfile ? 'которые я веду' : 'пользователя'} ({mentorCourses.length})
            </h3>
            {isOwnProfile && (
              <button 
                className="btn btn-outline" 
                onClick={() => navigate('/course/create')}
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
                  onClick={() => navigate(`/courses/${course.id}`)}
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
                      {course.tags.length > 2 && '...'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="meta">
                        {course.average_rating
                          ? `⭐ ${course.average_rating.toFixed(1)} (${course.ratings_count})`
                          : 'Нет оценок'
                        }
                      </span>
                      <span className="meta" style={{ fontSize: '11px' }}>
                        {new Date(course.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    {isOwnProfile && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-outline"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/course/edit/${course.id}`)
                          }}
                        >
                          Редактировать
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              {isOwnProfile
                ? 'Вы пока не создали ни одного курса'
                : 'Пользователь пока не создал ни одного курса'
              }
              {isOwnProfile && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '16px' }}
                  onClick={() => navigate('/course/create')}
                >
                  Создать первый курс
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Информация о студенте */}
      {isStudent && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0' }}>Информация об обучении</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {profile.student?.learning_goals && (
              <div>
                <div className="meta" style={{ marginBottom: '4px' }}>Цели обучения</div>
                <p style={{ margin: 0 }}>{profile.student.learning_goals}</p>
              </div>
            )}
            {profile.student?.preferred_learning_style && (
              <div>
                <div className="meta" style={{ marginBottom: '4px' }}>Предпочтительный стиль обучения</div>
                <p style={{ margin: 0 }}>{profile.student.preferred_learning_style}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Дополнительная информация */}
      <div className="card">
        <h3 style={{ margin: '0 0 16px 0' }}>Дополнительная информация</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
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

          {isMentor && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Курсов создано</div>
              <div style={{ fontWeight: '500' }}>
                {mentorCourses.length}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfilePage