import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProfile, updateProfile } from '../api/profiles.api'


export default function ProfilePage() {
const { id } = useParams()
const [profile, setProfile] = useState<any>(null)
const [editing, setEditing] = useState(false)
const [form, setForm] = useState<any>({})


useEffect(()=>{
if (!id) return
getProfile(id).then(d=>{
setProfile(d)
setForm(d.user || {})
}).catch(()=>{})
},[id])


const save = async () => {
try {
await updateProfile(id!, { ...form })
alert('saved')
setEditing(false)
} catch (e:any) { alert(e.message || 'failed') }
}


if (!profile) return <div className="app">Loading...</div>


return (
<div className="app">
<h2>Profile</h2>
<div className="card">
{!editing ? (
<div>
<div><strong>{profile.user?.first_name} {profile.user?.last_name}</strong></div>
<div>{profile.user?.email}</div>
<div style={{ marginTop:8 }}>
<button className="btn" onClick={()=>setEditing(true)}>Edit</button>
</div>
</div>
) : (
<div>
<input className="input" value={form.first_name||''} onChange={e=>setForm({...form, first_name:e.target.value})} />
<input className="input" value={form.last_name||''} onChange={e=>setForm({...form, last_name:e.target.value})} />
<input className="input" value={form.email||''} onChange={e=>setForm({...form, email:e.target.value})} />
<div style={{ marginTop:8 }}>
<button className="btn" onClick={save}>Save</button>
<button className="btn" onClick={()=>setEditing(false)}>Cancel</button>
</div>
</div>
)}
</div>
</div>
)
}