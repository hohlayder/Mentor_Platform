// src/components/Header.tsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import logo from '../assets/logo.jpg';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getAvatarUrl = (avatarUrl?: string | null): string => {
    if (!avatarUrl) return '';

    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }

    if (avatarUrl && !avatarUrl.includes('/')) {
      return `http://localhost:8080/api/v1/files/avatar/${avatarUrl}`;
    }

    if (avatarUrl.startsWith('/')) {
      return `http://localhost:8080${avatarUrl}`;
    }

    if (avatarUrl.startsWith('files/avatar/')) {
      return `http://localhost:8080/api/v1/${avatarUrl}`;
    }

    return avatarUrl;
  };

  return (
    <header style={{ 
      padding: '12px 0',
      borderBottom: '1px solid var(--glass)',
      background: 'var(--surface)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ 
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* ЛЕВАЯ ЧАСТЬ: только лого и название */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Link to="/" style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: '18px'
          }}>
            <img 
              src={logo} 
              alt="Mentor Fellowship" 
              style={{ 
                height: '36px',
                width: 'auto',
                borderRadius: '8px',
                objectFit: 'contain'
              }} 
            />
            <span style={{ whiteSpace: 'nowrap' }}>Mentor Fellowship</span>
          </Link>
        </div>
        
        {/* ПРАВАЯ ЧАСТЬ: все кнопки */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {token && user ? (
            // Авторизованный пользователь
            <>
              <Link 
                to="/courses" 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Курсы
              </Link>
              <Link 
                to="/dashboard" 
                style={{ 
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--glass)",
                  background: "transparent",
                  color: "var(--text)",
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "var(--glass)"}
                onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
              >
                Статистика
              </Link>
              
              <Link 
                to="/chats" 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Чаты
              </Link>
              
              <button 
                onClick={toggleTheme} 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {theme === 'light' ? '🌙' : '☀️'} Тема
              </button>
              
              <Link 
                to={`/profile/${user.user_id}`}
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: user.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'grid',
                  placeContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {user.avatar_url ? (
                    <img 
                      src={getAvatarUrl(user.avatar_url)} 
                      alt={`${user.first_name} ${user.last_name}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement as HTMLElement;
                        if (parent) {
                          parent.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-2))';
                          const span = document.createElement('span');
                          span.style.color = '#fff';
                          span.style.fontWeight = '600';
                          span.style.fontSize = '12px';
                          span.textContent = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`;
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`
                  )}
                </div>
                <span>{user.first_name || 'Профиль'}</span>
              </Link>
              
              <button 
                onClick={handleLogout} 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Выйти
              </button>
            </>
          ) : (
            // Неавторизованный пользователь
            <>
              <Link 
                to="/courses" 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Курсы
              </Link>
              
              
              <button 
                onClick={toggleTheme} 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {theme === 'light' ? '🌙' : '☀️'} Тема
              </button>
              
              <Link 
                to="/login" 
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Войти
              </Link>
              
              <Link 
                to="/signup" 
                style={{ 
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent)'}
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
