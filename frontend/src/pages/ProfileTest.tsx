// src/pages/EditProfilePage.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

// Типы на основе Swagger
interface User {
  user_id: string
  email: string
  first_name: string
  last_name: string
  avatar_url?: string
  created_at: string
}

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

interface ProfileResponse {
  user: User
  mentor?: {
    user_id: string
    description?: string
    rating?: number
    withdrawal_address?: string
    created_at: string
  }
  student?: {
    user_id: string
    learning_goals?: string
    preferred_learning_style?: string
    created_at: string
  }
  teaching_skills?: Array<{
    skill_id: string
    skill_name: string
    proficiency_level: string
    years_of_experience?: number
    created_at: string
  }>
}

const EditProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser, token, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  
  // Состояния для переключателей
  const [isMentor, setIsMentor] = useState(false)
  const [isStudent, setIsStudent] = useState(false)
  
  // Данные ментора (заполняются только если isMentor = true)
  const [mentorData, setMentorData] = useState<MentorUpdate>({
    description: '',
    withdrawal_address: ''
  })
  
  // Данные студента (заполняются только если isStudent = true)
  const [studentData, setStudentData] = useState<StudentUpdate>({
    learning_goals: '',
    preferred_learning_style: ''
  })

  // Навыки преподавания
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

  // Вспомогательная функция для извлечения имени файла из URL
  const extractFilenameFromURL = (url: string): string => {
    if (!url) return ''
    
    // Удаляем префикс пути
    const prefix = '/api/v1/files/avatar/'
    
    if (url.startsWith(prefix)) {
      // Извлекаем имя файла после префикса
      const filename = url.substring(prefix.length)
      // Удаляем любые параметры запроса
      return filename.split('?')[0]
    }
    
    // Если URL не содержит префикс, пробуем извлечь последнюю часть
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      return pathname.substring(pathname.lastIndexOf('/') + 1)
    } catch {
      // Если это невалидный URL, возвращаем как есть
      return url
    }
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
        const response = await fetch(`http://localhost:8080/api/v1/profiles/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error('Не удалось загрузить профиль')
        }

        const data: ProfileResponse = await response.json()
        setProfile(data)

        // Заполняем форму текущими данными
        setFormData({
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          email: data.user.email,
          avatar_url: data.user.avatar_url || ''
        })

        // Устанавливаем флаги ролей
        setIsMentor(!!data.mentor)
        setIsStudent(!!data.student)

        // Заполняем данные ментора если есть
        if (data.mentor) {
          setMentorData({
            description: data.mentor.description || '',
            withdrawal_address: data.mentor.withdrawal_address || ''
          })
        }

        // Заполняем данные студента если есть
        if (data.student) {
          setStudentData({
            learning_goals: data.student.learning_goals || '',
            preferred_learning_style: data.student.preferred_learning_style || ''
          })
        }

        // Заполняем навыки преподавания если есть
        if (data.teaching_skills) {
          setTeachingSkills(data.teaching_skills.map(skill => ({
            skill_name: skill.skill_name,
            proficiency_level: skill.proficiency_level,
            years_of_experience: skill.years_of_experience
          })))
        }

      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки профиля')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [id, token])

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

  // Обновленная функция handleAvatarUpload с правильной логикой
const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  // Проверка типа файла
  if (!file.type.startsWith('image/')) {
    setError('Пожалуйста, выберите изображение')
    return
  }

  // Проверка размера файла (максимум 5MB)
  if (file.size > 5 * 1024 * 1024) {
    setError('Размер файла не должен превышать 5MB')
    return
  }

  setUploading(true)
  setError(null)

  try {
    // Создаем FormData с правильным ключом
    const formData = new FormData()
    formData.append('avatar', file) // Ключ должен быть 'avatar' как в бекенде
    
    console.log('Отправляем файл на сервер:', file.name)

    // Загружаем на сервер - endpoint из вашего бекенда
    const uploadResponse = await fetch('http://localhost:8080/api/v1/files/avatar/'+token, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Не устанавливаем Content-Type - браузер сделает это сам для FormData
      },
      body: formData
    })

    console.log('Ответ сервера:', uploadResponse.status, uploadResponse.statusText)

    if (!uploadResponse.ok) {
      // Пробуем получить текст ошибки
      let errorMessage = `Ошибка ${uploadResponse.status}: ${uploadResponse.statusText}`
      
      try {
        const errorData = await uploadResponse.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
        // Если не JSON, пробуем текст
        const errorText = await uploadResponse.text()
        if (errorText) errorMessage = errorText
      }
      
      throw new Error(errorMessage)
    }

    const uploadData = await uploadResponse.json()
    console.log('Данные от сервера:', uploadData)
    
    // Получаем URL из ответа
    const avatarUrl = uploadData.url || uploadData.avatar_url
    
    if (!avatarUrl) {
      console.warn('Сервер не вернул URL, используем локальный URL')
      // Если сервер не вернул URL, создаем локальный для предпросмотра
      const localUrl = URL.createObjectURL(file)
      setFormData(prev => ({
        ...prev,
        avatar_url: localUrl
      }))
    } else {
      // Используем URL от сервера
      setFormData(prev => ({
        ...prev,
        avatar_url: avatarUrl
      }))
    }

    console.log('Аватар успешно загружен, URL:', avatarUrl)

  } catch (err: any) {
    console.error('Ошибка загрузки аватара:', err)
    setError(err.message || 'Ошибка загрузки изображения')
    
    // Создаем локальный URL для предпросмотра даже при ошибке
    const localUrl = URL.createObjectURL(file)
    setFormData(prev => ({
      ...prev,
      avatar_url: localUrl
    }))
  } finally {
    setUploading(false)
  }
}

// Обновленная функция handleDeleteAvatar
const handleDeleteAvatar = async () => {
  if (!formData.avatar_url) return
  
  setUploading(true)
  setError(null)
  
  try {
    // Извлекаем имя файла из URL
    const filename = extractFilenameFromURL(formData.avatar_url)
    console.log('Удаление аватара. Имя файла:', filename)
    
    if (!filename) {
      throw new Error('Не удалось извлечь имя файла из URL')
    }
    
    // Отправляем запрос на удаление - endpoint из вашего бекенда
    const deleteResponse = await fetch(`http://localhost:8080/api/v1/upload/avatar/${token}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('Ответ сервера при удалении:', deleteResponse.status, deleteResponse.statusText)

    if (!deleteResponse.ok) {
      // Пробуем получить текст ошибки
      let errorMessage = `Ошибка ${deleteResponse.status}: ${deleteResponse.statusText}`
      
      try {
        const errorData = await deleteResponse.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch {
        // Если не JSON, пробуем текст
        const errorText = await deleteResponse.text()
        if (errorText) errorMessage = errorText
      }
      
      throw new Error(errorMessage)
    }

    console.log('Аватар успешно удален с сервера')
    
    // Очищаем URL аватара в форме
    setFormData(prev => ({
      ...prev,
      avatar_url: ''
    }))

  } catch (err: any) {
    console.error('Ошибка удаления аватара:', err)
    setError(err.message || 'Ошибка удаления изображения')
    
    // Даже при ошибке очищаем локально
    setFormData(prev => ({
      ...prev,
      avatar_url: ''
    }))
  } finally {
    setUploading(false)
  }
}

  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Подготавливаем данные для отправки
      const updateData: UpdateProfileRequest = {}

      // Базовые поля
      if (formData.first_name && formData.first_name !== profile?.user.first_name) {
        updateData.first_name = formData.first_name
      }
      if (formData.last_name && formData.last_name !== profile?.user.last_name) {
        updateData.last_name = formData.last_name
      }
      if (formData.email && formData.email !== profile?.user.email) {
        updateData.email = formData.email
      }
      if (formData.avatar_url !== profile?.user.avatar_url) {
        updateData.avatar_url = formData.avatar_url
      }

      // Данные ментора (только если галочка установлена)
      if (isMentor) {
        updateData.mentor_data = {}
        if (mentorData.description) {
          updateData.mentor_data.description = mentorData.description
        }
        if (mentorData.withdrawal_address) {
          updateData.mentor_data.withdrawal_address = mentorData.withdrawal_address
        }

        // Навыки преподавания (только если есть)
        if (teachingSkills.length > 0) {
          updateData.teaching_skills = {
            teaching_skills: teachingSkills
          }
        }
      } else {
        // Если галочка снята - удаляем менторские данные
        updateData.mentor_data = {}
      }

      // Данные студента (только если галочка установлена)
      if (isStudent) {
        updateData.student_data = {}
        if (studentData.learning_goals) {
          updateData.student_data.learning_goals = studentData.learning_goals
        }
        if (studentData.preferred_learning_style) {
          updateData.student_data.preferred_learning_style = studentData.preferred_learning_style
        }
      } else {
        // Если галочка снята - удаляем студенческие данные
        updateData.student_data = {}
      }

      // Отправка запроса
      const response = await fetch(`http://localhost:8080/api/v1/profiles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Ошибка обновления профиля')
      }

      const result = await response.json()
      console.log('Profile updated:', result)

      // Обновляем пользователя в AuthContext
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

        {/* Уведомления */}
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
            {error}
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
                  background: formData.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'grid',
                  placeContent: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '24px'
                }}>
                  {formData.avatar_url ? (
                    <img 
                      src={`http://localhost:8080${formData.avatar_url}`} 
                      alt="Аватар" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        // Если изображение не загружается, показываем инициалы
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span>{formData.first_name?.[0]}{formData.last_name?.[0]}</span>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Загрузка...' : 'Выбрать файл'}
                    </button>
                    
                    {formData.avatar_url && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleDeleteAvatar}
                        disabled={uploading}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
                    Рекомендуемый размер: 300×300 пикселей, формат JPG или PNG
                  </div>
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

            {/* Менторская информация (раскрывается при активации) */}
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
                  
                  {/* Существующие навыки */}
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

                  {/* Форма добавления нового навыка */}
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

            {/* Студенческая информация (раскрывается при активации) */}
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
              disabled={saving}
            >
              Отмена
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>

      {/* Стили для анимации */}
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