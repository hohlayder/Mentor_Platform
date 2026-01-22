import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

const API_BASE_URL = "http://localhost:8080/api/v1";
const COURSES_PAGE_SIZE = 6;
const RATING_SAMPLE_SIZE = 100;
const MENTORS_PAGE_SIZE = 100;
const MAX_MENTORS_PAGES = 10;

const useTheme = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    return savedTheme || "light";
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, toggleTheme };
};

type CourseStatus = "published" | "draft" | "archived";

interface ApiPost {
  id: string;
  author_id: string;
  title: string;
  content: string;
  tags: string[];
  status: CourseStatus;
  average_rating?: number;
  ratings_count?: number;
  created_at: string;
  updated_at: string;
}

interface ListPostsResponse {
  posts: ApiPost[];
  next_page_token?: string;
  total_count: number;
}

interface CourseRow {
  id: string;
  title: string;
  subtitle: string;
  students: number;
  rating: number;
  status: CourseStatus;
}

interface MentorFavoritesResponse {
  mentor_id: string;
  users_count: number;
  total_favorites: number;
}

interface PostFavoriteCountResponse {
  post_id: string;
  users_count: number;
}

interface MentorPaymentResponse {
  mentor_id: string;
  total_amount: number;
}

const formatNumber = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
};

const formatRating = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
};

const getStatusLabel = (status: CourseStatus) => {
  switch (status) {
    case "published":
      return "Опубликован";
    case "draft":
      return "Черновик";
    case "archived":
      return "Архив";
    default:
      return "—";
  }
};

const buildSubtitle = (post: ApiPost) => {
  if (post.tags && post.tags.length > 0) {
    return post.tags.slice(0, 3).join(" • ");
  }

  const trimmedContent = post.content?.trim();
  if (!trimmedContent) return "Без описания";
  if (trimmedContent.length <= 60) return trimmedContent;
  return `${trimmedContent.slice(0, 60)}...`;
};

const computeAverageRating = (posts: ApiPost[]) => {
  const totalRatings = posts.reduce((acc, post) => acc + (post.ratings_count || 0), 0);
  if (totalRatings > 0) {
    const weightedSum = posts.reduce((acc, post) => {
      const rating = post.average_rating || 0;
      const count = post.ratings_count || 0;
      return acc + rating * count;
    }, 0);
    return weightedSum / totalRatings;
  }

  const ratedPosts = posts.filter((post) => (post.average_rating || 0) > 0);
  if (ratedPosts.length === 0) return null;
  const sum = ratedPosts.reduce((acc, post) => acc + (post.average_rating || 0), 0);
  return sum / ratedPosts.length;
};

