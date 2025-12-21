// Базовые типы на основе Swagger
export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface MentorProfile {
  user_id: string;
  description?: string;
  rating?: number;
  withdrawal_address?: string;
  created_at: string;
}

export interface StudentProfile {
  user_id: string;
  learning_goals?: string;
  preferred_learning_style?: string;
  created_at: string;
}

export interface TeachingSkill {
  skill_id: string;
  skill_name: string;
  proficiency_level: string;
  years_of_experience?: number;
  user_id: string;
  created_at: string;
}

export interface LearningSkill {
  skill_id: string;
  skill_name: string;
  proficiency_level: string;
  user_id: string;
  created_at: string;
}

export interface ProfileResponse {
  user: User;
  mentor?: MentorProfile;
  student?: StudentProfile;
  teaching_skills?: TeachingSkill[];
  learning_skills?: LearningSkill[];
}

// Типы для курсов (posts)
export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  average_rating?: number;
  ratings_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ListPostsResponse {
  posts: Post[];
  next_page_token?: string;
  total_count: number;
}

// Состояние загрузки
export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

// Контекст аутентификации
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}