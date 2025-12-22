import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

export const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const auth = useAuth();


  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    var userData = null;

    try {
      const res = await fetch("http://localhost:8080/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          surname: surname,
          email: email,
          password: password
        })
      });

      if (res.status === 201) {
        const data = await res.json(); 
        setSuccess("Аккаунт создан! Ваш ID: " + data.id);
        sessionStorage.setItem("id", data.id);

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

          if (res.status === 200) {
            const data = await res.json(); 
            setSuccess("Успешный вход");

            try {
            // Запрашиваем пользователя по email
            const userRes = await fetch(`http://localhost:8080/api/v1/users/email/${email}`, {
              headers: {
                "Authorization": `Bearer ${data.access_token}`
              }
            });
            
            if (userRes.ok) {
              userData = await userRes.json();
              console.log('🔐 Login: User data received:', userData);
              
              // Сохраняем пользователя в sessionStorage
              sessionStorage.setItem("user_data", JSON.stringify(userData));
            } else {
              console.warn('🔐 Login: Could not fetch user, status:', userRes.status);
              // Создаем временного пользователя с реальным email
              const tempUser = {
                user_id: `temp-${Date.now()}`,
                email: email,
                first_name: email.split('@')[0],
                last_name: '',
                created_at: new Date().toISOString()
              };
              sessionStorage.setItem("user_data", JSON.stringify(tempUser));
            }
          } catch (userErr) {
            console.error('🔐 Login: Error fetching user:', userErr);
            // Создаем временного пользователя
            const tempUser = {
              user_id: `temp-${Date.now()}`,
              email: email,
              first_name: email.split('@')[0],
              last_name: '',
              created_at: new Date().toISOString()
            };
            sessionStorage.setItem("user_data", JSON.stringify(tempUser));
          }
            auth.login(data.access_token, userData);// логин!!!!!
            navigate("/profile", { replace: true });
          } else if (res.status === 400) {
            const data = await res.json(); 
            setError("Некорректные данные. Проверьте ввод.");
          } else if (res.status === 401) {
            setError("Неверный логин или пароль");
          } else {
            setError(`${res.status} Error`);
          }

        } catch (e) {
          setError("Не удалось подключиться к серверу.");
        }

      } else if (res.status === 400) {
        setError("Некорректные данные. Проверьте ввод.");
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
        <h2 style={{ textAlign: "center" }}>Регистрация</h2>
        <input
          className="input"
          type="text"
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="input"
          type="text"
          placeholder="Фамилия"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
        />

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
          {loading ? "Загрузка..." : "Зарегистрироваться"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      {success && <p style={{ color: "green", marginTop: 10 }}>{success}</p>}
      <p style={{ marginTop: "12px" }}>
        Уже есть аккаунт? <a href="/login">Войти</a>
      </p>
    </div>
  );
};
