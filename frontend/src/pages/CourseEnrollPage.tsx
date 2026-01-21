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
  post_id?: string;
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

interface ListSessionsResponse {
  sessions: SessionResponse[];
  total: number;
}

interface UpdateSlotStatusRequest {
  status: string;
}

interface SuccessResponse {
  message: string;
  success: boolean;
}

// Упрощенная функция для работы с API
const apiFetch = async <T,>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> => {
  const baseUrl = 'http://localhost:8080';
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`🔵 API Request: ${options.method || 'GET'} ${url}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
      credentials: 'include'
    });

    console.log(`🟢 API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Если не JSON, читаем как текст
        const text = await response.text();
        if (text) errorMessage = text;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }

    // Для пустых ответов
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } catch (error: any) {
    console.error(`🔴 API Error:`, error);
    
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Не удалось подключиться к серверу. Проверьте:\n1. Запущен ли бэкенд на localhost:8080\n2. Настройки CORS');
    }
    
    throw error;
  }
};

const CourseEnrollPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
  });

  const [course, setCourse] = useState<Post | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [cancellingSession, setCancellingSession] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [cancellingError, setCancellingError] = useState<string | null>(null);
  const [cancellingSuccess, setCancellingSuccess] = useState(false);
  const [updatingSlotStatus, setUpdatingSlotStatus] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Загружаем курс
        const courseData = await apiFetch<{ post: Post }>(
          `/api/v1/posts/${id}`,
          { headers }
        );
        setCourse(courseData.post);

        // Загружаем информацию об авторе
        try {
          const authorData = await apiFetch<User>(
            `/api/v1/users/${courseData.post.author_id}`,
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

  // Загрузка слотов курса
  const loadCourseSlots = useCallback(async () => {
    if (!id) return;

    setLoadingSlots(true);
    try {
      console.log('🔵 Загружаем слоты курса...');
      const slotsData = await apiFetch<{ slots: SlotResponse[]; total: number }>(
        `/api/v1/posts/${id}/slots`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }
      );
      
      console.log(`🟢 Загружено слотов: ${slotsData.slots?.length || 0}`);
      setSlots(slotsData.slots || []);
    } catch (err: any) {
      console.error('🔴 Ошибка загрузки слотов:', err);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [id, token]);

  // Загрузка сессий студента
  const loadStudentSessions = useCallback(async () => {
    if (!user || !token) return;

    try {
      console.log('🔵 Загружаем сессии студента...');
      const sessionsData = await apiFetch<ListSessionsResponse>(
        `/api/v1/students/${user.user_id}/sessions`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      console.log(`🟢 Загружено сессий: ${sessionsData.sessions?.length || 0}`);
      setSessions(sessionsData.sessions || []);
    } catch (err: any) {
      console.error('🔴 Ошибка загрузки сессий:', err);
      setSessions([]);
    }
  }, [user, token]);

  // ПРЯМОЕ ОБНОВЛЕНИЕ СТАТУСА СЛОТА через /slots/{id}/status
  const updateSlotStatusDirectly = async (slotId: string, newStatus: string) => {
    console.log(`🔵 Обновляем статус слота ${slotId} на ${newStatus}`);
    setUpdatingSlotStatus(slotId);
    
    try {
      const requestData: UpdateSlotStatusRequest = { status: newStatus };
      
      const response = await apiFetch<SuccessResponse>(
        `/api/v1/slots/${slotId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        }
      );
      
      console.log('🟢 Статус слота обновлен:', response);
      
      // Сразу обновляем локальное состояние
      setSlots(prev => prev.map(slot => 
        slot.id === slotId ? { ...slot, status: newStatus } : slot
      ));
      
      return response;
    } catch (err: any) {
      console.error('🔴 Ошибка обновления статуса:', err);
      throw err;
    } finally {
      setUpdatingSlotStatus(null);
    }
  };

  // Загружаем данные при изменении
  useEffect(() => {
    if (course) {
      loadCourseSlots();
      if (user && token) {
        loadStudentSessions();
      }
    }
  }, [course, user, token, loadCourseSlots, loadStudentSessions]);

  // Бронирование слота - ПРОСТАЯ ВЕРСИЯ
  const handleBookSlot = async () => {
    if (!selectedSlot || !token || !user || !course) {
      setBookingError('Недостаточно данных для бронирования');
      return;
    }

    const selectedSlotData = slots.find(s => s.id === selectedSlot);
    if (!selectedSlotData) {
      setBookingError('Слот не найден');
      return;
    }

    // Проверки
    if (user.user_id === course.author_id) {
      setBookingError('Вы автор курса и не можете записаться');
      return;
    }

    const slotTime = new Date(selectedSlotData.start_time);
    if (slotTime <= new Date()) {
      setBookingError('Нельзя записаться на прошедший слот');
      return;
    }

    if (selectedSlotData.status !== 'available') {
      setBookingError('Слот уже забронирован или закрыт');
      return;
    }

    setBooking(true);
    setBookingError(null);
    setBookingSuccess(false);

    try {
      console.log('🚀 Начинаем процесс бронирования...');
      
      // 1. ПРЯМОЕ обновление статуса слота
      await updateSlotStatusDirectly(selectedSlot, 'booked');
      console.log('✅ Статус слота обновлен на "booked"');
      
      // 2. Создаем сессию
      const sessionRequest: CreateSessionRequest = {
        slot_id: selectedSlot,
        student_id: user.user_id,
        payment_status: 'pending'
      };
      
      console.log('🔵 Создаем сессию...');
      await apiFetch(
        '/api/v1/sessions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sessionRequest)
        }
      );
      console.log('✅ Сессия создана');
      
      setBookingSuccess(true);
      
      // Обновляем данные
      await Promise.all([
        loadCourseSlots(),
        loadStudentSessions()
      ]);
      
      setSelectedSlot(null);
      
    } catch (err: any) {
      console.error('❌ Ошибка бронирования:', err);
      setBookingError(err.message || 'Ошибка бронирования');
      
      // Попытка отката статуса
      try {
        const currentSlot = slots.find(s => s.id === selectedSlot);
        if (currentSlot?.status === 'booked') {
          await updateSlotStatusDirectly(selectedSlot, 'available');
        }
      } catch (rollbackErr) {
        console.error('Ошибка отката:', rollbackErr);
      }
    } finally {
      setBooking(false);
    }
  };

  // Отмена записи - ПРОСТАЯ ВЕРСИЯ
  const handleCancelSession = async (sessionId: string) => {
    if (!token || !window.confirm('Отменить запись?')) return;

    setCancellingSession(sessionId);
    setCancellingError(null);
    setCancellingSuccess(false);

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) throw new Error('Сессия не найдена');

      const slot = slots.find(s => s.id === session.slot_id);
      if (!slot) throw new Error('Слот не найден');

      if (session.student_id !== user?.user_id) {
        throw new Error('Нельзя отменить чужую запись');
      }

      console.log('🔵 Удаляем сессию...');
      await apiFetch(
        `/api/v1/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      console.log('✅ Сессия удалена');

      // ПРЯМОЕ обновление статуса слота обратно
      if (slot.status === 'booked') {
        await updateSlotStatusDirectly(slot.id, 'available');
        console.log('✅ Статус слота обновлен на "available"');
      }

      setCancellingSuccess(true);
      
      // Обновляем данные
      await Promise.all([
        loadCourseSlots(),
        loadStudentSessions()
      ]);
      
    } catch (err: any) {
      console.error('❌ Ошибка отмены:', err);
      setCancellingError(err.message || 'Ошибка отмены');
    } finally {
      setCancellingSession(null);
    }
  };

  // Вспомогательные функции
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} мин`;
    if (mins === 0) return `${hours} ч`;
    return `${hours} ч ${mins} мин`;
  };

  const isSlotAvailable = (slot: SlotResponse) => {
    const slotTime = new Date(slot.start_time);
    const now = new Date();
    return slotTime > now && slot.status === 'available';
  };

  const isSlotBookedByStudent = (slot: SlotResponse): SessionResponse | null => {
    if (!user) return null;
    return sessions.find(s => s.slot_id === slot.id && s.student_id === user.user_id) || null;
  };

  const getSlotStatusInfo = (slot: SlotResponse) => {
    const statuses = {
      available: { label: 'Доступен', color: '#10b981', emoji: '🟢', bgColor: 'rgba(16, 185, 129, 0.1)' },
      booked: { label: 'Забронирован', color: '#f59e0b', emoji: '🟡', bgColor: 'rgba(245, 158, 11, 0.1)' },
      closed: { label: 'Закрыт', color: '#ef4444', emoji: '🔴', bgColor: 'rgba(239, 68, 68, 0.1)' }
    };
    return statuses[slot.status as keyof typeof statuses] || statuses.available;
  };

  const isAuthor = user?.user_id === course?.author_id;

  // ========== RENDER ==========
  if (loading) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <header className="header">
          <Link to="/" className="brand">Mentor Fellowship</Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {token && user ? (
              <>
                <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">Профиль</Link>
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
          <div style={{ width: '60px', height: '60px', border: '3px solid var(--glass)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--muted)' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <header className="header">
          <Link to="/" className="brand">Mentor Fellowship</Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">Тема</button>
            {token && user ? (
              <>
                <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">Профиль</Link>
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
          <p style={{ color: 'var(--muted)', marginBottom: '20px', whiteSpace: 'pre-line' }}>
            {error || 'Курс не найден'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate('/courses')}>
              К списку курсов
            </button>
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>
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
        <header className="header">
          <Link to="/" className="brand">Mentor Fellowship</Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">Тема</button>
            {token && user ? (
              <>
                <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">Профиль</Link>
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
          <h3 style={{ margin: '0 0 12px 0' }}>Вы автор этого курса</h3>
          <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
            Вы не можете записаться на свой курс.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate(`/course/${id}`)}>
              Вернуться к курсу
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <header className="header">
          <Link to="/" className="brand">Mentor Fellowship</Link>
          <div className="header-nav">
            <button onClick={toggleTheme} className="btn btn-ghost">Тема</button>
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
        <Link to="/" className="brand">Mentor Fellowship</Link>
        <div className="header-nav">
          <button onClick={toggleTheme} className="btn btn-ghost">Тема</button>
          {token && user ? (
            <>
              <Link to={`/profile/${user.user_id}`} className="btn btn-ghost">{user.first_name || 'Профиль'}</Link>
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

      {/* Основной контент */}
      <div style={{ marginTop: '24px' }}>
        <nav style={{ margin: '24px 0', fontSize: '14px' }}>
          <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link> / 
          <Link to="/courses" style={{ color: 'var(--muted)', margin: '0 8px' }}>Курсы</Link> / 
          <Link to={`/course/${id}`} style={{ color: 'var(--muted)', marginRight: '8px' }}>{course.title}</Link> / 
          <span style={{ color: 'var(--accent)' }}>Запись</span>
        </nav>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '28px' }}>
            🎓 Запись на курс: {course.title}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '16px' }}>
            Выберите удобное время для записи
          </p>
        </div>
        
        {/* Информация о преподавателе */}
        <div className="card" style={{ padding: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'grid', placeContent: 'center', color: '#fff', fontWeight: 600, fontSize: '16px' }}>
            {author?.avatar_url ? (
              <img src={author.avatar_url} alt={author.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{author?.first_name?.[0]}{author?.last_name?.[0]}</span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {author ? `${author.first_name} ${author.last_name}` : 'Автор курса'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Преподаватель курса</div>
          </div>
        </div>

        {/* Сообщения */}
        {bookingSuccess && (
          <div className="card" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: '#10b981', color: '#10b981', marginBottom: '16px' }}>
            ✅ Запись успешна! Статус слота обновлен через PATCH /slots/{'{id}'}/status
          </div>
        )}
        
        {cancellingSuccess && (
          <div className="card" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: '#f59e0b', color: '#f59e0b', marginBottom: '16px' }}>
            ✅ Запись отменена! Статус слота обновлен через PATCH /slots/{'{id}'}/status
          </div>
        )}
        
        {bookingError && (
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', color: '#ef4444', marginBottom: '16px' }}>
            ❌ {bookingError}
          </div>
        )}
        
        {cancellingError && (
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', color: '#ef4444', marginBottom: '16px' }}>
            ❌ {cancellingError}
          </div>
        )}

        {/* Навигация по неделям */}
        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={goToPreviousWeek} className="btn btn-ghost">← Назад</button>
              <button onClick={goToToday} className="btn btn-ghost">Сегодня</button>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>
              Неделя с {currentWeekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </div>
            <button onClick={goToNextWeek} className="btn btn-ghost">Вперед →</button>
          </div>
        </div>

        {/* Грид слотов */}
        <div>
          {loadingSlots ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid var(--glass)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
              <p>Загрузка слотов...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', background: 'var(--glass)' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📅</div>
              <h3 style={{ margin: '0 0 12px 0' }}>Нет доступных слотов</h3>
              <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
                Автор курса еще не создал слоты для записи.
              </p>
              <button className="btn btn-primary" onClick={() => navigate(`/course/${id}`)}>
                Вернуться к курсу
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', marginBottom: '32px' }}>
                {weekDays.map((day, dayIndex) => {
                  const daySlots = getSlotsForDay(day);
                  const isPastDay = new Date(day) < new Date(new Date().setHours(0, 0, 0, 0));
                  
                  return (
                    <div key={dayIndex} className="card" style={{ padding: '12px', minHeight: '250px', opacity: isPastDay ? 0.7 : 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '10px', fontSize: '13px', color: isPastDay ? 'var(--muted)' : 'var(--accent)', textAlign: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--glass)' }}>
                        <div>{day.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}</div>
                        <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--muted)' }}>
                          {daySlots.length} слотов
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                        {daySlots.map(slot => {
                          const isAvailable = isSlotAvailable(slot);
                          const isSelected = selectedSlot === slot.id;
                          const studentSession = isSlotBookedByStudent(slot);
                          const isBookedByStudent = !!studentSession;
                          const statusInfo = getSlotStatusInfo(slot);
                          const startTime = formatTime(slot.start_time);
                          const duration = formatDuration(slot.duration_minutes);
                          const isUpdating = updatingSlotStatus === slot.id;
                          
                          return (
                            <div
                              key={slot.id}
                              onClick={() => isAvailable && !isBookedByStudent && !isUpdating && setSelectedSlot(slot.id)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: isSelected ? '2px solid var(--accent)' : `1px solid ${statusInfo.color}20`,
                                background: isBookedByStudent ? 'rgba(245, 158, 11, 0.2)' : isSelected ? 'var(--accent)' : `${statusInfo.color}10`,
                                fontSize: '10px',
                                cursor: (isAvailable && !isBookedByStudent && !isUpdating) ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                marginBottom: '2px',
                                opacity: isAvailable ? 1 : 0.6,
                                position: 'relative'
                              }}
                            >
                              {isUpdating && (
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 255, 255, 0.8)', display: 'grid', placeContent: 'center', borderRadius: '6px' }}>
                                  <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                </div>
                              )}
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                  <span style={{ fontSize: '12px' }}>{isBookedByStudent ? '✅' : statusInfo.emoji}</span>
                                  <div style={{ fontWeight: 600, fontSize: '10px', color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : statusInfo.color) }}>
                                    {startTime}
                                  </div>
                                </div>
                                
                                <div style={{ fontSize: '9px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : 'inherit') }}>
                                  {slot.title}
                                </div>
                                
                                <div style={{ fontSize: '9px', opacity: 0.8, color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : 'inherit') }}>
                                  {duration}
                                </div>
                                
                                <div style={{ fontSize: '8px', color: isBookedByStudent ? '#f59e0b' : (isSelected ? '#fff' : statusInfo.color), fontWeight: 600 }}>
                                  {statusInfo.label.toUpperCase()}
                                </div>
                                
                                {isBookedByStudent && studentSession && (
                                  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(245, 158, 11, 0.3)', paddingTop: '4px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelSession(studentSession.id);
                                      }}
                                      disabled={cancellingSession === studentSession.id || isUpdating}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        fontSize: '9px',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        cursor: (cancellingSession === studentSession.id || isUpdating) ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '2px',
                                        width: '100%'
                                      }}
                                    >
                                      {cancellingSession === studentSession.id ? 'Отмена...' : '✖ Отменить'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Информация о выбранном слоте */}
              {selectedSlotData && !isSlotBookedByStudent(selectedSlotData) && (
                <div className="card" style={{ marginBottom: '24px', padding: '16px', border: '2px solid var(--accent)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>🎯 Выбранный слот:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--accent)' }}>🟢</span>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{selectedSlotData.title}</div>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                        📅 {new Date(selectedSlotData.start_time).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                        ⏰ {formatTime(selectedSlotData.start_time)} ({formatDuration(selectedSlotData.duration_minutes)})
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '12px', padding: '8px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '6px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>Будет использовано:</div>
                        <code style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                          PATCH /api/v1/slots/{selectedSlotData.id}/status<br/>
                          body: {"{"} "status": "booked" {"}"}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Кнопки действий */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                {selectedSlotData && !isSlotBookedByStudent(selectedSlotData) && (
                  <button
                    className="btn btn-primary"
                    onClick={handleBookSlot}
                    disabled={booking || updatingSlotStatus === selectedSlot}
                    style={{ padding: '12px 24px', fontSize: '14px', minWidth: '180px' }}
                  >
                    {booking ? 'Запись...' : updatingSlotStatus === selectedSlot ? 'Обновление статуса...' : 'Записаться на курс'}
                  </button>
                )}
                
                <button className="btn btn-ghost" onClick={() => navigate(`/course/${id}`)} style={{ padding: '12px 20px', fontSize: '14px' }}>
                  Вернуться к курсу
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <footer style={{ marginTop: '60px', paddingTop: '40px', borderTop: '1px solid var(--glass)' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px', padding: '20px 0' }}>
          © {new Date().getFullYear()} Mentor Fellowship
        </div>
      </footer>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
          border-bottom: 1px solid var(--glass);
        }
        
        .brand {
          font-size: 20px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .header-nav {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid transparent;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: var(--accent);
          color: white;
        }
        
        .btn-primary:hover {
          background: var(--accent-hover);
        }
        
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-ghost {
          background: transparent;
          border: 1px solid var(--glass);
          color: var(--text);
        }
        
        .btn-ghost:hover {
          background: var(--glass);
        }
        
        .card {
          background: var(--card-bg);
          border: 1px solid var(--glass);
          border-radius: 8px;
          padding: 16px;
        }
        
        :root {
          --accent: #4f46e5;
          --accent-hover: #4338ca;
          --glass: rgba(0, 0, 0, 0.1);
          --text: #333;
          --muted: #666;
          --card-bg: #fff;
        }
        
        [data-theme="dark"] {
          --accent: #6366f1;
          --accent-hover: #4f46e5;
          --glass: rgba(255, 255, 255, 0.1);
          --text: #fff;
          --muted: #aaa;
          --card-bg: #1a1a1a;
        }
      `}</style>
    </div>
  );
};

export default CourseEnrollPage;