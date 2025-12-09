import api from './axios'


export const getChats = async (limit = 20, offset = 0) => {
const { data } = await api.get(`/chats?limit=${limit}&offset=${offset}`)
return data
}


export const createChat = async (other_user_id: string) => {
const { data } = await api.post('/chats', { other_user_id })
return data
}


export const getChatMessages = async (chat_id: string, limit = 50, cursor?: string) => {
const qs = new URLSearchParams({ chat_id, limit: String(limit) })
if (cursor) qs.append('cursor', cursor)
const { data } = await api.get(`/chats/messages?${qs.toString()}`)
return data
}


export const markMessagesRead = async (chat_id: string, message_ids: string[]) => {
const { data } = await api.post('/chats/messages/read', { chat_id, message_ids })
return data
}