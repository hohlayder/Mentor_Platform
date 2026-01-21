// src/pages/CourseEnrollPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Типы из сваггера
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

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

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

interface CreateSessionRequest {
  slot_id: string;
  student_id: string;
  payment_status?: string;
}

interface ListSlotsResponse {
  slots: SlotResponse[];
  total: number;
}

interface ListSessionsResponse {
  sessions: SessionResponse[];
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

const SLOT_STATUSES = {
  available: { label: 'Доступен', color: '#10b981', emoji: '🟢', bgColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' },
  booked: { label: 'Забронирован', color: '#f59e0b', emoji: '🟡', bgColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' },
  closed: { label: 'Закрыт', color: '#ef4444', emoji: '🔴', bgColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }
} as const;

type SlotStatus = keyof typeof SLOT_STATUSES;

const CourseEnrollPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return savedTheme || 'light';
  });

  const [course, setCourse] = useState<Post | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [cancellingSession, setCancellingSession] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [cancellingError, setCancellingError] = useState<string | null>(null);
  const [cancellingSuccess, setCancellingSuccess] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

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
    setSelectedSlot(null);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
    setSelectedSlot(null);
  };

  const goToToday = () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
    setSelectedSlot(null);
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

  // Загрузка данных курса
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

        // Загружаем курс
        const courseData = await apiFetch<{ post: Post }>(
          `http://localhost:8080/api/v1/posts/${id}`,
          { headers }
        );
        
        const loadedCourse = courseData.post;
        setCourse(loadedCourse);

        // Загружаем информацию об авторе
        try {
          const authorData = await apiFetch<User>(
            `http://localhost:8080/api/v1/users/${loadedCourse.author_id}`,
            { headers }
          );
          setAuthor(authorData);
        } catch (err) {
          console.warn('Не удалось загрузить информацию об авторе:', err);
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

  // Загрузка доступных слотов ментора
  const loadMentorSlots = useCallback(async () => {
    if (!course || !author) return;

    setLoadingSlots(true);
    try {
      // Загружаем ВСЕ слоты ментора из сваггера: GET /mentors/{mentor_id}/slots
      const slotsData = await apiFetch<ListSlotsResponse>(
        `http://localhost:8080/api/v1/mentors/${author.user_id}/slots`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        }
      );
      
      setSlots(slotsData.slots || []);
    } catch (err: any) {
      console.error('Ошибка загрузки слотов:', err);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [course, author, token]);

  // Загрузка сессий студента
  const loadStudentSessions = useCallback(async () => {
    if (!user) return;

    setLoadingSessions(true);
    try {
      // Загружаем сессии студента из сваггера: GET /students/{student_id}/sessions
      const sessionsData = await apiFetch<ListSessionsResponse>(
        `http://localhost:8080/api/v1/students/${user.user_id}/sessions`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSessions(sessionsData.sessions || []);
    } catch (err: any) {
      console.error('Ошибка загрузки сессий:', err);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [user, token]);

  // Загружаем слоты и сессии при загрузке курса и при изменении недели
  useEffect(() => {
    if (course && author && user) {
      loadMentorSlots();
      loadStudentSessions();
    }
  }, [course, author, user, currentWeekStart, loadMentorSlots, loadStudentSessions]);

  // Бронирование слота (создание сессии)
  const handleBookSlot = async () => {
    if (!selectedSlot || !token || !user) {
      setBookingError('Выберите слот для записи');
      return;
    }

    setBooking(true);
    setBookingError(null);
    setBookingSuccess(false);

    try {
      // Создаем сессию по сваггеру: POST /sessions
      await apiFetch(
        'http://localhost:8080/api/v1/sessions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            slot_id: selectedSlot,
            student_id: user.user_id,
            payment_status: 'pending'
          } as CreateSessionRequest)
        }
      );

      setBookingSuccess(true);
      
      // Обновляем списки слотов и сессий
      await Promise.all([
        loadMentorSlots(),
        loadStudentSessions()
      ]);
      
      // Сбрасываем выбранный слот
      setSelectedSlot(null);
      
    } catch (err: any) {
      console.error('Ошибка бронирования:', err);
      setBookingError(err.message || 'Не удалось записаться на курс');
    } finally {
      setBooking(false);
    }
  };

  // Удаление сессии (отмена записи)
  const handleCancelSession = async (sessionId: string) => {
    if (!token || !window.confirm('Вы уверены, что хотите отменить запись на эту сессию?')) {
      return;
    }

    setCancellingSession(sessionId);
    setCancellingError(null);
    setCancellingSuccess(false);

    try {
      // Удаляем сессию по сваггеру: DELETE /sessions/{id}
      await apiFetch(
        `http://localhost:8080/api/v1/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      setCancellingSuccess(true);
      
      // Обновляем списки слотов и сессий
      await Promise.all([
        loadMentorSlots(),
        loadStudentSessions()
      ]);
      
      setTimeout(() => {
        setCancellingSuccess(false);
      }, 2000);
      
    } catch (err: any) {
      console.error('Ошибка отмены сессии:', err);
      setCancellingError(err.message || 'Не удалось отменить запись');
    } finally {
      setCancellingSession(null);
    }
  };

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

  // Получаем сессии для определенного дня
  const getSessionsForDay = (day: Date): SessionResponse[] => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    
    return sessions.filter(session => {
      // Находим слот для этой сессии
      const slot = slots.find(s => s.id === session.slot_id);
      if (!slot) return false;
      
      const slotTime = new Date(slot.start_time);
      return slotTime >= dayStart && slotTime <= dayEnd;
    });
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

  // Форматирование полного названия дня
  const formatFullDayName = (date: Date): string => {
    return date.toLocaleDateString('ru-RU', { 
      weekday: 'long', 
      day: 'numeric',
      month: 'long' 
    });
  };

  // Проверка доступности слота (не прошедшее время и статус available)
  const isSlotAvailable = (slot: SlotResponse) => {
    const slotTime = new Date(slot.start_time);
    const now = new Date();
    return slotTime > now && slot.status === 'available';
  };

  // Получение информации о статусе слота
  const getSlotStatusInfo = (slot: SlotResponse) => {
    return SLOT_STATUSES[slot.status as SlotStatus] || SLOT_STATUSES.available;
  };

  // Проверяем, забронировал ли студент этот слот
  const isSlotBookedByStudent = (slot: SlotResponse): SessionResponse | null => {
    if (!user) return null;
    return sessions.find(session => 
      session.slot_id === slot.id && session.student_id === user.user_id
    ) || null;
  };

  // Проверка, является ли пользователь автором курса
  const isAuthor = user?.user_id === course?.author_id;

  if (loading) {
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
            {token && user ? (
              <>
                <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">
                  {user.first_name || 'Профиль'}
                </Link>
                <button onClick={logout} className="btn btn-ghost">Выйти</button>
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
          <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
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
            {token && user ? (
              <>
                <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">
                  {user.first_name || 'Профиль'}
                </Link>
                <button onClick={logout} className="btn btn-ghost">Выйти</button>
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

  if (isAuthor) {
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
            {token && user ? (
              <>
                <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">
                  {user.first_name || 'Профиль'}
                </Link>
                <button onClick={logout} className="btn btn-ghost">Выйти</button>
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
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>👨‍🏫</div>
          <h3 style={{ margin: '0 0 12px 0' }}>Вы являетесь автором этого курса</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            Чтобы записаться на курс, необходимо создать слоты для записи на странице курса.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/courses/${id}`)}
            >
              Вернуться к курсу
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

  if (!token) {
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
            <Link to="/login" className="btn btn-ghost">Войти</Link>
            <Link to="/signup" className="btn btn-primary">Регистрация</Link>
          </div>
        </header>
        
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
          <h3 style={{ margin: '0 0 12px 0' }}>Необходима авторизация</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            Войдите в систему, чтобы записаться на курс
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary">Войти</Link>
            <Link to="/signup" className="btn btn-outline">Регистрация</Link>
          </div>
        </div>
      </div>
    );
  }

  const weekDays = getWeekDays();
  const selectedSlotData = slots.find(s => s.id === selectedSlot);
  const selectedSession = selectedSlotData ? isSlotBookedByStudent(selectedSlotData) : null;

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
          {token && user ? (
            <>
              <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">
                {user.first_name || 'Профиль'}
              </Link>
              <button onClick={logout} className="btn btn-ghost">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Войти</Link>
              <Link to="/signup" className="btn btn-primary">Регистрация</Link>
            </>
          )}
        </div>
      </header>

      {/* Course & Teacher Info */}
      <div style={{ marginTop: '24px' }}>
        <nav style={{ margin: '24px 0', fontSize: '14px' }}>
          <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <Link to="/courses" style={{ color: 'var(--muted)' }}>Курсы</Link>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <Link to={`/course/${id}`} style={{ color: 'var(--muted)' }}>{course.title}</Link>
          <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
          <span style={{ color: 'var(--accent)' }}>Запись на курс</span>
        </nav>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '28px' }}>
            🎓 Запись на курс: {course.title}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '16px' }}>
            Выберите удобное время для записи на консультацию
          </p>
        </div>
        
        <div className="card" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          padding: '16px',
          marginBottom: '32px'
        }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%',
            overflow: 'hidden',
            background: author?.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'grid',
            placeContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: '16px',
            flexShrink: 0
          }}>
            {author?.avatar_url ? (
              <img 
                src={author.avatar_url} 
                alt={author?.first_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span>{author?.first_name?.[0]}{author?.last_name?.[0]}</span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {author ? `${author.first_name} ${author.last_name}` : 'Автор курса'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Преподаватель курса
            </div>
          </div>
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

      {/* Сообщения */}
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
          ✅ Вы успешно записались на курс!
        </div>
      )}
      
      {cancellingSuccess && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          color: '#f59e0b',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          ✅ Запись успешно отменена
        </div>
      )}
      
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
      
      {cancellingError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {cancellingError}
        </div>
      )}

      {/* Грид для выбора времени - КОМПАКТНАЯ ВЕРСИЯ */}
      <div className="section">
        {loadingSlots || loadingSessions ? (
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
            <p style={{ color: 'var(--muted)' }}>Загрузка доступного времени...</p>
          </div>
        ) : (
          <>
            <div className="booking-grid" style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '12px',
              marginBottom: '32px'
            }}>
              {weekDays.map((day, dayIndex) => {
                const daySlots = getSlotsForDay(day);
                const daySessions = getSessionsForDay(day);
                const isPastDay = new Date(day) < new Date(new Date().setHours(0, 0, 0, 0));
                
                return (
                  <div key={dayIndex} className="card" style={{ 
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass)',
                    minHeight: '320px',
                    position: 'relative',
                    opacity: isPastDay ? 0.7 : 1
                  }}>
                    <div className="booking-date" style={{ 
                      fontWeight: 600,
                      marginBottom: '10px',
                      fontSize: '13px',
                      color: isPastDay ? 'var(--muted)' : 'var(--accent)',
                      textAlign: 'center',
                      paddingBottom: '6px',
                      borderBottom: '1px solid var(--glass)'
                    }}>
                      <div>{formatDayHeader(day)}</div>
                      {isPastDay && <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>Прошедший день</div>}
                      <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--muted)' }}>
                        {daySlots.length} слотов / {daySessions.length} ваших записей
                      </div>
                    </div>
                    
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
                          Нет доступных слотов
                        </div>
                      ) : (
                        daySlots.map(slot => {
                          const isAvailable = isSlotAvailable(slot);
                          const isSelected = selectedSlot === slot.id;
                          const studentSession = isSlotBookedByStudent(slot);
                          const isBookedByStudent = !!studentSession;
                          const statusInfo = getSlotStatusInfo(slot);
                          const startTime = formatTime(slot.start_time);
                          const duration = formatDuration(slot.duration_minutes);
                          const hasPrice = slot.price && slot.price > 0;
                          
                          return (
                            <div
                              key={slot.id}
                              onClick={() => isAvailable && !isBookedByStudent && setSelectedSlot(slot.id)}
                              className={`slot ${isBookedByStudent ? 'booked-by-student' : isSelected ? 'selected' : isAvailable ? 'available' : 'unavailable'}`}
                              style={{
                                padding: '6px 4px',
                                borderRadius: '6px',
                                border: isSelected ? '2px solid var(--accent)' : `1px solid ${statusInfo.borderColor}`,
                                background: isBookedByStudent ? 'rgba(245, 158, 11, 0.2)' : isSelected ? 'var(--accent)' : statusInfo.bgColor,
                                fontSize: '10px',
                                cursor: (isAvailable && !isBookedByStudent) ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                marginBottom: '2px',
                                opacity: isAvailable ? 1 : 0.6,
                                position: 'relative'
                              }}
                            >
                              {isBookedByStudent && cancellingSession === studentSession?.id && (
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
                                  <span style={{ fontSize: '12px' }}>
                                    {isBookedByStudent ? '✅' : statusInfo.emoji}
                                  </span>
                                  <div style={{ 
                                    fontWeight: 600, 
                                    fontSize: '10px',
                                    color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : statusInfo.color)
                                  }}>
                                    {startTime}
                                  </div>
                                  {hasPrice && (
                                    <div style={{ 
                                      fontSize: '9px', 
                                      fontWeight: 600,
                                      marginLeft: '2px',
                                      color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : 'var(--accent)')
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
                                  textOverflow: 'ellipsis',
                                  color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : 'inherit')
                                }}>
                                  {slot.title}
                                  {isBookedByStudent && <span style={{ marginLeft: '2px' }}>(ваша запись)</span>}
                                </div>
                                
                                <div style={{ 
                                  fontSize: '9px', 
                                  opacity: 0.8,
                                  color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : 'inherit')
                                }}>
                                  {duration}
                                </div>
                                
                                {/* Кнопка отмены для забронированных студентом слотов */}
                                {isBookedByStudent && studentSession && (
                                  <div style={{ 
                                    marginTop: '4px',
                                    borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                                    paddingTop: '4px'
                                  }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelSession(studentSession.id);
                                      }}
                                      disabled={cancellingSession === studentSession.id}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        fontSize: '9px',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        cursor: cancellingSession === studentSession.id ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '2px',
                                        width: '100%'
                                      }}
                                      title="Отменить запись"
                                    >
                                      {cancellingSession === studentSession.id ? (
                                        <>
                                          <span style={{ 
                                            display: 'inline-block',
                                            width: '8px',
                                            height: '8px',
                                            border: '1px solid #ef4444',
                                            borderTopColor: 'transparent',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite'
                                          }} />
                                          Отмена...
                                        </>
                                      ) : (
                                        '✖ Отменить запись'
                                      )}
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

            {/* Информация о выбранном слоте */}
            {selectedSlotData && !isSlotBookedByStudent(selectedSlotData) && (
              <div className="card" style={{ 
                padding: '16px',
                marginBottom: '24px',
                background: 'var(--glass)',
                border: '2px solid var(--accent)',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>🎯 Выбранное время для записи:</h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr auto',
                  gap: '16px',
                  alignItems: 'start'
                }}>
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', color: 'var(--accent)' }}>🟢</span>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>
                        {selectedSlotData.title}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                      📅 {formatFullDayName(new Date(selectedSlotData.start_time))}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                      ⏰ {formatTime(selectedSlotData.start_time)} ({formatDuration(selectedSlotData.duration_minutes)})
                    </div>
                    {selectedSlotData.description && (
                      <div style={{ 
                        fontSize: '13px', 
                        marginTop: '8px', 
                        color: 'var(--text)',
                        lineHeight: 1.4
                      }}>
                        📝 {selectedSlotData.description}
                      </div>
                    )}
                    {selectedSlotData.price && selectedSlotData.price > 0 && (
                      <div style={{ 
                        fontSize: '14px', 
                        color: 'var(--accent)', 
                        fontWeight: 600, 
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        💰 Стоимость: {selectedSlotData.price} {selectedSlotData.currency || '₽'}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--muted)',
                    textAlign: 'right'
                  }}>
                    ID слота:<br />
                    <code style={{ 
                      background: 'rgba(0,0,0,0.05)', 
                      padding: '3px 6px', 
                      borderRadius: '3px',
                      fontSize: '10px',
                      wordBreak: 'break-all'
                    }}>
                      {selectedSlotData.id}
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* Кнопки действий */}
            <div style={{ 
              marginTop: '20px', 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              {selectedSlotData && !isSlotBookedByStudent(selectedSlotData) && (
                <button
                  className="btn btn-primary"
                  onClick={handleBookSlot}
                  disabled={booking}
                  style={{ 
                    padding: '12px 24px',
                    fontSize: '14px',
                    minWidth: '180px'
                  }}
                >
                  {booking ? (
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
                      Запись...
                    </>
                  ) : 'Записаться на курс'}
                </button>
              )}
              
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/course/${id}`)}
                style={{ padding: '12px 20px', fontSize: '14px' }}
              >
                Вернуться к курсу
              </button>
              
              {selectedSlot && !isSlotBookedByStudent(selectedSlotData!) && !booking && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setSelectedSlot(null)}
                  style={{ 
                    padding: '12px 20px', 
                    fontSize: '14px',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.2)'
                  }}
                >
                  Отменить выбор
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ 
        marginTop: '60px', 
        paddingTop: '40px',
        borderTop: '1px solid var(--glass)'
      }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px', padding: '20px 0' }}>
          © {new Date().getFullYear()} Mentor Fellowship. Все права защищены.
        </div>
      </footer>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .slot:hover:not(.booked-by-student):not(.unavailable) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .slot.selected {
          transform: scale(1.02);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3);
        }
        
        .slot.booked-by-student {
          cursor: default !important;
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
        
        .btn-ghost {
          background: transparent;
          border: 1px solid var(--glass);
          color: var(--text);
        }
        
        .btn-ghost:hover {
          background: var(--glass);
        }
        
        .btn-primary {
          background: var(--accent);
          border: 1px solid var(--accent);
          color: #fff;
        }
        
        .btn-primary:hover {
          background: var(--accent-hover);
        }
        
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default CourseEnrollPage;