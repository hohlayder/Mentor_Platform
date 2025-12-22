// src/pages/CoursesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Search, Filter, X, TrendingUp, Calendar, Star, Clock } from 'lucide-react';

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

// Опции сортировки
const SORT_OPTIONS = [
  { value: 'created_at-desc', label: 'Новые', icon: Calendar },
  { value: 'created_at-asc', label: 'Старые', icon: Calendar },
  { value: 'updated_at-desc', label: 'Недавно обновленные', icon: Clock },
  { value: 'average_rating-desc', label: 'Высокий рейтинг', icon: Star },
  { value: 'title-asc', label: 'По названию (А-Я)', icon: TrendingUp },
  { value: 'title-desc', label: 'По названию (Я-А)', icon: TrendingUp },
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
      // Собираем параметры запроса
      const params = new URLSearchParams({
        page_size: pageSize.toString(),
        page: page.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
      });
      
      // Добавляем сортировку
      const [sortField, sortOrder] = sortBy.split('-') as [SortField, SortOrder];
      params.append('sort_field', sortField);
      params.append('sort_order', sortOrder);
      
      // Запрос к API
      const response = await fetch(`http://localhost:8080/api/v1/posts?${params}`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка загрузки курсов: ${response.status}`);
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
  
  // Обработчики фильтров
  const handleSearch = useCallback(() => {
    setPage(1); // Сбрасываем на первую страницу при новом поиске
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
    navigate(`/course/${courseId}`);
  }, [navigate]);
  
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return (
    <div className="container">
      {/* Заголовок и поиск */}
      <div className="hero">
        <div className="hero-left">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>
            Каталог курсов
          </h1>
          <p className="lead">
            Найдите идеальный курс среди {totalCount} вариантов
          </p>
          
          <div className="search" style={{ maxWidth: '600px', marginTop: '24px' }}>
            <input
              type="text"
              placeholder="Поиск по названию курса или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              className="btn btn-primary"
              onClick={handleSearch}
              style={{ padding: '10px 20px' }}
            >
              <Search size={20} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="courses-container" style={{ marginTop: '32px' }}>
        {/* Сайдбар с фильтрами */}
        <div className="sidebar">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={20} />
              Фильтры
            </h3>
            {(searchQuery || selectedTags.length > 0 || statusFilter !== 'all') && (
              <button 
                className="btn btn-ghost" 
                onClick={handleClearFilters}
                style={{ fontSize: '14px', padding: '6px 12px' }}
              >
                Сбросить
              </button>
            )}
          </div>
          
          {/* Фильтр по статусу */}
          <div className="filter-group">
            <div className="heading">Статус курса</div>
            <div className="chips" style={{ display: 'flex' }}>
              {['all', 'published', 'draft', 'archived'].map((status) => (
                <button
                  key={status}
                  className={`chip ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter(status as any);
                    setPage(1);
                  }}
                >
                  {status === 'all' ? 'Все' : 
                   status === 'published' ? 'Опубликованные' :
                   status === 'draft' ? 'Черновики' : 'Архивные'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Теги */}
          <div className="filter-group">
            <div className="heading">Популярные теги</div>
            <div className="chips" style={{ display: 'flex' }}>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  className={`chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          
          {/* Добавить свой тег */}
          <div className="filter-group" style={{ marginTop: '24px' }}>
            <div className="heading">Добавить тег</div>
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
              <div className="heading">Выбранные теги</div>
              <div className="chips" style={{ display: 'flex' }}>
                {selectedTags.map((tag) => (
                  <div 
                    key={tag}
                    className="chip active"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'inherit' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                Найдено курсов: <strong>{totalCount}</strong>
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--muted)' }}>Сортировка:</span>
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
                  minWidth: '200px'
                }}
              >
                {SORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          
          {/* Состояние загрузки/ошибки */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '3px solid var(--glass)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: 'var(--muted)' }}>Загрузка курсов...</p>
            </div>
          )}
          
          {error && (
            <div style={{ 
              padding: '24px', 
              background: 'var(--surface)', 
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass)',
              textAlign: 'center'
            }}>
              <p style={{ color: '#EF4444' }}>Ошибка: {error}</p>
              <button 
                className="btn btn-primary" 
                onClick={fetchCourses}
                style={{ marginTop: '12px' }}
              >
                Попробовать снова
              </button>
            </div>
          )}
          
          {/* Сетка курсов */}
          {!isLoading && !error && (
            <>
              <div className="courses-grid">
                {courses.map((course) => (
                  <div 
                    key={course.id}
                    className="course"
                    onClick={() => handleCourseClick(course.id)}
                  >
                    {/* Картинка курса (можно добавить заглушку) */}
                    <div style={{
                      height: '140px',
                      width: '100%',
                      background: `linear-gradient(135deg, var(--accent), var(--accent-2))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '24px',
                      fontWeight: 'bold'
                    }}>
                      {course.title.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="c-body">
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px'
                      }}>
                        <h3 className="title" style={{ margin: 0, fontSize: '16px' }}>
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
                            fontSize: '12px'
                          }}>
                            <Star size={12} fill="currentColor" />
                            <span>{course.average_rating.toFixed(1)}</span>
                            <span style={{ color: 'var(--muted)' }}>({course.ratings_count})</span>
                          </div>
                        )}
                      </div>
                      
                      <p style={{ 
                        fontSize: '14px', 
                        color: 'var(--muted)',
                        margin: '8px 0',
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {course.content}
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
                      
                      <div className="meta" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        fontSize: '12px'
                      }}>
                        <span>
                          {course.status === 'published' ? 'Опубликован' : 
                           course.status === 'draft' ? 'Черновик' : 'В архиве'}
                        </span>
                        <span>
                          {new Date(course.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Пагинация */}
              {totalPages > 1 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '40px'
                }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ padding: '8px 16px' }}
                  >
                    Назад
                  </button>
                  
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
                  
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ padding: '8px 16px' }}
                  >
                    Вперед
                  </button>
                </div>
              )}
              
              {courses.length === 0 && !isLoading && (
                <div className="empty-state">
                  <h3 style={{ marginBottom: '12px' }}>Курсы не найдены</h3>
                  <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
                    Попробуйте изменить фильтры или очистить поиск
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={handleClearFilters}
                  >
                    Сбросить фильтры
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* CSS для анимации спиннера */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CoursesPage;