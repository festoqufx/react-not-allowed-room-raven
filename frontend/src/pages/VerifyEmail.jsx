import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, CheckCircle, Mail } from 'lucide-react';
import NarLoader from '../components/Loader';
import ThemeToggle from '../components/ThemeToggle';
import { apiUrl } from '../lib/config';
import { usePageTitle } from '../hooks/usePageTitle';
import './Auth.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token');
  const [email, setEmail] = useState(location.state?.email || '');
  const [status, setStatus] = useState(token ? 'verifying' : 'pending');
  const [message, setMessage] = useState(
    token ? 'Verifying your email...' : 'We sent a verification link to your email address.'
  );
  const [resending, setResending] = useState(false);
  const verificationStarted = useRef(false);
  const API_URL = apiUrl('/api/v1/auth');
  usePageTitle('Verify email');

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;

    axios.post(`${API_URL}/verify_email`, { token })
      .then((response) => {
        setStatus('success');
        setMessage(response.data.message);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Email verification failed');
      });
  }, [API_URL, token]);

  const handleResend = async (event) => {
    event.preventDefault();
    if (!email || resending) return;

    setResending(true);
    try {
      const response = await axios.post(`${API_URL}/resend_verification`, { email });
      setStatus('pending');
      setMessage(response.data.message);
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Could not resend the verification email');
    } finally {
      setResending(false);
    }
  };

  const icon = status === 'success'
    ? <CheckCircle size={48} />
    : status === 'error'
      ? <AlertCircle size={48} />
      : <Mail size={48} />;

  return (
    <div className="auth-page">
      <div className="auth-toolbar">
        <ThemeToggle compact />
      </div>
      <div className="glass card auth-card" id="main" style={{ textAlign: 'center' }}>
        <div className="auth-icon-block">
          {status === 'verifying' ? <NarLoader size="sm" label="Verifying email" /> : icon}
        </div>
        <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '12px' }}>
          {status === 'success' ? 'Email verified' : 'Verify your email'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{message}</p>

        {status === 'success' ? (
          <Link to="/login" className="btn btn-primary auth-full-btn">
            Continue to login
          </Link>
        ) : status !== 'verifying' && (
          <form onSubmit={handleResend}>
            <div className="input-group" style={{ textAlign: 'left' }}>
              <label htmlFor="verify-email">Email address</label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            <button className="btn btn-primary auth-full-btn" disabled={resending}>
              {resending ? <NarLoader size="sm" label="Sending" /> : 'Resend verification email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
