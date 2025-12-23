// src/pages/CoursePage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// Типы для слотов (обновлены)
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

interface UpdateSlotRequest {
  title?: string;
  description?: string;
  start_time?: string;
  duration_minutes?: number;
  price?: number;
  currency?: string;
  status?: string;
}

interface UpdateSlotStatusRequest {
  status: string;
}

// Типы для сессий (обновлены)
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

interface ListSessionsResponse {
  sessions: SessionResponse[];
  total: number;
}

interface ListSlotsResponse {
  slots: SlotResponse[];
  total: number;
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

// Константы
const DAYS_OF_WEEK = [
  { id: 1, name: 'Понедельник', short: 'Пн' },
  { id: 2, name: 'Вторник', short: 'Вт' },
  { id: 3, name: 'Среда', short: 'Ср' },
  { id: 4, name: 'Четверг', short: 'Чт' },
  { id: 5, name: 'Пятница', short: 'Пт' },
  { id: 6, name: 'Суббота', short: 'Сб' },
  { id: 7, name: 'Воскресенье', short: 'Вс' },
];

const DURATIONS = [
  { value: 15, label: '15 минут' },
  { value: 30, label: '30 минут' },
  { value: 45, label: '45 минут' },
  { value: 60, label: '1 час' },
  { value: 90, label: '1.5 часа' },
  { value: 120, label: '2 часа' },
  { value: 180, label: '3 часа' },
  { value: 240, label: '4 часа' }
];

const SLOT_STATUSES = {
  available: { label: 'Доступен', color: '#10b981', emoji: '🟢' },
  booked: { label: 'Забронирован', color: '#f59e0b', emoji: '🟡' },
  closed: { label: 'Закрыт', color: '#ef4444', emoji: '🔴' }
};

const PAYMENT_STATUSES = {
  pending: { label: 'Ожидает оплаты', color: '#f59e0b' },
  paid: { label: 'Оплачено', color: '#10b981' },
  failed: { label: 'Ошибка оплаты', color: '#ef4444' },
  refunded: { label: 'Возврат', color: '#6b7280' }
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
  
  // Состояния для слотов и сессий
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
  const [updatingSlotId, setUpdatingSlotId] = useState<string | null>(null);

  // Данные для создания слотов
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotPrice, setSlotPrice] = useState<number | ''>('');
  const [slotCurrency, setSlotCurrency] = useState('RUB');
  const [slotDescription, setSlotDescription] = useState('');
  const [slotTitle, setSlotTitle] = useState('');

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
  const isStudent = profile?.student && token && user?.user_id === profile.student.user_id;
  const isMentor = profile?.mentor && token && user?.user_id === profile.mentor.user_id;

