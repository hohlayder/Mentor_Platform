import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Login } from "./pages/Login"
import { Home } from "./pages/Home"
import { Register } from "./pages/Register"
import Profile from "./pages/Profile";
import CoursesPage from './pages/Courses'
import NotificationsPage from './pages/Notifications'
import { AuthProvider } from "./store/AuthContext";

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
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/courses" element={<CoursesPage />} />

          <Route path="*" element={<div>404 - Страница не найдена</div>} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}