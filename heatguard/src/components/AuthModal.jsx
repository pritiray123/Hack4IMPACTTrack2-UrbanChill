import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = isLogin ? `${API_BASE_URL}/api/auth/login` : `${API_BASE_URL}/api/auth/signup`;
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      login(data.user, data.token);
      closeAuthModal();
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeAuthModal} style={overlayStyle}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={contentStyle}>
        <h2>{isLogin ? 'Login to HeatGuard' : 'Sign Up for HeatGuard'}</h2>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '10px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            required
          />
          <button type="submit" style={btnStyle}>{isLogin ? 'Login' : 'Sign Up'}</button>
        </form>
        <button 
          onClick={() => setIsLogin(!isLogin)}
          style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--border)', marginTop: '10px' }}
        >
          {isLogin ? 'Create an account instead' : 'Already have an account? Login'}
        </button>
        <button onClick={closeAuthModal} style={{...btnStyle, background: 'var(--danger)', marginTop: '10px'}}>Close</button>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999
};

const contentStyle = {
  background: 'var(--surface2)', padding: '20px', borderRadius: '8px',
  width: '300px', border: '1px solid var(--border)', color: 'var(--text)'
};

const inputStyle = {
  padding: '10px', borderRadius: '4px', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)'
};

const btnStyle = {
  padding: '10px', borderRadius: '4px', border: 'none',
  background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
};
