// src/pages/Courses.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Header from '../components/Header';

// Типы для курса (на основе Swagger)
interface Post {
  id: string;
  author_id: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  average_rating: number;
  ratings_count: number;
  created_at: string;
  updated_at: string;
  avatar_url?: string | null; // Добавлено поле для аватара курса
}

// Типы для ответа API
interface ListPostsResponse {
  posts: Post[];
  total_count: number;
  next_page_token?: string;
}

// Типы для сортировки
type SortField = 'created_at' | 'updated_at' | 'title';
type SortOrder = 'asc' | 'desc';

// Популярные теги
const DEFAULT_TAGS = ['JavaScript', 'React', 'TypeScript', 'Python', 'Java', 'Frontend', 'Backend'];

// Опции сортировки
const SORT_OPTIONS = [
  { value: 'created_at-desc', label: 'Новые', emoji: '' },
  { value: 'created_at-asc', label: 'Старые', emoji: '' },
  { value: 'updated_at-desc', label: 'Недавно обновленные', emoji: '' },
  { value: 'title-asc', label: 'По названию (А-Я)', emoji: '' },
  { value: 'title-desc', label: 'По названию (Я-А)', emoji: '' },
];

// Константы
const PAGE_SIZE = 12; // Фиксированный размер страницы

// Функция для управления темой
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

// Функция для получения URL аватара поста
const getPostAvatarUrl = (postId: string, avatarUrl?: string | null): string => {
  if (!avatarUrl) return '';
  
  // Если это уже полный URL, возвращаем как есть
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  
  // Если это просто имя файла, формируем URL
  if (!avatarUrl.includes('/')) {
    return `http://localhost:8080/api/v1/files/posts/avatar/${avatarUrl}`;
  }
  
  // Если это относительный путь
  if (avatarUrl.startsWith('/')) {
    return `http://localhost:8080${avatarUrl}`;
  }
  
  // Если это путь без префикса http
  if (avatarUrl.startsWith('files/posts/avatar/')) {
    return `http://localhost:8080/api/v1/${avatarUrl}`;
  }
  
  // По умолчанию используем эндпоинт с post_id
  return `http://localhost:8080/api/v1/files/posts/avatar/${postId}`;
};

