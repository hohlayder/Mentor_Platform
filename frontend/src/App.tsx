import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Login } from "./pages/Login"
import { Home } from "./pages/Home"
import { Register } from "./pages/Register"
import Profile from "./pages/Profile";
import CoursesPage from './pages/Courses'
import { AuthProvider } from "./store/AuthContext";
import CourseFormPage from "./pages/CourseFormPage";
import EditProfilePage from './pages/ProfileEdit';
import CoursePage from './pages/Course';
import CourseEnrollmentPage from './pages/CourseEnrollPage';
import CreateSlotsPage from "./pages/ManageSlotsPage";
import Chats from './pages/Chats'; // Импортируем новый компонент


console.log("🚀 App.tsx запускается!")

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/profile/:id/edit" element={<EditProfilePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:id" element={<CoursePage />} />
          <Route path="/course/create" element={<CourseFormPage />} />
          <Route path="/course/edit/:id" element={<CourseFormPage />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/course/:id/enroll" element={<CourseEnrollmentPage />} />
          <Route path="/course/:id/create-slots" element={<CreateSlotsPage />} />

          <Route path="*" element={<div>404 - Страница не найдена</div>} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}