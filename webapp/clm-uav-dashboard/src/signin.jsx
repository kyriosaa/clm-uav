import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase.js';

export default function SignInVisual() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Error signing in');
      setLoading(false);
    }
  };

  return (
    <div className="viewer-outer">
      <div className="viewer-inner signin-container">

        <form className="controls-panel signin-form" onSubmit={handleSignIn}>
          <label>E‑Mail</label>
          <input className="signin-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@mail.tw" />

          <label>Passwort</label>
          <input className="signin-input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />

          {error && <div style={{ color: '#ff6b6b' }}>{error}</div>}

          <div className="control-row signin-actions" style={{ marginTop: 12 }}>
            <button type="submit" className="signin-btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
          </div>
        </form>
      </div>
    </div>
  );

}
