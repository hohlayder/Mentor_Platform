import React, { useState } from "react";

export const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8080/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      if (res.status === 201) {
        const data = await res.json(); 
        setSuccess("Аккаунт создан! Ваш ID: " + data.id);
        sessionStorage.setItem("token", data.id);
      } else if (res.status === 400) {
        setError("Некорректные данные. Проверьте ввод.");
      } else if (res.status === 401) {
        setError("Неверный логине или пароль");
      } else {
        setError(`${res.status} Error`);
      }

    } catch (e) {
      setError("Не удалось подключиться к серверу.");
    }

    setLoading(false);
  }

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: 40 }}>

      <form
        onSubmit={handleRegister}
        className="card"
        style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <h2 style={{ textAlign: "center" }}>Вход</h2>

        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Загрузка..." : "Войти"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      {success && <p style={{ color: "green", marginTop: 10 }}>{success}</p>}
      <p style={{ marginTop: "12px" }}>
        Нет аккаунта? <a href="/register">Зарегестрироваться</a>
      </p>
    </div>
  );
};
