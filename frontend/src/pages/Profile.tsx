import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

// Типы для ответа API
interface APIProfileResponse {
  Profile?: {
    user?: {
      user_id: string
      first_name: string
      last_name: string
      email: string
      avatar_url?: string | null
      created_at: string
    }
    mentor?: {
      user_id: string
      description?: string | null
      rating?: number | null
      withdrawal_address?: string | null
      created_at: string
    }
    student?: {
      user_id: string
      learning_goals?: string | null
      preferred_learning_style?: string | null
      created_at: string
    }
    teaching_skills?: any[] | null
    learning_skills?: any[] | null
  }
  profile?: {  // Добавляем вариант с маленькой буквы
    user?: {
      user_id: string
      first_name: string
      last_name: string
      email: string
      avatar_url?: string | null
      created_at: string
    }
    mentor?: {
      user_id: string
      description?: string | null
      rating?: number | null
      withdrawal_address?: string | null
      created_at: string
    }
    student?: {
      user_id: string
      learning_goals?: string | null
      preferred_learning_style?: string | null
      created_at: string
    }
    teaching_skills?: any[] | null
    learning_skills?: any[] | null
  }
  Posts?: {
    posts: any[]
    next_page_token?: string
    total_count: number
  }
}

// Типы для использования в компоненте
interface User {
  user_id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string | null
  created_at: string
}

interface MentorProfile {
  user_id: string
  description?: string | null
  rating?: number | null
  withdrawal_address?: string | null
  created_at: string
}

interface StudentProfile {
  user_id: string
  learning_goals?: string | null
  preferred_learning_style?: string | null
  created_at: string
}

interface TeachingSkill {
  skill_id: string
  skill_name: string
  proficiency_level: string
  years_of_experience?: number | null
  user_id: string
  created_at: string
}

interface LearningSkill {
  skill_id: string
  skill_name: string
  proficiency_level: string
  user_id: string
  created_at: string
}

interface Post {
  id: string
  title: string
  content: string
  author_id: string
  status: 'draft' | 'published' | 'archived'
  tags: string[]
  average_rating?: number | null
  ratings_count?: number | null
  created_at: string
  updated_at: string
  author_name?: string | null
  avatar_url?: string | null
}

interface ProfileResponse {
  user?: User | null
  mentor?: MentorProfile | null
  student?: StudentProfile | null
  teaching_skills?: TeachingSkill[]
  learning_skills?: LearningSkill[]
}

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