const parseUserCount = (data: unknown) => {
  if (typeof data === "number") return data;
  if (!data || typeof data !== "object") return null;

  const payload = data as { user_count?: number | string };
  if (typeof payload.user_count === "number") return payload.user_count;
  if (typeof payload.user_count === "string") {
    const parsed = Number.parseInt(payload.user_count, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const getStoredUserId = () => {
  const stored = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { user_id?: string };
    return parsed.user_id || null;
  } catch {
    return null;
  }
};

const Dashboard: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, token } = useAuth();
  const mentorId = user?.user_id || getStoredUserId();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [coursesPageCount, setCoursesPageCount] = useState(0);
  const [favoriteUsersCount, setFavoriteUsersCount] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [activeCoursesCount, setActiveCoursesCount] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [siteCoursesCount, setSiteCoursesCount] = useState<number | null>(null);
  const [siteMentorsCount, setSiteMentorsCount] = useState<number | null>(null);
  const [siteUsersCount, setSiteUsersCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!mentorId) return;

    const controller = new AbortController();
    const { signal } = controller;

    const apiFetch = async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      const authToken =
        token ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("access_token");

      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(options.headers ? (options.headers as Record<string, string>) : {})
      };

      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    };

    const safeFetch = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch (err) {
        console.error("Dashboard request failed:", err);
        return fallback;
      }
    };

    const fetchMentorsCount = async () => {
      const authorIds = new Set<string>();
      let pageToken = "";

      for (let page = 0; page < MAX_MENTORS_PAGES; page += 1) {
        const params = new URLSearchParams({
          status: "published",
          page_size: String(MENTORS_PAGE_SIZE)
        });
        if (pageToken) params.set("page_token", pageToken);

        const response = await apiFetch<ListPostsResponse>(`/posts?${params}`);
        (response.posts || []).forEach((post) => authorIds.add(post.author_id));

        if (!response.next_page_token) {
          break;
        }

        pageToken = response.next_page_token;
      }

      return authorIds.size;
    };

    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const coursesParams = new URLSearchParams({
          author_id: mentorId,
          page_size: String(COURSES_PAGE_SIZE),
          sort_field: "created_at",
          sort_order: "desc"
        });

        const ratingsParams = new URLSearchParams({
          author_id: mentorId,
          page_size: String(RATING_SAMPLE_SIZE)
        });

        const activeParams = new URLSearchParams({
          author_id: mentorId,
          status: "published",
          page_size: "1"
        });

        const sitePostsParams = new URLSearchParams({
          status: "published",
          page_size: "1"
        });

        const [
          paymentResponse,
          favoritesResponse,
          coursesResponse,
          ratingsResponse,
          activeResponse,
          sitePostsResponse,
          mentorsCount,
          usersCount
        ] = await Promise.all([
          safeFetch(apiFetch<MentorPaymentResponse>(`/mentors/${mentorId}/payment-amount`), null),
          safeFetch(apiFetch<MentorFavoritesResponse>(`/mentors/${mentorId}/favorited-by`), null),
          safeFetch(apiFetch<ListPostsResponse>(`/posts?${coursesParams}`), {
            posts: [],
            total_count: 0
          }),
          safeFetch(apiFetch<ListPostsResponse>(`/posts?${ratingsParams}`), {
            posts: [],
            total_count: 0
          }),
          safeFetch(apiFetch<ListPostsResponse>(`/posts?${activeParams}`), {
            posts: [],
            total_count: 0
          }),
          safeFetch(apiFetch<ListPostsResponse>(`/posts?${sitePostsParams}`), {
            posts: [],
            total_count: 0
          }),
          safeFetch(fetchMentorsCount(), null),
          safeFetch(fetch(`${API_BASE_URL}/users/all`, { signal }).then((res) => (res.ok ? res.json() : null)), null)
        ]);

        const mentorPosts = coursesResponse.posts || [];
        const favoriteCounts = await Promise.all(
          mentorPosts.map((post) =>
            safeFetch(apiFetch<PostFavoriteCountResponse>(`/posts/${post.id}/favorite/count`), {
              post_id: post.id,
              users_count: 0
            })
          )
        );

        const courseRows = mentorPosts.map((post, index) => ({
          id: post.id,
          title: post.title,
          subtitle: buildSubtitle(post),
          students: favoriteCounts[index]?.users_count || 0,
          rating: post.average_rating || 0,
          status: post.status
        }));

        setCourses(courseRows);
        setCoursesPageCount(mentorPosts.length);
        setPaymentAmount(paymentResponse ? paymentResponse.total_amount : null);
        setFavoriteUsersCount(favoritesResponse ? favoritesResponse.users_count : null);
        setActiveCoursesCount(activeResponse.total_count ?? 0);
        setAverageRating(computeAverageRating(ratingsResponse.posts || []));
        setSiteCoursesCount(sitePostsResponse.total_count ?? 0);
        setSiteMentorsCount(mentorsCount ?? null);
        setSiteUsersCount(parseUserCount(usersCount));
      } catch (err) {
        console.error("Dashboard load failed:", err);
        setError("Не удалось загрузить данные дашборда.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();

    return () => {
      controller.abort();
    };
  }, [mentorId, token]);

  const statusStyles: Record<CourseStatus, React.CSSProperties> = {
    published: {
      color: "#1e40af",
      background: "rgba(79, 70, 229, 0.08)",
      border: "1px solid rgba(79, 70, 229, 0.2)"
    },
    draft: {
      color: "#9a3412",
      background: "rgba(245, 158, 11, 0.12)",
      border: "1px solid rgba(245, 158, 11, 0.25)"
    },
    archived: {
      color: "#374151",
      background: "rgba(148, 163, 184, 0.18)",
      border: "1px solid rgba(148, 163, 184, 0.35)"
    }
  };

  return (
    <div className="container" style={{ padding: "0 24px", maxWidth: "1400px" }}>
      <Header theme={theme} toggleTheme={toggleTheme} />

      <div style={{ marginTop: "24px", marginBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Панель наставника</h1>
        <p style={{ color: "var(--muted)", marginTop: "8px" }}>
          Здесь собраны ключевые метрики и курсы, чтобы быстро оценить прогресс и нагрузку.
        </p>
        {error && (
          <div style={{ marginTop: "8px", color: "#f87171", fontSize: "13px" }}>{error}</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ color: "var(--muted)", fontSize: "13px" }}>Всего учеников</div>
          <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "8px" }}>
            {formatNumber(favoriteUsersCount)}
          </div>
          <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>
            Пользователей, добавивших курсы в избранное
          </div>
        </div>
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ color: "var(--muted)", fontSize: "13px" }}>Доход (за месяц)</div>
          <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "8px" }}>
            {formatNumber(paymentAmount)}
          </div>
          <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>
            Выплатим в конце месяца
          </div>
        </div>
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ color: "var(--muted)", fontSize: "13px" }}>Активные курсы</div>
          <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "8px" }}>
            {formatNumber(activeCoursesCount)}
          </div>
          <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>
            Ср. оценка: {formatRating(averageRating)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginTop: "20px" }}>
        <button className="btn btn-primary" onClick={() => navigate("/course/create")}>+ Создать новый курс</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "20px", marginTop: "24px" }}>
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--glass)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Мои курсы</h3>
              <div style={{ color: "var(--muted)", fontSize: "13px" }}>
                {coursesPageCount} курсов на странице
              </div>
            </div>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.7fr 0.9fr 1fr", gap: "12px", padding: "12px 0", fontSize: "13px", fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #4f46e5, #4338ca)", marginTop: "12px", borderRadius: "10px 10px 0 0" }}>
              <div style={{ paddingLeft: "12px" }}>Курс</div>
              <div>Число студентов</div>
              <div>Оценка</div>
              <div>Статус</div>
              <div>Действия</div>
            </div>
            {courses.map((course) => (
              <div
                key={course.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 0.8fr 0.7fr 0.9fr 1fr",
                  gap: "12px",
                  padding: "14px 12px",
                  borderBottom: "1px solid var(--glass)"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{course.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>{course.subtitle}</div>
                </div>
                <div style={{ alignSelf: "center" }}>{formatNumber(course.students)}</div>
                <div style={{ alignSelf: "center" }}>{course.rating.toFixed(1)}</div>
                <div style={{ alignSelf: "center" }}>
                  <span style={{ ...statusStyles[course.status], padding: "4px 10px", borderRadius: "999px", fontSize: "12px" }}>
                    {getStatusLabel(course.status)}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button className="btn btn-ghost" onClick={() => navigate(`/courses/${course.id}`)} style={{ padding: "6px 10px" }}>Просмотр</button>
                  <button className="btn btn-ghost" onClick={() => navigate(`/course/edit/${course.id}`)} style={{ padding: "6px 10px" }}>Изменить</button>
                </div>
              </div>
            ))}
            {!isLoading && courses.length === 0 && (
              <div style={{ padding: "16px 12px", color: "var(--muted)", fontSize: "13px" }}>
                Курсы пока не найдены.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px", marginTop: "32px" }}>
        {[
          { label: "Число курсов на сайте", value: formatNumber(siteCoursesCount) },
          { label: "Активных менторов", value: formatNumber(siteMentorsCount) },
          { label: "Пользователей", value: formatNumber(siteUsersCount) }
        ].map((item) => (
          <div
            key={item.label}
            className="card"
            style={{
              padding: "16px",
              textAlign: "center",
              background: "linear-gradient(135deg, #4f46e5, #4338ca)",
              color: "#fff"
            }}
          >
            <div style={{ fontSize: "13px", opacity: 0.85 }}>{item.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "6px" }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
