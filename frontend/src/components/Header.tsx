// src/components/Header.tsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// Импортируйте логотип
import logo from '../assets/logo.jpg'; // или logo.svg, logo.webp

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

  return (
    <header className="header" style={{ 
      padding: '12px 0',
      borderBottom: '1px solid var(--glass)',
      marginBottom: '24px'
    }}>
      <div className="container" style={{ 
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link to="/" className="brand" style={{ 
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
              borderRadius: '8px'
            }} 
          />
          <span>Mentor Fellowship</span>
        </Link>
        
        <div className="header-nav" style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button 
            onClick={toggleTheme} 
            className="btn btn-ghost"
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
              gap: '6px'
            }}
          >
            {theme === 'light' ? '🌙' : '☀️'} Тема
          </button>
          
          {token && user ? (
            <>
              <Link 
                to="/courses" 
                className="btn btn-ghost"
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}
              >
                Курсы
              </Link>
              
              <Link 
                to="/chats" 
                className="btn btn-ghost"
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}
              >
                Чаты
              </Link>
              
              <Link 
                to={`/profile/${user.user_id}`}
                className="btn btn-ghost"
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
                  gap: '6px'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'grid',
                  placeContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {user.first_name?.[0] || '👤'}
                </div>
                {user.first_name || 'Профиль'}
              </Link>
              
              <button 
                onClick={handleLogout} 
                className="btn btn-ghost"
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                className="btn btn-ghost"
                style={{ 
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: 'transparent',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}
              >
                Войти
              </Link>
              
              <Link 
                to="/signup" 
                className="btn btn-primary"
                style={{ 
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500
                }}
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