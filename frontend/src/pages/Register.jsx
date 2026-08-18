import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import NarLoader from '../components/Loader';
import ThemeToggle from '../components/ThemeToggle';
import { usePageTitle } from '../hooks/usePageTitle';
import './Auth.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  usePageTitle('Create account');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || success) return;
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const result = await register(name, email, password);
    if (result.success) {
      setSuccess(true);
      navigate('/verify-email', { state: { email } });
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
        <Link to="/" className="auth-link">
          <ArrowLeft size={17} />
          Back to rooms
        </Link>

        <div className="auth-header">
          <h1>Create account</h1>
          <p>Join rooms and chat securely</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="status">
            <CheckCircle size={18} />
            Account created. Check your email to verify it.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="register-name">Full name</label>
            <div className="input-with-icon">
              <User size={18} className="field-icon" />
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="register-email">Email address</label>
            <div className="input-with-icon">
              <Mail size={18} className="field-icon" />
              <input
                id="register-email"
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
            <label htmlFor="register-password">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

          <div className="input-group">
            <label htmlFor="register-confirm">Confirm password</label>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                id="register-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-full-btn" disabled={loading || success}>
            {loading ? <NarLoader size="sm" label="Creating account" /> : (
              <>
                <UserPlus size={20} />
                Register
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
