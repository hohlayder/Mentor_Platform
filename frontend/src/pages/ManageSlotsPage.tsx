// src/pages/CreateSlotsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Типы из сваггера
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
  post_id?: string; // Добавлено поле для привязки к курсу
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
  post_id?: string; // Обязательное поле для привязки к курсу
}

interface UpdateSlotStatusRequest {
  status: string;
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

// Интерфейсы для ответов API
interface MentorSlotsResponse {
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
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Не удалось распарсить JSON
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
};

// Дни недели на русском
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
  { value: 15, label: '15 мин' },
  { value: 30, label: '30 мин' },
  { value: 45, label: '45 мин' },
  { value: 60, label: '1 час' },
  { value: 90, label: '1.5 часа' },
  { value: 120, label: '2 часа' },
  { value: 180, label: '3 часа' },
  { value: 240, label: '4 часа' }
];

const SLOT_STATUSES = {
  available: { label: 'Доступен', color: '#10b981', emoji: '🟢', bgColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' },
  booked: { label: 'Забронирован', color: '#f59e0b', emoji: '🟡', bgColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' },
  closed: { label: 'Закрыт', color: '#ef4444', emoji: '🔴', bgColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }
} as const;

type SlotStatus = keyof typeof SLOT_STATUSES;

const CreateSlotsPage: React.FC = () => {
  const { id: postId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, logout } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return savedTheme || 'light';
  });
  
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [allMentorSlots, setAllMentorSlots] = useState<SlotResponse[]>([]); // Все слоты ментора для проверки пересечений
  const [updatingSlotId, setUpdatingSlotId] = useState<string | null>(null);
  const [creatingSlot, setCreatingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotSuccess, setSlotSuccess] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  
  // Состояния для создания слота в конкретном дне
  const [showCreateModalForDay, setShowCreateModalForDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotPrice, setSlotPrice] = useState<number | ''>('');
  const [slotCurrency, setSlotCurrency] = useState('RUB');
  const [slotDescription, setSlotDescription] = useState('');
  const [slotTitle, setSlotTitle] = useState('');

  // Загрузка темы
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Навигация по неделям
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Получаем все дни недели (с понедельника по воскресенье)
  const getWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Получение названия курса из location state или загрузка
  useEffect(() => {
    const loadCourseData = async () => {
      if (!postId || !token || !user) {
        navigate('/courses');
        return;
      }

      setLoadingCourse(true);
      
      try {
        // Пробуем получить название курса из location state
        if (location.state?.courseTitle) {
          setCourseTitle(location.state.courseTitle);
        } else {
          // Загружаем название курса через API
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          };

          try {
            const courseData = await apiFetch<{ post: { title: string } }>(
              `http://localhost:8080/api/v1/posts/${postId}`,
              { headers }
            );
            setCourseTitle(courseData.post.title);
          } catch (err) {
            console.error('Ошибка загрузки курса:', err);
            setCourseTitle('Слоты для записи');
          }
        }
      } catch (err: any) {
        console.error('Ошибка загрузки данных:', err);
      } finally {
        setLoadingCourse(false);
      }
    };

    loadCourseData();
  }, [postId, token, user, navigate, location.state]);

  // Проверяем, является ли пользователь автором курса
  const isAuthor = user?.user_id === location.state?.authorId;

  // Загрузка ВСЕХ слотов ментора (для проверки пересечений)
  const loadAllMentorSlots = useCallback(async () => {
    if (!token || !user) return;
    
    try {
      const slotsData = await apiFetch<MentorSlotsResponse>(
        `http://localhost:8080/api/v1/mentors/${user.user_id}/slots`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setAllMentorSlots(slotsData.slots || []);
    } catch (err) {
      console.error('Ошибка загрузки всех слотов ментора:', err);
      setAllMentorSlots([]);
    }
  }, [token, user]);

  // Загрузка слотов для этого конкретного поста
  const loadPostSlots = useCallback(async () => {
    if (!token || !user || !postId) return;
    
    setLoadingSlots(true);
    try {
      // Вариант 1: Загружаем все слоты ментора и фильтруем по post_id
      const slotsData = await apiFetch<MentorSlotsResponse>(
        `http://localhost:8080/api/v1/mentors/${user.user_id}/slots`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Фильтруем слоты, привязанные к текущему курсу
      const filteredSlots = slotsData.slots.filter(slot => 
        slot.post_id === postId
      ) || [];
      
      setSlots(filteredSlots);
      
      // Также сохраняем все слоты для проверки пересечений
      setAllMentorSlots(slotsData.slots || []);
      
    } catch (err) {
      console.error('Ошибка загрузки слотов:', err);
      setSlots([]);
      setAllMentorSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [token, user, postId]);

  // Загружаем слоты при монтировании и при изменении недели
  useEffect(() => {
    if (token && user && isAuthor && postId) {
      loadPostSlots();
    }
  }, [token, user, isAuthor, postId, currentWeekStart, loadPostSlots]);

  // Генерация временных слотов (с 8 утра до 22 вечера)
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    for (let hour = 8; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) { // Каждые 30 минут
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        slots.push(`${hourStr}:${minuteStr}`);
      }
    }
    return slots;
  }, []);

  // Получаем слоты для определенного дня
  const getSlotsForDay = (day: Date): SlotResponse[] => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    
    return slots.filter(slot => {
      const slotTime = new Date(slot.start_time);
      return slotTime >= dayStart && slotTime <= dayEnd;
    });
  };

  // Проверка пересечения слотов (проверяем со ВСЕМИ слотами ментора)
  const checkSlotOverlap = useCallback((startTime: Date, duration: number, allSlots: SlotResponse[]) => {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    // Проверяем с каждым существующим слотом ментора
    for (const slot of allSlots) {
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slotStart.getTime() + slot.duration_minutes * 60000);
      
      // Проверяем пересечение временных интервалов
      const hasOverlap = (
        (startTime >= slotStart && startTime < slotEnd) ||
        (endTime > slotStart && endTime <= slotEnd) ||
        (startTime <= slotStart && endTime >= slotEnd)
      );
      
      if (hasOverlap) {
        console.log('Найдено пересечение с слотом:', {
          slotTitle: slot.title,
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
          newStart: startTime.toISOString(),
          newEnd: endTime.toISOString(),
          slotId: slot.id,
          slotPostId: slot.post_id
        });
        return true;
      }
    }
    
    return false;
  }, []);

  // Проверка, является ли дата и время в прошлом
  const isPastDateTime = (date: Date, time: string): boolean => {
    const now = new Date();
    const targetDate = new Date(date);
    
    const [hours, minutes] = time.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);
    
    return targetDate < now;
  };

  // Получение следующего доступного времени (не в прошлом)
  const getNextAvailableTime = (date: Date): string => {
    const now = new Date();
    const times = generateTimeSlots();
    
    // Если день в прошлом, возвращаем первое время
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    if (dayEnd < now) {
      return times[0];
    }
    
    // Ищем ближайшее время, которое еще не наступило
    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);
      const targetDate = new Date(date);
      targetDate.setHours(hours, minutes, 0, 0);
      
      if (targetDate > now) {
        return time;
      }
    }
    
    // Если все времена в прошлом, возвращаем последнее
    return times[times.length - 1];
  };

  // Открытие модального окна создания слота для конкретного дня
  const openCreateModalForDay = (dayIndex: number) => {
    const day = getWeekDays()[dayIndex];
    const nextTime = getNextAvailableTime(day);
    
    setShowCreateModalForDay(dayIndex);
    setSelectedTime(nextTime);
    setSlotTitle(`Консультация по курсу: ${courseTitle}`);
    setSlotDuration(60);
    setSlotPrice('');
    setSlotDescription(`Консультация по курсу "${courseTitle}"`);
    setSlotError(null);
  };

  // Создание слота
  const createSlot = async () => {
    if (!token || !user || showCreateModalForDay === null || !postId) return;
    
    // Валидация
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

    // Проверка на прошедшее время
    const day = getWeekDays()[showCreateModalForDay];
    if (isPastDateTime(day, selectedTime)) {
      setSlotError('Нельзя создать слот на прошедшее время');
      return;
    }

    setCreatingSlot(true);
    setSlotError(null);

    try {
      // Находим дату для выбранного дня
      const targetDate = new Date(currentWeekStart);
      targetDate.setDate(targetDate.getDate() + showCreateModalForDay);
      
      // Устанавливаем время
      const [hours, minutes] = selectedTime.split(':').map(Number);
      targetDate.setHours(hours, minutes, 0, 0);
      
      // ОБНОВЛЕНО: Проверяем пересечение со ВСЕМИ слотами ментора
      if (checkSlotOverlap(targetDate, slotDuration, allMentorSlots)) {
        setSlotError('Это время пересекается с существующим слотом ментора');
        setCreatingSlot(false);
        return;
      }
      
      const startTimeISO = targetDate.toISOString();
      
      const slotData: CreateSlotRequest = {
        mentor_id: user.user_id,
        title: slotTitle.trim(),
        start_time: startTimeISO,
        duration_minutes: slotDuration,
        status: 'available',
        post_id: postId // ОБЯЗАТЕЛЬНОЕ поле для привязки к курсу
      };
      
      if (slotDescription.trim()) {
        slotData.description = slotDescription.trim();
      }
      
      if (slotPrice !== '') {
        slotData.price = Number(slotPrice);
        slotData.currency = slotCurrency;
      }
      
      console.log('Создание слота с данными:', {
        ...slotData,
        start_time: startTimeISO,
        post_id: postId
      });
      
      const response = await apiFetch<{ slot_id: string; success: boolean }>(
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
      
      console.log('Слот успешно создан:', response);
      
      setSlotSuccess(true);
      
      // ОБНОВЛЕНО: Перезагружаем все слоты
      await Promise.all([
        loadPostSlots(),
        loadAllMentorSlots()
      ]);
      
      setTimeout(() => {
        setSlotSuccess(false);
        setShowCreateModalForDay(null);
      }, 2000);

    } catch (err: any) {
      console.error('Ошибка создания слота:', err);
      setSlotError(err.message || 'Не удалось создать слот. Убедитесь, что post_id указан правильно.');
    } finally {
      setCreatingSlot(false);
    }
  };

  // Изменение статуса слота
  const updateSlotStatus = async (slotId: string, newStatus: SlotStatus) => {
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

      // ОБНОВЛЕНО: Перезагружаем все слоты
      await Promise.all([
        loadPostSlots(),
        loadAllMentorSlots()
      ]);
      
      alert(`✅ Статус слота изменен на "${SLOT_STATUSES[newStatus].label}"`);
    } catch (err: any) {
      console.error('Ошибка изменения статуса слота:', err);
      alert(err.message || 'Не удалось изменить статус слота');
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Обновление информации о слоте
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

      // ОБНОВЛЕНО: Перезагружаем все слоты
      await Promise.all([
        loadPostSlots(),
        loadAllMentorSlots()
      ]);
      
      alert('✅ Слот успешно обновлен!');
    } catch (err: any) {
      console.error('Ошибка обновления слота:', err);
      alert(err.message || 'Не удалось обновить слот');
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Удаление слота
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

      // ОБНОВЛЕНО: Перезагружаем все слоты
      await Promise.all([
        loadPostSlots(),
        loadAllMentorSlots()
      ]);
      
      alert('✅ Слот успешно удален!');
    } catch (err: any) {
      console.error('Ошибка удаления слота:', err);
      alert(err.message || 'Не удалось удалить слот');
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Форматирование даты для заголовка дня
  const formatDayHeader = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Завтра';
    } else {
      return date.toLocaleDateString('ru-RU', { 
        weekday: 'short', 
        day: 'numeric',
        month: 'short'
      }).replace(',', '');
    }
  };

  // Форматирование времени
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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

  // Получение информации о статусе слота
  const getSlotStatusInfo = (slot: SlotResponse) => {
    return SLOT_STATUSES[slot.status as SlotStatus] || SLOT_STATUSES.available;
  };

  // Проверка, доступен ли слот для клика (только available слоты можно редактировать)
  const isSlotClickable = (slot: SlotResponse) => {
    return slot.status === 'available';
  };

  // Проверка, является ли день в прошлом
  const isPastDay = (day: Date): boolean => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    
    return day < yesterday;
  };

  if (!token) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <header className="header">
          <Link to="/" className="brand">
            <div className="logo">M</div>Mentor Fellowship
          </Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">
              {theme === 'light' ? '🌙' : '☀️'} Тема
            </button>
            <Link to="/login" className="btn btn-ghost">Войти</Link>
            <Link to="/signup" className="btn btn-primary">Регистрация</Link>
          </div>
        </header>
        
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
          <h3 style={{ margin: '0 0 12px 0' }}>Необходима авторизация</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            Войдите в систему для создания слотов
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary">Войти</Link>
            <Link to="/signup" className="btn btn-outline">Регистрация</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthor) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <header className="header">
          <Link to="/" className="brand">
            <div className="logo">M</div>Mentor Fellowship
          </Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">
              {theme === 'light' ? '🌙' : '☀️'} Тема
            </button>
            <Link to={`/profile/${user?.user_id}`} className="btn btn-ghost">
              {user?.first_name || 'Профиль'}
            </Link>
            <button onClick={logout} className="btn btn-ghost">Выйти</button>
          </div>
        </header>
        
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
          <h3 style={{ margin: '0 0 12px 0' }}>Доступ запрещен</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            Вы не являетесь автором этого курса
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/course/${postId}`)}
            >
              Вернуться к курсу
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/courses')}
            >
              К списку курсов
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingCourse) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <header className="header">
          <Link to="/" className="brand">
            <div className="logo">M</div>Mentor Fellowship
          </Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">
              {theme === 'light' ? '🌙' : '☀️'} Тема
            </button>
            <Link to={`/profile/${user?.user_id}`} className="btn btn-ghost">
              {user?.first_name || 'Профиль'}
            </Link>
            <button onClick={logout} className="btn btn-ghost">Выйти</button>
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
          <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  const weekDays = getWeekDays();
  const timeSlots = generateTimeSlots();

  return (
    <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
      {/* Header */}
      <header className="header">
        <Link to="/" className="brand">
          <div className="logo">M</div>Mentor Fellowship
        </Link>
        <div className="header-nav">
          <button onClick={toggleTheme} className="btn btn-ghost">
            {theme === 'light' ? '🌙' : '☀️'} Тема
          </button>
          <Link to={`/profile/${user?.user_id}`} className="btn btn-ghost">
            {user?.first_name || 'Профиль'}
          </Link>
          <button onClick={logout} className="btn btn-ghost">Выйти</button>
        </div>
      </header>

      {/* Хлебные крошки */}
      <nav style={{ margin: '24px 0', fontSize: '14px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <Link to="/courses" style={{ color: 'var(--muted)' }}>Курсы</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <Link to={`/course/${postId}`} style={{ color: 'var(--muted)' }}>{courseTitle}</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>Управление слотами</span>
      </nav>

      {/* Заголовок */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '28px' }}>
          🎯 Управление слотами для курса: {courseTitle}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '16px' }}>
          Создавайте и управляйте временными слотами для консультаций по вашему курсу. 
          Слоты автоматически привязываются к этому курсу.
        </p>
      </div>

      {/* Информация о текущем курсе */}
      <div className="card" style={{ 
        marginBottom: '24px',
        padding: '16px',
        background: 'var(--glass)',
        borderRadius: '8px',
        borderLeft: '4px solid var(--accent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Курс ID:</div>
            <code style={{ 
              background: 'rgba(0,0,0,0.05)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              fontSize: '12px',
              wordBreak: 'break-all'
            }}>
              {postId}
            </code>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Все создаваемые слоты будут привязаны к этому курсу
          </div>
        </div>
      </div>

      {/* Информация о проверке пересечений */}
      <div className="card" style={{ 
        marginBottom: '24px',
        padding: '16px',
        background: 'rgba(245, 158, 11, 0.1)',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span>ℹ️</span>
          <span style={{ fontWeight: 600 }}>Проверка пересечений времени</span>
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
          Система проверяет пересечение со ВСЕМИ слотами ментора (даже из других курсов) 
          для предотвращения двойного бронирования.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
          Всего слотов ментора: {allMentorSlots.length} | Слотов этого курса: {slots.length}
        </div>
      </div>

      {/* Навигация по неделям */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px',
        background: 'var(--glass)',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={goToPreviousWeek} className="btn btn-ghost">
            ← Предыдущая неделя
          </button>
          <button onClick={goToToday} className="btn btn-ghost">
            Сегодня
          </button>
        </div>
        
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 600,
          textAlign: 'center'
        }}>
          {currentWeekStart.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
          })} — {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
          })}
        </div>
        
        <div>
          <button onClick={goToNextWeek} className="btn btn-ghost">
            Следующая неделя →
          </button>
        </div>
      </div>

      {/* Грид с 7 днями недели в одну строку */}
      <div className="section">
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
            ✅ Слот успешно создан и привязан к курсу! (post_id: {postId})
          </div>
        )}
        
        {/* Грид для отображения слотов */}
        {loadingSlots ? (
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
            <p style={{ color: 'var(--muted)' }}>Загрузка слотов курса...</p>
          </div>
        ) : (
          <>
            {/* 7 дней недели в одну строку - КОМПАКТНАЯ ВЕРСИЯ */}
            <div className="booking-grid" style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '12px',
              marginBottom: '32px'
            }}>
              {weekDays.map((day, dayIndex) => {
                const daySlots = getSlotsForDay(day);
                const isPast = isPastDay(day);
                
                return (
                  <div key={dayIndex} className="card" style={{ 
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass)',
                    minHeight: '320px',
                    position: 'relative',
                    opacity: isPast ? 0.7 : 1
                  }}>
                    <div className="booking-date" style={{ 
                      fontWeight: 600,
                      marginBottom: '10px',
                      fontSize: '13px',
                      color: isPast ? 'var(--muted)' : 'var(--accent)',
                      textAlign: 'center',
                      paddingBottom: '6px',
                      borderBottom: '1px solid var(--glass)'
                    }}>
                      <div>{formatDayHeader(day)}</div>
                      {isPast && <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>Прошедший день</div>}
                      <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--muted)' }}>
                        {daySlots.length} слотов
                      </div>
                    </div>
                    
                    {/* Кнопка создания слота */}
                    <button
                      onClick={() => !isPast && openCreateModalForDay(dayIndex)}
                      disabled={isPast}
                      className="btn btn-outline"
                      style={{
                        width: '100%',
                        marginBottom: '12px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        opacity: isPast ? 0.5 : 1,
                        cursor: isPast ? 'not-allowed' : 'pointer'
                      }}
                    >
                      + Создать слот
                    </button>
                    
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px', 
                      maxHeight: '220px', 
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {daySlots.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          color: 'var(--muted)',
                          fontSize: '12px',
                          padding: '16px 0'
                        }}>
                          Нет созданных слотов
                        </div>
                      ) : (
                        daySlots.map(slot => {
                          const statusInfo = getSlotStatusInfo(slot);
                          const isClickable = isSlotClickable(slot);
                          const isUpdating = updatingSlotId === slot.id;
                          const startTime = formatTime(slot.start_time);
                          const duration = formatDuration(slot.duration_minutes);
                          const hasPrice = slot.price && slot.price > 0;
                          const isCorrectPost = slot.post_id === postId;
                          
                          return (
                            <div
                              key={slot.id}
                              className={`slot ${isClickable ? 'clickable' : 'unclickable'}`}
                              onClick={() => isClickable && !isUpdating && (
                                alert(`Слот: ${slot.title}\nВремя: ${startTime}\nСтатус: ${statusInfo.label}\nДлительность: ${duration}\nПривязка к курсу: ${isCorrectPost ? '✓ Правильно' : '⚠ Ошибка'}\n${slot.description ? `Описание: ${slot.description}\n` : ''}${hasPrice ? `Цена: ${slot.price} ${slot.currency || '₽'}` : ''}`)
                              )}
                              style={{
                                padding: '6px 4px',
                                borderRadius: '6px',
                                border: `1px solid ${statusInfo.borderColor}`,
                                background: statusInfo.bgColor,
                                fontSize: '10px',
                                cursor: isClickable && !isUpdating ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                opacity: isUpdating ? 0.6 : 1,
                                position: 'relative',
                                marginBottom: '2px'
                              }}
                            >
                              {isUpdating && (
                                <div style={{
                                  position: 'absolute',
                                  top: '2px',
                                  right: '2px',
                                  width: '10px',
                                  height: '10px',
                                  border: '2px solid var(--accent)',
                                  borderTopColor: 'transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }} />
                              )}
                              
                              {/* Компактное отображение слота */}
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '2px'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  gap: '3px',
                                  marginBottom: '2px'
                                }}>
                                  <span style={{ fontSize: '12px' }}>{statusInfo.emoji}</span>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    fontSize: '10px',
                                    color: statusInfo.color
                                  }}>
                                    {startTime}
                                  </div>
                                  {hasPrice && (
                                    <div style={{ 
                                      fontSize: '9px', 
                                      fontWeight: 600,
                                      marginLeft: '2px',
                                      color: 'var(--accent)'
                                    }}>
                                      {slot.price}
                                    </div>
                                  )}
                                </div>
                                
                                <div style={{ 
                                  fontSize: '9px', 
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {slot.title}
                                </div>
                                
                                <div style={{ 
                                  fontSize: '9px', 
                                  opacity: 0.8,
                                  marginBottom: '2px'
                                }}>
                                  {duration}
                                </div>
                                
                                {/* Показываем статус привязки к курсу */}
                                <div style={{ 
                                  fontSize: '8px', 
                                  color: isCorrectPost ? '#10b981' : '#ef4444',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '2px'
                                }}>
                                  {isCorrectPost ? '✓' : '⚠'} 
                                  {isCorrectPost ? 'Привязан' : 'Ошибка привязки'}
                                </div>
                                
                                {/* Быстрые действия для доступных слотов - только значки */}
                                {isClickable && !isUpdating && (
                                  <div style={{ 
                                    display: 'flex', 
                                    gap: '3px', 
                                    marginTop: '4px',
                                    justifyContent: 'center',
                                    borderTop: '1px solid rgba(0,0,0,0.1)',
                                    paddingTop: '4px'
                                  }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateSlotStatus(slot.id, 'closed');
                                      }}
                                      className="btn btn-ghost"
                                      style={{ 
                                        fontSize: '9px', 
                                        padding: '1px 4px',
                                        minHeight: 'unset',
                                        minWidth: 'unset',
                                        color: '#ef4444',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '3px'
                                      }}
                                      title="Закрыть слот"
                                    >
                                      ✖
                                    </button>
                                    
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteSlot(slot.id);
                                      }}
                                      className="btn btn-ghost"
                                      style={{ 
                                        fontSize: '9px', 
                                        padding: '1px 4px',
                                        minHeight: 'unset',
                                        minWidth: 'unset',
                                        color: '#ef4444',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '3px'
                                      }}
                                      title="Удалить слот"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Кнопка возврата */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              justifyContent: 'center',
              marginBottom: '60px'
            }}>
              <button
                className="btn btn-outline"
                onClick={() => navigate(`/course/${postId}`)}
                style={{ padding: '12px 24px' }}
              >
                ← Вернуться к курсу
              </button>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно для создания слота */}
      {showCreateModalForDay !== null && (
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
            maxWidth: '500px',
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
              <h2 style={{ margin: 0, fontSize: '20px' }}>
                Создание слота на {formatDayHeader(weekDays[showCreateModalForDay])}
              </h2>
              <button
                onClick={() => setShowCreateModalForDay(null)}
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

            {/* Информация о курсе и проверке */}
            <div style={{
              background: 'rgba(79, 70, 229, 0.1)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
              color: '#4f46e5',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>ℹ️ Важная информация:</div>
              <div>1. Слот будет привязан к курсу: <strong>{courseTitle}</strong></div>
              <div>2. Проверка пересечений со всеми слотами ментора</div>
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                post_id: <code>{postId}</code>
              </div>
            </div>

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
                placeholder={`Например: Консультация по курсу "${courseTitle}"`}
                required
                minLength={3}
                maxLength={255}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '15px',
                  marginBottom: '20px'
                }}
              />

              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Время начала *
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '15px',
                  marginBottom: '20px',
                  cursor: 'pointer'
                }}
              >
                {timeSlots.map(time => {
                  const isPast = isPastDateTime(weekDays[showCreateModalForDay], time);
                  return (
                    <option 
                      key={time} 
                      value={time}
                      disabled={isPast}
                      style={{
                        color: isPast ? 'var(--muted)' : 'var(--text)',
                        background: isPast ? 'var(--glass)' : 'transparent'
                      }}
                    >
                      {time} {isPast ? '(прошедшее время)' : ''}
                    </option>
                  );
                })}
              </select>

              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Описание (опционально)
              </label>
              <textarea
                value={slotDescription}
                onChange={(e) => setSlotDescription(e.target.value)}
                placeholder={`Дополнительная информация о сессии по курсу "${courseTitle}"...`}
                maxLength={1000}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '15px',
                  marginBottom: '24px',
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
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '15px'
                    }}
                  />
                  <select
                    value={slotCurrency}
                    onChange={(e) => setSlotCurrency(e.target.value)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '15px',
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

              {/* Техническая информация (для отладки) */}
              <div style={{
                background: 'var(--glass)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                fontSize: '12px'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>Технические данные:</div>
                <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  <div>• Проверка пересечений: {allMentorSlots.length} слотов ментора</div>
                  <div>• Будущий post_id: <code>{postId}</code></div>
                  <div>• Дата: {weekDays[showCreateModalForDay].toLocaleDateString('ru-RU')}</div>
                  <div>• Время: {selectedTime} ({slotDuration} минут)</div>
                </div>
              </div>

              {/* Предварительный просмотр */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>Предварительный просмотр:</div>
                <div style={{ fontSize: '13px', color: '#10b981' }}>
                  <div>Курс: <strong>{courseTitle}</strong></div>
                  <div>День: <strong>{formatDayHeader(weekDays[showCreateModalForDay])}</strong></div>
                  <div>Время: <strong>{selectedTime}</strong> ({slotDuration} минут)</div>
                  {slotPrice ? (
                    <div>Цена: <strong>{slotPrice} {slotCurrency}</strong></div>
                  ) : (
                    <div>Цена: <strong>Бесплатно</strong></div>
                  )}
                  {postId && (
                    <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600 }}>
                      ✅ Будет привязан к курсу (post_id: {postId})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Кнопки действий */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowCreateModalForDay(null)}
                disabled={creatingSlot}
                style={{ padding: '10px 20px' }}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={createSlot}
                disabled={creatingSlot || !slotTitle.trim() || isPastDateTime(weekDays[showCreateModalForDay], selectedTime)}
                style={{ 
                  padding: '10px 24px',
                  background: creatingSlot ? 'var(--muted)' : 'var(--accent)',
                  opacity: (!slotTitle.trim() || isPastDateTime(weekDays[showCreateModalForDay], selectedTime)) ? 0.5 : 1
                }}
              >
                {creatingSlot ? (
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
                  'Создать слот'
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
        
        .slot.clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .slot.unclickable {
          opacity: 0.7;
          cursor: not-allowed !important;
        }
        
        .section {
          margin-bottom: 32px;
        }
        
        .booking-grid {
          scrollbar-width: thin;
          scrollbar-color: var(--glass) transparent;
        }
        
        .booking-grid::-webkit-scrollbar {
          height: 6px;
        }
        
        .booking-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .booking-grid::-webkit-scrollbar-thumb {
          background-color: var(--glass);
          border-radius: 3px;
        }
        
        select option:disabled {
          color: #999;
          background-color: #f5f5f5;
        }
        
        [data-theme="dark"] select option:disabled {
          color: #666;
          background-color: #333;
        }
        
        code {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.9em;
          background-color: rgba(0,0,0,0.05);
          padding: 2px 4px;
          border-radius: 3px;
        }
        
        [data-theme="dark"] code {
          background-color: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
};

export default CreateSlotsPage;