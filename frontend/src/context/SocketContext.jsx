import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL } from '../lib/config';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    // Same-origin by default so the Vite/nginx proxy can forward websocket traffic.
    const newSocket = io(SOCKET_URL || undefined, {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to realtime server:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Realtime connection retrying:', err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
