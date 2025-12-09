import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = "https://localhost:8080/api/v1";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка авторизации");
        return;
      }

      // сохраняем токен в localStorage
      localStorage.setItem("token", data.token);

      // редирект на домашнюю страницу
      navigate("/");
    } catch (err) {
      setError("Сетевая ошибка. Попробуйте позже.");
    }
  };

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "16px" }}>
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <h2 style={{ textAlign: "center" }}>Вход</h2>

        <label>
          Email
          <input
            type="email"
            placeholder="Введите email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn btn-primary">Войти</button>

        <div style={{ textAlign: "center", fontSize: "14px" }}>
          Нет аккаунта? <a href="/signup">Зарегистрироваться</a>
        </div>
      </form>
    </div>
  )
}