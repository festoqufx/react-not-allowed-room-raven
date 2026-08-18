import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { isApiConfigured } from '../lib/config';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
  const socket = useSocket();
  const [online, setOnline] = useState(Boolean(socket?.connected));

  useEffect(() => {
    if (!socket) {
      setOnline(false);
      return undefined;
    }

    const onConnect = () => setOnline(true);
    const onDisconnect = () => setOnline(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setOnline(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  if (!isApiConfigured) {
    return (
      <div className="connection-status offline" role="status">
        <span className="connection-dot" />
        API not configured
      </div>
    );
  }

  return (
    <div className={`connection-status ${online ? 'online' : 'offline'}`} role="status">
      <span className="connection-dot" />
      {online ? 'Live' : 'Reconnecting'}
    </div>
  );
};

export default ConnectionStatus;
