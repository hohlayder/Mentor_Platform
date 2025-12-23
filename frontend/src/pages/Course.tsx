// src/pages/CoursePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Хук для управления темой
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

// Типы на основе Swagger
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

// Типы для слотов (на основе Swagger)
interface SlotResponse {
  id: string;
  mentor_id: string;
  title: string;
  description?: string;
  start_time: string;
  duration_minutes: number;
  price?: number;
  currency?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CreateSlotRequest {
  mentor_id: string;
  title: string;
  description?: string;
  start_time: string;
  duration_minutes: number;
  price?: number;
  currency?: string;
  status?: string;
}

interface UpdateSlotStatusRequest {
  status: string;
}

// Типы для сессий
interface CreateSessionRequest {
  slot_id: string;
  student_id: string;
  payment_status?: string;
}

interface SessionResponse {
  id: string;
  slot_id: string;
  student_id: string;
  payment_status: string;
  rating?: number;
  review?: string;
  created_at: string;
  updated_at: string;
}

// Типы для чатов
interface Chat {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
}

// Дни недели
const DAYS_OF_WEEK = [
  { id: 1, name: 'Понедельник', short: 'Пн' },
  { id: 2, name: 'Вторник', short: 'Вт' },
  { id: 3, name: 'Среда', short: 'Ср' },
  { id: 4, name: 'Четверг', short: 'Чт' },
  { id: 5, name: 'Пятница', short: 'Пт' },
  { id: 6, name: 'Суббота', short: 'Сб' },
  { id: 7, name: 'Воскресенье', short: 'Вс' },
];

// Временные слоты
const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', 
  '19:00', '20:00'
];

// Длительности сессий
const DURATIONS = [
  { value: 15, label: '15 минут' },
  { value: 30, label: '30 минут' },
  { value: 45, label: '45 минут' },
  { value: 60, label: '1 час' },
  { value: 90, label: '1.5 часа' },
  { value: 120, label: '2 часа' },
];

