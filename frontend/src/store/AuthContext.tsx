import React, { createContext, useState, useEffect } from 'react'
import { refreshToken as apiRefresh } from '../api/auth.api'


type AuthContextType = {
token: string | null
setToken: (t: string | null) => void
logout: () => void
}


export const AuthContext = createContext<AuthContextType>({
token: null,
setToken: () => {},
logout: () => {}
})


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('access_token'))


useEffect(() => {
sessionStorage.setItem('access_token', token ?? '')
}, [token])


const logout = async () => {
// optionally call /auth/logout via api
sessionStorage.removeItem('access_token')
localStorage.removeItem('refresh_token')
setToken(null)
window.location.href = '/login'
}


// auto refresh on mount if refresh token present and no access token
useEffect(() => {
const tryRefresh = async () => {
if (!token) {
const refresh = localStorage.getItem('refresh_token')
if (refresh) {
try {
const data = await apiRefresh({ refresh_token: refresh })
setToken(data.access_token)
localStorage.setItem('refresh_token', data.refresh_token)
} catch (e) {
// ignore
}
}
}
}


tryRefresh()
}, [])


return (
<AuthContext.Provider value={{ token, setToken, logout }}>
{children}
</AuthContext.Provider>
)
}