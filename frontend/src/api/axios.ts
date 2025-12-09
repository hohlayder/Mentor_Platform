import axios, { AxiosInstance } from 'axios'
import { refreshToken } from './auth.api'


export const API_BASE = 'http://localhost:8080/api/v1'


const api: AxiosInstance = axios.create({
baseURL: API_BASE,
headers: { 'Content-Type': 'application/json' },
})


let isRefreshing = false
let subscribers: ((token: string) => void)[] = []


function onRefreshed(token: string) {
subscribers.forEach((cb) => cb(token))
subscribers = []
}


function addSubscriber(cb: (token: string) => void) {
subscribers.push(cb)
}


api.interceptors.request.use((config) => {
const token = sessionStorage.getItem('access_token')
if (token && config.headers) config.headers.Authorization = `Bearer ${token}`
return config
})


api.interceptors.response.use(
(res) => res,
async (error) => {
const originalRequest = error.config
if (error.response && error.response.status === 401 && !originalRequest._retry) {
if (isRefreshing) {
return new Promise((resolve) => {
addSubscriber((token: string) => {
originalRequest.headers.Authorization = `Bearer ${token}`
resolve(api(originalRequest))
})
})
}


originalRequest._retry = true
isRefreshing = true
try {
const refresh = localStorage.getItem('refresh_token')
if (!refresh) throw new Error('no refresh')
const data = await refreshToken({ refresh_token: refresh })
sessionStorage.setItem('access_token', data.access_token)
localStorage.setItem('refresh_token', data.refresh_token)
onRefreshed(data.access_token)
originalRequest.headers.Authorization = `Bearer ${data.access_token}`
return api(originalRequest)
} catch (e) {
sessionStorage.removeItem('access_token')
localStorage.removeItem('refresh_token')
window.location.href = '/login'
return Promise.reject(e)
} finally {
isRefreshing = false
}
}
return Promise.reject(error)
}
)

export default api