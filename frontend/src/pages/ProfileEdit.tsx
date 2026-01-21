import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

// Типы на основе Go структур
interface User {
  user_id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string | null
  created_at: string
}

interface MentorProfile {
  user_id: string
  description?: string | null
  rating?: number | null
  withdrawal_address?: string | null
  created_at: string
}

interface StudentProfile {
  user_id: string
  learning_goals?: string | null
  preferred_learning_style?: string | null
  created_at: string
}

interface TeachingSkill {
  skill_id: string
  skill_name: string
  proficiency_level: string
  years_of_experience?: number | null
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
  mentor?: MentorProfile | null
  student?: StudentProfile | null
  teaching_skills: TeachingSkill[]
  learning_skills: LearningSkill[]
}

interface ProfileWithPostsResponse {
  Profile?: ProfileResponse
  profile?: ProfileResponse
  posts?: {
    posts: any[]
    next_page_token?: string
    total_count: number
  }
  // Если данные могут приходить без обертки Profile
  user?: User
  mentor?: MentorProfile
  student?: StudentProfile
  teaching_skills?: TeachingSkill[]
  learning_skills?: LearningSkill[]
}

// Типы для обновления
interface MentorUpdate {
  description?: string
  withdrawal_address?: string
}

interface StudentUpdate {
  learning_goals?: string
  preferred_learning_style?: string
}

interface TeachingSkillUpdate {
  skill_name: string
  proficiency_level: string
  years_of_experience?: number
}

interface TeachingSkillsUpdate {
  teaching_skills: TeachingSkillUpdate[]
}

interface UpdateProfileRequest {
  first_name?: string
  last_name?: string
  email?: string
  avatar_url?: string
  mentor_data?: MentorUpdate
  student_data?: StudentUpdate
  teaching_skills?: TeachingSkillsUpdate
}

// Тип для ошибок аватара
interface AvatarErrorResponse {
  details?: string
  error?: string
  message?: string
}

const EditProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser, token, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  console.log('🟢 EditProfilePage рендерится!', { 
    id, 
    hasToken: !!token, 
    currentUser: currentUser?.user_id,
    path: window.location.pathname 
  });

  
  const [formData, setFormData] = useState<UpdateProfileRequest>({
    first_name: '',
    last_name: '',
    email: '',
    avatar_url: ''
  })

  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [isMentor, setIsMentor] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  
  const [mentorData, setMentorData] = useState<MentorUpdate>({
    description: '',
    withdrawal_address: ''
  })
  
  const [studentData, setStudentData] = useState<StudentUpdate>({
    learning_goals: '',
    preferred_learning_style: ''
  })

  const [teachingSkills, setTeachingSkills] = useState<TeachingSkillUpdate[]>([])
  const [newTeachingSkill, setNewTeachingSkill] = useState<TeachingSkillUpdate>({
    skill_name: '',
    proficiency_level: 'beginner',
    years_of_experience: undefined
  })

  const proficiencyLevels = [
    { value: 'beginner', label: 'Начальный' },
    { value: 'intermediate', label: 'Средний' },
    { value: 'advanced', label: 'Продвинутый' },
    { value: 'expert', label: 'Эксперт' }
  ]

  // Функция для получения правильного URL аватара
  const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
    if (!avatarUrl) return ''
    
    // Если URL уже полный (http или https)
    if (avatarUrl.startsWith('http')) {
      return avatarUrl
    }
    
    // Если это имя файла
    if (avatarUrl && !avatarUrl.includes('/')) {
      return `http://localhost:8080/api/v1/files/avatar/${avatarUrl}`
    }
    
    // Если это относительный путь
    if (avatarUrl.startsWith('/')) {
      return `http://localhost:8080${avatarUrl}`
    }
    
    // Если это путь без префикса http
    if (avatarUrl.startsWith('files/avatar/')) {
      return `http://localhost:8080/api/v1/${avatarUrl}`
    }
    
    return avatarUrl
  }

  // Проверка прав доступа
  useEffect(() => {
    if (!currentUser || !id || currentUser.user_id !== id) {
      navigate(`/profile/${currentUser?.user_id}/edit`, { replace: true })
      return
    }
  }, [currentUser, id, navigate])

  // Загрузка профиля
  useEffect(() => {
    if (!id || !token) return
    
    const loadProfile = async () => {
      setLoading(true)
      try {
        console.log(`🔍 Загрузка профиля для редактирования ID: ${id}`)
        
        const response = await fetch(`http://localhost:8080/api/v1/profiles/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ HTTP ошибка:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: Не удалось загрузить профиль`)
        }
  
        const responseText = await response.text()
        console.log('✅ Сырой ответ:', responseText)
        
        let apiData;
        try {
          apiData = JSON.parse(responseText);
          console.log('✅ Парсинг JSON успешен');
        } catch (parseError) {
          console.error('❌ Ошибка парсинга JSON:', parseError)
          throw new Error('Некорректный ответ от сервера')
        }
        
        // ВАЖНО: Сначала выведем всю структуру ответа
        console.group('📊 СТРУКТУРА ОТВЕТА API');
        console.log('Тип данных:', typeof apiData);
        console.log('Все ключи:', Object.keys(apiData || {}));
        console.log('Полный ответ:', JSON.stringify(apiData, null, 2));
        console.groupEnd();
        
        // Определяем, где находятся данные профиля
        let profileData = null;
        
        // Вариант 1: Проверяем различные возможные структуры
        if (apiData && typeof apiData === 'object') {
          // Самый частый случай: apiData.Profile
          if (apiData.Profile && typeof apiData.Profile === 'object') {
            console.log('📌 Используем apiData.Profile');
            profileData = apiData.Profile;
          }
          // Вариант с маленькой буквы
          else if (apiData.profile && typeof apiData.profile === 'object') {
            console.log('📌 Используем apiData.profile');
            profileData = apiData.profile;
          }
          // Возможно данные уже в корне
          else if (apiData.user_id || apiData.first_name || apiData.email) {
            console.log('📌 Используем корневые данные');
            profileData = apiData;
          }
          // Возможно это уже готовый ProfileResponse
          else if (apiData.user && typeof apiData.user === 'object') {
            console.log('📌 apiData это уже ProfileResponse');
            profileData = apiData;
          }
        }
        
        if (!profileData) {
          console.error('❌ Данные профиля не найдены ни в одном формате');
          console.log('apiData:', apiData);
          throw new Error('Данные профиля не найдены');
        }
        
        console.log('📌 Найденные данные профиля:', profileData);
        
        // Определяем данные пользователя
        let userData = null;
        
        if (profileData.user && typeof profileData.user === 'object') {
          console.log('📌 Используем profileData.user');
          userData = profileData.user;
        } else {
          console.log('📌 Используем profileData как userData');
          userData = profileData;
        }
        
        console.log('📌 Данные пользователя:', userData);
        
        if (!userData) {
          console.error('❌ Данные пользователя не найдены');
          throw new Error('Данные пользователя не найдены');
        }
        
        // Нормализуем данные пользователя
        const normalizedUser: User = {
          user_id: userData.user_id || userData.UserID || userData.id || id || '',
          first_name: userData.first_name || userData.FirstName || '',
          last_name: userData.last_name || userData.LastName || '',
          email: userData.email || userData.Email || '',
          avatar_url: getAvatarUrl(userData.avatar_url || userData.AvatarURL || null),
          created_at: userData.created_at || userData.CreatedAt || ''
        };
        
        console.log('✅ Нормализованные данные пользователя:', normalizedUser);
        
        // Проверяем обязательные поля
        if (!normalizedUser.user_id || !normalizedUser.first_name) {
          console.error('❌ Обязательные поля отсутствуют:', normalizedUser);
          throw new Error('Недостаточно данных пользователя');
        }
        
        // Создаем нормализованный профиль
        const normalizedProfile: ProfileResponse = {
          user: normalizedUser,
          mentor: profileData.mentor || null,
          student: profileData.student || null,
          teaching_skills: profileData.teaching_skills || profileData.teachingSkills || [],
          learning_skills: profileData.learning_skills || profileData.learningSkills || []
        };
        
        console.log('✅ Нормализованный профиль:', normalizedProfile);
        
        // Устанавливаем состояние
        setProfile(normalizedProfile);
        setFormData({
          first_name: normalizedUser.first_name || '',
          last_name: normalizedUser.last_name || '',
          email: normalizedUser.email || '',
          avatar_url: normalizedUser.avatar_url || ''
        });
        setIsMentor(!!normalizedProfile.mentor);
        setIsStudent(!!normalizedProfile.student);
        
        if (normalizedProfile.mentor) {
          setMentorData({
            description: normalizedProfile.mentor.description || '',
            withdrawal_address: normalizedProfile.mentor.withdrawal_address || ''
          });
        }
        
        if (normalizedProfile.student) {
          setStudentData({
            learning_goals: normalizedProfile.student.learning_goals || '',
            preferred_learning_style: normalizedProfile.student.preferred_learning_style || ''
          });
        }
        
        if (normalizedProfile.teaching_skills && normalizedProfile.teaching_skills.length > 0) {
          setTeachingSkills(normalizedProfile.teaching_skills.map(skill => ({
            skill_name: skill.skill_name,
            proficiency_level: skill.proficiency_level,
            years_of_experience: skill.years_of_experience || undefined
          })));
        }
        
        console.log('✅ Профиль успешно загружен!');
  
      } catch (err: any) {
        console.error('❌ Ошибка загрузки профиля:', err);
        setError(err.message || 'Ошибка загрузки профиля');
      } finally {
        setLoading(false);
      }
    }
  
    loadProfile();
  }, [id, token]);

  // Обработка изменения базовых полей
  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Обработка изменения данных ментора
  const handleMentorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setMentorData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Обработка изменения данных студента
  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setStudentData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Добавление навыка преподавания
  const addTeachingSkill = () => {
    if (!newTeachingSkill.skill_name.trim()) {
      setError('Введите название навыка')
      return
    }

    setTeachingSkills(prev => [...prev, { ...newTeachingSkill }])

    setNewTeachingSkill({
      skill_name: '',
      proficiency_level: 'beginner',
      years_of_experience: undefined
    })
  }

  // Удаление навыка преподавания
  const removeTeachingSkill = (index: number) => {
    setTeachingSkills(prev => prev.filter((_, i) => i !== index))
  }

  // Загрузка аватара
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
  
    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml']
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg']
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      setError('Разрешены только форматы: JPG, JPEG, PNG, GIF, SVG')
      return
    }
  
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB')
      return
    }
  
    setUploading(true)
    setError(null)
  
    try {
      const formData = new FormData()
      formData.append('avatar', file)
  
      // ИСПРАВЛЕННЫЙ ЭНДПОИНТ
      const uploadResponse = await fetch('http://localhost:8080/api/v1/files/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
  
      let responseData: any;
      try {
        responseData = await uploadResponse.json()
      } catch {
        throw new Error('Некорректный ответ от сервера')
      }
  
      if (!uploadResponse.ok) {
        // Обработка различных ошибок согласно документации
        let errorMessage = 'Ошибка загрузки аватара'
        
        switch (uploadResponse.status) {
          case 400:
            errorMessage = responseData.message || 'Неверный формат файла'
            break
          case 401:
            errorMessage = 'Требуется авторизация'
            break
          case 413:
            errorMessage = responseData.message || 'Файл слишком большой'
            break
          case 500:
            errorMessage = responseData.message || 'Ошибка сервера'
            break
          default:
            errorMessage = responseData.message || `Ошибка ${uploadResponse.status}`
        }
        
        throw new Error(errorMessage)
      }
  
      console.log('✅ Ответ от сервера при загрузке аватара:', responseData)
      
      // Обрабатываем разные форматы ответа
      let avatarUrl = responseData.uri || responseData.filename || responseData.url || responseData.avatar_url
      
      // Формируем полный URL если нужно
      avatarUrl = getAvatarUrl(avatarUrl)
      
      console.log('✅ Аватар загружен, URL:', avatarUrl)
      
      // Обновляем форму
      setFormData(prev => ({
        ...prev,
        avatar_url: avatarUrl
      }))
  
      // Также обновляем профиль для немедленного отображения
      if (profile) {
        setProfile(prev => prev ? {
          ...prev,
          user: {
            ...prev.user,
            avatar_url: avatarUrl
          }
        } : null)
      }
  
    } catch (err: any) {
      console.error('❌ Ошибка загрузки аватара:', err)
      setError(err.message || 'Ошибка при загрузке аватара')
      
      // Локальный URL для предпросмотра (опционально)
      const localUrl = URL.createObjectURL(file)
      setFormData(prev => ({
        ...prev,
        avatar_url: localUrl
      }))
      
      // Освобождаем память при размонтировании
      setTimeout(() => URL.revokeObjectURL(localUrl), 1000)
    } finally {
      setUploading(false)
    }
  }

  // Удаление аватара
  const handleRemoveAvatar = () => {
    setFormData(prev => ({
      ...prev,
      avatar_url: ''
    }))
    
    if (profile) {
      setProfile(prev => prev ? {
        ...prev,
        user: {
          ...prev.user,
          avatar_url: null
        }
      } : null)
    }
    
    console.log('✅ Аватар удален локально')
  }

  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const updateData: UpdateProfileRequest = {}

      // Базовые поля - всегда отправляем если изменились
      if (formData.first_name !== profile?.user.first_name) {
        updateData.first_name = formData.first_name
      }
      if (formData.last_name !== profile?.user.last_name) {
        updateData.last_name = formData.last_name
      }
      if (formData.email !== profile?.user.email) {
        updateData.email = formData.email
      }
      if (formData.avatar_url !== profile?.user.avatar_url) {
        updateData.avatar_url = formData.avatar_url
      }

      // Данные ментора
      if (isMentor) {
        updateData.mentor_data = {}
        if (mentorData.description !== (profile?.mentor?.description || '')) {
          updateData.mentor_data.description = mentorData.description
        }
        if (mentorData.withdrawal_address !== (profile?.mentor?.withdrawal_address || '')) {
          updateData.mentor_data.withdrawal_address = mentorData.withdrawal_address
        }

        if (teachingSkills.length > 0) {
          updateData.teaching_skills = {
            teaching_skills: teachingSkills
          }
        }
      } else if (profile?.mentor) {
        // Если галочка снята, но ментор был - удаляем
        updateData.mentor_data = {}
      }

      // Данные студента
      if (isStudent) {
        updateData.student_data = {}
        if (studentData.learning_goals !== (profile?.student?.learning_goals || '')) {
          updateData.student_data.learning_goals = studentData.learning_goals
        }
        if (studentData.preferred_learning_style !== (profile?.student?.preferred_learning_style || '')) {
          updateData.student_data.preferred_learning_style = studentData.preferred_learning_style
        }
      } else if (profile?.student) {
        // Если галочка снята, но студент был - удаляем
        updateData.student_data = {}
      }

      console.log('Sending update data:', updateData)

      const response = await fetch(`http://localhost:8080/api/v1/profiles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Update error response:', errorText)
        
        let errorMessage = 'Ошибка обновления профиля'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('Profile updated:', result)

      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          first_name: formData.first_name || currentUser.first_name,
          last_name: formData.last_name || currentUser.last_name,
          email: formData.email || currentUser.email,
          avatar_url: formData.avatar_url || currentUser.avatar_url
        }
        setUser(updatedUser)
      }

      setSuccess(true)
      setTimeout(() => {
        navigate(`/profile/${id}`)
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Ошибка при сохранении профиля')
    } finally {
      setSaving(false)
    }
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

  // Добавляем проверку перед рендерингом формы
  if (error || !profile || !profile.user) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="logo" style={{ 
            margin: '0 auto 20px', 
            background: '#ef4444'
          }}>
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
              onClick={() => navigate(`/profile/${id}`)}
            >
              Назад к профилю
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Безопасное получение данных для отображения
  const firstNameInitial = formData.first_name?.[0] || profile.user.first_name?.[0] || ''
  const lastNameInitial = formData.last_name?.[0] || profile.user.last_name?.[0] || ''
  const initials = `${firstNameInitial}${lastNameInitial}` || 'U'
  const currentAvatarUrl = getAvatarUrl(formData.avatar_url)

  return (
    <div className="container">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Хлебные крошки */}
        <nav style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: 'var(--muted)' }}>Главная</a>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <a href={`/profile/${id}`} style={{ color: 'var(--muted)' }}>Профиль</a>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--accent)' }}>Редактирование</span>
        </nav>

        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          Редактирование профиля
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: '32px' }}>
          Обновите информацию о себе. Вы можете быть одновременно и ментором, и студентом.
        </p>

        {success && (
          <div className="card" style={{ 
            marginBottom: '24px',
            background: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#fff',
                display: 'grid',
                placeContent: 'center'
              }}>
                ✓
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Профиль успешно обновлен!</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                  Перенаправление на страницу профиля...
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="card" style={{ 
            marginBottom: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <div>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Основная информация */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
              Основная информация
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Имя *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleBasicChange}
                  required
                  style={{ width: '100%' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Фамилия *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleBasicChange}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleBasicChange}
                required
                style={{ width: '100%' }}
              />
            </div>

            {/* Загрузка аватара */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Аватар
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                {/* Предпросмотр аватара */}
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: currentAvatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'grid',
                  placeContent: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '24px'
                }}>
                  {currentAvatarUrl ? (
                    <img 
                      src={currentAvatarUrl} 
                      alt="Аватар" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          const span = document.createElement('span')
                          span.style.fontSize = '24px'
                          span.style.color = '#fff'
                          span.style.fontWeight = '600'
                          span.textContent = initials
                          parent.appendChild(span)
                        }
                      }}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept=".jpg,.jpeg,.png,.gif,.svg,image/jpeg,image/jpg,image/png,image/gif,image/svg+xml"
                    style={{ display: 'none' }}
                  />
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || saving}
                    >
                      {uploading ? 'Загрузка...' : 'Выбрать файл'}
                    </button>
                    
                    {currentAvatarUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleRemoveAvatar}
                        disabled={uploading || saving}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
                    Максимальный размер: 5MB. Разрешенные форматы: JPG, JPEG, PNG, GIF, SVG
                  </div>
                  
                  {uploading && (
                    <div style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '4px' }}>
                      ⏳ Загружается...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Переключатель ментора */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '10px',
                  background: isMentor ? 'var(--accent)' : 'var(--glass)',
                  display: 'grid',
                  placeContent: 'center',
                  color: isMentor ? '#fff' : 'var(--muted)'
                }}>
                  👨‍🏫
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 600 }}>Я ментор</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--muted)' }}>
                    {isMentor ? 'Вы можете создавать курсы' : 'Создавайте и ведите курсы'}
                  </p>
                </div>
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ 
                  width: '44px', 
                  height: '24px', 
                  borderRadius: '12px',
                  background: isMentor ? 'var(--accent)' : 'var(--glass)',
                  position: 'relative',
                  transition: 'all 0.3s',
                  marginRight: '8px'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: isMentor ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'all 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
                <input
                  type="checkbox"
                  checked={isMentor}
                  onChange={(e) => setIsMentor(e.target.checked)}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Менторская информация */}
            {isMentor && (
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '20px', 
                borderTop: '1px solid var(--glass)',
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Описание ментора
                  </label>
                  <textarea
                    name="description"
                    value={mentorData.description || ''}
                    onChange={handleMentorChange}
                    placeholder="Расскажите о своем опыте преподавания, специализации..."
                    style={{ 
                      width: '100%', 
                      minHeight: '100px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Адрес для выплат
                  </label>
                  <input
                    type="text"
                    name="withdrawal_address"
                    value={mentorData.withdrawal_address || ''}
                    onChange={handleMentorChange}
                    placeholder="Банковский счет, криптокошелек и т.д."
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Навыки преподавания */}
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
                    Навыки преподавания
                  </h4>
                  
                  {teachingSkills.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div className="chips">
                        {teachingSkills.map((skill, index) => (
                          <div key={index} className="chip" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>
                              {skill.skill_name} ({skill.proficiency_level})
                              {skill.years_of_experience && ` • ${skill.years_of_experience} лет`}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeTeachingSkill(index)}
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
                    </div>
                  )}

                  <div style={{ 
                    padding: '16px', 
                    background: 'var(--glass)', 
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Навык *</label>
                        <input
                          type="text"
                          value={newTeachingSkill.skill_name}
                          onChange={(e) => setNewTeachingSkill(prev => ({ ...prev, skill_name: e.target.value }))}
                          placeholder="JavaScript, React, Python..."
                          style={{ width: '100%' }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Уровень</label>
                        <select
                          value={newTeachingSkill.proficiency_level}
                          onChange={(e) => setNewTeachingSkill(prev => ({ ...prev, proficiency_level: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          {proficiencyLevels.map(level => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Лет опыта</label>
                        <input
                          type="number"
                          value={newTeachingSkill.years_of_experience || ''}
                          onChange={(e) => setNewTeachingSkill(prev => ({ 
                            ...prev, 
                            years_of_experience: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                          min="0"
                          max="50"
                          placeholder="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={addTeachingSkill}
                      className="btn btn-outline"
                      style={{ width: '100%' }}
                    >
                      + Добавить навык
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Переключатель студента */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '10px',
                  background: isStudent ? 'var(--accent-2)' : 'var(--glass)',
                  display: 'grid',
                  placeContent: 'center',
                  color: isStudent ? '#fff' : 'var(--muted)'
                }}>
                  👨‍🎓
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 600 }}>Я студент</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--muted)' }}>
                    {isStudent ? 'Вы можете изучать курсы' : 'Изучайте курсы других менторов'}
                  </p>
                </div>
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ 
                  width: '44px', 
                  height: '24px', 
                  borderRadius: '12px',
                  background: isStudent ? 'var(--accent-2)' : 'var(--glass)',
                  position: 'relative',
                  transition: 'all 0.3s',
                  marginRight: '8px'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: isStudent ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'all 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
                <input
                  type="checkbox"
                  checked={isStudent}
                  onChange={(e) => setIsStudent(e.target.checked)}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Студенческая информация */}
            {isStudent && (
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '20px', 
                borderTop: '1px solid var(--glass)',
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Цели обучения
                  </label>
                  <textarea
                    name="learning_goals"
                    value={studentData.learning_goals || ''}
                    onChange={handleStudentChange}
                    placeholder="Чему вы хотите научиться? Какие навыки развить?"
                    style={{ 
                      width: '100%', 
                      minHeight: '100px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                    Предпочтительный стиль обучения
                  </label>
                  <input
                    type="text"
                    name="preferred_learning_style"
                    value={studentData.preferred_learning_style || ''}
                    onChange={handleStudentChange}
                    placeholder="Визуальный, аудиальный, практический..."
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--glass)',
            paddingTop: '24px'
          }}>
            <button
              type="button"
              onClick={() => navigate(`/profile/${id}`)}
              className="btn btn-ghost"
              disabled={saving || uploading}
            >
              Отмена
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploading}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default EditProfilePage