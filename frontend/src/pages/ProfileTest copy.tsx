// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

interface ProfileData {
  user_id: string;
  first_name: string;
  last_name: string;
  bio: string;
  avatar_url?: string;
  mentor: {
    is_mentor: boolean;
    experience?: string;
    specialization?: string[];
    hourly_rate?: number;
  };
  student: {
    is_student: boolean;
    level?: string;
    interests?: string[];
  };
  teaching_skills: string[];
  learning_skills: string[];
}

interface UpdateProfileRequest {
  avatar_url?: string;
  bio: string;
  first_name: string;
  last_name: string;
  learning_skills: string[];
  mentor: {
    is_mentor: boolean;
    experience?: string;
    specialization?: string[];
    hourly_rate?: number;
  };
  student: {
    is_student: boolean;
    level?: string;
    interests?: string[];
  };
  teaching_skills: string[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  rating: number;
  thumbnail_url?: string;
  student_count: number;
  created_at: string;
}

interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  url?: string;
  tags: string[];
  created_at: string;
}

const API_BASE_URL = "http://localhost:8080/api/v1";

export const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user: currentUser } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UpdateProfileRequest>({
    first_name: "",
    last_name: "",
    bio: "",
    avatar_url: "",
    mentor: { is_mentor: false },
    student: { is_student: false },
    teaching_skills: [],
    learning_skills: []
  });

  const [teacherCourses, setTeacherCourses] = useState<Course[]>([]);
  const [studentCourses, setStudentCourses] = useState<Course[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<PortfolioProject[]>([]);
  
  const [coursesLoading, setCoursesLoading] = useState({
    teacher: false,
    student: false,
    portfolio: false
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
          const data: ProfileData = await response.json();
          setProfile(data);
          
          // Заполняем форму данными профиля
          setFormData({
            first_name: data.first_name,
            last_name: data.last_name,
            bio: data.bio,
            avatar_url: data.avatar_url || "",
            mentor: data.mentor,
            student: data.student,
            teaching_skills: data.teaching_skills,
            learning_skills: data.learning_skills
          });

          // Загружаем дополнительные данные отдельно
          if (data.mentor.is_mentor) {
            loadTeacherCourses(data.user_id);
          }
          
          if (data.student.is_student) {
            loadStudentCourses(data.user_id);
          }
          
          loadPortfolio(data.user_id);
          
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

  // Загрузка курсов преподавателя
  const loadTeacherCourses = async (userId: string) => {
    if (!token) return;
    
    try {
      setCoursesLoading(prev => ({ ...prev, teacher: true }));
      
      const response = await fetch(`${API_BASE_URL}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeacherCourses(data);
      }
    } catch (e) {
      console.error("Error loading teacher courses:", e);
    } finally {
      setCoursesLoading(prev => ({ ...prev, teacher: false }));
    }
  };

  // Загрузка курсов студента
  const loadStudentCourses = async (userId: string) => {
    if (!token) return;
    
    try {
      setCoursesLoading(prev => ({ ...prev, student: true }));
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}/courses/learning`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudentCourses(data);
      }
    } catch (e) {
      console.error("Error loading student courses:", e);
    } finally {
      setCoursesLoading(prev => ({ ...prev, student: false }));
    }
  };

  // Загрузка портфолио
  /*const loadPortfolio = async (userId: string) => {
    try {
      setCoursesLoading(prev => ({ ...prev, portfolio: true }));
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}/portfolio`);
      
      if (response.ok) {
        const data = await response.json();
        setPortfolioProjects(data);
      }
    } catch (e) {
      console.error("Error loading portfolio:", e);
    } finally {
      setCoursesLoading(prev => ({ ...prev, portfolio: false }));
    }
  };*/

  // Перезагрузка всех дополнительных данных
  const reloadAdditionalData = () => {
    if (!profile) return;
    
    if (profile.mentor.is_mentor) {
      loadTeacherCourses(profile.user_id);
    }
    
    if (profile.student.is_student) {
      loadStudentCourses(profile.user_id);
    }
    
    //loadPortfolio(profile.user_id);
  };

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

  // Переключение режима ментора
  const handleToggleMentorMode = async () => {
    if (!profile || !id || !token) return;
    
    const newMentorStatus = !profile.mentor.is_mentor;
    const updatedFormData = {
      ...formData,
      mentor: { ...formData.mentor, is_mentor: newMentorStatus }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedFormData)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProfile(prev => prev ? {
            ...prev,
            mentor: { ...prev.mentor, is_mentor: newMentorStatus }
          } : null);
          
          setFormData(updatedFormData);
          
          if (newMentorStatus) {
            loadTeacherCourses(profile.user_id);
          } else {
            setTeacherCourses([]);
          }
        }
      }
    } catch (e) {
      console.error("Error toggling mentor mode:", e);
      alert("Не удалось обновить режим ментора");
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
            
            {isEditing ? (
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Расскажите о себе..."
                rows={3}
                className="input"
                style={{ width: "100%", marginBottom: 16, resize: "vertical" }}
              />
            ) : (
              <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
                {profile?.bio || "Пользователь пока не добавил информацию о себе"}
              </p>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <strong style={{ display: "block", marginBottom: 6 }}>
                  {isEditing ? "Навыки преподавания (через запятую):" : "Преподаёт:"}
                </strong>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.teaching_skills.join(", ")}
                    onChange={(e) => handleSkillsChange('teaching', e.target.value)}
                    placeholder="React, TypeScript, JavaScript"
                    className="input"
                    style={{ width: "100%" }}
                  />
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {profile?.teaching_skills?.map((skill, index) => (
                      <span key={index} className="chip">{skill}</span>
                    )) || <span className="chip">Не указаны</span>}
                  </div>
                )}
              </div>
              
              <div>
                <strong style={{ display: "block", marginBottom: 6 }}>
                  {isEditing ? "Навыки для изучения (через запятую):" : "Изучает:"}
                </strong>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.learning_skills.join(", ")}
                    onChange={(e) => handleSkillsChange('learning', e.target.value)}
                    placeholder="Дизайн, Маркетинг, Английский"
                    className="input"
                    style={{ width: "100%" }}
                  />
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {profile?.learning_skills?.map((skill, index) => (
                      <span key={index} className="chip">{skill}</span>
                    )) || <span className="chip">Не указаны</span>}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isOwner && !isEditing && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  Редактировать профиль
                </button>
              )}
              
              {isOwner && isEditing && (
                <>
                  <button 
                    className="btn btn-primary"
                    onClick={handleSaveProfile}
                    disabled={editLoading}
                  >
                    {editLoading ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button 
                    className="btn"
                    onClick={() => {
                      setIsEditing(false);
                      if (profile) {
                        setFormData({
                          first_name: profile.first_name,
                          last_name: profile.last_name,
                          bio: profile.bio,
                          avatar_url: profile.avatar_url || "",
                          mentor: profile.mentor,
                          student: profile.student,
                          teaching_skills: profile.teaching_skills,
                          learning_skills: profile.learning_skills
                        });
                      }
                    }}
                  >
                    Отмена
                  </button>
                </>
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

      {/* Режим ментора */}
      {profile?.mentor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 12 }}>Режим ментора</h2>
          <p style={{ color: "var(--muted)", marginBottom: 12 }}>
            {profile.mentor.is_mentor 
              ? "Вы являетесь ментором и можете создавать курсы."
              : "Станьте ментором для открытия полного функционала."}
          </p>
          
          {profile.mentor.is_mentor && profile.mentor.experience && (
            <p style={{ marginBottom: 8 }}>
              <strong>Опыт:</strong> {profile.mentor.experience}
            </p>
          )}
          
          {profile.mentor.is_mentor && profile.mentor.hourly_rate && (
            <p style={{ marginBottom: 12 }}>
              <strong>Ставка:</strong> ${profile.mentor.hourly_rate}/час
            </p>
          )}
          
          {isOwner && (
            <button 
              className={`btn ${profile.mentor.is_mentor ? "" : "btn-primary"}`}
              onClick={handleToggleMentorMode}
            >
              {profile.mentor.is_mentor ? "Отключить режим ментора" : "Стать ментором"}
            </button>
          )}
        </div>
      )}

      {/* Курсы преподавателя */}
      {profile?.mentor.is_mentor && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2>Мои курсы</h2>
            <button 
              className="btn" 
              onClick={() => profile && loadTeacherCourses(profile.user_id)}
              disabled={coursesLoading.teacher}
              style={{ fontSize: "14px", padding: "6px 12px" }}
            >
              {coursesLoading.teacher ? "Обновление..." : "🔄 Обновить"}
            </button>
          </div>
          
          {coursesLoading.teacher ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>Загрузка курсов...</p>
            </div>
          ) : teacherCourses.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
              {teacherCourses.map(course => (
                <Link 
                  key={course.id} 
                  to={`/courses/${course.id}`}
                  className="card" 
                  style={{ textDecoration: "none", padding: 12 }}
                >
                  <img 
                    src={course.thumbnail_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop"}
                    style={{ 
                      width: "100%", 
                      height: 120, 
                      borderRadius: 8,
                      objectFit: "cover",
                      marginBottom: 8
                    }} 
                    alt={course.title}
                  />
                  <h3 style={{ marginBottom: 4 }}>{course.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>
                    {course.category} | {course.rating.toFixed(1)} ⭐ | {course.student_count} студентов
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24 }}>
              <p style={{ color: "var(--muted)", marginBottom: 12 }}>У вас пока нет созданных курсов</p>
              {isOwner && (
                <Link to="/courses/create" className="btn btn-primary">
                  Создать первый курс
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Курсы студента */}
      {profile?.student.is_student && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2>Курсы, которые я изучаю</h2>
            <button 
              className="btn" 
              onClick={() => profile && loadStudentCourses(profile.user_id)}
              disabled={coursesLoading.student}
              style={{ fontSize: "14px", padding: "6px 12px" }}
            >
              {coursesLoading.student ? "Обновление..." : "🔄 Обновить"}
            </button>
          </div>
          
          {coursesLoading.student ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>Загрузка курсов...</p>
            </div>
          ) : studentCourses.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
              {studentCourses.map(course => (
                <Link 
                  key={course.id} 
                  to={`/courses/${course.id}`}
                  className="card" 
                  style={{ textDecoration: "none", padding: 12 }}
                >
                  <img 
                    src={course.thumbnail_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop"}
                    style={{ 
                      width: "100%", 
                      height: 120, 
                      borderRadius: 8,
                      objectFit: "cover",
                      marginBottom: 8
                    }} 
                    alt={course.title}
                  />
                  <h3 style={{ marginBottom: 4 }}>{course.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>
                    {course.category} | {course.rating.toFixed(1)} ⭐
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24 }}>
              <p style={{ color: "var(--muted)", marginBottom: 12 }}>Вы пока не записаны на курсы</p>
              {isOwner && (
                <Link to="/courses" className="btn btn-primary">
                  Найти курсы
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Портфолио */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2>Портфолио</h2>
          <button 
            className="btn" 
            onClick={() => profile && loadPortfolio(profile.user_id)}
            disabled={coursesLoading.portfolio}
            style={{ fontSize: "14px", padding: "6px 12px" }}
          >
            {coursesLoading.portfolio ? "Обновление..." : "🔄 Обновить"}
          </button>
        </div>
        
        {coursesLoading.portfolio ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p>Загрузка портфолио...</p>
          </div>
        ) : portfolioProjects.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {portfolioProjects.map(project => (
              <div key={project.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <img 
                    src={project.image_url || "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=100&h=100&fit=crop"}
                    style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: "50%", 
                      objectFit: "cover" 
                    }} 
                    alt={project.title}
                  />
                  <div>
                    <strong style={{ display: "block" }}>{project.title}</strong>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8, lineHeight: 1.4 }}>
                  {project.description}
                </p>
                {project.tags && project.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {project.tags.map((tag, index) => (
                      <span key={index} style={{ 
                        fontSize: 12, 
                        padding: "2px 8px", 
                        background: "var(--glass)", 
                        borderRadius: 12 
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ color: "var(--muted)", marginBottom: 12 }}>Портфолио пока пусто</p>
            {isOwner && (
              <Link to="/portfolio/add" className="btn btn-primary">
                Добавить проект в портфолио
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Кнопка для перезагрузки всех данных */}
      {isOwner && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button 
            className="btn" 
            onClick={reloadAdditionalData}
            disabled={coursesLoading.teacher || coursesLoading.student || coursesLoading.portfolio}
          >
            Обновить все данные
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link to="/" style={{ color: "var(--accent)" }}>
          ← Вернуться на главную
        </Link>
      </div>
    </div>
  );
};