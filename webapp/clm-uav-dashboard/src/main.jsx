import React, { useEffect, useState } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import { auth } from './firebase.js'
import App from './App.jsx'
import SignIn from './signin.jsx'
import { onAuthStateChanged } from 'firebase/auth'

function Root() {
  const [initializing, setInitializing] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setInitializing(false)
    })
    return () => unsub()
  }, [])

  if (initializing) return <div style={{color: '#fff', textAlign: 'center', marginTop: 40}}>Loading…</div>
  return user ? <App /> : <SignIn />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