const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // Состояние фильтров
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [showMyCourses, setShowMyCourses] = useState(false);
  const [sortBy, setSortBy] = useState<string>('created_at-desc');
  const [page, setPage] = useState(1);
  const [pageTokens, setPageTokens] = useState<Map<number, string>>(new Map()); // Храним токены для каждой страницы
  
  // Состояние данных
  const [courses, setCourses] = useState<Post[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popularTags, setPopularTags] = useState<string[]>(DEFAULT_TAGS);
  
  // Извлечение параметров из URL
  useEffect(() => {
    const tagsParam = searchParams.get('tags');
    if (tagsParam) {
      setSelectedTags(tagsParam.split(','));
    }
    const myCoursesParam = searchParams.get('my');
    if (myCoursesParam === 'true' && token) {
      setShowMyCourses(true);
    }
    const pageParam = searchParams.get('page');
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setPage(pageNum);
      }
    }
  }, [searchParams, token]);
  
  // Загрузка курсов для конкретной страницы
  const fetchCourses = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Собираем параметры запроса
      const params = new URLSearchParams({
        page_size: PAGE_SIZE.toString(),
        status: 'published', // Только опубликованные курсы
        ...(searchQuery && { search: searchQuery }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
        ...(showMyCourses && user && { author_id: user.user_id }), // Фильтр по автору
      });
      
      // Добавляем сортировку
      const [sortField, sortOrder] = sortBy.split('-') as [SortField, SortOrder];
      params.append('sort_field', sortField);
      params.append('sort_order', sortOrder);
      
      // Пагинация через page_token
      const tokenForPage = pageTokens.get(pageNum - 1); // Токен для предыдущей страницы
      if (pageNum > 1 && tokenForPage) {
        params.append('page_token', tokenForPage);
      }
      
      // Запрос к API
      const response = await fetch(`http://localhost:8080/api/v1/posts?${params}`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка загрузки курсов: ${response.status}`);
      }
      
      const data: ListPostsResponse = await response.json();
      
      // Обновляем данные
      setCourses(data.posts || []);
      setTotalCount(data.total_count || 0);
      
      // Сохраняем токен для следующей страницы
      if (data.next_page_token) {
        setPageTokens(prev => new Map(prev).set(pageNum, data.next_page_token!));
      }
      
      // Обновляем URL с текущими фильтрами
      const newParams = new URLSearchParams();
      if (searchQuery) newParams.set('search', searchQuery);
      if (selectedTags.length > 0) newParams.set('tags', selectedTags.join(','));
      if (showMyCourses) newParams.set('my', 'true');
      newParams.set('sort', sortBy);
      newParams.set('page', pageNum.toString());
      setSearchParams(newParams);
      
    } catch (err) {
      console.error('Ошибка при загрузке курсов:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTags, showMyCourses, sortBy, token, user, setSearchParams, pageTokens]);
  
  // Загружаем курсы при изменении страницы или сбросе фильтров
  useEffect(() => {
    // Сбрасываем токены при изменении фильтров
    const shouldReset = searchParams.toString() === '' || 
                       !searchParams.get('page') || 
                       page === 1;
    
    if (shouldReset) {
      setPageTokens(new Map());
    }
    
    fetchCourses(page);
  }, [page]);
  
  // Сбрасываем на первую страницу при изменении фильтров
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      // Если уже на первой странице, перезагружаем данные
      setPageTokens(new Map());
      fetchCourses(1);
    }
  }, [searchQuery, selectedTags, showMyCourses, sortBy]);
  
  // Получаем популярные теги из существующих курсов
  useEffect(() => {
    if (courses.length > 0) {
      const allTags = courses.flatMap(course => course.tags || []);
      const tagFrequency: Record<string, number> = {};
      
      allTags.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
      
      const sortedTags = Object.entries(tagFrequency)
        .sort(([, a], [, b]) => b - a)
        .map(([tag]) => tag)
        .slice(0, 15);
      
      if (sortedTags.length > 0) {
        setPopularTags(prev => [...new Set([...sortedTags, ...prev])].slice(0, 20));
      }
    }
  }, [courses]);
  
  // Обработчики фильтров
  const handleSearch = useCallback(() => {
    setPage(1);
  }, []);
  
  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
    setPage(1);
  }, []);
  
  const handleAddCustomTag = useCallback(() => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags(prev => [...prev, customTag.trim()]);
      setCustomTag('');
      setPage(1);
    }
  }, [customTag, selectedTags]);
  
  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
    setPage(1);
  }, []);
  
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
    setShowMyCourses(false);
    setPage(1);
    setSearchParams({});
  }, [setSearchParams]);
  
  const handleCourseClick = useCallback((courseId: string) => {
    navigate(`/courses/${courseId}`);
  }, [navigate]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);
  
  const toggleMyCourses = useCallback(() => {
    setShowMyCourses(prev => !prev);
    setPage(1);
  }, []);
  
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);
  
  // Функция для рендеринга изображения курса
  const renderCourseImage = (course: Post) => {
    const avatarUrl = course.avatar_url ? getPostAvatarUrl(course.id, course.avatar_url) : '';
    const isMyCourse = user && course.author_id === user.user_id;
    
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={course.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          onError={(e) => {
            // Если изображение не загружается, показываем fallback
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.style.width = '100%';
              fallback.style.height = '100%';
              fallback.style.background = isMyCourse 
                ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' 
                : 'linear-gradient(135deg, var(--accent), var(--accent-2))';
              fallback.style.display = 'flex';
              fallback.style.alignItems = 'center';
              fallback.style.justifyContent = 'center';
              fallback.style.color = '#fff';
              fallback.style.fontWeight = 'bold';
              fallback.style.fontSize = '48px';
              fallback.style.fontWeight = '800';
              fallback.style.opacity = '0.9';
              fallback.textContent = course.title.charAt(0).toUpperCase();
              parent.appendChild(fallback);
            }
          }}
        />
      );
    }
    
    // Если нет аватара, показываем градиент с первой буквой
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: isMyCourse 
          ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' 
          : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '48px',
        fontWeight: '800',
        opacity: 0.9
      }}>
        {course.title.charAt(0).toUpperCase()}
      </div>
    );
  };
  
  // Корректный расчет общего количества страниц
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  
  return (
    <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
      {/* Header */}
      <Header theme={theme} toggleTheme={toggleTheme} />

      <nav style={{ marginBottom: '24px', marginTop: '20px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>Курсы</span>
      </nav>
      
      {/* Основной контент */}
      <div style={{ display: 'flex', gap: '32px', marginTop: '24px' }}>
        {/* Левая панель - Фильтры */}
        <div style={{ 
          flex: '0 0 280px',
          position: 'sticky',
          top: '80px',
          height: 'fit-content',
          alignSelf: 'flex-start'
        }}>
          {/* Блок поиска - компактный */}
          <div style={{ 
            marginBottom: '24px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            border: '1px solid var(--glass)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div className="search" style={{ margin: 0 }}>
              <input
                type="text"
                placeholder="Поиск курсов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          {/* Фильтры */}
          <div style={{ 
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            border: '1px solid var(--glass)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Фильтры
              </h3>
              {(searchQuery || selectedTags.length > 0 || showMyCourses) && (
                <button 
                  className="btn btn-ghost" 
                  onClick={handleClearFilters}
                  style={{ fontSize: '13px', padding: '5px 10px' }}
                >
                  Сбросить
                </button>
              )}
            </div>
            
            {/* Фильтр "Мои курсы" */}
            {token && user && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  marginBottom: '8px',
                  padding: '10px',
                  borderRadius: '10px',
                  background: showMyCourses ? 'var(--accent-light)' : 'transparent',
                  border: `1px solid ${showMyCourses ? 'var(--accent)' : 'var(--glass)'}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition)'
                }} onClick={toggleMyCourses}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '4px',
                    border: `2px solid ${showMyCourses ? 'var(--accent)' : 'var(--muted)'}`,
                    background: showMyCourses ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {showMyCourses && (
                      <span style={{ color: 'white', fontSize: '12px' }}>✓</span>
                    )}
                  </div>
                  <span style={{ fontWeight: showMyCourses ? 600 : 400 }}>
                    👤 Мои курсы
                  </span>
                </div>
                {showMyCourses && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: 'var(--muted)',
                    padding: '8px 12px',
                    background: 'var(--accent-lightest)',
                    borderRadius: '8px',
                    marginTop: '8px'
                  }}>
                    Показываются только курсы, созданные вами
                  </div>
                )}
              </div>
            )}
            
            {/* Популярные теги */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--muted)' }}>
                Популярные теги
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    className={`chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                    style={{ fontSize: '13px', padding: '6px 10px' }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Добавить свой тег */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--muted)' }}>
                ➕ Добавить тег
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Введите тег..."
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                  style={{ 
                    flex: 1, 
                    padding: '8px 12px',
                    fontSize: '14px'
                  }}
                />
                <button 
                  className="btn btn-primary"
                  onClick={handleAddCustomTag}
                  disabled={!customTag.trim()}
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                >
                  +
                </button>
              </div>
            </div>
            
            {/* Выбранные теги */}
            {selectedTags.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--muted)' }}>
                  ✅ Выбранные теги
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedTags.map((tag) => (
                    <div 
                      key={tag}
                      className="chip active"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        padding: '6px 10px',
                        fontSize: '13px'
                      }}
                    >
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          padding: '0', 
                          color: 'inherit',
                          fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Статистика */}
            <div style={{ 
              padding: '16px', 
              background: 'var(--accent-lightest)',
              borderRadius: '8px',
              border: '1px solid var(--glass)',
              fontSize: '13px'
            }}>
              <div style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                Информация
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                <div>• Всего курсов: <strong>{totalCount}</strong></div>
                <div>• На странице: <strong>{PAGE_SIZE}</strong></div>
                <div>• Страница: <strong>{page} из {totalPages}</strong></div>
                <div>• Показано: <strong>{courses.length}</strong></div>
                {showMyCourses && <div>• Режим: <strong>👤 Мои курсы</strong></div>}
              </div>
            </div>
          </div>
        </div>
        
        {/* Правая панель - Курсы */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Панель сортировки */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px',
            padding: '16px 20px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                {showMyCourses ? 'Мои курсы' : 'Все курсы'}
              </h2>
              {courses.length > 0 && (
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>
                  Показано <strong>{courses.length}</strong> из <strong>{totalCount}</strong> курсов • Страница <strong>{page}</strong> из <strong>{totalPages}</strong>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--muted)' }}>Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  minWidth: '200px'
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Состояние загрузки */}
          {isLoading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '80px 20px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass)'
            }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                border: '3px solid var(--glass)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                margin: '0 auto 24px',
                animation: 'spin 1s linear infinite'
              }} />
              <h3 style={{ marginBottom: '12px', fontSize: '18px' }}>⏳ Загружаем курсы...</h3>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                {showMyCourses ? 'Ищем ваши курсы...' : 'Загружаем каталог курсов...'}
              </p>
            </div>
          )}
          
          {/* Ошибка */}
          {error && !isLoading && (
            <div style={{ 
              padding: '40px', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass)',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>😞</div>
              <h3 style={{ marginBottom: '12px', fontSize: '20px' }}>Произошла ошибка</h3>
              <p style={{ color: '#EF4444', marginBottom: '24px', fontSize: '15px' }}>{error}</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => fetchCourses(page)}
                  style={{ padding: '10px 20px' }}
                >
                  🔄 Попробовать снова
                </button>
                <button 
                  className="btn btn-ghost" 
                  onClick={handleClearFilters}
                  style={{ padding: '10px 20px' }}
                >
                  Сбросить фильтры
                </button>
              </div>
            </div>
          )}
          
          {/* Сетка курсов */}
          {!isLoading && !error && courses.length > 0 && (
            <>
              <div className="courses-grid" style={{ 
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px'
              }}>
                {courses.map((course) => {
                  const isMyCourse = user && course.author_id === user.user_id;
                  return (
                    <div 
                      key={course.id}
                      className="course"
                      onClick={() => handleCourseClick(course.id)}
                      style={{ 
                        cursor: 'pointer',
                        position: 'relative',
                        border: isMyCourse ? '2px solid var(--accent)' : undefined,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {/* Бейдж "Мой курс" */}
                      {isMyCourse && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          zIndex: 2,
                          background: 'var(--accent)',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          👤 Мой курс
                        </div>
                      )}
                      
                      {/* Заголовок курса с цветным фоном или аватаром */}
                      <div style={{
                        height: '160px',
                        width: '100%',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* Изображение курса */}
                        {renderCourseImage(course)}
                        
                        {/* Рейтинг */}
                        {course.average_rating > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(255,255,255,0.2)',
                            padding: '6px 10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backdropFilter: 'blur(4px)',
                            fontWeight: 600,
                            zIndex: 2
                          }}>
                            <span>⭐</span>
                            <span>{course.average_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="c-body" style={{ 
                        padding: '20px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <h3 className="title" style={{ 
                          margin: 0, 
                          fontSize: '18px',
                          lineHeight: '1.4',
                          fontWeight: 700,
                          marginBottom: '12px'
                        }}>
                          {course.title}
                        </h3>
                        
                        {/* Краткое описание */}
                        <p style={{ 
                          fontSize: '14px', 
                          color: 'var(--muted)',
                          margin: '0 0 16px 0',
                          lineHeight: '1.5',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {course.content || 'Описание отсутствует'}
                        </p>
                        
                        {/* Теги курса */}
                        {course.tags && course.tags.length > 0 && (
                          <div className="chips" style={{ marginTop: 'auto' }}>
                            {course.tags.slice(0, 4).map((tag) => (
                              <span 
                                key={tag}
                                className="chip"
                                style={{ 
                                  fontSize: '12px',
                                  padding: '5px 10px',
                                  marginBottom: '8px'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTagToggle(tag);
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                            {course.tags.length > 4 && (
                              <span 
                                className="chip"
                                style={{ 
                                  fontSize: '12px',
                                  padding: '5px 10px',
                                  marginBottom: '8px'
                                }}
                              >
                                +{course.tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Мета-информация */}
                        <div className="meta" style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '16px',
                          fontSize: '13px',
                          paddingTop: '16px',
                          borderTop: '1px solid var(--glass)'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }}>
                            <span>📅</span>
                            {new Date(course.created_at).toLocaleDateString('ru-RU')}
                          </span>
                          <span style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600
                          }}>
                            {course.ratings_count > 0 ? (
                              <>
                                <span style={{ color: 'var(--muted)' }}>⭐</span>
                                <span>{course.ratings_count}</span>
                              </>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>Нет оценок</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Пагинация */}
              {totalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '48px',
                  padding: '24px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--glass)'
                }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ 
                      padding: '10px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '15px'
                    }}
                  >
                    ◀️ Назад
                  </button>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(() => {
                      const pages = [];
                      
                      // Всегда показываем первую страницу
                      if (page > 3) {
                        pages.push(1);
                        if (page > 4) pages.push('...');
                      }
                      
                      // Показываем страницы вокруг текущей
                      for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
                        pages.push(i);
                      }
                      
                      // Всегда показываем последнюю страницу
                      if (page < totalPages - 2) {
                        if (page < totalPages - 3) pages.push('...');
                        pages.push(totalPages);
                      }
                      
                      return pages.map((pageNum, index) => 
                        pageNum === '...' ? (
                          <span 
                            key={`dots-${index}`} 
                            style={{ 
                              padding: '10px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--muted)'
                            }}
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={pageNum}
                            className={`btn ${page === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setPage(pageNum as number)}
                            style={{ 
                              padding: '10px 16px',
                              minWidth: '44px',
                              fontSize: '15px'
                            }}
                          >
                            {pageNum}
                          </button>
                        )
                      );
                    })()}
                  </div>
                  
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ 
                      padding: '10px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '15px'
                    }}
                  >
                    Вперед ▶️
                  </button>
                </div>
              )}
            </>
          )}
          
          {/* Пустое состояние */}
          {!isLoading && !error && courses.length === 0 && (
            <div className="empty-state" style={{ 
              padding: '60px 40px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '80px', marginBottom: '24px' }}>
                {showMyCourses ? '📭' : '🔍'}
              </div>
              <h3 style={{ marginBottom: '16px', fontSize: '24px' }}>
                {showMyCourses ? 'У вас пока нет курсов' : 'Курсы не найдены'}
              </h3>
              <p style={{ 
                color: 'var(--muted)', 
                marginBottom: '32px', 
                maxWidth: '500px', 
                margin: '0 auto 32px',
                fontSize: '16px',
                lineHeight: '1.5'
              }}>
                {showMyCourses 
                  ? 'Создайте свой первый курс, чтобы он появился здесь'
                  : 'Попробуйте изменить фильтры поиска или очистить текущие'}
              </p>
              
              {!showMyCourses && (
                <div style={{ marginTop: '24px' }}>
                  <Link to="/courses/new" className="btn btn-primary" style={{ padding: '12px 24px' }}>
                    + Создать новый курс
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* CSS для анимации спиннера */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .course:hover {
          transform: translateY(-8px);
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.12);
          transition: transform var(--transition), box-shadow var(--transition);
        }
        
        /* Адаптивность */
        @media (max-width: 1200px) {
          .courses-grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
          }
        }
        
        @media (max-width: 992px) {
          .container > div {
            flex-direction: column;
          }
          
          .container > div > div:first-child {
            position: static !important;
            width: 100%;
            margin-bottom: 32px;
          }
          
          .courses-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)) !important;
          }
        }
        
        @media (max-width: 768px) {
          .courses-grid {
            grid-template-columns: 1fr !important;
          }
          
          .container > div > div:first-child {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CoursesPage;