// Статусы слотов
const SLOT_STATUSES = {
  available: { label: 'Доступен', color: '#10b981', emoji: '🟢' },
  booked: { label: 'Забронирован', color: '#f59e0b', emoji: '🟡' },
  closed: { label: 'Закрыт', color: '#ef4444', emoji: '🔴' }
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
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'slots'>('description');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  
  // Состояния для слотов
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [creatingSlots, setCreatingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotSuccess, setSlotSuccess] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);

  // Данные для создания слотов
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotPrice, setSlotPrice] = useState<number | ''>('');
  const [slotCurrency, setSlotCurrency] = useState('RUB');
  const [slotDescription, setSlotDescription] = useState('');
  const [slotTitle, setSlotTitle] = useState('');

  // Инициализируем заголовок слота при загрузке курса
  useEffect(() => {
    if (course) {
      setSlotTitle(`Консультация: ${course.title}`);
      // Загружаем слоты и сессии
      loadSlotsAndSessions();
    }
  }, [course]);

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

  // Функция для создания/перехода в чат с автором
  const handleStartChat = async (mentorId: string) => {
    if (!token || !user) {
      navigate('/login', { state: { returnTo: `/course/${id}` } });
      return;
    }

    try {
      // 1. Получаем список всех чатов пользователя
      const chatsResponse = await fetch('http://localhost:8080/api/v1/chats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!chatsResponse.ok) {
        throw new Error('Ошибка при загрузке чатов');
      }

      const chatsData = await chatsResponse.json();
      
      // 2. Ищем существующий чат с этим ментором
      const existingChat = chatsData.chats?.find((chat: Chat) => 
        (chat.user1_id === mentorId && chat.user2_id === user.user_id) ||
        (chat.user2_id === mentorId && chat.user1_id === user.user_id)
      );

      if (existingChat) {
        // 3. Если чат существует - переходим в него
        navigate(`/chats?chat=${existingChat.id}`);
      } else {
        // 4. Если чата нет - создаем новый
        const createResponse = await fetch('http://localhost:8080/api/v1/chats', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            other_user_id: mentorId
          })
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(errorData.message || 'Ошибка создания чата');
        }

        const createData = await createResponse.json();
        
        // 5. Переходим в созданный чат
        navigate(`/chats?chat=${createData.chat_id}`);
      }

    } catch (err: any) {
      console.error('Ошибка при создании/переходе в чат:', err);
      setError(err.message || 'Не удалось открыть чат');
    }
  };

  // Загрузка слотов и сессий
  const loadSlotsAndSessions = async () => {
    if (!author || !token) return;
    
    setLoadingSlots(true);
    try {
      // Загружаем сессии студента (если пользователь студент)
      if (user && profile?.student) {
        const sessionsResponse = await fetch(
          `http://localhost:8080/api/v1/students/${user.user_id}/sessions`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          setSessions(sessionsData.sessions || []);
        }
      }
      
      // В реальном приложении здесь был бы запрос к API для получения слотов ментора
      // Пока оставляем пустой массив
      setSlots([]);
      
    } catch (err: any) {
      console.error('Ошибка загрузки слотов и сессий:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Проверка, забронирован ли слот текущим пользователем
  const isSlotBookedByCurrentUser = (slotId: string) => {
    if (!user) return false;
    return sessions.some(session => 
      session.slot_id === slotId && session.student_id === user.user_id
    );
  };

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

        // 3. Загружаем профиль автора
        const profileResponse = await fetch(`http://localhost:8080/api/v1/profiles/${loadedCourse.author_id}`, { headers });
        
        if (profileResponse.ok) {
          const profileData: ProfileResponse = await profileResponse.json();
          setProfile(profileData);
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
  const canRate = !isAuthor && token && sessions.length > 0; // Могут оценивать те, кто был на сессиях
  const statusInfo = course ? getStatusInfo(course.status) : getStatusInfo('');
  const isStudent = profile?.student && token && user?.user_id === profile.student.user_id;

  // Функция для изменения статуса курса
  const updateCourseStatus = async (newStatus: 'draft' | 'published' | 'archived') => {
    if (!token || !course) return;

    const action = newStatus === 'archived' ? 'архивации' : 
                   newStatus === 'published' ? 'публикации' : 'перевода в черновик';
    
    if (!window.confirm(`Вы уверены, что хотите ${action} курс "${course.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/posts/${course.id}`, {
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
      });

      if (response.ok) {
        const data: UpdatePostResponse = await response.json();
        setCourse(data.post);
        
        // Показываем уведомление об успехе
        const successMessage = newStatus === 'archived' ? 'Курс перемещен в архив' :
                               newStatus === 'published' ? 'Курс опубликован' : 
                               'Курс переведен в черновик';
        alert(`✅ ${successMessage}!`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Ошибка при ${action} курса`);
      }
    } catch (err: any) {
      console.error(`Ошибка ${action} курса:`, err);
      setError(err.message || `Не удалось ${action} курс`);
    }
  };

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

  // Бронирование слота
  const bookSlot = async (slotId: string) => {
    if (!token || !user) {
      setBookingError('Необходимо авторизоваться');
      return;
    }

    setBookingSlotId(slotId);
    setBookingError(null);
    setBookingSuccess(false);

    try {
      const response = await fetch('http://localhost:8080/api/v1/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slot_id: slotId,
          student_id: user.user_id
        } as CreateSessionRequest)
      });

      if (response.ok) {
        const data = await response.json();
        setBookingSuccess(true);
        // Обновляем список сессий
        loadSlotsAndSessions();
        // Убираем успешное сообщение через 3 секунды
        setTimeout(() => {
          setBookingSuccess(false);
        }, 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при бронировании');
      }
    } catch (err: any) {
      console.error('Ошибка бронирования:', err);
      setBookingError(err.message || 'Не удалось забронировать слот');
    } finally {
      setBookingSlotId(null);
    }
  };

  // Отмена бронирования сессии
  const cancelSession = async (sessionId: string) => {
    if (!token || !window.confirm('Вы уверены, что хотите отменить сессию?')) {
      return;
    }

    setCancelingSessionId(sessionId);
    try {
      const response = await fetch(`http://localhost:8080/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Обновляем список сессий
        loadSlotsAndSessions();
        alert('✅ Сессия отменена!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при отмене сессии');
      }
    } catch (err: any) {
      console.error('Ошибка отмены сессии:', err);
      setError(err.message || 'Не удалось отменить сессию');
    } finally {
      setCancelingSessionId(null);
    }
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

  // Функция для создания слотов (для преподавателя)
  const createSlots = async () => {
    if (!token || !user || !course) return;
    
    // Валидация
    if (selectedDays.length === 0) {
      setSlotError('Выберите хотя бы один день недели');
      return;
    }
    
    if (selectedTimes.length === 0) {
      setSlotError('Выберите хотя бы одно время');
      return;
    }
    
    if (!slotTitle.trim()) {
      setSlotError('Введите заголовок слота');
      return;
    }

    setCreatingSlots(true);
    setSlotError(null);

    try {
      // Для каждого выбранного дня и времени создаем слот
      const requests: CreateSlotRequest[] = [];
      
      // Рассчитываем даты на следующую неделю для выбранных дней
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      selectedDays.forEach(dayIndex => {
        selectedTimes.forEach(time => {
          // Находим дату для этого дня недели на следующей неделе
          const targetDate = new Date(nextWeek);
          const currentDay = targetDate.getDay() || 7; // Преобразуем воскресенье (0) в 7
          const daysToAdd = (dayIndex - currentDay + 7) % 7;
          targetDate.setDate(targetDate.getDate() + daysToAdd);
          
          // Создаем полную дату и время
          const [hours, minutes] = time.split(':').map(Number);
          targetDate.setHours(hours, minutes, 0, 0);
          
          // Форматируем в ISO строку
          const startTimeISO = targetDate.toISOString();
          
          requests.push({
            mentor_id: user.user_id,
            title: slotTitle,
            description: slotDescription || undefined,
            start_time: startTimeISO,
            duration_minutes: slotDuration,
            price: slotPrice ? Number(slotPrice) : undefined,
            currency: slotPrice ? slotCurrency : undefined,
            status: 'available'
          } as CreateSlotRequest);
        });
      });

      // Отправляем запросы на создание слотов
      const promises = requests.map(async (slotData) => {
        const response = await fetch('http://localhost:8080/api/v1/slots', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(slotData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Ошибка создания слота');
        }

        return response.json();
      });

      const results = await Promise.all(promises);
      
      setSlotSuccess(true);
      // Обновляем список слотов
      loadSlotsAndSessions();
      
      setTimeout(() => {
        setSlotSuccess(false);
        // Сброс формы
        setSelectedDays([]);
        setSelectedTimes([]);
        setSlotDuration(60);
        setSlotPrice('');
        setSlotDescription('');
      }, 2000);

    } catch (err: any) {
      console.error('Ошибка создания слотов:', err);
      setSlotError(err.message || 'Не удалось создать слоты');
    } finally {
      setCreatingSlots(false);
    }
  };

  // Изменение статуса слота
  const updateSlotStatus = async (slotId: string, newStatus: string) => {
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8080/api/v1/slots/${slotId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        } as UpdateSlotStatusRequest)
      });

      if (response.ok) {
        // Обновляем список слотов
        loadSlotsAndSessions();
        alert(`✅ Статус слота изменен на "${SLOT_STATUSES[newStatus as keyof typeof SLOT_STATUSES]?.label || newStatus}"`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при изменении статуса слота');
      }
    } catch (err: any) {
      console.error('Ошибка изменения статуса слота:', err);
      setError(err.message || 'Не удалось изменить статус слота');
    }
  };

  // Функции для выбора дней и времени
  const toggleDaySelection = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
    );
  };

  const toggleTimeSelection = (time: string) => {
    setSelectedTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const clearAllSelections = () => {
    setSelectedDays([]);
    setSelectedTimes([]);
    setSlotDuration(60);
    setSlotPrice('');
    setSlotDescription('');
    setSlotError(null);
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

  // Форматирование времени
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Полная дата и время
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
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

  // Рендер слотов для бронирования
  const renderAvailableSlots = () => {
    if (loadingSlots) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid var(--glass)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            margin: '0 auto 20px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'var(--muted)' }}>Загрузка доступных слотов...</p>
        </div>
      );
    }

    // В реальном приложении здесь был бы запрос к API для получения слотов
    // Для демонстрации показываем сообщение
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
        <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '18px' }}>
          {isAuthor ? 'Ваши слоты' : 'Доступные слоты'}
        </h4>
        <p>
          {isAuthor 
            ? 'Здесь будут отображаться созданные вами временные слоты' 
            : 'Здесь будут отображаться доступные слоты для записи'}
        </p>
        {isAuthor && profile?.mentor && (
          <button
            className="btn btn-primary"
            onClick={() => setShowSlotModal(true)}
            style={{ marginTop: '16px' }}
          >
            🕒 Создать слоты
          </button>
        )}
      </div>
    );
  };

  // Рендер сессий пользователя
  const renderUserSessions = () => {
    if (sessions.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
          <p>У вас нет запланированных сессий</p>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Ваши сессии:</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.map(session => {
            const slot = slots.find(s => s.id === session.slot_id);
            return (
              <div key={session.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {slot?.title || 'Сессия'}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
                      {slot ? formatDateTime(slot.start_time) : 'Время не указано'}
                      {slot && ` • ${slot.duration_minutes} минут`}
                    </div>
                    {slot?.description && (
                      <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                        {slot.description}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Статус: {session.payment_status || 'не указан'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {session.rating ? (
                      <div style={{ 
                        background: 'var(--glass)', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        Оценка: {session.rating}/5
                      </div>
                    ) : (
                      <button
                        className="btn btn-outline"
                        onClick={() => {/* Оценить сессию */}}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        Оценить
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => cancelSession(session.id)}
                      disabled={cancelingSessionId === session.id}
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        color: '#ef4444'
                      }}
                    >
                      {cancelingSessionId === session.id ? 'Отмена...' : 'Отменить'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                  
                  {/* Кнопка добавления слотов (только для автора-преподавателя) */}
                  {isAuthor && profile?.mentor && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowSlotModal(true)}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 20px',
                        background: 'linear-gradient(135deg, var(--accent-2), #10b981)'
                      }}
                    >
                      🕒 Создать слоты
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
                    onClick={() => handleStartChat(author.user_id)}
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
            className={`btn ${activeTab === 'slots' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('slots')}
            style={{ whiteSpace: 'nowrap', fontSize: '14px', padding: '10px 16px' }}
          >
            📅 Доступные слоты
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

          {activeTab === 'slots' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>
                {isAuthor ? 'Управление слотами' : 'Запись на сессии'}
              </h3>
              
              {/* Сообщение об успешном бронировании */}
              {bookingSuccess && (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: '#10b981',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  ✅ Вы успешно записались на сессию!
                </div>
              )}
              
              {/* Сообщение об ошибке бронирования */}
              {bookingError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  {bookingError}
                </div>
              )}
              
              {/* Информация для преподавателя */}
              
              {/* Информация для студентов */}
              {!isAuthor && token && (
                <div style={{
                  background: 'rgba(79, 70, 229, 0.05)',
                  border: '1px solid rgba(79, 70, 229, 0.1)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>
                    🎓 Запись на индивидуальные сессии
                  </div>
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    Выберите удобное время для консультации с преподавателем. После записи вы сможете общаться в чате.
                  </p>
                </div>
              )}
              
              {/* Список доступных слотов */}
              {renderAvailableSlots()}
              
              {/* Сессии пользователя (для студентов) */}
              {!isAuthor && token && renderUserSessions()}
              
              {/* Информация для неавторизованных пользователей */}
              {!token && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '18px' }}>
                    Войдите для доступа к слотам
                  </h4>
                  <p>Авторизуйтесь, чтобы видеть доступные слоты и записываться на индивидуальные сессии</p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                    <Link to="/login" className="btn btn-primary">
                      Войти
                    </Link>
                    <Link to="/signup" className="btn btn-outline">
                      Регистрация
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Отзывы о курсе</h3>
              
              {/* Форма оценки (только для тех, кто был на сессиях) */}
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

      {/* Модальное окно для создания слотов */}
      {showSlotModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '24px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--glass)'
          }}>
            {/* Заголовок модального окна */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--glass)'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>🕒 Настройка временных слотов</h2>
              <button
                onClick={() => setShowSlotModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--muted)'
                }}
              >
                ×
              </button>
            </div>

            {/* Сообщение об успехе */}
            {slotSuccess && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                color: '#10b981',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                ✅ Слоты успешно созданы!
              </div>
            )}

            {/* Сообщение об ошибке */}
            {slotError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                {slotError}
              </div>
            )}

            {/* Основная форма */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Заголовок слота
              </label>
              <input
                type="text"
                value={slotTitle}
                onChange={(e) => setSlotTitle(e.target.value)}
                placeholder="Например: Консультация по React"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}
              />

              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Описание (опционально)
              </label>
              <textarea
                value={slotDescription}
                onChange={(e) => setSlotDescription(e.target.value)}
                placeholder="Дополнительная информация о сессии..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '14px',
                  marginBottom: '20px',
                  resize: 'vertical'
                }}
              />

              {/* Длительность сессии */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>
                  Длительность сессии (15-240 минут)
                </label>
                <div className="chips" style={{ gap: '8px' }}>
                  {DURATIONS.map(duration => (
                    <button
                      key={duration.value}
                      type="button"
                      onClick={() => setSlotDuration(duration.value)}
                      className={`chip ${slotDuration === duration.value ? 'active' : ''}`}
                      style={{
                        border: 'none',
                        background: slotDuration === duration.value ? 'var(--accent)' : 'transparent',
                        color: slotDuration === duration.value ? '#fff' : 'inherit'
                      }}
                    >
                      {duration.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Выбор дней недели */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>
                  Выберите дни недели
                </label>
                <div className="chips" style={{ gap: '8px' }}>
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDaySelection(day.id)}
                      className={`chip ${selectedDays.includes(day.id) ? 'active' : ''}`}
                      style={{
                        border: 'none',
                        background: selectedDays.includes(day.id) ? 'var(--accent)' : 'transparent',
                        color: selectedDays.includes(day.id) ? '#fff' : 'inherit'
                      }}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Выбор времени */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>
                  Выберите время
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '8px'
                }}>
                  {TIME_SLOTS.map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => toggleTimeSelection(time)}
                      className={`chip ${selectedTimes.includes(time) ? 'active' : ''}`}
                      style={{
                        border: 'none',
                        background: selectedTimes.includes(time) ? 'var(--accent)' : 'transparent',
                        color: selectedTimes.includes(time) ? '#fff' : 'inherit',
                        fontSize: '14px',
                        padding: '8px'
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {/* Настройки цены */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 500 }}>
                  Цена (опционально, 0-1000000)
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={slotPrice}
                    onChange={(e) => setSlotPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    min="0"
                    max="1000000"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '14px'
                    }}
                  />
                  <select
                    value={slotCurrency}
                    onChange={(e) => setSlotCurrency(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '14px',
                      minWidth: '80px'
                    }}
                  >
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="KZT">₸ KZT</option>
                  </select>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
                  {slotPrice ? `Будет создано ${selectedDays.length * selectedTimes.length} слотов` : 'Бесплатные сессии'}
                </div>
              </div>

              {/* Предварительный просмотр */}
              {selectedDays.length > 0 && selectedTimes.length > 0 && (
                <div style={{
                  background: 'var(--glass)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontWeight: 600 }}>Предварительный просмотр:</div>
                    <button
                      onClick={clearAllSelections}
                      className="btn btn-ghost"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      Очистить все
                    </button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                    Будет создано <strong>{selectedDays.length * selectedTimes.length}</strong> слотов:
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    maxHeight: '120px', 
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '6px'
                  }}>
                    {selectedDays.map(dayId => {
                      const day = DAYS_OF_WEEK.find(d => d.id === dayId);
                      return selectedTimes.map(time => (
                        <div key={`${dayId}-${time}`} style={{ 
                          padding: '4px 8px', 
                          marginBottom: '4px',
                          background: 'rgba(79, 70, 229, 0.05)',
                          borderRadius: '4px'
                        }}>
                          {day?.name}, {time} ({slotDuration} мин){slotPrice ? ` - ${slotPrice} ${slotCurrency}` : ''}
                        </div>
                      ));
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Кнопки действий */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowSlotModal(false)}
                disabled={creatingSlots}
                style={{ padding: '10px 20px' }}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={createSlots}
                disabled={creatingSlots || selectedDays.length === 0 || selectedTimes.length === 0}
                style={{ 
                  padding: '10px 24px',
                  background: creatingSlots ? 'var(--muted)' : 'var(--accent)'
                }}
              >
                {creatingSlots ? (
                  <>
                    <span style={{ 
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      marginRight: '8px',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Создание...
                  </>
                ) : (
                  `Создать ${selectedDays.length * selectedTimes.length} слотов`
                )}
              </button>
            </div>
          </div>
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