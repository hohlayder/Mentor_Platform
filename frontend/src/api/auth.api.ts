import api, { API_BASE } from './axios'


export const login = async (payload: { email: string; password: string }) => {
const { data } = await api.post('/auth/login', payload)
return data
}


export const register = async (payload: { email: string; name: string; password: string; surname: string }) => {
const { data } = await api.post('/auth/register', payload)
return data
}


export const refreshToken = async (payload: { refresh_token: string }) => {
// use raw fetch to avoid interceptor loops
const res = await fetch(`${API_BASE}/auth/refresh`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
})
if (!res.ok) throw new Error('refresh failed')
return res.tson()
}


export const logout = async (payload: { refresh_token: string }) => {
const { data } = await api.post('/auth/logout', payload)
return data
}