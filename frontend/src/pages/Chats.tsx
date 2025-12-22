import React, { useEffect, useState } from 'react'
import { getChats } from '../api/chats.api'
import { Link } from 'react-router-dom'


export default function ChatsPage() {
const [chats, setChats] = useState<any[]>([])
const [loading, setLoading] = useState(false)


useEffect(()=>{
setLoading(true)
getChats().then((d)=>setChats(d.chats || [])).catch(()=>{}).finally(()=>setLoading(false))
},[])


return (
<div className="app">
<div className="header">
<h2>Chats</h2>
<div>
<a href="/profile/me">Profile</a>
</div>
</div>


<div style={{ display:'grid', gap:8 }}>
{loading && <div className="card">Loading...</div>}
{chats.map((c)=> (
<Link key={c.id} to={`/chats/${c.id}`} className="card" style={{ textDecoration:'none', color:'inherit' }}>
<div style={{ display:'flex', justifyContent:'space-between' }}>
<div>
<div><strong>{c.id}</strong></div>
<div style={{ fontSize:12, color:'#666' }}>{c.last_message?.content || '—'}</div>
</div>
<div style={{ textAlign:'right' }}>
<div>{c.unread_count || 0}</div>
<div style={{ fontSize:12 }}>{c.updated_at}</div>
</div>
</div>
</Link>
))}
{chats.length === 0 && !loading && <div className="card">No chats</div>}
</div>
</div>
)
}