  // Загрузка слотов и сессий
  const loadSlotsAndSessions = useCallback(async () => {
    if (!token || !user) return;
    
    setLoadingSlots(true);
    try {
      // Загружаем слоты ментора по документации: GET /mentors/{mentor_id}/slots
      if (isAuthor && profile?.mentor) {
        try {
          const slotsData = await apiFetch<ListSlotsResponse>(
            `http://localhost:8080/api/v1/mentors/${user.user_id}/slots`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          setSlots(slotsData.slots || []);
        } catch (err) {
          console.error('Ошибка загрузки слотов ментора:', err);
        }
      }
      
      // Загружаем сессии студента по документации: GET /students/{student_id}/sessions
      if (isStudent) {
        try {
          const sessionsData = await apiFetch<ListSessionsResponse>(
            `http://localhost:8080/api/v1/students/${user.user_id}/sessions`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          setSessions(sessionsData.sessions || []);
        } catch (err) {
          console.error('Ошибка загрузки сессий студента:', err);
        }
      }
      
      // Загружаем сессии ментора по документации: GET /mentors/{mentor_id}/sessions
      if (isMentor) {
        try {
          const mentorSessionsData = await apiFetch<ListSessionsResponse>(
            `http://localhost:8080/api/v1/mentors/${user.user_id}/sessions`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          // Объединяем сессии студента и ментора
          setSessions(prev => [...prev, ...(mentorSessionsData.sessions || [])]);
        } catch (err) {
          console.error('Ошибка загрузки сессий ментора:', err);
        }
      }
      
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err);
    } finally {
      setLoadingSlots(false);
    }
  }, [token, user, isAuthor, profile, isStudent, isMentor]);

  // Загружаем слоты и сессии при загрузке курса
  useEffect(() => {
    if (course && token && user) {
      loadSlotsAndSessions();
    }
  }, [course, token, user, loadSlotsAndSessions]);

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

  // ========== ФУНКЦИИ ДЛЯ СЛОТОВ И СЕССИЙ ==========
  
  // Генерация временных слотов
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        slots.push(`${hourStr}:${minuteStr}`);
      }
    }
    return slots;
  }, []);

  // Проверка пересечения слотов
  const checkSlotOverlap = useCallback((startTime: Date, duration: number, existingSlots: SlotResponse[]) => {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    return existingSlots.some(slot => {
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slotStart.getTime() + slot.duration_minutes * 60000);
      
      return (
        (startTime >= slotStart && startTime < slotEnd) ||
        (endTime > slotStart && endTime <= slotEnd) ||
        (startTime <= slotStart && endTime >= slotEnd)
      );
    });
  }, []);

  // Бронирование слота студентом по документации: POST /sessions
  const bookSlot = async (slotId: string) => {
    if (!token || !user) {
      setBookingError('Необходимо авторизоваться');
      return;
    }

    setBookingSlotId(slotId);
    setBookingError(null);
    setBookingSuccess(false);

    try {
      await apiFetch(
        'http://localhost:8080/api/v1/sessions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            slot_id: slotId,
            student_id: user.user_id,
            payment_status: 'pending'
          } as CreateSessionRequest)
        }
      );

      setBookingSuccess(true);
      // Обновляем данные
      loadSlotsAndSessions();
      // Убираем успешное сообщение через 3 секунды
      setTimeout(() => {
        setBookingSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Ошибка бронирования:', err);
      setBookingError(err.message || 'Не удалось забронировать слот');
    } finally {
      setBookingSlotId(null);
    }
  };

  // Отмена сессии по документации: DELETE /sessions/{id}
  const cancelSession = async (sessionId: string) => {
    if (!token || !window.confirm('Вы уверены, что хотите отменить сессию?')) {
      return;
    }

    setCancelingSessionId(sessionId);
    try {
      await apiFetch(
        `http://localhost:8080/api/v1/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Обновляем данные
      loadSlotsAndSessions();
      alert('✅ Сессия отменена!');
    } catch (err: any) {
      console.error('Ошибка отмены сессии:', err);
      setError(err.message || 'Не удалось отменить сессию');
    } finally {
      setCancelingSessionId(null);
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

  // Создание слотов преподавателем по документации: POST /slots
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

    if (slotDuration < 15 || slotDuration > 240) {
      setSlotError('Длительность должна быть от 15 до 240 минут');
      return;
    }

    if (slotPrice !== '' && (Number(slotPrice) < 0 || Number(slotPrice) > 1000000)) {
      setSlotError('Цена должна быть от 0 до 1000000');
      return;
    }

    setCreatingSlots(true);
    setSlotError(null);

    try {
      const TIME_SLOTS = generateTimeSlots();
      const requests: CreateSlotRequest[] = [];
      const today = new Date();
      
      // Создаем слоты на следующую неделю
      selectedDays.forEach(dayIndex => {
        selectedTimes.forEach(time => {
          // Находим дату для этого дня недели на следующей неделе
          const targetDate = new Date(today);
          const currentDay = targetDate.getDay() || 7;
          const daysToAdd = (dayIndex - currentDay + 7) % 7;
          targetDate.setDate(targetDate.getDate() + daysToAdd + 7); // +7 дней для следующей недели
          
          // Устанавливаем время
          const [hours, minutes] = time.split(':').map(Number);
          targetDate.setHours(hours, minutes, 0, 0);
          
          // Проверка на пересечение
          if (checkSlotOverlap(targetDate, slotDuration, slots)) {
            console.warn(`Слот на ${DAYS_OF_WEEK.find(d => d.id === dayIndex)?.name} в ${time} пересекается с существующим`);
            return; // Пропускаем пересекающиеся слоты
          }
          
          const startTimeISO = targetDate.toISOString();
          
          const slotData: CreateSlotRequest = {
            mentor_id: user.user_id,
            title: slotTitle.trim(),
            start_time: startTimeISO,
            duration_minutes: slotDuration,
            status: 'available'
          };
          
          if (slotDescription.trim()) {
            slotData.description = slotDescription.trim();
          }
          
          if (slotPrice !== '') {
            slotData.price = Number(slotPrice);
            slotData.currency = slotCurrency;
          }
          
          requests.push(slotData);
        });
      });

      if (requests.length === 0) {
        setSlotError('Нет слотов для создания (все пересекаются с существующими)');
        return;
      }

      // Отправляем запросы последовательно
      for (const slotData of requests) {
        try {
          await apiFetch(
            'http://localhost:8080/api/v1/slots',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(slotData)
            }
          );
        } catch (err) {
          console.error('Ошибка создания одного из слотов:', err);
          // Продолжаем создание остальных слотов
        }
      }
      
      setSlotSuccess(true);
      loadSlotsAndSessions();
      
      setTimeout(() => {
        setSlotSuccess(false);
        clearAllSelections();
        setShowSlotModal(false);
      }, 2000);

    } catch (err: any) {
      console.error('Ошибка создания слотов:', err);
      setSlotError(err.message || 'Не удалось создать слоты');
    } finally {
      setCreatingSlots(false);
    }
  };

  // Изменение статуса слота по документации: PATCH /slots/{id}/status
  const updateSlotStatus = async (slotId: string, newStatus: string) => {
    if (!token) return;

    setUpdatingSlotId(slotId);
    try {
      await apiFetch(
        `http://localhost:8080/api/v1/slots/${slotId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newStatus
          } as UpdateSlotStatusRequest)
        }
      );

      loadSlotsAndSessions();
      alert(`✅ Статус слота изменен на "${SLOT_STATUSES[newStatus as keyof typeof SLOT_STATUSES]?.label || newStatus}"`);
    } catch (err: any) {
      console.error('Ошибка изменения статуса слота:', err);
      setError(err.message || 'Не удалось изменить статус слота');
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Обновление информации о слоте по документации: PUT /slots/{id}
  const updateSlot = async (slotId: string, updates: UpdateSlotRequest) => {
    if (!token) return;

    setUpdatingSlotId(slotId);
    try {
      await apiFetch(
        `http://localhost:8080/api/v1/slots/${slotId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      loadSlotsAndSessions();
      alert('✅ Слот успешно обновлен!');
    } catch (err: any) {
      console.error('Ошибка обновления слота:', err);
      setError(err.message || 'Не удалось обновить слот');
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Удаление слота по документации: DELETE /slots/{id}
  const deleteSlot = async (slotId: string) => {
    if (!token || !window.confirm('Вы уверены, что хотите удалить этот слот?')) {
      return;
    }

    setUpdatingSlotId(slotId);
    try {
      await apiFetch(
        `http://localhost:8080/api/v1/slots/${slotId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      loadSlotsAndSessions();
      alert('✅ Слот успешно удален!');
    } catch (err: any) {
      console.error('Ошибка удаления слота:', err);
      setError(err.message || 'Не удалось удалить слот');
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Обновление сессии по документации: PUT /sessions/{id}
  const updateSession = async (sessionId: string, updates: { payment_status?: string; rating?: number; review?: string }) => {
    if (!token) return;

    try {
      await apiFetch(
        `http://localhost:8080/api/v1/sessions/${sessionId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      loadSlotsAndSessions();
      alert('✅ Сессия успешно обновлена!');
    } catch (err: any) {
      console.error('Ошибка обновления сессии:', err);
      setError(err.message || 'Не удалось обновить сессию');
    }
  };

  // Оценка сессии по документации: POST /sessions/{id}/rate
  const rateSession = async (sessionId: string, rating: number, review?: string) => {
    if (!token || rating < 1 || rating > 5) return;

    try {
      await apiFetch(
        `http://localhost:8080/api/v1/sessions/${sessionId}/rate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rating, review })
        }
      );

      loadSlotsAndSessions();
      alert('✅ Спасибо за вашу оценку!');
    } catch (err: any) {
      console.error('Ошибка оценки сессии:', err);
      setError(err.message || 'Не удалось оценить сессию');
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Форматирование продолжительности
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins} мин`;
    }
    
    if (mins === 0) {
      return `${hours} ч`;
    }
    
    return `${hours} ч ${mins} мин`;
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

  // Проверка, забронирован ли слот текущим пользователем
  const isSlotBookedByCurrentUser = (slotId: string) => {
    if (!user) return false;
    return sessions.some(session => 
      session.slot_id === slotId && session.student_id === user.user_id
    );
  };

  // Получение сессии по ID слота
  const getSessionForSlot = (slotId: string) => {
    return sessions.find(session => session.slot_id === slotId);
  };

  // Получение информации о статусе платежа
  const getPaymentStatusInfo = (status?: string) => {
    if (!status) return PAYMENT_STATUSES.pending;
    
    return PAYMENT_STATUSES[status as keyof typeof PAYMENT_STATUSES] || PAYMENT_STATUSES.pending;
  };

  // ========== РЕНДЕРИНГ КОМПОНЕНТОВ ==========

  // Рендеринг доступных слотов для студентов
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

    const availableSlots = slots.filter(slot => slot.status === 'available');
    
    if (availableSlots.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '18px' }}>
            Нет доступных слотов
          </h4>
          <p>Преподаватель еще не создал слоты для записи</p>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Доступные слоты для записи:</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {availableSlots.map(slot => {
            const isBooked = isSlotBookedByCurrentUser(slot.id);
            const session = getSessionForSlot(slot.id);
            const paymentStatus = getPaymentStatusInfo(session?.payment_status);
            
            return (
              <div key={slot.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {slot.title}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
                      📅 {formatDateTime(slot.start_time)}
                      <span style={{ margin: '0 8px' }}>•</span>
                      ⏱️ {formatDuration(slot.duration_minutes)}
                    </div>
                    {slot.description && (
                      <div style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text)' }}>
                        📝 {slot.description}
                      </div>
                    )}
                    {slot.price && slot.price > 0 && (
                      <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600, marginBottom: '8px' }}>
                        💰 {slot.price} {slot.currency}
                      </div>
                    )}
                    {isBooked && session && (
                      <div style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        padding: '4px 8px',
                        background: paymentStatus.color + '20',
                        color: paymentStatus.color,
                        borderRadius: '4px',
                        marginTop: '8px'
                      }}>
                        <span>✅</span>
                        <span>{paymentStatus.label}</span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isBooked ? (
                      <>
                        <button
                          className="btn btn-outline"
                          disabled
                          style={{ 
                            fontSize: '12px', 
                            padding: '6px 12px',
                            borderColor: paymentStatus.color,
                            color: paymentStatus.color
                          }}
                        >
                          ✅ Забронировано
                        </button>
                        {session && !session.rating && session.payment_status === 'paid' && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              const rating = prompt('Оцените сессию (1-5):');
                              const review = prompt('Оставьте отзыв (опционально):');
                              if (rating && Number(rating) >= 1 && Number(rating) <= 5) {
                                rateSession(session.id, Number(rating), review || undefined);
                              }
                            }}
                            style={{ 
                              fontSize: '12px', 
                              padding: '6px 12px',
                              color: '#f59e0b'
                            }}
                          >
                            ⭐ Оценить
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => bookSlot(slot.id)}
                        disabled={bookingSlotId === slot.id}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        {bookingSlotId === slot.id ? 'Бронирование...' : 'Забронировать'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Рендеринг слотов преподавателя
  const renderMentorSlots = () => {
    if (loadingSlots) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ 
            width: '30px', 
            height: '30px', 
            border: '3px solid var(--glass)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            margin: '0 auto 10px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'var(--muted)' }}>Загрузка ваших слотов...</p>
        </div>
      );
    }

    if (slots.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
          <p>У вас нет созданных слотов</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowSlotModal(true)}
            style={{ marginTop: '12px', fontSize: '14px', padding: '8px 16px' }}
          >
            Создать первый слот
          </button>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '16px' }}>Ваши слоты ({slots.length})</h4>
          <button
            className="btn btn-primary"
            onClick={() => setShowSlotModal(true)}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            + Добавить слоты
          </button>
        </div>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {slots.map(slot => {
            const session = sessions.find(s => s.slot_id === slot.id);
            const statusInfo = SLOT_STATUSES[slot.status as keyof typeof SLOT_STATUSES] || SLOT_STATUSES.available;
            const isUpdating = updatingSlotId === slot.id;
            
            return (
              <div key={slot.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: statusInfo.color, fontSize: '20px' }}>{statusInfo.emoji}</span>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>{slot.title}</span>
                      <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        background: statusInfo.color + '20',
                        color: statusInfo.color,
                        borderRadius: '4px',
                        fontWeight: 500
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
                      📅 {formatDateTime(slot.start_time)}
                      <span style={{ margin: '0 8px' }}>•</span>
                      ⏱️ {formatDuration(slot.duration_minutes)}
                    </div>
                    
                    {slot.description && (
                      <div style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text)' }}>
                        📝 {slot.description}
                      </div>
                    )}
                    
                    {slot.price && slot.price > 0 && (
                      <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 600, marginBottom: '8px' }}>
                        💰 {slot.price} {slot.currency}
                      </div>
                    )}
                    
                    {session && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--accent)',
                        padding: '4px 8px',
                        background: 'rgba(79, 70, 229, 0.1)',
                        borderRadius: '4px',
                        display: 'inline-block',
                        marginTop: '8px'
                      }}>
                        👤 Забронировано студентом
                        {session.rating && (
                          <span style={{ marginLeft: '8px', color: '#f59e0b' }}>
                            ⭐ {session.rating}/5
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', minWidth: '120px' }}>
                    {slot.status === 'available' && !session && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => updateSlotStatus(slot.id, 'closed')}
                        disabled={isUpdating}
                        style={{ 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          color: '#ef4444',
                          borderColor: 'rgba(239, 68, 68, 0.2)'
                        }}
                      >
                        {isUpdating ? '...' : 'Закрыть'}
                      </button>
                    )}
                    
                    {slot.status === 'closed' && !session && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => updateSlotStatus(slot.id, 'available')}
                        disabled={isUpdating}
                        style={{ 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          color: '#10b981',
                          borderColor: 'rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        {isUpdating ? '...' : 'Открыть'}
                      </button>
                    )}
                    
                    {session && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          const newStatus = prompt('Изменить статус платежа (pending/paid/failed/refunded):');
                          if (newStatus && ['pending', 'paid', 'failed', 'refunded'].includes(newStatus)) {
                            updateSession(session.id, { payment_status: newStatus });
                          }
                        }}
                        disabled={isUpdating}
                        style={{ 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          color: '#3b82f6'
                        }}
                      >
                        💳 Статус оплаты
                      </button>
                    )}
                    
                    <button
                      className="btn btn-ghost"
                      onClick={() => deleteSlot(slot.id)}
                      disabled={isUpdating}
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        color: '#ef4444',
                        opacity: session ? 0.5 : 1
                      }}
                      title={session ? 'Нельзя удалить забронированный слот' : 'Удалить слот'}
                    >
                      🗑️ Удалить
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

  // Рендеринг сессий пользователя
  const renderUserSessions = () => {
    if (sessions.length === 0) {
      return null;
    }

    const userSessions = sessions.filter(session => 
      session.student_id === user?.user_id || 
      slots.find(slot => slot.id === session.slot_id)?.mentor_id === user?.user_id
    );

    if (userSessions.length === 0) {
      return null;
    }

    return (
      <div style={{ marginTop: '32px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Ваши записи:</h4>
        <div style={{ display: 'grid', gap: '12px' }}>
          {userSessions.map(session => {
            const slot = slots.find(s => s.id === session.slot_id);
            const isStudentSession = session.student_id === user?.user_id;
            const paymentStatus = getPaymentStatusInfo(session.payment_status);
            
            return (
              <div key={session.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {slot?.title || 'Сессия'}
                      {!isStudentSession && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                          (со студентом)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                      {slot ? formatDateTime(slot.start_time) : 'Дата не указана'}
                      {slot && (
                        <>
                          <span style={{ margin: '0 8px' }}>•</span>
                          {formatDuration(slot.duration_minutes)}
                        </>
                      )}
                    </div>
                    <div style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      padding: '4px 8px',
                      background: paymentStatus.color + '20',
                      color: paymentStatus.color,
                      borderRadius: '4px',
                      marginTop: '8px'
                    }}>
                      💳 {paymentStatus.label}
                    </div>
                    {session.rating && (
                      <div style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        padding: '4px 8px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                        borderRadius: '4px',
                        marginLeft: '8px',
                        marginTop: '8px'
                      }}>
                        ⭐ {session.rating}/5
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isStudentSession && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => cancelSession(session.id)}
                        disabled={cancelingSessionId === session.id || session.payment_status === 'paid'}
                        style={{ 
                          color: '#ef4444', 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          opacity: cancelingSessionId === session.id || session.payment_status === 'paid' ? 0.5 : 1
                        }}
                        title={session.payment_status === 'paid' ? 'Оплаченную сессию нельзя отменить' : 'Отменить сессию'}
                      >
                        {cancelingSessionId === session.id ? 'Отмена...' : 'Отменить'}
                      </button>
                    )}
                    
                    {isStudentSession && !session.rating && session.payment_status === 'paid' && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          const rating = prompt('Оцените сессию (1-5):');
                          const review = prompt('Оставьте отзыв (опционально):');
                          if (rating && Number(rating) >= 1 && Number(rating) <= 5) {
                            rateSession(session.id, Number(rating), review || undefined);
                          }
                        }}
                        style={{ 
                          fontSize: '12px', 
                          padding: '4px 8px',
                          color: '#f59e0b'
                        }}
                      >
                        ⭐ Оценить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ========== ОСНОВНОЙ РЕНДЕРИНГ ==========
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
                  
                  {/* Кнопка создания слотов для преподавателя */}
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
            className={`btn ${activeTab === 'slots' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('slots')}
            style={{ whiteSpace: 'nowrap', fontSize: '14px', padding: '10px 16px' }}
          >
            📅 {isAuthor ? 'Мои слоты' : 'Доступные слоты'}
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
                {isAuthor ? 'Управление слотами для записи' : 'Запись на индивидуальные сессии'}
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
              
              {/* Контент для преподавателя */}
              {isAuthor && profile?.mentor && (
                <>
                  <div style={{ 
                    background: 'rgba(79, 70, 229, 0.05)', 
                    padding: '16px', 
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>
                      🎯 Создайте слоты для записи студентов
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                      Установите доступное время для консультаций по этому курсу. Студенты смогут видеть и бронировать ваши слоты.
                    </p>
                  </div>
                  
                  {renderMentorSlots()}
                </>
              )}
              
              {/* Контент для студентов */}
              {!isAuthor && token && (
                <>
                  <div style={{ 
                    background: 'rgba(79, 70, 229, 0.05)', 
                    padding: '16px', 
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--accent)' }}>
                      🎓 Запись на индивидуальные консультации
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                      Выберите удобное время для консультации с преподавателем. После записи вы сможете общаться в чате.
                    </p>
                  </div>
                  
                  {renderAvailableSlots()}
                  {renderUserSessions()}
                </>
              )}
              
              {/* Контент для неавторизованных */}
              {!token && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '18px' }}>
                    Войдите для доступа к слотам
                  </h4>
                  <p>Авторизуйтесь, чтобы видеть доступные слоты и записываться на индивидуальные сессии</p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                    <Link to="/login" className="btn btn-primary">Войти</Link>
                    <Link to="/signup" className="btn btn-outline">Регистрация</Link>
                  </div>
                </div>
              )}
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
            maxWidth: '800px',
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
              <h2 style={{ margin: 0, fontSize: '20px' }}>Создание временных слотов</h2>
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
                Заголовок слота *
              </label>
              <input
                type="text"
                value={slotTitle}
                onChange={(e) => setSlotTitle(e.target.value)}
                placeholder="Например: Консультация по React"
                required
                minLength={3}
                maxLength={255}
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
                Описание (опционально, до 1000 символов)
              </label>
              <textarea
                value={slotDescription}
                onChange={(e) => setSlotDescription(e.target.value)}
                placeholder="Дополнительная информация о сессии..."
                maxLength={1000}
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
                  Длительность сессии * (15-240 минут)
                </label>
                <div className="chips" style={{ gap: '8px', flexWrap: 'wrap' }}>
                  {DURATIONS.map(duration => (
                    <button
                      key={duration.value}
                      type="button"
                      onClick={() => setSlotDuration(duration.value)}
                      className={`chip ${slotDuration === duration.value ? 'active' : ''}`}
                      style={{
                        border: 'none',
                        background: slotDuration === duration.value ? 'var(--accent)' : 'transparent',
                        color: slotDuration === duration.value ? '#fff' : 'inherit',
                        fontSize: '13px',
                        padding: '8px 12px'
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
                  Выберите дни недели *
                </label>
                <div className="chips" style={{ gap: '8px', flexWrap: 'wrap' }}>
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDaySelection(day.id)}
                      className={`chip ${selectedDays.includes(day.id) ? 'active' : ''}`}
                      style={{
                        border: 'none',
                        background: selectedDays.includes(day.id) ? 'var(--accent)' : 'transparent',
                        color: selectedDays.includes(day.id) ? '#fff' : 'inherit',
                        fontSize: '13px',
                        padding: '8px 12px',
                        flex: '1',
                        minWidth: '60px'
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
                  Выберите время *
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  padding: '8px',
                  background: 'var(--glass)',
                  borderRadius: '8px'
                }}>
                  {generateTimeSlots().map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => toggleTimeSelection(time)}
                      className={`chip ${selectedTimes.includes(time) ? 'active' : ''}`}
                      style={{
                        border: 'none',
                        background: selectedTimes.includes(time) ? 'var(--accent)' : 'transparent',
                        color: selectedTimes.includes(time) ? '#fff' : 'inherit',
                        fontSize: '13px',
                        padding: '6px 8px',
                        textAlign: 'center'
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                  Выбрано: {selectedTimes.length} временных точек
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
                disabled={creatingSlots || selectedDays.length === 0 || selectedTimes.length === 0 || !slotTitle.trim()}
                style={{ 
                  padding: '10px 24px',
                  background: creatingSlots ? 'var(--muted)' : 'var(--accent)',
                  opacity: (selectedDays.length === 0 || selectedTimes.length === 0 || !slotTitle.trim()) ? 0.5 : 1
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