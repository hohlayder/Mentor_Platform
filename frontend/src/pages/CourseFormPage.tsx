// src/pages/CourseFormPage.tsx (исправленная версия)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Header from '../components/Header';

// Обновленные типы на основе Swagger документации
interface Post {
  id: string;
  title: string;
  content: string;
  status: string;
  tags: string[];
  author_id: string;
  avatar_url?: string | null; // Изменено: может быть null
  average_rating: number;
  ratings_count: number;
  created_at: string;
  updated_at: string;
}

interface CreatePostRequest {
  title: string;
  content: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
}

interface UpdatePostRequest {
  post: PostUpdate;
}

interface PostUpdate {
  id: string;
  title?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
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

interface UploadAvatarResponse {
  filename: string;
  url: string;
}

interface DeleteAvatarResponse {
  message: string;
}

const CourseFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { token, user, refreshToken } = useAuth();
  
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
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [course, setCourse] = useState<Post | null>(null);
  const [isCourseOwner, setIsCourseOwner] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  
  // Состояния для загрузки аватара
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Функция для получения URL аватара поста
  const getPostAvatarUrl = (postId: string, filename?: string | null): string | null => {
    if (!filename) return null;
    
    // Если это уже полный URL, возвращаем как есть
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    
    // Если это просто имя файла, формируем URL
    if (!filename.includes('/')) {
      return `http://localhost:8080/api/v1/files/posts/avatar/${filename}`;
    }
    
    // Если это относительный путь
    if (filename.startsWith('/')) {
      return `http://localhost:8080${filename}`;
    }
    
    // Если это путь без префикса http
    if (filename.startsWith('files/posts/avatar/')) {
      return `http://localhost:8080/api/v1/${filename}`;
    }
    
    // По умолчанию используем эндпоинт с post_id
    return `http://localhost:8080/api/v1/files/posts/avatar/${postId}`;
  };

  // Функция для получения URL аватара пользователя
  const getUserAvatarUrl = (filename?: string): string | null => {
    if (!filename) return null;
    
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    
    // Для аватара пользователя: GET /files/avatar/{filename}
    return `http://localhost:8080/api/v1/files/avatar/${filename}`;
  };