// Компонент для отображения избранного поста с вертикальной закладкой
const FavoritePostCard: React.FC<{ 
  post: Post; 
  onClick: () => void;
  index: number;
}> = ({ post, onClick, index }) => {
  const getPostAvatarUrl = (postId: string, avatarUrl: string | null | undefined): string => {
    if (!avatarUrl) return '';
    
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    
    if (avatarUrl && !avatarUrl.includes('/')) {
      return `http://localhost:8080/api/v1/files/posts/avatar/${avatarUrl}`;
    }
    
    if (avatarUrl.startsWith('/')) {
      return `http://localhost:8080${avatarUrl}`;
    }
    
    if (avatarUrl.startsWith('files/posts/avatar/')) {
      return `http://localhost:8080/api/v1/${avatarUrl}`;
    }
    
    return `http://localhost:8080/api/v1/files/posts/avatar/${postId}`;
  };

  const avatarUrl = post.avatar_url ? getPostAvatarUrl(post.id, post.avatar_url) : '';

  return (
    <div 
      className="favorite-post-card"
      onClick={onClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        background: 'var(--card-bg)',
        border: '1px solid var(--glass)',
        height: '180px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Вертикальная закладка */}
      <div style={{
        position: 'absolute',
        top: '-10px',
        left: '10px',
        zIndex: 2,
        width: '40px',
        height: '50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: 'rotate(0deg)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'var(--accent)',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
        }}>
          {index + 1}
        </div>
        <div style={{
          width: 0,
          height: 0,
          borderLeft: '20px solid transparent',
          borderRight: '20px solid transparent',
          borderTop: '10px solid var(--accent)'
        }} />
      </div>

      {/* Изображение курса */}
      <div style={{
        width: '100%',
        height: '100px',
        position: 'relative',
        overflow: 'hidden',
        background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #f59e0b, #d97706)'
      }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={post.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = document.createElement('div');
                fallback.style.width = '100%';
                fallback.style.height = '100%';
                fallback.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                fallback.style.display = 'flex';
                fallback.style.alignItems = 'center';
                fallback.style.justifyContent = 'center';
                fallback.style.color = '#fff';
                fallback.style.fontWeight = 'bold';
                fallback.style.fontSize = '24px';
                fallback.textContent = post.title?.[0] || '❤️';
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '24px'
          }}>
            {post.title?.[0] || '❤️'}
          </div>
        )}
      </div>

      {/* Информация о посте */}
      <div style={{
        padding: '12px',
        flex: 1
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '4px',
          color: 'var(--text)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          height: '40px',
          lineHeight: '20px'
        }}>
          {post.title || 'Без названия'}
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--muted)'
          }}>
            {post.average_rating ? (
              <>
                <span>⭐</span>
                <span>{post.average_rating.toFixed(1)}</span>
                <span>({post.ratings_count || 0})</span>
              </>
            ) : (
              <span>Нет оценок</span>
            )}
          </div>
          
          <div style={{
            fontSize: '11px',
            color: 'var(--muted)',
            whiteSpace: 'nowrap'
          }}>
            {post.created_at ? new Date(post.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна'}
          </div>
        </div>

        {/* Теги */}
        {post.tags && post.tags.length > 0 && (
          <div style={{
            marginTop: '8px',
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap'
          }}>
            {post.tags.slice(0, 2).map((tag, tagIndex) => (
              <span
                key={tagIndex}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  background: 'rgba(79, 70, 229, 0.1)',
                  color: 'var(--accent)',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                #{tag}
              </span>
            ))}
            {post.tags.length > 2 && (
              <span style={{
                fontSize: '10px',
                color: 'var(--muted)'
              }}>
                +{post.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Иконка закладки в правом нижнем углу */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        color: 'var(--accent)',
        opacity: 0.3
      }}>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          stroke="none"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [mentorCourses, setMentorCourses] = useState<Post[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isProfileRoot = location.pathname === '/profile' || location.pathname === '/profile/'

  // Функция для получения правильного URL аватара пользователя
  const getUserAvatarUrl = (avatarUrl: string | null | undefined): string => {
    if (!avatarUrl) return ''
    
    // Если URL уже полный (http или https)
    if (avatarUrl.startsWith('http')) {
      return avatarUrl
    }
    
    // Если это имя файла
    if (avatarUrl && !avatarUrl.includes('/')) {
      return `http://localhost:8080/api/v1/files/avatar/${avatarUrl}`
    }
    
    // Если это относительный путь
    if (avatarUrl.startsWith('/')) {
      return `http://localhost:8080${avatarUrl}`
    }
    
    // Если это путь без префикса http
    if (avatarUrl.startsWith('files/avatar/')) {
      return `http://localhost:8080/api/v1/${avatarUrl}`
    }
    
    return avatarUrl
  }

  useEffect(() => {
    if (isProfileRoot) {
      if (token && authUser?.user_id) {
        navigate(`/profile/${authUser.user_id}`, { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }
  }, [isProfileRoot, token, authUser, navigate])

  useEffect(() => {
    if (!id || isProfileRoot) {
      return
    }

    const loadProfile = async () => {
      setLoading(true)
      setError(null)

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }
        
        const currentToken = token || sessionStorage.getItem('access_token')
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`
        }

        console.log(`Loading profile for ID: ${id}`);

        // 1. Загружаем профиль
        const profileResponse = await fetch(
          `http://localhost:8080/api/v1/profiles/${id}`,
          { 
            headers,
            method: 'GET'
          }
        )
        
        console.log('Profile response status:', profileResponse.status);
        
        if (!profileResponse.ok) {
          const errorText = await profileResponse.text();
          console.error('Profile response error:', errorText);
          throw new Error(`HTTP ${profileResponse.status}: ${errorText || 'Неизвестная ошибка'}`);
        }
        
        const responseText = await profileResponse.text();
        console.log('Profile response text:', responseText);
        
        let apiData: APIProfileResponse;
        try {
          apiData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse JSON:', parseError);
          throw new Error('Некорректный ответ от сервера');
        }
        
        console.log('Parsed profile data:', apiData);
        
        // Проверяем структуру данных
        if (!apiData || typeof apiData !== 'object') {
          console.error('Invalid profile data structure:', apiData);
          throw new Error('Неверная структура профиля');
        }
        
        // Исправление: используем любой вариант (с большой или маленькой буквы)
        const profileData = apiData.Profile || apiData.profile;
        
        // Проверяем наличие данных профиля
        if (!profileData) {
          console.error('No Profile or profile data found:', apiData);
          throw new Error('Отсутствуют данные профиля');
        }
        
        // Преобразуем данные из API в наш формат
        const normalizedData: ProfileResponse = {};
        
        // user
        if (profileData.user) {
          normalizedData.user = {
            user_id: profileData.user.user_id || '',
            first_name: profileData.user.first_name || '',
            last_name: profileData.user.last_name || '',
            email: profileData.user.email || '',
            avatar_url: getUserAvatarUrl(profileData.user.avatar_url || null),
            created_at: profileData.user.created_at || ''
          };
        } else {
          console.error('No user data in profileData:', profileData);
          throw new Error('Отсутствуют данные пользователя');
        }
        
        // mentor
        if (profileData.mentor) {
          normalizedData.mentor = {
            user_id: profileData.mentor.user_id || '',
            description: profileData.mentor.description || null,
            rating: profileData.mentor.rating || null,
            withdrawal_address: profileData.mentor.withdrawal_address || null,
            created_at: profileData.mentor.created_at || ''
          };
        }
        
        // student
        if (profileData.student) {
          normalizedData.student = {
            user_id: profileData.student.user_id || '',
            learning_goals: profileData.student.learning_goals || null,
            preferred_learning_style: profileData.student.preferred_learning_style || null,
            created_at: profileData.student.created_at || ''
          };
        }
        
        // teaching_skills
        if (profileData.teaching_skills && Array.isArray(profileData.teaching_skills)) {
          normalizedData.teaching_skills = profileData.teaching_skills.map((skill: any) => ({
            skill_id: skill.skill_id || '',
            skill_name: skill.skill_name || '',
            proficiency_level: skill.proficiency_level || '',
            years_of_experience: skill.years_of_experience || null,
            user_id: skill.user_id || '',
            created_at: skill.created_at || ''
          }));
        }
        
        // learning_skills
        if (profileData.learning_skills && Array.isArray(profileData.learning_skills)) {
          normalizedData.learning_skills = profileData.learning_skills.map((skill: any) => ({
            skill_id: skill.skill_id || '',
            skill_name: skill.skill_name || '',
            proficiency_level: skill.proficiency_level || '',
            user_id: skill.user_id || '',
            created_at: skill.created_at || ''
          }));
        }
        
        console.log('Normalized profile data:', normalizedData);
        setProfile(normalizedData);

        // 2. Сохраняем понравившиеся посты из Posts
        try {
          const favoritesResponse = await fetch(
            `http://localhost:8080/api/v1/posts/favorite?page_size=20`,
            { 
              headers,
              method: 'GET'
            }
          );
          
          console.log('Favorites response status:', favoritesResponse.status);
          
          if (favoritesResponse.ok) {
            const favoritesData = await favoritesResponse.json();
            console.log('Favorites data:', favoritesData);
            
            if (favoritesData.posts && Array.isArray(favoritesData.posts)) {
              const transformedPosts: Post[] = favoritesData.posts.map((post: any) => ({
                id: post.id || '',
                title: post.title || '',
                content: post.content || '',
                author_id: post.author_id || '',
                status: post.status || 'published',
                tags: post.tags || [],
                average_rating: post.average_rating || null,
                ratings_count: post.ratings_count || null,
                created_at: post.created_at || '',
                updated_at: post.updated_at || '',
                author_name: post.author_name || null,
                avatar_url: post.avatar_url || null
              }));
              console.log('Transformed liked posts:', transformedPosts);
              setLikedPosts(transformedPosts);
            } else {
              console.log('No liked posts found in favorites endpoint');
            }
          } else {
            console.warn('Не удалось загрузить избранное:', favoritesResponse.status);
            // Проверяем, есть ли посты в старом формате (на всякий случай)
            if (apiData.Posts?.posts && Array.isArray(apiData.Posts.posts)) {
              const transformedPosts: Post[] = apiData.Posts.posts.map((post: any) => ({
                id: post.id || '',
                title: post.title || '',
                content: post.content || '',
                author_id: post.author_id || '',
                status: post.status || 'published',
                tags: post.tags || [],
                average_rating: post.average_rating || null,
                ratings_count: post.ratings_count || null,
                created_at: post.created_at || '',
                updated_at: post.updated_at || '',
                author_name: post.author_name || null,
                avatar_url: post.avatar_url || null
              }));
              console.log('Fallback to old liked posts format:', transformedPosts);
              setLikedPosts(transformedPosts);
            }
          }
        } catch (favoritesErr) {
          console.error('Error loading favorites:', favoritesErr);
          // Fallback к старому формату данных
          if (apiData.Posts?.posts && Array.isArray(apiData.Posts.posts)) {
            const transformedPosts: Post[] = apiData.Posts.posts.map((post: any) => ({
              id: post.id || '',
              title: post.title || '',
              content: post.content || '',
              author_id: post.author_id || '',
              status: post.status || 'published',
              tags: post.tags || [],
              average_rating: post.average_rating || null,
              ratings_count: post.ratings_count || null,
              created_at: post.created_at || '',
              updated_at: post.updated_at || '',
              author_name: post.author_name || null,
              avatar_url: post.avatar_url || null
            }));
            console.log('Error fallback liked posts:', transformedPosts);
            setLikedPosts(transformedPosts);
          }
        }

        // 3. Загружаем курсы, созданные пользователем
        const userId = normalizedData.user?.user_id || id;
        if (normalizedData.mentor || normalizedData.user) {
          try {
            const params = new URLSearchParams({
              author_id: userId,
              status: 'published',
              page_size: '20',
              sort_field: 'created_at',
              sort_order: 'desc'
            });

            console.log('Loading courses with params:', params.toString());
            
            const coursesResponse = await fetch(
              `http://localhost:8080/api/v1/posts?${params}`,
              { headers }
            )

            console.log('Courses response status:', coursesResponse.status);
            
            if (coursesResponse.ok) {
              const coursesData = await coursesResponse.json();
              console.log('Courses data:', coursesData);
              const coursesWithAvatar = (coursesData.posts || []).map((post: any) => ({
                ...post,
                avatar_url: post.avatar_url || null
              }));
              setMentorCourses(coursesWithAvatar);
            } else {
              console.warn('Не удалось загрузить курсы:', coursesResponse.status);
            }
          } catch (courseErr) {
            console.error('Error loading courses:', courseErr)
          }
        }

      } catch (err: any) {
        console.error('Profile load error:', err)
        
        if (err.message?.includes('401')) {
          setError('Требуется авторизация')
        } else if (err.message?.includes('404')) {
          setError('Профиль не найден')
        } else {
          setError(`Ошибка загрузки профиля: ${err.message}`)
        }
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [id, token, isProfileRoot])

  const handleLogout = () => {
    logout();
  };

  // Функция для рендеринга изображения курса
  const renderCourseImage = (course: Post, isLikedPost: boolean = false) => {
    const getPostAvatarUrl = (postId: string, avatarUrl: string | null | undefined): string => {
      if (!avatarUrl) return '';
      
      if (avatarUrl.startsWith('http')) {
        return avatarUrl;
      }
      
      if (avatarUrl && !avatarUrl.includes('/')) {
        return `http://localhost:8080/api/v1/files/posts/avatar/${avatarUrl}`;
      }
      
      if (avatarUrl.startsWith('/')) {
        return `http://localhost:8080${avatarUrl}`;
      }
      
      if (avatarUrl.startsWith('files/posts/avatar/')) {
        return `http://localhost:8080/api/v1/${avatarUrl}`;
      }
      
      return `http://localhost:8080/api/v1/files/posts/avatar/${postId}`;
    };

    const avatarUrl = course.avatar_url ? getPostAvatarUrl(course.id, course.avatar_url) : '';
    
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
              fallback.style.background = isLikedPost 
                ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
                : 'linear-gradient(135deg, var(--accent), var(--accent-2))';
              fallback.style.display = 'flex';
              fallback.style.alignItems = 'center';
              fallback.style.justifyContent = 'center';
              fallback.style.color = '#fff';
              fallback.style.fontWeight = 'bold';
              fallback.style.fontSize = '24px';
              fallback.textContent = course.title?.[0] || (isLikedPost ? '❤️' : '📚');
              parent.appendChild(fallback);
            }
          }}
        />
      );
    }
    
    // Если нет аватара, показываем градиент
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: isLikedPost 
          ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
          : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '24px'
      }}>
        {course.title?.[0] || (isLikedPost ? '❤️' : '📚')}
      </div>
    );
  };

  // Функция для отображения загрузки
  const renderLoading = () => (
    <div className="container">
      <header className="header">
        <Link to="/" className="brand">
          <div className="logo">M</div>Mentor Fellowship
        </Link>
        <div className="header-nav">
          <button onClick={toggleTheme} className="btn btn-ghost">
            {theme === 'light' ? '🌙' : '☀️'} Тема
          </button>
          {token && authUser ? (
            <>
              <Link to="/courses" className="btn btn-ghost">Курсы</Link>
              <Link to="/chats" className="btn btn-ghost">Сообщения</Link>
              <Link to={`/profile/${authUser.user_id}`} className="btn btn-ghost">
                {authUser.first_name || 'Профиль'}
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
        <div className="logo" style={{ 
          margin: '0 auto 20px', 
          animation: 'pulse 1.5s infinite'
        }}>
          <span>⏳</span>
        </div>
        <p style={{ color: 'var(--muted)' }}>Загрузка профиля...</p>
      </div>
    </div>
  )

  // Функция для отображения ошибки
  const renderError = () => (
    <div className="container">
      <header className="header">
        <Link to="/" className="brand">
          <div className="logo">M</div>Mentor Fellowship
        </Link>
        <div className="header-nav">
          <button onClick={toggleTheme} className="btn btn-ghost">
            {theme === 'light' ? '🌙' : '☀️'} Тема
          </button>
          {token && authUser ? (
            <>
              <Link to="/courses" className="btn btn-ghost">Курсы</Link>
              <Link to="/chats" className="btn btn-ghost">Сообщения</Link>
              <Link to={`/profile/${authUser.user_id}`} className="btn btn-ghost">
                {authUser.first_name || 'Профиль'}
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
        <div className="logo" style={{ margin: '0 auto 20px', background: '#ef4444' }}>
          <span>⚠️</span>
        </div>
        <h3 style={{ margin: '0 0 12px 0' }}>Ошибка</h3>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
          {error || 'Профиль не найден'}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Попробовать снова
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/')}
          >
            На главную
          </button>
        </div>
      </div>
    </div>
  )

  if (isProfileRoot) {
    return renderLoading()
  }

  if (loading) {
    return renderLoading()
  }

  if (error || !profile || !profile.user) {
    return renderError()
  }

  const isOwnProfile = authUser?.user_id === id
  const isMentor = !!profile.mentor
  const isStudent = !!profile.student

  // Безопасное получение данных
  const userName = `${profile.user.first_name || ''} ${profile.user.last_name || ''}`.trim() || 'Пользователь'
  const userEmail = profile.user.email || ''
  const userInitials = `${profile.user.first_name?.[0] || ''}${profile.user.last_name?.[0] || ''}` || 'U'
  const userAvatarUrl = getUserAvatarUrl(profile.user.avatar_url)

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <Link to="/" className="brand">
          <div className="logo">M</div>Mentor Fellowship
        </Link>
        <div className="header-nav">
          <button onClick={toggleTheme} className="btn btn-ghost">
            {theme === 'light' ? '🌙' : '☀️'} Тема
          </button>
          {token && authUser ? (
            <>
              <Link to="/courses" className="btn btn-ghost">Курсы</Link>
              <Link to="/chats" className="btn btn-ghost">Сообщения</Link>
              <Link to={`/profile/${authUser.user_id}`} className="btn btn-ghost">
                {authUser.first_name || 'Профиль'}
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
      <nav style={{ marginBottom: '24px' }}>
        <Link to="/" style={{ color: 'var(--muted)' }}>Главная</Link>
        <span style={{ margin: '0 8px', color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--accent)' }}>
          {isOwnProfile ? 'Мой профиль' : 'Профиль'}
        </span>
      </nav>

      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}>
        {isOwnProfile ? 'Мой профиль' : userName}
      </h1>

      {/* Заголовок профиля */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Аватар */}
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%',
            overflow: 'hidden',
            background: userAvatarUrl ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'grid',
            placeContent: 'center'
          }}>
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={userName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  // Если изображение не загружается, показываем инициалы
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const span = document.createElement('span');
                    span.style.fontSize = '24px';
                    span.style.color = '#fff';
                    span.style.fontWeight = '600';
                    span.textContent = userInitials;
                    parent.appendChild(span);
                  }
                }}
              />
            ) : (
              <span style={{ fontSize: '24px', color: '#fff', fontWeight: 600 }}>
                {userInitials}
              </span>
            )}
          </div>

          {/* Основная информация */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2 className="title" style={{ margin: '0 0 4px 0' }}>
              {userName}
            </h2>
            <p className="meta" style={{ margin: '0 0 8px 0' }}>
              {userEmail}
            </p>

            {/* Бейджи ролей */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {isMentor && (
                  <span className="chip" style={{ background: 'var(--accent)', color: '#fff' }}>
                    Ментор
                  </span>
                )}
                {isStudent && (
                  <span className="chip" style={{ background: 'var(--accent-2)', color: '#fff' }}>
                    Студент
                  </span>
                )}
              </div>

              {/* Кнопки действий */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {isOwnProfile && (
                  <button 
                    className="btn btn-outline"
                    onClick={() => navigate(`/profile/${id}/edit`)}
                  >
                    Редактировать профиль
                  </button>
                )}
                {!isOwnProfile && token && (
                  <button 
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        const chatsResponse = await fetch('http://localhost:8080/api/v1/chats?limit=20&offset=0', {
                          headers: {
                            'Authorization': `Bearer ${token}`,
                          },
                        });
                        
                        if (chatsResponse.ok) {
                          const chatsData = await chatsResponse.json();
                          const existingChat = chatsData.chats?.find((chat: any) => 
                            (chat.user1_id === profile.user?.user_id && chat.user2_id === authUser?.user_id) ||
                            (chat.user2_id === profile.user?.user_id && chat.user1_id === authUser?.user_id)
                          );
                          
                          if (existingChat) {
                            navigate(`/chats?chat=${existingChat.id}`);
                          } else {
                            const createResponse = await fetch('http://localhost:8080/api/v1/chats', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                other_user_id: profile.user?.user_id,
                              }),
                            });
                            
                            if (createResponse.ok) {
                              const chatData = await createResponse.json();
                              navigate(`/chats?chat=${chatData.chat_id}`);
                            }
                          }
                        }
                      } catch (error) {
                        console.error('Ошибка при создании чата:', error);
                        alert('Ошибка при создании чата. Попробуйте позже.');
                      }
                    }}
                  >
                    Написать
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {profile.mentor?.description && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass)' }}>
            <p style={{ margin: 0, color: 'var(--text)' }}>
              {profile.mentor.description}
            </p>
          </div>
        )}
      </div>

      {/* Навыки */}
      {(profile.teaching_skills?.length || profile.learning_skills?.length) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {profile.teaching_skills && profile.teaching_skills.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 12px 0' }}>Навыки преподавания</h3>
              <div className="chips">
                {profile.teaching_skills.map((skill, index) => (
                  <div key={skill.skill_id || `skill-${index}`} className="chip">
                    {skill.skill_name}
                    <span style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>
                      ({skill.proficiency_level})
                      {skill.years_of_experience && ` • ${skill.years_of_experience} лет`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.learning_skills && profile.learning_skills.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 12px 0' }}>Навыки обучения</h3>
              <div className="chips">
                {profile.learning_skills.map((skill, index) => (
                  <div key={skill.skill_id || `learn-skill-${index}`} className="chip">
                    {skill.skill_name}
                    <span style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>
                      ({skill.proficiency_level})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Понравившиеся посты - новый дизайн с вертикальными закладками */}
      {likedPosts.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '2px solid var(--glass)' 
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '20px'
            }}>
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                stroke="none"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>
                {isOwnProfile ? 'Мои закладки' : 'Сохраненные курсы'}
              </h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
                {likedPosts.length} {likedPosts.length === 1 ? 'закладка' : likedPosts.length < 5 ? 'закладки' : 'закладок'}
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {likedPosts.map((post, index) => (
              <FavoritePostCard
                key={post.id}
                post={post}
                onClick={() => navigate(`/courses/${post.id}`)}
                index={index}
              />
            ))}
          </div>

          {/* Если постов много, показываем кнопку "Показать еще" */}
          {likedPosts.length >= 8 && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button 
                className="btn btn-ghost"
                style={{
                  color: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  fontSize: '14px'
                }}
              >
                Показать все закладки →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Курсы ментора */}
      {isMentor && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>
              {isOwnProfile ? 'Мои курсы' : 'Курсы пользователя'} ({mentorCourses.length})
            </h3>
            {isOwnProfile && (
              <button 
                className="btn btn-outline" 
                onClick={() => navigate('/course/create')}
              >
                + Создать курс
              </button>
            )}
          </div>

          {mentorCourses.length > 0 ? (
            <div className="courses-grid">
              {mentorCourses.map((course) => (
                <div 
                  key={course.id} 
                  className="course"
                  onClick={() => navigate(`/courses/${course.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    className="thumb"
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      height: '150px'
                    }}
                  >
                    {renderCourseImage(course)}
                  </div>
                  <div className="c-body">
                    <div className="title" style={{ fontSize: '16px', marginBottom: '8px' }}>
                      {course.title || 'Без названия'}
                    </div>
                    <div className="meta" style={{ fontSize: '12px', marginBottom: '8px' }}>
                      {course.tags?.slice(0, 2).map(tag => `#${tag}`).join(' ') || ''}
                      {course.tags?.length > 2 && '...'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="meta">
                        {course.average_rating
                          ? `⭐ ${course.average_rating.toFixed(1)} (${course.ratings_count || 0})`
                          : 'Нет оценок'
                        }
                      </span>
                      <span className="meta" style={{ fontSize: '11px' }}>
                        {course.created_at ? new Date(course.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна'}
                      </span>
                    </div>
                    {isOwnProfile && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-outline"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/course/edit/${course.id}`)
                          }}
                        >
                          Редактировать
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              {isOwnProfile
                ? 'Вы пока не создали ни одного курса'
                : 'Пользователь пока не создал ни одного курса'
              }
            </div>
          )}
        </div>
      )}

      {/* Информация о студенте */}
      {isStudent && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0' }}>Информация об обучении</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {profile.student?.learning_goals && (
              <div>
                <div className="meta" style={{ marginBottom: '4px' }}>Цели обучения</div>
                <p style={{ margin: 0 }}>{profile.student.learning_goals}</p>
              </div>
            )}
            {profile.student?.preferred_learning_style && (
              <div>
                <div className="meta" style={{ marginBottom: '4px' }}>Предпочтительный стиль обучения</div>
                <p style={{ margin: 0 }}>{profile.student.preferred_learning_style}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Дополнительная информация */}
      <div className="card">
        <h3 style={{ margin: '0 0 16px 0' }}>Дополнительная информация</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div>
            <div className="meta" style={{ marginBottom: '6px' }}>Дата регистрации</div>
            <div style={{ fontWeight: '500' }}>
              {profile.user.created_at ? new Date(profile.user.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              }) : 'Не указана'}
            </div>
          </div>

          {profile.mentor?.created_at && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Ментор с</div>
              <div style={{ fontWeight: '500' }}>
                {new Date(profile.mentor.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}

          {profile.student?.created_at && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Студент с</div>
              <div style={{ fontWeight: '500' }}>
                {new Date(profile.student.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}

          {isMentor && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Курсов создано</div>
              <div style={{ fontWeight: '500' }}>
                {mentorCourses.length}
              </div>
            </div>
          )}

          {likedPosts.length > 0 && (
            <div>
              <div className="meta" style={{ marginBottom: '6px' }}>Понравившихся постов</div>
              <div style={{ fontWeight: '500' }}>
                {likedPosts.length}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .favorite-post-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12) !important;
        }
      `}</style>
    </div>
  )
}

export default ProfilePage