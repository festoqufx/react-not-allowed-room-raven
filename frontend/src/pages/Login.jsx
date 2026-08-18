import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import NarLoader from '../components/Loader';
import ThemeToggle from '../components/ThemeToggle';
import { usePageTitle } from '../hooks/usePageTitle';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  usePageTitle('Sign in');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-toolbar">
        <ThemeToggle compact />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass card auth-card"
        id="main"
      >
        <div className="auth-brand">
          <img src="/favicon.svg" alt="" />
          <strong>NotAllowedRoom</strong>
        </div>
        <div className="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to manage your rooms</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="login-email">Email address</label>
            <div className="input-with-icon">
              <Mail size={18} className="field-icon" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-full-btn" disabled={loading}>
            {loading ? <NarLoader size="sm" label="Signing in" /> : (
              <>
                <LogIn size={20} />
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>

        <Link to="/" className="btn btn-secondary auth-full-btn" style={{ marginTop: '16px' }}>
          <ArrowLeft size={18} />
          Back to rooms
        </Link>
      </motion.div>
    </div>
  );
};

export default Login;