  // API клиент с обработкой ошибок и обновлением токена
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && refreshToken) {
      try {
        const refreshResponse = await fetch('http://localhost:8080/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newHeaders = {
            ...headers,
            'Authorization': `Bearer ${refreshData.access_token}`,
          };
          
          response = await fetch(url, { ...options, headers: newHeaders });
        }
      } catch (refreshError) {
        console.error('Ошибка обновления токена:', refreshError);
        navigate('/login', { state: { from: location.pathname } });
        throw new Error('Требуется повторная авторизация');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || 
        errorData.error || 
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return response;
  };

  // Загрузка данных профиля
  const loadProfile = async () => {
    if (!user?.user_id) return null;

    try {
      const response = await fetch(`http://localhost:8080/api/v1/profiles/${user.user_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Ошибка загрузки профиля: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      return null;
    }
  };

  // Загрузка курса
  const loadCourse = async (courseId: string) => {
    try {
      const response = await apiFetch(`http://localhost:8080/api/v1/posts/${courseId}`);
      const data = await response.json();
      return data.post;
    } catch (error) {
      console.error('Ошибка загрузки курса:', error);
      throw error;
    }
  };

  // Инициализация страницы
  useEffect(() => {
    const initializePage = async () => {
      if (!token || !user) {
        navigate('/login', { state: { from: location.pathname } });
        return;
      }

      try {
        // 1. Получаем профиль пользователя (опционально)
        const profileData = await loadProfile();
        setProfile(profileData);
          
        // 2. Если режим редактирования, загружаем курс
        if (isEditMode) {
          const loadedCourse = await loadCourse(id!);
          setCourse(loadedCourse);
          
          // Устанавливаем превью аватара, если он есть
          if (loadedCourse.avatar_url) {
            const avatarUrl = getPostAvatarUrl(loadedCourse.id, loadedCourse.avatar_url);
            console.log('Загруженный avatar_url:', loadedCourse.avatar_url);
            console.log('Сформированный URL аватара:', avatarUrl);
            if (avatarUrl) {
              // Проверяем, существует ли изображение
              try {
                const testResponse = await fetch(avatarUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                  setAvatarPreview(avatarUrl);
                } else {
                  console.warn('Аватар не найден по URL:', avatarUrl);
                  setAvatarPreview(null);
                }
              } catch (err) {
                console.warn('Не удалось проверить аватар:', err);
                setAvatarPreview(null);
              }
            }
          }
          
          // Проверяем, является ли пользователь автором курса
          if (loadedCourse.author_id === user.user_id) {
            setIsCourseOwner(true);
            setFormData({
              title: loadedCourse.title,
              content: loadedCourse.content,
              status: loadedCourse.status,
              tags: loadedCourse.tags || []
            });
          } else {
            setError('Вы не являетесь автором этого курса');
          }
        }
      } catch (err: any) {
        console.error('Ошибка инициализации:', err);
        if (isEditMode) {
          setError(err.message || 'Ошибка при загрузке данных курса');
        }
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

  // Добавление тега с клавишей Enter
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const newTag = tagInput.trim().toLowerCase();
      if (!formData.tags?.includes(newTag)) {
        setFormData(prev => ({
          ...prev,
          tags: [...(prev.tags || []), newTag]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  // Валидация формы
  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return 'Введите название курса';
    }
    if (!formData.content.trim()) {
      return 'Введите описание курса';
    }
    if (formData.title.length > 255) {
      return 'Название не должно превышать 255 символов';
    }
    return null;
  };

  // Обработка отправки формы
  const handleSubmit = async (status: 'draft' | 'published' | 'archived') => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isEditMode && !isCourseOwner) {
      setError('Вы не являетесь автором этого курса');
      return;
    }
  
    setError(null);
    setIsSubmitting(true);

    try {
      let response;
      let url = 'http://localhost:8080/api/v1/posts';
      
      const requestData = {
        title: formData.title,
        content: formData.content,
        status: status === 'archived' ? 'draft' : status,
        tags: formData.tags
      };

      if (isEditMode) {
        // Редактирование существующего курса
        url = `http://localhost:8080/api/v1/posts/${id}`;
        const updateData: UpdatePostRequest = {
          post: {
            id: id!,
            ...requestData
          }
        };
        
        response = await apiFetch(url, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
      } else {
        // Создание нового курса
        response = await apiFetch(url, {
          method: 'POST',
          body: JSON.stringify(requestData)
        });
      }

      const data = await response.json();
      console.log('Ответ от сервера:', data);
      
      // Получаем ID созданного/обновленного курса
      const courseId = isEditMode ? id : data.post?.id || data.id;
      
      // Если был выбран файл для загрузки и курс создан/обновлен
      if (avatarFile && courseId) {
        try {
          await uploadAvatarForPost(courseId, avatarFile);
          
          // Не обновляем локальное состояние, так как после редиректа
          // страница курса загрузит данные с сервера
        } catch (uploadError) {
          console.error('Ошибка загрузки аватара:', uploadError);
          // Продолжаем несмотря на ошибку загрузки аватара
          // Можно показать предупреждение, но не прерывать процесс
        }
      }
      
      // Редирект на страницу курса
      navigate(`/courses/${courseId}`, {
        state: { 
          message: `Курс успешно ${isEditMode ? 'обновлен' : 'создан'}`,
          ...(avatarFile ? { avatarUploaded: true } : {})
        }
      });
      
    } catch (err: any) {
      console.error('Ошибка создания/обновления курса:', err);
      
      if (err.message.includes('403') || err.message.includes('Forbidden')) {
        setError('У вас нет прав для создания или редактирования курсов');
      } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Требуется авторизация. Пожалуйста, войдите снова.');
        navigate('/login', { state: { from: location.pathname } });
      } else {
        setError(err.message || `Произошла ошибка при ${isEditMode ? 'обновлении' : 'создании'} курса`);
      }
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
      await apiFetch(`http://localhost:8080/api/v1/posts/${id}`, {
        method: 'DELETE'
      });

      navigate('/courses', {
        state: { message: 'Курс успешно удален' }
      });
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      setError(err.message || 'Произошла ошибка при удалении курса');
      setIsSubmitting(false);
    }
  };

  // Обработка выбора файла для аватара
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Неподдерживаемый формат файла. Разрешены: JPG, PNG, GIF, SVG');
      return;
    }

    // Проверка размера файла (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setAvatarError('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    setAvatarFile(file);
    setAvatarError(null);

    // Создание превью из файла
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Загрузка аватара для поста
  const uploadAvatarForPost = async (postId: string, file: File): Promise<UploadAvatarResponse> => {
    setIsUploadingAvatar(true);
    setAvatarError(null);
    
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
      // ПРАВИЛЬНЫЙ эндпоинт: POST /files/posts/avatar/{post_id}
      const response = await fetch(`http://localhost:8080/api/v1/files/posts/avatar/${postId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Ошибка загрузки аватара';
        
        if (response.status === 413) {
          errorMessage = 'Файл слишком большой (максимум 5MB)';
        } else if (response.status === 415) {
          errorMessage = 'Неподдерживаемый формат файла';
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
        
        throw new Error(errorMessage);
      }
      
      const data: UploadAvatarResponse = await response.json();
      console.log('Аватар загружен:', data);
      
      return data;
    } catch (err: any) {
      console.error('Ошибка загрузки аватара:', err);
      setAvatarError(err.message || 'Не удалось загрузить аватар');
      throw err;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Удаление аватара поста
  const handleAvatarDelete = async () => {
    if (!id) return;

    if (!window.confirm('Вы уверены, что хотите удалить аватар курса?')) {
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarError(null);
    
    try {
      // ПРАВИЛЬНЫЙ эндпоинт: DELETE /files/posts/avatar/{post_id}
      const response = await fetch(`http://localhost:8080/api/v1/files/posts/avatar/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Ошибка удаления аватара');
      }
      
      const data: DeleteAvatarResponse = await response.json();
      console.log('Аватар удален:', data);
      
      // Сбрасываем превью и состояние
      setAvatarPreview(null);
      setAvatarFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Обновляем состояние курса
      if (course) {
        setCourse({
          ...course,
          avatar_url: null
        });
      }
      
    } catch (err: any) {
      console.error('Ошибка удаления аватара:', err);
      setAvatarError(err.message || 'Не удалось удалить аватар');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Отдельная загрузка аватара (для режима редактирования)
  const handleAvatarUpload = async () => {
    if (!id || !avatarFile) return;
    
    try {
      const uploadResult = await uploadAvatarForPost(id, avatarFile);
      
      // Обновляем превью с URL от сервера
      const newAvatarUrl = getPostAvatarUrl(id, uploadResult.filename || uploadResult.url);
      if (newAvatarUrl) {
        // Проверяем, что изображение загрузилось
        try {
          const testResponse = await fetch(newAvatarUrl, { method: 'HEAD' });
          if (testResponse.ok) {
            setAvatarPreview(newAvatarUrl);
          }
        } catch (err) {
          console.warn('Не удалось проверить загруженный аватар:', err);
        }
      }
      
      // Обновляем состояние курса
      if (course) {
        setCourse({
          ...course,
          avatar_url: uploadResult.filename || uploadResult.url
        });
      }
      
      // Сбрасываем файл после успешной загрузки
      setAvatarFile(null);
      
    } catch (error) {
      // Ошибка уже обработана в uploadAvatarForPost
      console.error('Ошибка загрузки аватара:', error);
    }
  };

  // Очистка выбранного файла (без загрузки на сервер)
  const handleAvatarClear = () => {
    // Если есть текущий аватар курса, возвращаем его в превью
    if (course?.avatar_url) {
      const currentAvatarUrl = getPostAvatarUrl(id!, course.avatar_url);
      if (currentAvatarUrl) {
        setAvatarPreview(currentAvatarUrl);
      }
    } else {
      setAvatarPreview(null);
    }
    
    setAvatarFile(null);
    setAvatarError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Триггер клика по скрытому input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Получаем имя пользователя для отображения
  const getUserDisplayName = () => {
    if (profile?.user?.first_name && profile?.user?.last_name) {
      return `${profile.user.first_name} ${profile.user.last_name}`;
    }
    if (profile?.user?.email) {
      return profile.user.email;
    }
    return user?.email || 'Пользователь';
  };

  // Получаем инициалы для аватара
  const getUserInitials = () => {
    if (profile?.user?.first_name && profile?.user?.last_name) {
      return `${profile.user.first_name[0]}${profile.user.last_name[0]}`.toUpperCase();
    }
    if (profile?.user?.email) {
      return profile.user.email[0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'П';
  };

  // UI компоненты
  const LoadingSpinner = () => (
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

  const AccessDeniedView = () => (
    <div className="container">
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ 
            fontSize: '48px',
            marginBottom: '20px',
            color: 'var(--muted)'
          }}>
            🚫
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
            Нет прав доступа
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
            {error || 'Вы не являетесь автором этого курса'}
          </p>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/courses')}
              className="btn btn-outline"
            >
              К курсам
            </button>
            <button
              onClick={() => navigate(`/profile/${user?.user_id}/edit`)}
              className="btn btn-primary"
            >
              Редактировать профиль
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const CourseStatusBadge = ({ course }: { course: Post }) => {
    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'published':
          return { text: '✅ Опубликован', color: 'var(--accent)', bg: 'var(--accent-lightest)' };
        case 'draft':
          return { text: '✏️ Черновик', color: '#D97706', bg: '#FEF3C7' };
        case 'archived':
          return { text: '📦 В архиве', color: '#6B7280', bg: '#F3F4F6' };
        default:
          return { text: status, color: '#6B7280', bg: '#F3F4F6' };
      }
    };

    const statusConfig = getStatusConfig(course.status);

    return (
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        alignItems: 'center',
        padding: '12px',
        background: statusConfig.bg,
        borderRadius: '10px',
        marginTop: '12px',
        flexWrap: 'wrap' as const
      }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Текущий статус:</div>
          <div style={{ fontWeight: 600, color: statusConfig.color }}>
            {statusConfig.text}
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
        {course.status === 'published' && course.ratings_count > 0 && (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Оценок:</div>
            <div>{course.ratings_count} ({course.average_rating.toFixed(1)}★)</div>
          </div>
        )}
      </div>
    );
  };

  // Компонент загрузки аватара
  const AvatarUploadSection = () => {
    // Определяем, что показывать в превью
    const renderPreview = () => {
      if (avatarPreview) {
        return (
          <img 
            src={avatarPreview} 
            alt="Превью аватара курса" 
            style={{ 
              width: '200px', 
              height: '200px',
              borderRadius: '12px',
              objectFit: 'cover',
              border: '2px solid var(--glass)'
            }}
            onError={(e) => {
              console.error('Ошибка загрузки изображения:', avatarPreview);
              // Если изображение не загрузилось, показываем заглушку
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = document.createElement('div');
                fallback.style.width = '200px';
                fallback.style.height = '200px';
                fallback.style.borderRadius = '12px';
                fallback.style.background = 'var(--glass)';
                fallback.style.display = 'flex';
                fallback.style.flexDirection = 'column';
                fallback.style.alignItems = 'center';
                fallback.style.justifyContent = 'center';
                fallback.style.color = 'var(--muted)';
                fallback.innerHTML = `
                  <div style="font-size: 48px; margin-bottom: 8px;">📷</div>
                  <div style="font-size: 14px; text-align: center;">Изображение курса</div>
                `;
                parent.appendChild(fallback);
              }
            }}
          />
        );
      }
      
      return (
        <div style={{ 
          width: '200px', 
          height: '200px',
          borderRadius: '12px',
          background: 'var(--glass)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          border: '2px dashed var(--border)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>
            📷
          </div>
          <div style={{ fontSize: '14px', textAlign: 'center' }}>
            Изображение курса
          </div>
        </div>
      );
    };

    return (
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
          Изображение курса
        </h2>
        
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            {/* Превью аватара */}
            <div style={{ position: 'relative' }}>
              {renderPreview()}
              
              {/* Кнопка удаления поверх изображения - показываем если есть аватар или выбран файл */}
              {(avatarFile || (isEditMode && course?.avatar_url)) && (
                <button
                  type="button"
                  onClick={avatarFile ? handleAvatarClear : handleAvatarDelete}
                  disabled={isUploadingAvatar}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.9)',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    opacity: isUploadingAvatar ? 0.5 : 1
                  }}
                  title={avatarFile ? "Отменить выбор файла" : "Удалить изображение"}
                >
                  ×
                </button>
              )}
            </div>

            {/* Информация о файле */}
            {avatarFile && (
              <div style={{ 
                width: '100%',
                padding: '12px',
                background: 'var(--glass)',
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500 }}>Файл:</span>
                  <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {avatarFile.name}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>Размер:</span>
                  <span>{(avatarFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>
            )}

            {/* Сообщение об ошибке загрузки аватара */}
            {avatarError && (
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                width: '100%',
                fontSize: '14px'
              }}>
                {avatarError}
              </div>
            )}

            {/* Кнопки управления аватаром */}
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              width: '100%',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              {/* Скрытый input для выбора файла */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/jpeg,image/jpg,image/png,image/gif,image/svg+xml"
                style={{ display: 'none' }}
              />
              
              <button
                type="button"
                onClick={triggerFileInput}
                className="btn btn-outline"
                disabled={isUploadingAvatar}
                style={{ flex: 1, minWidth: '140px' }}
              >
                {isUploadingAvatar ? 'Загрузка...' : 'Выбрать файл'}
              </button>
              
              {avatarFile && (
                <>
                  <button
                    type="button"
                    onClick={handleAvatarClear}
                    className="btn btn-ghost"
                    disabled={isUploadingAvatar}
                    style={{ flex: 1, minWidth: '120px' }}
                  >
                    Отменить
                  </button>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={handleAvatarUpload}
                      className="btn btn-primary"
                      disabled={isUploadingAvatar}
                      style={{ flex: 1, minWidth: '160px' }}
                    >
                      Загрузить сейчас
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Информация о требованиях к файлу */}
            <div style={{ 
              fontSize: '13px', 
              color: 'var(--muted)',
              textAlign: 'center',
              width: '100%',
              paddingTop: '12px',
              borderTop: '1px solid var(--glass)'
            }}>
              <div>Поддерживаемые форматы: JPG, PNG, GIF, SVG</div>
              <div>Максимальный размер: 5MB</div>
              {!isEditMode && (
                <div style={{ marginTop: '8px', fontStyle: 'italic', color: 'var(--accent)' }}>
                  Изображение будет загружено после создания курса
                </div>
              )}
              {isEditMode && avatarFile && (
                <div style={{ marginTop: '8px', fontStyle: 'italic', color: 'var(--accent)' }}>
                  Нажмите "Загрузить сейчас" или сохраните курс для загрузки изображения
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) return <LoadingSpinner />;
  if (isEditMode && !isCourseOwner) return <AccessDeniedView />;

  // Определяем роль пользователя для отображения
  const getUserRole = () => {
    if (profile?.mentor) return ' (ментор)';
    if (profile?.student) return ' (студент)';
    return '';
  };

  // Получаем URL аватара пользователя
  const userAvatarUrl = profile?.user?.avatar_url ? getUserAvatarUrl(profile.user.avatar_url) : null;

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

        {/* Заголовок с информацией о пользователе */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            marginBottom: '16px' 
          }}>
            {/* Аватар пользователя с безопасным доступом */}
            {userAvatarUrl ? (
              <img 
                src={userAvatarUrl} 
                alt="Аватар" 
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  console.error('Ошибка загрузки аватара пользователя:', userAvatarUrl);
                  // Показываем заглушку если аватар не загрузился
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.style.width = '60px';
                    fallback.style.height = '60px';
                    fallback.style.borderRadius = '50%';
                    fallback.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-2))';
                    fallback.style.display = 'grid';
                    fallback.style.placeContent = 'center';
                    fallback.style.color = '#fff';
                    fallback.style.fontWeight = '600';
                    fallback.style.fontSize = '20px';
                    fallback.textContent = getUserInitials();
                    parent.appendChild(fallback);
                  }
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
                {getUserInitials()}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>
                {isEditMode ? 'Редактировать курс' : 'Создать новый курс'}
              </h1>
              <p style={{ color: 'var(--muted)' }}>
                {isEditMode 
                  ? `Вы редактируете курс как: ${getUserDisplayName()}${getUserRole()}`
                  : `Вы создаете курс как: ${getUserDisplayName()}${getUserRole()}`}
              </p>
            </div>
          </div>
          
          {isEditMode && course && <CourseStatusBadge course={course} />}
        </div>

        {/* Форма */}
        <div>
          {/* Секция загрузки аватара */}
          <AvatarUploadSection />

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
                    placeholder="Введите тег и нажмите Добавить или Enter"
                    style={{ flex: 1 }}
                    onKeyDown={handleTagKeyDown}
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
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
                  Используйте теги для облегчения поиска курса (например: "программирование", "дизайн", "маркетинг")
                </div>
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
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', textAlign: 'right' }}>
                {formData.content.length} символов
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
                disabled={isSubmitting || isUploadingAvatar}
              >
                Отмена
              </button>
              
              {isEditMode && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn btn-outline"
                  disabled={isSubmitting || isUploadingAvatar}
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
                  disabled={isSubmitting || isUploadingAvatar}
                  style={{ color: '#6B7280', borderColor: '#D1D5DB' }}
                >
                  📦 В архив
                </button>
              )}
              
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                className="btn btn-outline"
                disabled={isSubmitting || isUploadingAvatar}
              >
                {isSubmitting ? 'Сохранение...' : 
                  isEditMode ? 'Сохранить черновик' : 'Сохранить как черновик'}
              </button>
              
              <button
                type="button"
                onClick={() => handleSubmit('published')}
                className="btn btn-primary"
                disabled={isSubmitting || isUploadingAvatar}
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
              <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.6 }}>
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
                  disabled={isSubmitting || isUploadingAvatar}
                  style={{ padding: '10px 20px' }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('archived')}
                  className="btn btn-outline"
                  disabled={isSubmitting || isUploadingAvatar}
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

        {/* Информация о профиле пользователя - только если профиль загружен */}
        {profile && profile.user && (
          <div className="card" style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
              Информация о пользователе
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
                  {profile.user.first_name && profile.user.last_name 
                    ? `${profile.user.first_name} ${profile.user.last_name}`
                    : 'Не указано'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>Email:</div>
                <div style={{ fontWeight: 500 }}>{profile.user.email || 'Не указан'}</div>
              </div>
              {profile.mentor && (
                <div>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>Роль:</div>
                  <div style={{ fontWeight: 500, color: 'var(--accent)' }}>Ментор</div>
                </div>
              )}
              {profile.student && !profile.mentor && (
                <div>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>Роль:</div>
                  <div style={{ fontWeight: 500, color: 'var(--accent-2)' }}>Студент</div>
                </div>
              )}
              {profile.mentor?.description && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>Описание ментора:</div>
                  <div>{profile.mentor.description}</div>
                </div>
              )}
              {profile.mentor?.rating && profile.mentor.rating > 0 && (
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
        
        @media (max-width: 768px) {
          .action-buttons {
            flex-direction: column;
          }
          
          .left-buttons, .right-buttons {
            flex-direction: column;
            width: 100%;
          }
          
          .mentor-details {
            grid-template-columns: 1fr !important;
          }
          
          .course-status-badge {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          
          .avatar-upload-buttons {
            flex-direction: column;
          }
          
          .avatar-upload-buttons button {
            width: 100%;
            margin-bottom: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default CourseFormPage;