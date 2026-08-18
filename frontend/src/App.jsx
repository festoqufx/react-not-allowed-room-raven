import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import SplashScreen from './components/SplashScreen';
import NarLoader from './components/Loader';

import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import ChatRoom from './pages/ChatRoom';

const ProtectedRoute = ({ children, allowGuest = false }) => {
  const { token, loading } = useAuth();

  if (loading) return (
    <NarLoader fullscreen label="Loading session…" />
  );

  if (!token && !allowGuest) return <Navigate to="/login" />;

  return children;
};

const App = () => {
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('nar_splash_done') === '1'
  );

  const handleSplashDone = () => {
    sessionStorage.setItem('nar_splash_done', '1');
    setSplashDone(true);
  };

  return (
    <ThemeProvider>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}

      <Router>
        <AuthProvider>
          <SocketProvider>
            <div className="app-shell">
              <a className="skip-link" href="#main">Skip to content</a>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute allowGuest={true}>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/room/:id"
                  element={
                    <ProtectedRoute allowGuest={true}>
                      <ChatRoom />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
