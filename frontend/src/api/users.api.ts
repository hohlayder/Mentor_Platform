import api from './axios'


export const getUserById = async (id: string) => {
const { data } = await api.get(`/users/${id}`)
return data
}


export const getUserByEmail = async (email: string) => {
const { data } = await api.get(`/users/email/${encodeURIComponent(email)}`)
return data
}


export const deleteUser = async (id: string) => {
const res = await api.delete(`/users/${id}`)
return res.status === 204
}