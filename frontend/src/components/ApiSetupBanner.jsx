import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getBackendUrl, setBackendUrl } from '../lib/config';
import './ApiSetupBanner.css';

const ApiSetupBanner = () => {
  const [value, setValue] = useState(getBackendUrl());
  const [error, setError] = useState('');

  if (getBackendUrl() || import.meta.env.DEV) return null;

  const save = (event) => {
    event.preventDefault();
    const next = value.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(next)) {
      setError('Enter a full API origin, for example https://api.example.com');
      return;
    }
    if (window.isSecureContext && next.startsWith('http://')) {
      setError('This site is https, so the API URL must also use https.');
      return;
    }
    setBackendUrl(next);
    window.location.reload();
  };

  return (
    <div className="api-setup-banner" role="alert">
      <div className="api-setup-copy">
        <AlertTriangle size={18} />
        <div>
          <strong>API is not configured</strong>
          <p>
            The camera and rooms never start on this Vercel site because no backend URL was set at build time.
            Add <code>VITE_BACKEND_URL</code> in Vercel, or paste your public API origin below. Then open a room and tap the camera icon.
          </p>
        </div>
      </div>
      <form className="api-setup-form" onSubmit={save}>
        <input
          type="url"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
          placeholder="https://your-api.example.com"
          aria-label="API origin"
        />
        <button type="submit" className="btn btn-primary">Save and reload</button>
      </form>
      {error && <p className="api-setup-error">{error}</p>}
    </div>
  );
};

export default ApiSetupBanner;
