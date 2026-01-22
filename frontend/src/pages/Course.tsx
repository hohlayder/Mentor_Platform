import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Header from '../components/Header';

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

const RATINGS_PAGE_SIZE = 10;

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
  avatar_url?: string | null; // Добавлено поле для аватара поста
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

interface Rating {
  id: string;
  post_id: string;
  user_id: string;
  rate: number;
  comment?: string;
  created_at: string;
}


interface APIProfileResponse {
  Profile?: {
    user?: {
      user_id: string
      first_name: string
      last_name: string
      email: string
      avatar_url?: string | null
      created_at: string
    };
    mentor?: {
      user_id: string
      description?: string | null
      rating?: number | null
      withdrawal_address?: string | null
      created_at: string
    };
    student?: {
      user_id: string
      learning_goals?: string | null
      preferred_learning_style?: string | null
      created_at: string
    };
    teaching_skills?: any[] | null
    learning_skills?: any[] | null
  };
  profile?: {
    user?: {
      user_id: string
      first_name: string
      last_name: string
      email: string
      avatar_url?: string | null
      created_at: string
    };
    mentor?: {
      user_id: string
      description?: string | null
      rating?: number | null
      withdrawal_address?: string | null
      created_at: string
    };
    student?: {
      user_id: string
      learning_goals?: string | null
      preferred_learning_style?: string | null
      created_at: string
    };
    teaching_skills?: any[] | null
    learning_skills?: any[] | null
  };
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

// Интерфейс для ответа количества избранного
interface FavoriteCountResponse {
  post_id: string;
  users_count: number;
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

// Вспомогательная функция для получения правильного URL аватара пользователя
const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
  if (!avatarUrl) return '';
  
