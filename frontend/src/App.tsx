import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Login } from "./pages/Login"
import { Home } from "./pages/Home"
import { Register } from "./pages/Register"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
         <Route path="/signup" element={<Register />} />
      </Routes>
    </Router>
  )
}