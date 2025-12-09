import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getChatMessages, markMessagesRead } from '../api/chats.api'


export default function ChatView() {
const { id } = useParams()
const [messages, setMessages] = useState<any[]>([])
const [loading, setLoading] = useState(false)


useEffect(()=>{
if (!id) return
setLoading(true)
getChatMessages(id).then((d)=>{
setMessages(d.messages || [])
// mark first batch as read
const ids = (d.messages || []).map((m:any)=>m.id)
if (ids.length) markMessagesRead(id, ids).catch(()=>{})
}).catch(()=>{}).finally(()=>setLoading(false))
}, [id])


return (
<div className="app">
<h3>Chat {id}</h3>
<div style={{ display:'grid', gap:8 }}>
{loading && <div className="card">Loading...</div>}
{messages.map(m => (
<div key={m.id} className="card">
<div style={{ fontSize:12, color:'#666' }}>{m.sender_id} • {m.created_at}</div>
<div style={{ marginTop:8 }}>{m.content}</div>
</div>
))}
</div>
</div>
)
}