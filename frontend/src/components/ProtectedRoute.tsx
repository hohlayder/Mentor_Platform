import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../store/AuthContext'


const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
const { token } = useContext(AuthContext)
if (!token) return <Navigate to="/login" />
return children
}

export default ProtectedRoute