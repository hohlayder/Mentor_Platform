import React, { useState } from "react";

export const Register: React.FC = () => {
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("http://localhost:8080/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      if (response.status === 201) {
        const data = await response.json();
        setSuccess(`Регистрация прошла успешно! ID: ${data.id}`);
        setForm({ name: "", surname: "", email: "", password: "" });
      } else {
        const errData = await response.json();
        setError(errData.message || "Ошибка при регистрации");
      }
    } catch (err) {
      setError("Сервер недоступен");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: "400px", marginTop: "50px" }}>
      <h1>Регистрация</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <input
          type="text"
          name="name"
          placeholder="Имя"
          value={form.name}
          onChange={handleChange}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />
        <input
          type="password"
          name="password"
          placeholder="Пароль"
          value={form.password}
          onChange={handleChange}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Отправка..." : "Зарегистрироваться"}
        </button>
      </form>
      {error && <p style={{ color: "red", marginTop: "8px" }}>{error}</p>}
      <p style={{ marginTop: "12px" }}>
        Уже есть аккаунт? <a href="/login">Войти</a>
      </p>
    </div>
  );
};