  // Если URL уже полный (http или https)
  if (avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  
  // Если это имя файла
  if (avatarUrl && !avatarUrl.includes('/')) {
    return `http://localhost:8080/api/v1/files/avatar/${avatarUrl}`;
  }
  
  // Если это относительный путь
  if (avatarUrl.startsWith('/')) {
    return `http://localhost:8080${avatarUrl}`;
  }
  
  // Если это путь без префикса http
  if (avatarUrl.startsWith('files/avatar/')) {
    return `http://localhost:8080/api/v1/${avatarUrl}`;
  }
  
  return avatarUrl;
};

// Вспомогательная функция для получения правильного URL аватара поста
const getPostAvatarUrl = (postId: string, avatarUrl: string | null | undefined): string => {
  if (!avatarUrl) return '';
  
  // Если URL уже полный (http или https)
  if (avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  
  // Если это имя файла
  if (avatarUrl && !avatarUrl.includes('/')) {
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
  
  // По умолчанию используем эндпоинт с post_id из документации
  return `http://localhost:8080/api/v1/files/posts/avatar/${postId}`;
};

// Компонент кнопки добавления в избранное (стиль Brave)
interface FavoriteToggleProps {
  postId: string;
  favoriteCount: number;
  isFavorite: boolean;
  onToggle: () => void;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const FavoriteToggle: React.FC<FavoriteToggleProps> = ({ 
  postId, 
  favoriteCount,
  isFavorite,
  onToggle,
  loading = false,
  size = 'md'
}) => {
  const { token } = useAuth();
  
  const sizeConfig = {
    sm: { icon: 18, padding: '6px', size: '34px', strokeWidth: '1.5' },
    md: { icon: 22, padding: '8px', size: '40px', strokeWidth: '2' },
    lg: { icon: 26, padding: '10px', size: '46px', strokeWidth: '2.5' }
  };

  const handleClick = () => {
    if (!token) {
      showNotification('Войдите, чтобы добавлять курсы в избранное', 'info');
      return;
    }
    
    if (loading) return;
    
    onToggle();
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: ${type === 'success' ? '#10b981' : 
                  type === 'error' ? '#ef4444' : 
                  type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  if (!token) {
    return (
      <button
        className="btn btn-ghost"
        onClick={() => showNotification('Войдите, чтобы добавлять курсы в избранное', 'info')}
        style={{
          width: sizeConfig[size].size,
          height: sizeConfig[size].size,
          padding: sizeConfig[size].padding,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          position: 'relative'
        }}
        title="Войдите, чтобы добавлять в избранное"
      >
        {/* SVG закладки как в Brave - пустая */}
        <svg 
          width={sizeConfig[size].icon} 
          height={sizeConfig[size].icon} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth={sizeConfig[size].strokeWidth}
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        
        {favoriteCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            fontSize: '11px',
            background: 'var(--accent)',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            minWidth: '18px',
            textAlign: 'center',
            lineHeight: 1
          }}>
            {favoriteCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      className="btn btn-ghost"
      onClick={handleClick}
      disabled={loading}
      style={{
        width: sizeConfig[size].size,
        height: sizeConfig[size].size,
        padding: sizeConfig[size].padding,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        background: isFavorite ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
        border: 'none',
        color: isFavorite ? 'var(--accent)' : 'var(--muted)',
        position: 'relative',
        opacity: loading ? 0.7 : 1
      }}
      title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
    >
      {loading && (
        <span style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'rgba(79, 70, 229, 0.2)',
          animation: 'pulse 1.5s ease-in-out infinite',
          transform: 'translate(-50%, -50%)'
        }} />
      )}
      
      <span 
        className={isFavorite ? 'bookmark-pulse' : ''}
        style={{ 
          transition: 'transform 0.2s ease',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* SVG закладки как в Brave - с заполнением */}
        <svg 
          width={sizeConfig[size].icon} 
          height={sizeConfig[size].icon} 
          viewBox="0 0 24 24" 
          fill={isFavorite ? "currentColor" : "none"} 
          stroke="currentColor" 
          strokeWidth={sizeConfig[size].strokeWidth}
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      
      {favoriteCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          fontSize: '11px',
          background: isFavorite ? 'var(--accent)' : 'var(--muted)',
          color: 'white',
          borderRadius: '10px',
          padding: '2px 6px',
          minWidth: '18px',
          textAlign: 'center',
          lineHeight: 1
        }}>
          {favoriteCount}
        </span>
      )}
      
      {loading && (
        <span style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '8px',
          color: 'var(--muted)',
          whiteSpace: 'nowrap'
        }}>
          ...
        </span>
      )}
    </button>
  );
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
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [postAvatarUrl, setPostAvatarUrl] = useState<string>('');
  
  // Состояния для избранного
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsNextToken, setRatingsNextToken] = useState<string | null>(null);
  const [ratingsTotalCount, setRatingsTotalCount] = useState(0);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingUsers, setRatingUsers] = useState<Record<string, User>>({});
  const [ratingUsersLoading, setRatingUsersLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);

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

