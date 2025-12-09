import api from './axios'


export const getProfile = async (id: string) => {
const { data } = await api.get(`/profiles/${id}`)
return data
}


export const updateProfile = async (id: string, payload: any) => {
const { data } = await api.put(`/profiles/${id}`, payload)
return data
}