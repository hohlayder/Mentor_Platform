import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import placeholderImg from "../assets/placeholder.svg";

export const Home: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const navigate = useNavigate();

  // При монтировании читаем тему из localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);
    document.body.dataset.theme = savedTheme ?? "light";
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.body.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme);
  };

  const handleLoginClick = () => {
    navigate("/login");
  };

  const handleRegisterClick = () => {
    navigate("/signup");
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem("refresh_token");
    const accessToken = localStorage.getItem("access_token");

    if (!refreshToken || !accessToken) {
      setIsLoggedIn(false);
      return;
    }

    fetch("http://localhost:8080/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(res => {
        if (res.ok) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          setIsLoggedIn(false);
        }
      })
      .catch(console.error);
  };

    return (
    <div>
      {/* Header */}
      <header className="header">
        <Link to="/" className="brand">
          <div className="logo">M</div>Mentor Fellowship
        </Link>
        <div className="search">
          <input type="text" placeholder="Поиск курсов..." />
        </div>
        <div className="header-nav">
          <button data-toggle-theme className="btn btn-ghost">Тема</button>
          <Link to="/notifications" className="btn btn-ghost">Уведомления</Link>
          {user ? (
            <>
              <Link to="/profile" className="btn btn-ghost">Профиль</Link>
              <button onClick={handleLogout} className="btn btn-ghost">Выйти</button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost">Войти</Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container">
        {/* Hero Section */}
        <div className="hero">
          <div className="hero-left">
            <h1>Важное приветствие</h1>
            <p className="lead">Какой-нить слоган.</p>
            {user ? (
              <Link to="/profile" className="btn btn-primary">Перейти в профиль</Link>
            ) : (
              <Link to="/signup" className="btn btn-primary">Начать пользоваться</Link>
            )}
          </div>
          <img
            src={placeholderImg}
            alt="Hero"
            style={{ width: 400, height: 250, borderRadius: 12 }}
          />
        </div>

        {/* Top Courses */}
        <div className="section">
          <h2>Популярные курсы</h2>
          <div className="courses-grid">
            {["Course 1", "Course 2", "Course 3"].map((c, i) => (
              <div key={i} className="course">
                <img src={placeholderImg} className="thumb" alt={c} />
                <div className="c-body">
                  <div className="title">{c}</div>
                  <div className="meta">{i === 0 ? "Дизайн | 4.5 ⭐" : "История | 4.2 ⭐"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Teachers */}
        <div className="section">
          <h2>Лучшие менторы</h2>
          <div className="teachers-grid">
            {["Teacher 1", "Teacher 2", "Teacher 3"].map((t, i) => (
              <div key={i} className="teacher">
                <img src={placeholderImg} style={{ width: 48, height: 48, borderRadius: "50%" }} alt={t} />
                <div>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-stats">
            <div>Число курсов на сайте: 120</div>
            <div>Активных менторов: 45</div>
            <div>Пользователей: 500+</div>
          </div>
          <div className="footer-grid">
            <div>
              <h4>Полезные ссылки</h4>
              <Link to="/">Главная страница</Link>
              <Link to="/courses">Поиск курсов</Link>
              <Link to="/profile">Профиль</Link>
              <Link to="/notifications">Уведомления</Link>
            </div>
            <div>
              <h4>Топ категорий</h4>
              <a href="#">Дизайн</a>
              <a href="#">История</a>
              <a href="#">Преподавание</a>
            </div>
            <div>
              <h4>О нас</h4>
              <a href="#">Что-то 1</a>
              <a href="#">Что-то 2</a>
              <a href="#">Что-то 3</a>
              <a href="#">Что-то 4</a>
            </div>
            <div>
              <h4>Поддрежка</h4>
              <a href="#">ЧАВО</a>
              <a href="#">Связаться с нами</a>
              <a href="#">Сообщить об ошибке</a>
            </div>
            <div className="socials">
              <div>VK</div>
              <div>Tg</div>
              <div>X</div>
              <div>Max</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