  // Функция загрузки количества добавлений в избранное
  const loadFavoriteCount = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(
        `http://localhost:8080/api/v1/posts/${id}/favorite/count`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data: FavoriteCountResponse = await response.json();
        setFavoriteCount(data.users_count || 0);
      }
    } catch (err) {
      console.warn('Не удалось получить количество избранного:', err);
    }
  };

  // Функция проверки, добавлен ли пост в избранное у текущего пользователя
  const checkIfFavorite = async () => {
    if (!token || !id) {
      setIsFavorite(false);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8080/api/v1/posts/favorite?page_size=100`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const isFav = data.posts?.some((post: Post) => post.id === id) || false;
        setIsFavorite(isFav);
      }
    } catch (err) {
      console.error('Ошибка проверки избранного:', err);
    }
  };

  const loadRatingUsers = useCallback(async (userIds: string[]) => {
    const idsToLoad = Array.from(new Set(userIds)).filter((userId) => userId && !ratingUsers[userId]);
    if (idsToLoad.length === 0) {
      return;
    }

    setRatingUsersLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const results = await Promise.all(
        idsToLoad.map(async (userId) => {
          try {
            const response = await fetch(`http://localhost:8080/api/v1/users/${userId}`, { headers });
            if (!response.ok) {
              return null;
            }
            const data = await response.json();
            return data as User;
          } catch {
            return null;
          }
        })
      );

      const nextUsers: Record<string, User> = {};
      for (const userData of results) {
        if (userData && userData.user_id) {
          nextUsers[userData.user_id] = userData;
        }
      }

      if (Object.keys(nextUsers).length > 0) {
        setRatingUsers((prev) => ({ ...prev, ...nextUsers }));
      }
    } finally {
      setRatingUsersLoading(false);
    }
  }, [ratingUsers, token]);

  const loadRatings = useCallback(async (reset: boolean = false) => {
    if (!id) return;

    setRatingsLoading(true);
    setRatingsError(null);
    if (reset) {
      setRatings([]);
      setRatingsNextToken(null);
    }

    try {
      const params = new URLSearchParams({
        page_size: RATINGS_PAGE_SIZE.toString()
      });

      const pageToken = reset ? null : ratingsNextToken;
      if (pageToken) {
        params.append('page_token', pageToken);
      }

      const response = await fetch(
        `http://localhost:8080/api/v1/posts/${id}/ratings?${params}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load ratings: ${response.status}`);
      }

      const data = await response.json();
      const incoming = Array.isArray(data.ratings) ? data.ratings : [];

      setRatings(prev => reset ? incoming : [...prev, ...incoming]);
      if (incoming.length > 0) {
        loadRatingUsers(incoming.map((item: any) => item.user_id));
      }
      setRatingsNextToken(data.next_page_token || null);
      setRatingsTotalCount(data.total_count || 0);

      if (typeof data.average_rating === 'number' && typeof data.ratings_count === 'number') {
        setCourse(prev => prev ? {
          ...prev,
          average_rating: data.average_rating,
          ratings_count: data.ratings_count
        } : prev);
      }
    } catch (err) {
      console.error('Failed to load ratings:', err);
      setRatingsError(err instanceof Error ? err.message : 'Failed to load ratings');
    } finally {
      setRatingsLoading(false);
    }
  }, [id, ratingsNextToken, token, loadRatingUsers]);





  // Функция добавления в избранное
  const addToFavorite = async () => {
    if (!token || !id || favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8080/api/v1/posts/${id}/favorite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setIsFavorite(true);
        setFavoriteCount(prev => prev + 1);
        showNotification('Курс добавлен в избранное!', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка добавления в избранное');
      }
    } catch (err: any) {
      console.error('Ошибка добавления в избранное:', err);
      showNotification(err.message || 'Не удалось добавить в избранное', 'error');
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Функция удаления из избранного
  const removeFromFavorite = async () => {
    if (!token || !id || favoriteLoading) return;

    setFavoriteLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8080/api/v1/posts/${id}/favorite`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        setIsFavorite(false);
        setFavoriteCount(prev => Math.max(0, prev - 1));
        showNotification('Курс удален из избранного', 'info');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка удаления из избранного');
      }
    } catch (err: any) {
      console.error('Ошибка удаления из избранного:', err);
      showNotification(err.message || 'Не удалось удалить из избранного', 'error');
    } finally {
      setFavoriteLoading(false);
    }
  };

  // Функция для показа уведомлений
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      background: ${type === 'success' ? '#10b981' : 
                  type === 'error' ? '#ef4444' : 
                  type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
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

        // 2. Загружаем аватар поста
        try {
          if (loadedCourse.avatar_url) {
            const postAvatarUrl = getPostAvatarUrl(loadedCourse.id, loadedCourse.avatar_url);
            setPostAvatarUrl(postAvatarUrl);
          } else {
            setPostAvatarUrl('');
          }
        } catch (err) {
          console.warn('Не удалось загрузить аватар поста:', err);
          setPostAvatarUrl('');
        }

        // 3. Загружаем информацию об авторе по документации: GET /users/{id}
        try {
          const authorData = await apiFetch<User>(
            `http://localhost:8080/api/v1/users/${loadedCourse.author_id}`,
            { headers }
          );
          setAuthor(authorData);
        } catch (err) {
          console.warn('Не удалось загрузить информацию об авторе:', err);
          setAuthor({
            user_id: loadedCourse.author_id,
            email: 'unknown@example.com',
            first_name: 'Неизвестный',
            last_name: 'Автор',
            created_at: new Date().toISOString()
          });
        }

        // 4. Загружаем профиль автора по документации: GET /profiles/{id}
        try {
          const profileResponse = await fetch(
            `http://localhost:8080/api/v1/profiles/${loadedCourse.author_id}`,
            { headers }
          );
          
          if (profileResponse.ok) {
            const profileData: APIProfileResponse = await profileResponse.json();
            
            const profileObj = profileData.Profile || profileData.profile;
            
            if (profileObj?.user) {
              const normalizedProfile: ProfileResponse = {
                user: {
                  user_id: profileObj.user.user_id || loadedCourse.author_id,
                  email: profileObj.user.email || '',
                  first_name: profileObj.user.first_name || '',
                  last_name: profileObj.user.last_name || '',
                  avatar_url: getAvatarUrl(profileObj.user.avatar_url),
                  created_at: profileObj.user.created_at || ''
                },
                mentor: profileObj.mentor ? {
                  user_id: profileObj.mentor.user_id || loadedCourse.author_id,
                  description: profileObj.mentor.description || undefined,
                  rating: profileObj.mentor.rating || undefined,
                  created_at: profileObj.mentor.created_at || ''
                } : undefined,
                student: profileObj.student ? {
                  user_id: profileObj.student.user_id || loadedCourse.author_id,
                  learning_goals: profileObj.student.learning_goals || undefined,
                  preferred_learning_style: profileObj.student.preferred_learning_style || undefined,
                  created_at: profileObj.student.created_at || ''
                } : undefined
              };
              
              setProfile(normalizedProfile);
              
              if (author) {
                setAuthor({
                  ...author,
                  avatar_url: getAvatarUrl(profileObj.user.avatar_url),
                  first_name: profileObj.user.first_name || author.first_name,
                  last_name: profileObj.user.last_name || author.last_name,
                  email: profileObj.user.email || author.email
                });
              } else {
                setAuthor({
                  user_id: loadedCourse.author_id,
                  email: profileObj.user.email || '',
                  first_name: profileObj.user.first_name || 'Неизвестный',
                  last_name: profileObj.user.last_name || 'Автор',
                  avatar_url: getAvatarUrl(profileObj.user.avatar_url),
                  created_at: profileObj.user.created_at || new Date().toISOString()
                });
              }
            }
          } else {
            console.warn('Профиль автора не найден или ошибка доступа');
          }
        } catch (err) {
          console.warn('Не удалось загрузить профиль автора:', err);
        }

        // 5. Загружаем количество избранного
        await loadFavoriteCount();
        
        // 6. Проверяем, добавлен ли курс в избранное у пользователя
        await checkIfFavorite();
        await loadRatings(true);

      } catch (err: any) {
        console.error('Ошибка загрузки курса:', err);
        setError(err.message || 'Ошибка загрузки курса');
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [id, token, navigate, loadRatings]);

  // Проверяем, является ли пользователь автором курса
  const isAuthor = user?.user_id === course?.author_id;
  const canEdit = isAuthor && token;
  const canRate = !isAuthor && token;
  const statusInfo = course ? getStatusInfo(course.status) : getStatusInfo('');
  const reviewsCount = ratingsTotalCount || course?.ratings_count || 0;

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
      showNotification(`✅ ${successMessage}!`, 'success');
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
      await loadRatings(true);
      showNotification('Спасибо за ваш отзыв!', 'success');
    } catch (err: any) {
      console.error('Ошибка оценки курса:', err);
      showNotification(err.message || 'Не удалось оценить курс', 'error');
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

      showNotification('Курс успешно удален', 'success');
      navigate('/courses');
    } catch (err: any) {
      console.error('Ошибка удаления курса:', err);
      showNotification(err.message || 'Не удалось удалить курс', 'error');
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

  // ========== ФУНКЦИЯ ЗАПИСИ НА КУРС ==========
  const handleEnroll = () => {
    if (!token) {
      navigate('/login', { state: { returnTo: `/course/${id}` } });
      return;
    }
    
    if (isAuthor) {
      showNotification('Вы являетесь автором этого курса. Создайте слоты для студентов на отдельной странице', 'info');
      return;
    }
    
    navigate(`/course/${id}/enroll`);
  };

  // ========== РЕНДЕРИНГ ==========
  if (loading) {
    return (
      <div className="container" style={{ padding: '0 24px', maxWidth: '1400px' }}>
        <Header theme={theme} toggleTheme={toggleTheme} />
        
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
        <Header theme={theme} toggleTheme={toggleTheme} />
        
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
      <Header theme={theme} toggleTheme={toggleTheme} />

      <nav style={{ margin: '24px 0', fontSize: '14px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <Link to="/courses" style={{ color: 'var(--muted)' }}>Курсы</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>{course.title}</span>
      </nav>

      <div className="hero" style={{ 
        flexDirection: 'row', 
        alignItems: 'flex-start', 
        gap: '32px',
        marginBottom: '32px'
      }}>
        <div style={{ 
          width: '350px', 
          height: '200px', 
          borderRadius: '12px',
          overflow: 'hidden',
          background: postAvatarUrl ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'grid',
          placeContent: 'center',
          color: '#fff',
          fontSize: '48px',
          fontWeight: 700,
          flexShrink: 0,
          position: 'relative'
        }}>
          {postAvatarUrl ? (
            <img 
              src={postAvatarUrl} 
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
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.style.fontSize = '48px';
                  span.style.color = '#fff';
                  span.style.fontWeight = '700';
                  span.textContent = course.title[0];
                  parent.appendChild(span);
                }
              }}
            />
          ) : (
            <span>{course.title[0]}</span>
          )}
        </div>

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
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  fontSize: '14px',
                  color: 'var(--muted)'
                }}>
                  {/* SVG иконка закладки вместо эмодзи */}
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="currentColor" 
                    stroke="none"
                    style={{ verticalAlign: 'middle' }}
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span style={{ fontWeight: 500 }}>
                    {favoriteCount}
                  </span>
                  <span style={{ fontSize: '13px' }}>в избранном</span>
                </div>
                
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                  Обновлен: {formatDate(course.updated_at)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {canEdit && (
                <>
                  <input
                    type="file"
                    id="post-avatar-upload"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !token || !course) return;

                      if (file.size > 5 * 1024 * 1024) {
                        alert('Файл слишком большой. Максимальный размер: 5 МБ');
                        return;
                      }

                      const allowedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
                      if (!allowedFormats.includes(file.type)) {
                        alert('Неподдерживаемый формат файла. Разрешенные форматы: jpg, jpeg, png, gif, svg');
                        return;
                      }

                      const formData = new FormData();
                      formData.append('avatar', file);

                      try {
                        const response = await fetch(
                          `http://localhost:8080/api/v1/files/posts/avatar/${course.id}`,
                          {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                            },
                            body: formData
                          }
                        );

                        if (response.ok) {
                          const data = await response.json();
                          setPostAvatarUrl(getPostAvatarUrl(course.id, data.filename || data.url));
                          showNotification('✅ Аватар курса успешно загружен!', 'success');
                        } else {
                          const errorData = await response.json().catch(() => ({}));
                          showNotification(`Ошибка загрузки аватара: ${errorData.message || response.statusText}`, 'error');
                        }
                      } catch (err) {
                        console.error('Ошибка загрузки аватара:', err);
                        showNotification('Ошибка загрузки аватара', 'error');
                      }
                    }}
                  />
                  <label htmlFor="post-avatar-upload" className="btn btn-ghost" style={{ 
                    fontSize: '14px', 
                    padding: '8px 16px',
                    cursor: 'pointer',
                    border: '1px dashed var(--accent)',
                    color: 'var(--accent)'
                  }}>
                    📷 Загрузить аватар
                  </label>

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
                  
                  {isAuthor && (
                    <button 
                      className="btn btn-outline"
                      onClick={() => navigate(`/course/${id}/create-slots`, { 
                        state: { 
                          courseTitle: course.title,
                          authorId: course.author_id 
                        } 
                      })}
                      style={{ 
                        fontSize: '14px', 
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        border: 'none',
                        color: '#fff'
                      }}
                    >
                      📅 Создать слоты
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
              
              {!isAuthor && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={handleEnroll}
                    style={{ 
                      fontSize: '14px', 
                      padding: '8px 20px',
                      background: 'linear-gradient(135deg, var(--accent-2), #10b981)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🎓 Записаться на курс
                  </button>
                  
                  <FavoriteToggle 
                    postId={course.id}
                    favoriteCount={favoriteCount}
                    isFavorite={isFavorite}
                    onToggle={isFavorite ? removeFromFavorite : addToFavorite}
                    loading={favoriteLoading}
                    size="md"
                  />
                </div>
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
                background: author.avatar_url ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                display: 'grid',
                placeContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '20px',
                flexShrink: 0,
                position: 'relative'
              }}>
                {author.avatar_url ? (
                  <img 
                    src={getAvatarUrl(author.avatar_url)} 
                    alt={author.first_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const initials = `${author.first_name?.[0] || ''}${author.last_name?.[0] || ''}` || 'A';
                        const span = document.createElement('span');
                        span.style.fontSize = '20px';
                        span.style.color = '#fff';
                        span.style.fontWeight = '600';
                        span.textContent = initials;
                        parent.appendChild(span);
                      }
                    }}
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

      <div style={{ marginBottom: '32px' }}>
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
            className={`btn ${activeTab === 'reviews' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('reviews')}
            style={{ whiteSpace: 'nowrap', fontSize: '14px', padding: '10px 16px' }}
          >
            ⭐ Отзывы ({course.ratings_count || 0})
          </button>
        </div>

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
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>В избранном</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* SVG иконка закладки */}
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="currentColor" 
                        stroke="none"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{favoriteCount} пользователей</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Отзывы о курсе</h3>
              
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
              
              <div>
                {reviewsCount > 0 ? (
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

              {ratingsLoading && ratings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                  Loading reviews...
                </div>
              )}

              {ratingsError && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>
                  {ratingsError}
                </div>
              )}

              {ratings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  {ratings.map((item) => (
                    <div key={item.id} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600 }}>
                          {ratingUsers[item.user_id]
                            ? `${ratingUsers[item.user_id].first_name || ''} ${ratingUsers[item.user_id].last_name || ''}`.trim() || ratingUsers[item.user_id].email || item.user_id.slice(0, 8)
                            : item.user_id ? `User ${item.user_id.slice(0, 8)}` : 'User'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU') : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: item.comment ? '8px' : 0 }}>
                        <span style={{ fontWeight: 600 }}>
                          {item.rate}/5
                        </span>
                      </div>
                      {item.comment && (
                        <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                          {item.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {ratingUsersLoading && ratings.length > 0 && (
                <div style={{ textAlign: 'center', padding: '8px', color: 'var(--muted)', fontSize: '12px' }}>
                  Loading reviewer names...
                </div>
              )}

                            {ratingsNextToken && !ratingsLoading && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => loadRatings()}
                    style={{ padding: '8px 16px' }}
                  >
                    Load more reviews
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
          
          <div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              В избранном
            </div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* SVG иконка закладки */}
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                stroke="none"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>{favoriteCount} пользователей</span>
            </div>
          </div>
        </div>
      </div>

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
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        @keyframes bookmarkPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        .bookmark-pulse {
          animation: bookmarkPulse 0.6s ease;
        }
      `}</style>
    </div>
  );
};

export default CoursePage;
