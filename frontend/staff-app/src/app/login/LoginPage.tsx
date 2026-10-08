import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import logo from '@/assets/Sk-logo.png';

const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(`DEBUG ERROR: ${err.message || 'unknown'} - Name: ${err.name || 'unknown'}. Code: ${err.code || 'unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ justifyContent: 'center' }}>
      <div className="page-container" style={{ textAlign: 'center' }}>
        {/* Logo */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 20,
            background: '#fff',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <img src={logo} alt="App logo" style={{ width: 72, height: 72, objectFit: 'contain' }} />
        </div>

        <h1 className="t-page-title" style={{ fontSize: 24 }}>Staff Attendance</h1>
        <p className="t-muted" style={{ marginTop: 6, fontSize: 14 }}>
          Track your attendance securely and effortlessly.
        </p>

        <form onSubmit={handleLogin} style={{ marginTop: 32, textAlign: 'left' }}>
          <div className="field">
            <label className="field-label">Username</label>
            <input
              className="field-input"
              type="text"
              value={username}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Enter your username"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <input
              className="field-input"
              type="password"
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="loc-note err" style={{ marginBottom: 16 }}>
              <ion-icon name="alert-circle-outline" style={{ fontSize: 18 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p className="t-muted" style={{ fontSize: 13 }}>
            Note: If you have forgotten your password, please contact your administrator to reset it.
          </p>
        </div>

        <p className="t-tiny" style={{ textAlign: 'center', marginTop: 16 }}>
          Version 1.0
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
