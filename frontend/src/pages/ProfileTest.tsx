// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

interface User{
  avatar_url: string,
  created_at: string,
  email: string,
  first_name: string,
  last_name: string,
  user_id: string
}

interface UpdateProfileRequest{
  avatar_url: string,
  created_at: string,
  email: string,
  first_name: string,
  last_name: string,
  user_id: string
}

const API_BASE_URL = "http://localhost:8080/api/v1";

export const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user: currentUser } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UpdateProfileRequest>({
    avatar_url: "",
    created_at: "",
    email: "",
    first_name: "",
    last_name: "",
    user_id: ""
  });
  
  const isOwner = currentUser?.user_id === id;

  // Загрузка основной информации профиля
  useEffect(() => {
    const loadProfile = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/profiles/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (response.status === 200) {
          const data: User = await response.json();
          setProfile(data);
          
          // Заполняем форму данными профиля
          setFormData({
            avatar_url: data.avatar_url,
            created_at: data.created_at,
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            user_id: data.user_id
          });
          
        } else if (response.status === 404) {
          setError("Профиль не найден");
        } else if (response.status === 500) {
          setError("Ошибка сервера");
        } else {
          setError(`Ошибка ${response.status}`);
        }
      } catch (e) {
        setError("Не удалось подключиться к серверу");
        console.error("Error loading profile:", e);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [id, token]);

  // Сохранение профиля
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !token) return;
    
    try {
      setEditLoading(true);
      setEditSuccess(null);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.success) {
          setEditSuccess("Профиль успешно обновлен");
          setProfile(prev => prev ? { ...prev, ...formData } : null);
          setIsEditing(false);
        }
      } else if (response.status === 400) {
        setError("Некорректные данные");
      } else if (response.status === 401) {
        setError("Требуется авторизация");
        navigate("/login");
      } else if (response.status === 403) {
        setError("Нет доступа для редактирования этого профиля");
      } else if (response.status === 404) {
        setError("Профиль не найден");
      } else {
        setError(`Ошибка ${response.status}`);
      }
    } catch (e) {
      setError("Не удалось подключиться к серверу");
      console.error("Error saving profile:", e);
    } finally {
      setEditLoading(false);
    }
  };

  // Обработчики формы
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSkillsChange = (type: 'teaching' | 'learning', value: string) => {
    const skills = value.split(',').map(s => s.trim()).filter(s => s);
    
    if (type === 'teaching') {
      setFormData(prev => ({ ...prev, teaching_skills: skills }));
    } else {
      setFormData(prev => ({ ...prev, learning_skills: skills }));
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: 800, marginTop: 40, textAlign: "center" }}>
        <div className="card" style={{ padding: "40px" }}>
          <p>Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="container" style={{ maxWidth: 800, marginTop: 40 }}>
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <h2 style={{ color: "var(--accent)" }}>Ошибка</h2>
          <p>{error}</p>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate("/")}
            style={{ marginTop: "20px" }}
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  const fullName = `${profile?.first_name} ${profile?.last_name}`;
  const email = currentUser?.email || `${profile?.first_name?.toLowerCase()}.${profile?.last_name?.toLowerCase()}@example.com`;

  return (
    <div className="container" style={{ maxWidth: 1000, marginTop: 20 }}>
      {/* Основная информация пользователя */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div>
            <img 
              src={profile?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop"}
              style={{ 
                width: 120, 
                height: 120, 
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid var(--accent-light)"
              }} 
              alt={fullName}
            />
            
            {isEditing && (
              <input
                type="text"
                name="avatar_url"
                value={formData.avatar_url}
                onChange={handleInputChange}
                placeholder="URL аватара"
                className="input"
                style={{ marginTop: 12, width: "100%" }}
              />
            )}
          </div>

          <div style={{ flex: 1 }}>
            {isEditing ? (
              <>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Имя"
                  className="input"
                  style={{ width: "100%", marginBottom: 8, fontSize: 24, fontWeight: "bold" }}
                />
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Фамилия"
                  className="input"
                  style={{ width: "100%", marginBottom: 12, fontSize: 24, fontWeight: "bold" }}
                />
              </>
            ) : (
              <h1 style={{ marginBottom: 8 }}>{fullName}</h1>
            )}
            
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>{email}</p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isOwner && !isEditing && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  Редактировать профиль
                </button>
              )}
              
              {!isOwner && token && (
                <Link to={`/chat/create?userId=${id}`} className="btn btn-primary">
                  Написать сообщение
                </Link>
              )}
            </div>
          </div>
        </div>

        {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
        {editSuccess && <p style={{ color: "green", marginTop: 12 }}>{editSuccess}</p>}
      </div>

      

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link to="/" style={{ color: "var(--accent)" }}>
          ← Вернуться на главную
        </Link>
      </div>
    </div>
  );
};