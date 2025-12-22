// src/pages/Courses.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

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
}

// Типы для сортировки
type SortField = 'created_at' | 'updated_at' | 'title' | 'average_rating';
type SortOrder = 'asc' | 'desc';

// Популярные теги (можно будет динамически получать из API)
const POPULAR_TAGS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
  'Java', 'C#', 'Go', 'Rust', 'DevOps', 'Docker', 'Kubernetes',
  'AWS', 'Machine Learning', 'Data Science', 'Web Development',
  'Mobile Development', 'UI/UX', 'Blockchain', 'Cybersecurity'
];

// Опции сортировки с emoji
const SORT_OPTIONS = [
  { value: 'created_at-desc', label: '📅 Новые', icon: '📅' },
  { value: 'created_at-asc', label: '📅 Старые', icon: '📅' },
  { value: 'updated_at-desc', label: '⏰ Недавно обновленные', icon: '⏰' },
  { value: 'average_rating-desc', label: '⭐ Высокий рейтинг', icon: '⭐' },
  { value: 'title-asc', label: '📈 По названию (А-Я)', icon: '📈' },
  { value: 'title-desc', label: '📈 По названию (Я-А)', icon: '📈' },
];

const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  
  // Состояние фильтров
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<string>('created_at-desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  
  // Состояние данных
  const [courses, setCourses] = useState<Post[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popularTags, setPopularTags] = useState<string[]>(POPULAR_TAGS);
  
  // Извлечение тегов из URL
  useEffect(() => {
    const tagsParam = searchParams.get('tags');
    if (tagsParam) {
      setSelectedTags(tagsParam.split(','));
    }
  }, [searchParams]);
  
  // Загрузка курсов
  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Собираем параметры запроса согласно Swagger
      const params = new URLSearchParams({
        page_size: pageSize.toString(),
        // Для пагинации по Swagger используется page_token, но для простоты используем page
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
      });
      
      // Добавляем сортировку
      const [sortField, sortOrder] = sortBy.split('-') as [SortField, SortOrder];
      params.append('sort_field', sortField);
      params.append('sort_order', sortOrder);
      
      // Для пагинации можно использовать page_token из response
      // Для простоты оставим offset-based пагинацию
      params.append('offset', ((page - 1) * pageSize).toString());
      params.append('limit', pageSize.toString());
      
      // Запрос к API из Swagger: GET /posts
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
      
      const data = await response.json();
      setCourses(data.posts || []);
      setTotalCount(data.total_count || 0);
      
      // Обновляем URL с текущими фильтрами
      const newParams = new URLSearchParams();
      if (searchQuery) newParams.set('search', searchQuery);
      if (selectedTags.length > 0) newParams.set('tags', selectedTags.join(','));
      if (statusFilter !== 'all') newParams.set('status', statusFilter);
      newParams.set('sort', sortBy);
      setSearchParams(newParams);
      
    } catch (err) {
      console.error('Ошибка при загрузке курсов:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTags, statusFilter, sortBy, page, pageSize, token, setSearchParams]);
  
  // Загружаем курсы при изменении фильтров
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);
  
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
        .slice(0, 20);
      
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
    setPage(1);
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
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
    setStatusFilter('all');
    setSortBy('created_at-desc');
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
  
  const totalPages = Math.ceil(totalCount / pageSize);
  
  // Функция для получения цвета фона карточки курса
  const getCourseColor = (index: number) => {
    const colors = [
      'linear-gradient(135deg, var(--accent), var(--accent-2))',
      'linear-gradient(135deg, #06B6D4, #0EA5E9)',
      'linear-gradient(135deg, #8B5CF6, #A855F7)',
      'linear-gradient(135deg, #EC4899, #F43F5E)',
      'linear-gradient(135deg, #10B981, #34D399)',
    ];
    return colors[index % colors.length];
  };
  
  // Функция для отображения статуса курса
  const getStatusBadge = (status: string) => {
    const badges = {
      published: { text: 'Опубликован', emoji: '✅', color: 'var(--accent-light)' },
      draft: { text: 'Черновик', emoji: '✏️', color: '#FEF3C7' },
      archived: { text: 'В архиве', emoji: '📦', color: '#E5E7EB' }
    };
    return badges[status as keyof typeof badges] || badges.published;
  };
  
  return (
    <div className="container">
      {/* Заголовок и поиск */}
      <div className="hero">
        <div className="hero-left">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>
            🎓 Каталог курсов
          </h1>
          <p className="lead">
            Найдите идеальный курс среди {totalCount} вариантов
          </p>
          
          <div className="search" style={{ maxWidth: '600px', marginTop: '24px' }}>
            <input
              type="text"
              placeholder="🔍 Поиск по названию курса или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              className="btn btn-primary"
              onClick={handleSearch}
              style={{ padding: '10px 20px' }}
            >
              Найти
            </button>
          </div>
        </div>
      </div>
      
      <div className="courses-container" style={{ marginTop: '32px' }}>
        {/* Сайдбар с фильтрами */}
        <div className="sidebar">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ Фильтры
            </h3>
            {(searchQuery || selectedTags.length > 0 || statusFilter !== 'all') && (
              <button 
                className="btn btn-ghost" 
                onClick={handleClearFilters}
                style={{ fontSize: '14px', padding: '6px 12px' }}
              >
                🗑️ Сбросить
              </button>
            )}
          </div>
          
          {/* Фильтр по статусу */}
          <div className="filter-group">
            <div className="heading">Статус курса</div>
            <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { value: 'all', label: 'Все', emoji: '📚' },
                { value: 'published', label: 'Опубликованные', emoji: '✅' },
                { value: 'draft', label: 'Черновики', emoji: '✏️' },
                { value: 'archived', label: 'Архивные', emoji: '📦' }
              ].map(({ value, label, emoji }) => (
                <button
                  key={value}
                  className={`chip ${statusFilter === value ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter(value as any);
                    setPage(1);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Популярные теги */}
          <div className="filter-group">
            <div className="heading">🏷️ Популярные теги</div>
            <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {popularTags.map((tag) => (
                <button
                  key={tag}
                  className={`chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                  style={{ fontSize: '13px' }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          
          {/* Добавить свой тег */}
          <div className="filter-group" style={{ marginTop: '24px' }}>
            <div className="heading">➕ Добавить тег</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Введите тег..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                style={{ flex: 1, padding: '8px 12px' }}
              />
              <button 
                className="btn btn-primary"
                onClick={handleAddCustomTag}
                disabled={!customTag.trim()}
                style={{ padding: '8px 12px' }}
              >
                Добавить
              </button>
            </div>
          </div>
          
          {/* Выбранные теги */}
          {selectedTags.length > 0 && (
            <div className="filter-group" style={{ marginTop: '20px' }}>
              <div className="heading">✅ Выбранные теги</div>
              <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedTags.map((tag) => (
                  <div 
                    key={tag}
                    className="chip active"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
                        fontSize: '14px'
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
            marginTop: '24px', 
            padding: '16px', 
            background: 'var(--accent-lightest)',
            borderRadius: '8px',
            border: '1px solid var(--glass)'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>
              📊 Статистика фильтров
            </div>
            <div style={{ fontSize: '12px' }}>
              <div>• Найдено: <strong>{totalCount}</strong> курсов</div>
              <div>• Выбрано тегов: <strong>{selectedTags.length}</strong></div>
              <div>• Страница: <strong>{page}</strong> из {totalPages || 1}</div>
            </div>
          </div>
        </div>
        
        {/* Основной контент */}
        <div style={{ flex: 1 }}>
          {/* Панель сортировки */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px',
            padding: '16px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div>
              <span style={{ color: 'var(--muted)' }}>
                🎯 Найдено курсов: <strong>{totalCount}</strong>
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--muted)' }}>📊 Сортировка:</span>
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
                  minWidth: '220px'
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
              padding: '60px 20px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass)'
            }}>
              <div style={{ 
                width: '50px', 
                height: '50px', 
                border: '3px solid var(--glass)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 1s linear infinite'
              }} />
              <h3 style={{ marginBottom: '12px' }}>⏳ Загружаем курсы...</h3>
              <p style={{ color: 'var(--muted)' }}>Пожалуйста, подождите</p>
            </div>
          )}
          
          {/* Ошибка */}
          {error && !isLoading && (
            <div style={{ 
              padding: '32px', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass)',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>😞</div>
              <h3 style={{ marginBottom: '12px' }}>Произошла ошибка</h3>
              <p style={{ color: '#EF4444', marginBottom: '20px' }}>{error}</p>
              <button 
                className="btn btn-primary" 
                onClick={fetchCourses}
                style={{ marginRight: '12px' }}
              >
                🔄 Попробовать снова
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={handleClearFilters}
              >
                🗑️ Сбросить фильтры
              </button>
            </div>
          )}
          
          {/* Сетка курсов */}
          {!isLoading && !error && courses.length > 0 && (
            <>
              <div className="courses-grid">
                {courses.map((course, index) => {
                  const statusBadge = getStatusBadge(course.status);
                  return (
                    <div 
                      key={course.id}
                      className="course"
                      onClick={() => handleCourseClick(course.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Заголовок курса с цветным фоном */}
                      <div style={{
                        height: '140px',
                        width: '100%',
                        background: getCourseColor(index),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'rgba(255,255,255,0.2)',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backdropFilter: 'blur(4px)'
                        }}>
                          <span>{statusBadge.emoji}</span>
                          <span>{statusBadge.text}</span>
                        </div>
                        <div style={{ 
                          fontSize: '42px',
                          opacity: 0.9
                        }}>
                          {course.title.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="c-body">
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '8px'
                        }}>
                          <h3 className="title" style={{ 
                            margin: 0, 
                            fontSize: '16px',
                            lineHeight: '1.3'
                          }}>
                            {course.title}
                          </h3>
                          {course.status === 'published' && course.average_rating > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              background: 'var(--accent-light)',
                              padding: '4px 8px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              minWidth: '70px',
                              justifyContent: 'center'
                            }}>
                              <span style={{ fontSize: '12px' }}>⭐</span>
                              <span>{course.average_rating.toFixed(1)}</span>
                              <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                                ({course.ratings_count})
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Краткое описание */}
                        <p style={{ 
                          fontSize: '13px', 
                          color: 'var(--muted)',
                          margin: '8px 0',
                          lineHeight: '1.4',
                          height: '36px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {course.content || 'Описание отсутствует'}
                        </p>
                        
                        {/* Теги курса */}
                        {course.tags && course.tags.length > 0 && (
                          <div className="chips" style={{ marginTop: '12px' }}>
                            {course.tags.slice(0, 3).map((tag) => (
                              <span 
                                key={tag}
                                className="chip"
                                style={{ 
                                  fontSize: '11px',
                                  padding: '4px 8px'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTagToggle(tag);
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                            {course.tags.length > 3 && (
                              <span 
                                className="chip"
                                style={{ 
                                  fontSize: '11px',
                                  padding: '4px 8px'
                                }}
                              >
                                +{course.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Мета-информация */}
                        <div className="meta" style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginTop: '12px',
                          fontSize: '11px',
                          paddingTop: '12px',
                          borderTop: '1px solid var(--glass)'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📅</span>
                            {new Date(course.created_at).toLocaleDateString('ru-RU')}
                          </span>
                          <span style={{ 
                            background: statusBadge.color,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px'
                          }}>
                            {statusBadge.emoji} {statusBadge.text}
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
                  gap: '8px',
                  marginTop: '40px',
                  padding: '20px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--glass)'
                }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ 
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    ◀️ Назад
                  </button>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          className={`btn ${page === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setPage(pageNum)}
                          style={{ 
                            padding: '8px 12px',
                            minWidth: '40px'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {totalPages > 5 && page < totalPages - 2 && (
                      <span style={{ 
                        padding: '8px 4px',
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        ...
                      </span>
                    )}
                  </div>
                  
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ 
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
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
            <div className="empty-state">
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔍</div>
              <h3 style={{ marginBottom: '12px' }}>Курсы не найдены</h3>
              <p style={{ color: 'var(--muted)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
                Попробуйте изменить фильтры поиска или очистить текущие
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleClearFilters}
                >
                  🗑️ Сбросить фильтры
                </button>
                <button 
                  className="btn btn-ghost"
                  onClick={() => setSelectedTags([])}
                  disabled={selectedTags.length === 0}
                >
                  🏷️ Очистить теги
                </button>
              </div>
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
          transform: translateY(-6px);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        }
        
        /* Адаптивность для карточек */
        @media (max-width: 900px) {
          .courses-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          }
        }
        
        @media (max-width: 600px) {
          .courses-grid {
            grid-template-columns: 1fr;
          }
          
          .course .c-body {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default CoursesPage;