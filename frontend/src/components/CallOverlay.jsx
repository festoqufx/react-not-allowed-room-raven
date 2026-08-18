import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Maximize2, Settings, Volume2, MessageSquare, X, Send, Smile, Trash2, CheckSquare,
  SwitchCamera, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import MediaVideo from './MediaVideo';
import {
  getUserMediaWithFallback,
  listMediaDevices,
  stopStream,
  replaceStreamTrack,
  getIceServers,
  getMediaErrorMessage,
  canUseMediaDevices,
} from '../lib/media';

const CallOverlay = ({
  roomId,
  isRoomJoined,
  onLeave,
  onEndCall,
  initialVideo = true,
  initialMuted = false,
  localUserName = 'You',
  messages = [],
  currentUser,
  token,
  guestId,
  selectedMessageIds = new Set(),
  onToggleMessageSelect,
  onDeleteSelectedMessages,
  chatInput = '',
  setChatInput,
  onSendMessage
}) => {
  const socket = useSocket();
  const { theme } = useTheme();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [callParticipants, setCallParticipants] = useState({});
  const [participantOrder, setParticipantOrder] = useState(['local']);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isCameraOff, setIsCameraOff] = useState(!initialVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [remoteAudioSpeaks, setRemoteAudioSpeaks] = useState({});
  const [devices, setDevices] = useState({ video: [], audio: [] });
  const [selectedDevices, setSelectedDevices] = useState({ videoId: '', audioId: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [openDeviceMenu, setOpenDeviceMenu] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [screenDisplaySurface, setScreenDisplaySurface] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [mediaLoading, setMediaLoading] = useState(true);
  const [connectionStates, setConnectionStates] = useState({});

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const screenStreamRef = useRef(null);
  const actionsRef = useRef({});
  const isInitializing = useRef(false);
  const hasJoinedCall = useRef(false);
  const makingOfferRef = useRef({});
  const ignoreOfferRef = useRef({});
  const iceCandidatesQueue = useRef({});
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const startMediaRef = useRef(null);
  const initialVideoRef = useRef(initialVideo);
  const initialMutedRef = useRef(initialMuted);

  const localInitials = (localUserName || 'You').slice(0, 2).toUpperCase();

  const getOutgoingVideoTrack = () => (
    screenStreamRef.current?.getVideoTracks()[0] ||
    localStreamRef.current?.getVideoTracks()[0] ||
    null
  );

  const refreshDevices = useCallback(async () => {
    try {
      const nextDevices = await listMediaDevices();
      setDevices({ video: nextDevices.video, audio: nextDevices.audio });
      setSelectedDevices((prev) => ({
        videoId: prev.videoId || nextDevices.video[0]?.deviceId || '',
        audioId: prev.audioId || nextDevices.audio[0]?.deviceId || '',
      }));
      return nextDevices;
    } catch (err) {
      console.error('Error fetching devices:', err);
      return { video: [], audio: [], audioOutput: [] };
    }
  }, []);

  const applyInitialTrackState = (stream) => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !initialMutedRef.current;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = initialVideoRef.current;
    });
    setIsMuted(initialMutedRef.current);
    setIsCameraOff(!stream.getVideoTracks().length || !initialVideoRef.current);
  };

  const startMedia = useCallback(async ({ videoDeviceId = '', audioDeviceId = '', facingMode = 'user' } = {}) => {
    setMediaLoading(true);
    setMediaError('');

    const stream = await getUserMediaWithFallback({
      video: true,
      audio: true,
      videoDeviceId,
      audioDeviceId,
      facingMode,
    });

    applyInitialTrackState(stream);
    const previous = localStreamRef.current;
    localStreamRef.current = stream;
    setLocalStream(stream);
    if (previous && previous !== stream) stopStream(previous);

    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (localStreamRef.current?.getVideoTracks()[0] === track) {
          setIsCameraOff(true);
          setMediaError('Camera disconnected. Choose another camera or retry.');
        }
      };
    });

    await refreshDevices();
    setSelectedDevices((prev) => ({
      videoId: stream.getVideoTracks()[0]?.getSettings?.().deviceId || prev.videoId,
      audioId: stream.getAudioTracks()[0]?.getSettings?.().deviceId || prev.audioId,
    }));
    setMediaLoading(false);
    return stream;
  }, [refreshDevices]);

  useEffect(() => {
    startMediaRef.current = startMedia;
  }, [startMedia]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!canUseMediaDevices()) {
        setMediaLoading(false);
        setMediaError(getMediaErrorMessage({ name: 'CAMERA_UNSUPPORTED' }));
        return;
      }

      try {
        await refreshDevices();
        const stream = await startMediaRef.current();
        if (cancelled) {
          stopStream(stream);
        }
      } catch (error) {
        if (!cancelled) {
          setMediaLoading(false);
          setMediaError(getMediaErrorMessage(error));
        }
      }
    };

    boot();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      stopStream(screenStreamRef.current);
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
      screenStreamRef.current = null;
    };
  }, [refreshDevices]);

  const replaceSenderTrack = (kind, track) => {
    Object.values(peersRef.current).forEach((peer) => {
      const sender = peer.getSenders().find((item) => (
        item.track?.kind === kind ||
        (!item.track && peer.getTransceivers().some((transceiver) => (
          transceiver.sender === item && transceiver.receiver.track?.kind === kind
        )))
      ));
      if (sender) sender.replaceTrack(track);
      else if (track && localStreamRef.current) peer.addTrack(track, localStreamRef.current);
    });
  };

  const changeDevice = async (type, deviceId) => {
    if (!deviceId) return;
    try {
      setMediaError('');
      const newStream = await getUserMediaWithFallback({
        video: type === 'video' ? true : Boolean(localStreamRef.current?.getVideoTracks().length),
        audio: type === 'audio' ? true : Boolean(localStreamRef.current?.getAudioTracks().length),
        videoDeviceId: type === 'video' ? deviceId : selectedDevices.videoId,
        audioDeviceId: type === 'audio' ? deviceId : selectedDevices.audioId,
      });
      const newTrack = type === 'video' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
      if (!newTrack) {
        stopStream(newStream);
        throw new Error('No media track returned for that device.');
      }

      if (!localStreamRef.current) {
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      } else {
        replaceStreamTrack(localStreamRef.current, newTrack);
        setLocalStream(localStreamRef.current);
        newStream.getTracks().forEach((track) => {
          if (track !== newTrack) track.stop();
        });
      }

      if (type === 'video') {
        newTrack.enabled = true;
        setIsCameraOff(false);
        if (!isScreenSharing) replaceSenderTrack('video', newTrack);
      } else {
        newTrack.enabled = true;
        setIsMuted(false);
        replaceSenderTrack('audio', newTrack);
      }

      setSelectedDevices((prev) => ({
        ...prev,
        [type === 'video' ? 'videoId' : 'audioId']: deviceId,
      }));
      await refreshDevices();
    } catch (err) {
      setMediaError(getMediaErrorMessage(err));
    }
  };

  const createPeer = (targetSocketId, user) => {
    if (peersRef.current[targetSocketId]) return peersRef.current[targetSocketId];

    const peer = new RTCPeerConnection({
      iceServers: getIceServers(),
      iceCandidatePoolSize: 4,
    });

    peersRef.current[targetSocketId] = peer;
    makingOfferRef.current[targetSocketId] = false;
    ignoreOfferRef.current[targetSocketId] = false;
    iceCandidatesQueue.current[targetSocketId] = [];
    setConnectionStates((prev) => ({ ...prev, [targetSocketId]: 'connecting' }));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('call_signal', {
          to: targetSocketId,
          signal: { type: 'ice-candidate', candidate: event.candidate }
        });
      }
    };

    peer.ontrack = (event) => {
      const incoming = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams((prev) => {
        const current = prev[targetSocketId]?.stream;
        if (current) {
          if (!current.getTracks().includes(event.track)) current.addTrack(event.track);
          return { ...prev, [targetSocketId]: { stream: current, user } };
        }
        return { ...prev, [targetSocketId]: { stream: incoming, user } };
      });
    };

    peer.onnegotiationneeded = async () => {
      try {
        if (makingOfferRef.current[targetSocketId] || peer.signalingState !== 'stable') return;
        makingOfferRef.current[targetSocketId] = true;
        await peer.setLocalDescription();
        socket.emit('call_signal', { to: targetSocketId, signal: peer.localDescription });
      } catch (err) {
        console.error(`[WebRTC] Negotiation failed for ${targetSocketId}:`, err);
      } finally {
        makingOfferRef.current[targetSocketId] = false;
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      setConnectionStates((prev) => ({ ...prev, [targetSocketId]: state }));
      if (state === 'failed') {
        try { peer.restartIce(); } catch { /* ignore */ }
      }
    };

    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const videoTrack = getOutgoingVideoTrack();
    const outbound = localStreamRef.current || new MediaStream();

    if (audioTrack) peer.addTrack(audioTrack, outbound);
    else peer.addTransceiver('audio', { direction: 'sendrecv' });

    if (videoTrack) peer.addTrack(videoTrack, screenStreamRef.current || outbound);
    else peer.addTransceiver('video', { direction: 'sendrecv' });

    return peer;
  };

  const handleUserJoined = ({ socket_id, user }) => {
    if (!socket?.id || socket_id === socket.id) return;
    setCallParticipants((prev) => ({ ...prev, [socket_id]: user }));
    createPeer(socket_id, user);
  };

  const handleCurrentParticipants = ({ participants }) => {
    const newParticipants = {};
    participants.forEach(({ socket_id, user }) => {
      if (socket_id !== socket.id) {
        newParticipants[socket_id] = user;
        createPeer(socket_id, user);
      }
    });
    setCallParticipants((prev) => ({ ...prev, ...newParticipants }));
  };

  const handleSignal = async ({ signal, from, user }) => {
    let peer = peersRef.current[from];
    if (!peer) peer = createPeer(from, user);

    try {
      if (signal.type === 'offer') {
        const polite = socket.id > from;
        const offerCollision = (makingOfferRef.current[from] || peer.signalingState !== 'stable');
        ignoreOfferRef.current[from] = !polite && offerCollision;
        if (ignoreOfferRef.current[from]) return;

        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        await peer.setLocalDescription();
        socket.emit('call_signal', { to: from, signal: peer.localDescription });

        for (const candidate of iceCandidatesQueue.current[from] || []) {
          await peer.addIceCandidate(candidate).catch(() => {});
        }
        iceCandidatesQueue.current[from] = [];
      } else if (signal.type === 'answer') {
        if (peer.signalingState === 'have-local-offer') {
          await peer.setRemoteDescription(new RTCSessionDescription(signal));
          for (const candidate of iceCandidatesQueue.current[from] || []) {
            await peer.addIceCandidate(candidate).catch(() => {});
          }
          iceCandidatesQueue.current[from] = [];
        }
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        const candidate = new RTCIceCandidate(signal.candidate);
        if (peer.remoteDescription) {
          await peer.addIceCandidate(candidate).catch((err) => {
            if (!ignoreOfferRef.current[from]) console.warn(`[WebRTC] ICE error for ${from}:`, err);
          });
        } else {
          iceCandidatesQueue.current[from] = iceCandidatesQueue.current[from] || [];
          iceCandidatesQueue.current[from].push(candidate);
        }
      }
    } catch (err) {
      console.error(`[WebRTC] Signaling error with ${from}:`, err);
    }
  };

  const handleUserLeft = ({ socket_id }) => {
    if (peersRef.current[socket_id]) {
      peersRef.current[socket_id].close();
      delete peersRef.current[socket_id];
    }
    delete iceCandidatesQueue.current[socket_id];
    setCallParticipants((prev) => {
      const next = { ...prev };
      delete next[socket_id];
      return next;
    });
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socket_id];
      return next;
    });
    setConnectionStates((prev) => {
      const next = { ...prev };
      delete next[socket_id];
      return next;
    });
  };

  const signalHandlersRef = useRef({
    handleUserJoined,
    handleCurrentParticipants,
    handleSignal,
    handleUserLeft,
  });

  useEffect(() => {
    signalHandlersRef.current = {
      handleUserJoined,
      handleCurrentParticipants,
      handleSignal,
      handleUserLeft,
    };
  });

  useEffect(() => {
    if (!socket?.connected || !socket?.id || !isRoomJoined || !isJoined) return;

    const resetPeers = () => {
      Object.values(peersRef.current).forEach((peer) => peer.close());
      peersRef.current = {};
      iceCandidatesQueue.current = {};
      makingOfferRef.current = {};
      ignoreOfferRef.current = {};
      hasJoinedCall.current = false;
      setRemoteStreams({});
      setCallParticipants({});
      setConnectionStates({});
    };

    const init = () => {
      if (isInitializing.current || hasJoinedCall.current || !socket.id) return;
      isInitializing.current = true;
      hasJoinedCall.current = true;
      socket.emit('join_call', { room_id: roomId });
      isInitializing.current = false;
    };

    const onUserJoined = (payload) => signalHandlersRef.current.handleUserJoined(payload);
    const onCurrentParticipants = (payload) => signalHandlersRef.current.handleCurrentParticipants(payload);
    const onSignal = (payload) => signalHandlersRef.current.handleSignal(payload);
    const onUserLeft = (payload) => signalHandlersRef.current.handleUserLeft(payload);
    const onToggleMedia = ({ socket_id, type, status }) => {
      setCallParticipants((prev) => {
        const user = prev[socket_id];
        if (!user) return prev;
        return { ...prev, [socket_id]: { ...user, [type === 'mic' ? 'isMuted' : 'isCameraOff']: !status } };
      });
    };

    const onReconnect = () => {
      resetPeers();
      init();
    };

    socket.on('user_joined_call', onUserJoined);
    socket.on('current_participants', onCurrentParticipants);
    socket.on('call_signal', onSignal);
    socket.on('user_left_call', onUserLeft);
    socket.on('user_toggle_media', onToggleMedia);
    socket.on('connect', onReconnect);
    init();

    return () => {
      socket.emit('leave_call', { room_id: roomId });
      socket.off('user_joined_call', onUserJoined);
      socket.off('current_participants', onCurrentParticipants);
      socket.off('call_signal', onSignal);
      socket.off('user_left_call', onUserLeft);
      socket.off('user_toggle_media', onToggleMedia);
      socket.off('connect', onReconnect);
      resetPeers();
    };
  }, [socket, socket?.connected, socket?.id, roomId, isRoomJoined, isJoined]);

  useEffect(() => {
    if (!localStream || isMuted) {
      setLocalIsSpeaking(false);
      setMicLevel(0);
      return undefined;
    }
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId;
    let lastSpeaking = false;
    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i += 1) sum += dataArray[i];
      const average = sum / bufferLength;
      setMicLevel(Math.min(100, Math.floor(average * 1.5)));
      const speaking = average > 30;
      if (speaking !== lastSpeaking) {
        lastSpeaking = speaking;
        setLocalIsSpeaking(speaking);
      }
      animationId = requestAnimationFrame(checkVolume);
    };
    checkVolume();
    return () => {
      cancelAnimationFrame(animationId);
      audioContext.close();
    };
  }, [localStream, isMuted]);

  useEffect(() => {
    const remoteIds = Object.keys(callParticipants);
    setParticipantOrder((prev) => {
      const next = prev.filter((id) => id === 'local' || remoteIds.includes(id));
      remoteIds.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  }, [callParticipants]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream?.getAudioTracks().length) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
    if (isJoined) socket.emit('toggle_media', { room_id: roomId, type: 'mic', status: !nextMuted });
  };

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    let videoTrack = stream?.getVideoTracks()[0];

    if (!videoTrack || videoTrack.readyState === 'ended') {
      try {
        setMediaError('');
        const camStream = await getUserMediaWithFallback({
          video: true,
          audio: false,
          videoDeviceId: selectedDevices.videoId,
        });
        videoTrack = camStream.getVideoTracks()[0];
        if (!videoTrack) throw new Error('No camera track available.');
        if (!localStreamRef.current) {
          localStreamRef.current = camStream;
          setLocalStream(camStream);
        } else {
          replaceStreamTrack(localStreamRef.current, videoTrack);
          setLocalStream(localStreamRef.current);
          camStream.getTracks().forEach((track) => {
            if (track !== videoTrack) track.stop();
          });
        }
        if (!isScreenSharing) replaceSenderTrack('video', videoTrack);
        setIsCameraOff(false);
        if (isJoined) socket.emit('toggle_media', { room_id: roomId, type: 'video', status: true });
        await refreshDevices();
      } catch (error) {
        setMediaError(getMediaErrorMessage(error));
      }
      return;
    }

    const enable = !videoTrack.enabled;
    videoTrack.enabled = enable;
    setIsCameraOff(!enable);
    if (isJoined) socket.emit('toggle_media', { room_id: roomId, type: 'video', status: enable });
  };

  const flipCamera = async () => {
    const cameras = devices.video;
    if (cameras.length < 2) {
      const currentFacing = localStreamRef.current?.getVideoTracks()[0]?.getSettings?.().facingMode;
      try {
        const camStream = await getUserMediaWithFallback({
          video: true,
          audio: false,
          facingMode: currentFacing === 'environment' ? 'user' : 'environment',
        });
        const videoTrack = camStream.getVideoTracks()[0];
        if (!videoTrack || !localStreamRef.current) return;
        replaceStreamTrack(localStreamRef.current, videoTrack);
        setLocalStream(localStreamRef.current);
        camStream.getTracks().forEach((track) => {
          if (track !== videoTrack) track.stop();
        });
        setIsCameraOff(false);
        if (!isScreenSharing) replaceSenderTrack('video', videoTrack);
      } catch (error) {
        setMediaError(getMediaErrorMessage(error));
      }
      return;
    }

    const currentId = selectedDevices.videoId || localStreamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId;
    const currentIndex = Math.max(0, cameras.findIndex((device) => device.deviceId === currentId));
    const next = cameras[(currentIndex + 1) % cameras.length];
    await changeDevice('video', next.deviceId);
  };

  const retryMedia = async () => {
    try {
      await startMedia({
        videoDeviceId: selectedDevices.videoId,
        audioDeviceId: selectedDevices.audioId,
      });
      if (isJoined && localStreamRef.current) {
        replaceSenderTrack('audio', localStreamRef.current.getAudioTracks()[0] || null);
        if (!isScreenSharing) replaceSenderTrack('video', localStreamRef.current.getVideoTracks()[0] || null);
      }
    } catch (error) {
      setMediaLoading(false);
      setMediaError(getMediaErrorMessage(error));
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false,
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        const track = stream.getVideoTracks()[0];
        setScreenDisplaySurface(track.getSettings?.().displaySurface || '');
        replaceSenderTrack('video', track);
        setIsScreenSharing(true);
        track.onended = () => actionsRef.current.stopScreenShare?.();
      } catch (err) {
        if (err?.name !== 'NotAllowedError') setMediaError('Screen sharing failed. Please try again.');
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenDisplaySurface('');
    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    replaceSenderTrack('video', camTrack);
    setIsScreenSharing(false);
  };

  const handleLeave = () => {
    stopStream(screenStreamRef.current);
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setScreenStream(null);
    if (onEndCall) onEndCall();
    else onLeave();
  };

  useEffect(() => {
    actionsRef.current = { toggleMute, toggleCamera, flipCamera, stopScreenShare };
  });

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'm' || event.key === 'M') actionsRef.current.toggleMute?.();
      if (event.key === 'v' || event.key === 'V' || event.key === 'c' || event.key === 'C') actionsRef.current.toggleCamera?.();
      if (event.key === 'f' || event.key === 'F') actionsRef.current.flipCamera?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleDragUpdate = (event, info, draggedId) => {
    const centerX = info.point.x;
    const centerY = info.point.y;
    const targetId = participantOrder.find((id) => {
      if (id === draggedId) return false;
      const rect = itemRefs.current[id]?.getBoundingClientRect();
      if (!rect) return false;
      return centerX > rect.left && centerX < rect.right && centerY > rect.top && centerY < rect.bottom;
    });
    if (targetId) {
      const oldIndex = participantOrder.indexOf(draggedId);
      const newIndex = participantOrder.indexOf(targetId);
      if (oldIndex !== newIndex) {
        const newOrder = [...participantOrder];
        newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, draggedId);
        setParticipantOrder(newOrder);
      }
    }
  };

  const remotesCount = Object.keys(callParticipants).length;
  const totalParticipants = remotesCount + 1;
  const canPreviewOwnScreen = isScreenSharing && screenDisplaySurface && screenDisplaySurface !== 'monitor';
  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-1';
    if (totalParticipants === 2) return 'grid-2';
    if (totalParticipants <= 4) return 'grid-4';
    return 'grid-more';
  };

  const formatDeviceLabel = (label, fallback) => {
    const value = label || fallback;
    return value
      .replace(/\s*\([^)]+\)\s*/g, '')
      .replace(/^default\s*-\s*/i, 'Default - ')
      .replace(/^communications\s*-\s*/i, 'Comms - ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const renderLobbyDevicePicker = (type, label, Icon, deviceList, selectedId, fallback) => {
    const selectedDevice = deviceList.find((device) => device.deviceId === selectedId);
    const menuKey = `lobby-${type}`;

    return (
      <div className="lobby-select-group">
        <label><Icon size={14} /> {label}</label>
        <div className="lobby-device-select">
          <button
            type="button"
            className="lobby-device-trigger"
            onClick={() => setOpenDeviceMenu(openDeviceMenu === menuKey ? null : menuKey)}
          >
            <span>{formatDeviceLabel(selectedDevice?.label, deviceList.length ? fallback : `No ${fallback.toLowerCase()}`)}</span>
            <span className="lobby-device-caret">v</span>
          </button>
          {openDeviceMenu === menuKey && (
            <div className="lobby-device-menu">
              {deviceList.length === 0 && (
                <div className="lobby-device-option">No {fallback.toLowerCase()} found</div>
              )}
              {deviceList.map((device) => (
                <button
                  type="button"
                  key={device.deviceId}
                  title={device.label || fallback}
                  className={`lobby-device-option ${device.deviceId === selectedId ? 'selected' : ''}`}
                  onClick={() => {
                    changeDevice(type, device.deviceId);
                    setOpenDeviceMenu(null);
                  }}
                >
                  {formatDeviceLabel(device.label, fallback)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const testSpeaker = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  const mediaOverlay = (compact = false) => {
    if (!mediaError && !mediaLoading) return null;
    return (
      <div className={`media-status-overlay ${compact ? 'compact' : ''}`}>
        {mediaLoading && !mediaError && (
          <>
            <div className="media-spinner" />
            <strong>Starting camera…</strong>
            <span>Allow camera and microphone access if the browser asks.</span>
          </>
        )}
        {mediaError && (
          <>
            <AlertTriangle size={28} />
            <strong>Camera did not load</strong>
            <span>{mediaError}</span>
            <button type="button" className="retry-media-btn" onClick={retryMedia}>
              <RefreshCw size={16} /> Retry camera
            </button>
          </>
        )}
      </div>
    );
  };

  if (!isJoined) {
    return (
      <div className="lobby-root">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lobby-container"
        >
          <div className="lobby-preview">
            {localStream && !isCameraOff && (
              <MediaVideo stream={localStream} muted mirror />
            )}
            {(isCameraOff || !localStream) && !mediaLoading && (
              <div className="lobby-avatar-placeholder">
                <div className="lobby-avatar">{localInitials}</div>
              </div>
            )}
            {mediaOverlay()}
            <div className="lobby-overlay-controls">
              <button onClick={toggleMute} className={`lobby-btn ${isMuted ? 'muted' : ''}`} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button onClick={toggleCamera} className={`lobby-btn ${isCameraOff ? 'off' : ''}`} title={isCameraOff ? 'Start camera' : 'Stop camera'}>
                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
              {devices.video.length > 1 && (
                <button onClick={flipCamera} className="lobby-btn" title="Switch camera">
                  <SwitchCamera size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="lobby-details">
            <h2>Ready to join?</h2>
            <p>{remotesCount === 0 ? 'Be the first to join this conversation' : `${remotesCount} others are already in the call`}</p>

            <div className="lobby-test-area">
              <div className="mic-meter-container">
                <label><Volume2 size={14} /> Mic test</label>
                <div className="mic-meter-bg">
                  <motion.div
                    className="mic-meter-fill"
                    animate={{ width: `${isMuted ? 0 : micLevel}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </div>
              </div>
              <button className="test-sound-btn" type="button" onClick={testSpeaker}>
                Test speaker
              </button>
            </div>

            <div className="lobby-settings">
              {renderLobbyDevicePicker('video', 'Camera', Video, devices.video, selectedDevices.videoId, 'Camera')}
              {renderLobbyDevicePicker('audio', 'Microphone', Mic, devices.audio, selectedDevices.audioId, 'Microphone')}
            </div>

            <div className="lobby-actions">
              <button className="join-btn" onClick={() => setIsJoined(true)}>
                Join Meeting
              </button>
              <button className="cancel-btn" onClick={onLeave}>Back</button>
            </div>
            <p className="lobby-hint">Shortcuts: M mute, V camera{devices.video.length > 1 ? ', F flip camera' : ''}</p>
          </div>
        </motion.div>

        <style>{`
          .lobby-root { position: fixed; inset: 0; background: var(--bg-primary); z-index: 10000; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; color: var(--text-primary); padding: 20px; overflow-y: auto; }
          .lobby-container { display: flex; background: var(--bg-secondary); border-radius: 12px; overflow: hidden; max-width: 900px; width: 100%; border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow); }
          .lobby-preview { width: 58%; background: #080808; position: relative; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          .lobby-preview video { width: 100%; height: 100%; object-fit: cover; background: #080808; }
          .lobby-overlay-controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 15px; z-index: 3; }
          .lobby-btn { width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.22); background: rgba(34,32,28,0.58); color: white; cursor: pointer; backdrop-filter: blur(10px); transition: var(--transition); display: flex; align-items: center; justify-content: center; }
          .lobby-btn:hover { background: rgba(34,32,28,0.72); transform: translateY(-1px); }
          .lobby-btn.muted, .lobby-btn.off { background: #111; }
          .lobby-details { width: 42%; padding: 34px; display: flex; flex-direction: column; justify-content: center; }
          .lobby-details h2 { margin: 0 0 8px 0; font-size: 1.75rem; letter-spacing: 0; color: var(--text-primary); }
          .lobby-details p { color: var(--text-secondary); margin: 0 0 20px 0; font-size: 0.92rem; line-height: 1.35; }
          .lobby-hint { margin: 12px 0 0 !important; font-size: 0.72rem !important; color: var(--text-dim) !important; }
          .lobby-test-area { background: var(--bg-primary); border: 1px solid var(--glass-border); border-radius: 8px; padding: 14px; margin-bottom: 18px; }
          .mic-meter-container { margin-bottom: 12px; }
          .mic-meter-container label { font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
          .mic-meter-bg { height: 6px; background: var(--bg-tertiary); border-radius: 10px; overflow: hidden; }
          .mic-meter-fill { height: 100%; background: var(--accent-primary); border-radius: 10px; }
          .test-sound-btn { width: 100%; padding: 10px; background: var(--accent-soft); border: 1px solid var(--glass-border); border-radius: 8px; color: var(--text-primary); font-size: 0.82rem; font-weight: 800; cursor: pointer; transition: var(--transition); }
          .test-sound-btn:hover { background: var(--bg-tertiary); }
          .lobby-settings { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
          .lobby-select-group { display: flex; flex-direction: column; gap: 8px; }
          .lobby-select-group label { font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 6px; }
          .lobby-device-select { position: relative; min-width: 0; }
          .lobby-device-trigger { width: 100%; min-width: 0; height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 8px; color: var(--text-primary); padding: 0 12px; font-size: 0.9rem; cursor: pointer; text-align: left; }
          .lobby-device-trigger span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .lobby-device-caret { color: var(--text-secondary); font-size: 1rem; line-height: 1; }
          .lobby-device-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30; width: 100%; max-height: 132px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg-secondary); box-shadow: var(--glass-shadow); }
          .lobby-device-option { width: 100%; min-width: 0; display: block; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--glass-border); background: transparent; color: var(--text-primary); font-size: 0.88rem; line-height: 1.25; text-align: left; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .lobby-device-option:last-child { border-bottom: 0; }
          .lobby-device-option:hover, .lobby-device-option.selected { background: var(--accent-soft); color: var(--text-primary); }
          .lobby-actions { display: flex; gap: 12px; }
          .join-btn { flex: 2; padding: 14px; background: var(--accent-primary); border: none; border-radius: 8px; color: var(--accent-contrast); font-weight: 800; font-size: 1rem; cursor: pointer; transition: var(--transition); }
          .join-btn:hover { background: var(--accent-secondary); }
          .cancel-btn { flex: 1; padding: 14px; background: transparent; border: 1px solid var(--glass-border); border-radius: 8px; color: var(--text-secondary); cursor: pointer; transition: var(--transition); font-weight: 700; }
          .cancel-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
          .lobby-avatar-placeholder { position: absolute; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; }
          .lobby-avatar { width: 104px; height: 104px; border-radius: 50%; background: var(--accent-primary); color: var(--accent-contrast); display: flex; align-items: center; justify-content: center; font-size: 2.1rem; font-weight: 800; border: 4px solid rgba(255,255,255,0.2); }
          .media-status-overlay { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; background: rgba(8,8,8,0.82); color: #fff; }
          .media-status-overlay strong { font-size: 1rem; }
          .media-status-overlay span { max-width: 280px; font-size: 0.8rem; line-height: 1.4; color: #d4d4d4; }
          .media-spinner { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: media-spin 0.8s linear infinite; }
          @keyframes media-spin { to { transform: rotate(360deg); } }
          .retry-media-btn { margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: #fff; color: #111; font-weight: 800; cursor: pointer; }
          @media (max-width: 800px) {
            .lobby-root { padding: 16px; align-items: flex-start; }
            .lobby-container { flex-direction: column; border-radius: 12px; margin-top: 8px; margin-bottom: 18px; max-width: 430px; }
            .lobby-preview, .lobby-details { width: 100%; }
            .lobby-preview { aspect-ratio: 4/3; }
            .lobby-details { padding: 22px; }
            .lobby-details h2 { font-size: 1.55rem; }
            .lobby-details p { margin-bottom: 18px; }
            .lobby-actions { flex-direction: column; gap: 10px; }
            .join-btn { order: 1; }
            .cancel-btn { order: 2; border: none; padding: 10px; }
          }
          @media (max-height: 700px) and (max-width: 800px) {
            .lobby-root { padding-top: 10px; }
            .lobby-preview { aspect-ratio: 16/10; }
            .lobby-avatar { width: 72px; height: 72px; font-size: 1.8rem; }
            .lobby-test-area { padding: 12px; margin-bottom: 12px; }
            .lobby-settings { margin-bottom: 14px; }
            .lobby-details { padding: 18px 22px; }
            .lobby-device-menu { max-height: 96px; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="call-root-wrapper">
      <header className="call-header">
        <div className="header-info">
          <div className="pulse-dot" />
          <div>
            <h1>Live Conference</h1>
            <span className="room-subtext">{remotesCount === 0 ? 'Waiting for others...' : `${totalParticipants} participants in call`}</span>
          </div>
        </div>
      </header>

      <main className="video-grid-container" ref={containerRef}>
        <div className={`video-grid ${getGridClass()}`}>
          {participantOrder.map((id) => {
            const isLocal = id === 'local';
            const user = isLocal ? null : callParticipants[id];
            if (!isLocal && !user) return null;

            return (
              <motion.div
                key={id}
                layout
                drag
                dragConstraints={containerRef}
                dragSnapToOrigin={true}
                dragElastic={0.01}
                onDrag={(e, info) => handleDragUpdate(e, info, id)}
                whileDrag={{ zIndex: 50, scale: 0.95, opacity: 0.8 }}
                ref={(el) => { itemRefs.current[id] = el; }}
                className={`video-container ${isLocal ? 'local' : ''} ${isLocal && localIsSpeaking ? 'active-speaker' : (!isLocal && remoteAudioSpeaks[id] ? 'active-speaker' : '')} ${isLocal && isScreenSharing ? 'is-sharing' : ''}`}
                style={{ cursor: 'grab' }}
              >
                {isLocal ? (
                  <>
                    {!isScreenSharing && localStream && !isCameraOff && (
                      <MediaVideo stream={localStream} muted mirror />
                    )}
                    {isScreenSharing && (
                      <div className="screen-share-preview">
                        {canPreviewOwnScreen && screenStream ? (
                          <MediaVideo stream={screenStream} muted className="screen-share-video" />
                        ) : (
                          <div className="screen-share-safe-preview">
                            <div className="screen-share-icon"><Maximize2 size={28} /></div>
                            <strong>You are sharing your screen</strong>
                            <span>Preview is hidden for full-screen sharing to prevent the mirror effect.</span>
                          </div>
                        )}
                        {!isCameraOff && localStream && (
                          <div className="screen-camera-pip">
                            <MediaVideo stream={localStream} muted mirror />
                          </div>
                        )}
                        <div className="screen-share-status">
                          <Maximize2 size={14} />
                          Sharing screen
                        </div>
                      </div>
                    )}
                    {(isCameraOff || !localStream) && !isScreenSharing && (
                      <div className="camera-off-placeholder">
                        <div className="user-avatar">{localInitials}</div>
                      </div>
                    )}
                    {mediaOverlay(true)}
                    <div className="participant-label">
                      {isScreenSharing ? `${localUserName} (Screen)` : localUserName} {isMuted && <MicOff size={10} />}
                    </div>
                  </>
                ) : (
                  <RemoteVideo
                    socketId={id}
                    stream={remoteStreams[id]?.stream}
                    user={user}
                    connectionState={connectionStates[id]}
                    onSpeaking={(speaking) => setRemoteAudioSpeaks((prev) => (
                      speaking === prev[id] ? prev : { ...prev, [id]: speaking }
                    ))}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </main>

      <footer className="call-controls">
        <div className="controls-inner">
          <button onClick={toggleMute} className={`action-btn ${isMuted ? 'muted' : ''}`}>
            {isMuted ? <MicOff /> : <Mic />}
            <label>{isMuted ? 'Unmute' : 'Mute'}</label>
          </button>
          <button
            onClick={toggleCamera}
            className={`action-btn ${isCameraOff ? 'camera-off' : ''}`}
          >
            {isCameraOff ? <VideoOff /> : <Video />}
            <label>{isCameraOff ? 'Start' : 'Stop'}</label>
          </button>
          {devices.video.length > 1 && (
            <button onClick={flipCamera} className="action-btn">
              <SwitchCamera />
              <label>Flip</label>
            </button>
          )}
          <button onClick={toggleScreenShare} className={`action-btn ${isScreenSharing ? 'sharing' : ''}`}>
            <Maximize2 />
            <label>Share</label>
          </button>
          <button onClick={() => setShowChat(true)} className={`action-btn ${showChat ? 'active' : ''}`}>
            <MessageSquare />
            <label>Chat</label>
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`action-btn ${showSettings ? 'active' : ''}`}>
            <Settings />
            <label>Settings</label>
          </button>
          <button onClick={handleLeave} className="action-btn end-call">
            <PhoneOff />
            <label>End</label>
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {showChat && (
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="call-chat-panel"
          >
            <div className="call-chat-header">
              <div>
                <h3>Room Chat</h3>
                <span>{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span>
              </div>
              {selectedMessageIds.size > 0 && (
                <button type="button" className="call-chat-delete" onClick={onDeleteSelectedMessages}>
                  <Trash2 size={16} />
                  {selectedMessageIds.size}
                </button>
              )}
              <button type="button" className="call-chat-close" onClick={() => setShowChat(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="call-chat-messages">
              {messages.length > 0 ? (
                messages.map((msg, index) => {
                  const isOwnMessage = (token && currentUser && msg.user_id === currentUser.id) ||
                    (!token && guestId && msg.user_tempeorary_id === guestId);
                  const isSelected = selectedMessageIds.has(Number(msg.id));

                  return (
                    <div
                      key={`${msg.id || 'call-msg'}-${index}`}
                      className={`call-chat-message ${isOwnMessage ? 'own' : 'other'} ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="call-chat-meta">
                        {msg.user_name} · {new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="call-chat-row">
                        {isOwnMessage && msg.id && (
                          <button
                            type="button"
                            className={`call-chat-select ${isSelected ? 'active' : ''}`}
                            onClick={() => onToggleMessageSelect?.(msg.id)}
                            title={isSelected ? 'Unselect message' : 'Select message'}
                          >
                            <CheckSquare size={14} />
                          </button>
                        )}
                        <div className="call-chat-bubble">{msg.message}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="call-chat-empty">No messages yet.</div>
              )}
            </div>

            <form className="call-chat-form" onSubmit={onSendMessage}>
              <div className="call-emoji-wrap">
                <button
                  type="button"
                  className="call-emoji-button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile size={18} />
                </button>
                {showEmojiPicker && (
                  <div className="call-emoji-picker">
                    <EmojiPicker
                      width="100%"
                      height={340}
                      theme={theme === 'dark' ? 'dark' : 'light'}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                      onEmojiClick={(emojiData) => {
                        setChatInput?.(`${chatInput}${emojiData.emoji}`);
                      }}
                    />
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput?.(e.target.value)}
                onFocus={() => setShowEmojiPicker(false)}
              />
              <button type="submit" disabled={!chatInput.trim()}>
                <Send size={17} />
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="settings-modal"
          >
            <div className="settings-content">
              <h3>Device Settings</h3>
              <div className="setting-group">
                <label><Video size={16} /> Camera</label>
                <select value={selectedDevices.videoId} onChange={(e) => changeDevice('video', e.target.value)}>
                  {devices.video.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} title={d.label || 'Camera'}>
                      {formatDeviceLabel(d.label, 'Camera')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="setting-group">
                <label><Mic size={16} /> Microphone</label>
                <select value={selectedDevices.audioId} onChange={(e) => changeDevice('audio', e.target.value)}>
                  {devices.audio.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} title={d.label || 'Microphone'}>
                      {formatDeviceLabel(d.label, 'Microphone')}
                    </option>
                  ))}
                </select>
              </div>
              <button className="close-settings" onClick={() => setShowSettings(false)}>Done</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .call-root-wrapper { position: fixed; inset: 0; height: 100dvh; background: #050508; z-index: 9999; display: flex; flex-direction: column; color: white; overflow: hidden; font-family: 'Inter', sans-serif; }
        .call-header { padding: 12px 20px; background: rgba(0,0,0,0.8); flex-shrink: 0; display: flex; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(20px); }
        .header-info { display: flex; gap: 10px; align-items: center; }
        .header-info h1 { font-size: 0.9rem; margin: 0; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
        .room-subtext { font-size: 0.6rem; color: #a3a3a3; font-weight: 500; }
        .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #f5f5f5; box-shadow: 0 0 10px rgba(255,255,255,0.45); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.4; transform: scale(0.9); } }
        .video-grid-container { flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 16px; position: relative; }
        .video-grid { display: grid; gap: 12px; width: 100%; height: 100%; max-width: 1400px; margin: 0 auto; }
        .video-grid.grid-1 { grid-template-columns: 1fr; }
        .video-grid.grid-2 { grid-template-columns: 1fr 1fr; }
        @media (max-width: 600px) { .video-grid.grid-2 { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; } }
        .video-grid.grid-3, .video-grid.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
        .video-grid.grid-more { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
        @media (max-width: 600px) {
          .video-grid.grid-more { grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(150px, 1fr); }
        }
        @media (max-width: 400px) { .video-grid.grid-more { grid-template-columns: 1fr; } }
        .video-container { background: #111; border-radius: 16px; overflow: hidden; position: relative; border: 2px solid rgba(255,255,255,0.08); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background-image: radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%); cursor: grab; touch-action: none; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .video-container video { width: 100%; height: 100%; object-fit: cover; }
        .active-speaker { border-color: #fff !important; box-shadow: 0 0 24px rgba(255,255,255,0.22); }
        .participant-label { position: absolute; bottom: 12px; left: 12px; background: rgba(15, 23, 42, 0.7); padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; backdrop-filter: blur(12px); display: flex; align-items: center; gap: 6px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); z-index: 5; }
        .camera-off-placeholder { position: absolute; inset: 0; background: #111; display: flex; align-items: center; justify-content: center; }
        .user-avatar { width: 80px; height: 80px; border-radius: 50%; background: #f5f5f5; color: #111; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.4rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 3px solid rgba(255,255,255,0.15); }
        .screen-share-preview { position: absolute; inset: 0; background: #050505; }
        .screen-share-video { width: 100%; height: 100%; object-fit: contain !important; background: #050505; transform: none !important; }
        .screen-share-safe-preview { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; background: linear-gradient(135deg, #050505, #141414); color: white; }
        .screen-share-icon { width: 58px; height: 58px; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); }
        .screen-share-safe-preview strong { font-size: 1rem; line-height: 1.2; }
        .screen-share-safe-preview span { max-width: 300px; color: #a3a3a3; font-size: 0.78rem; line-height: 1.4; }
        .screen-camera-pip { position: absolute; right: 14px; bottom: 14px; width: min(180px, 28%); aspect-ratio: 4 / 3; overflow: hidden; border-radius: 14px; border: 1px solid rgba(255,255,255,0.18); background: #111; box-shadow: 0 16px 40px rgba(0,0,0,0.45); z-index: 6; }
        .screen-camera-pip video { width: 100%; height: 100%; object-fit: cover; }
        .screen-share-status { position: absolute; top: 12px; right: 12px; z-index: 6; display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; background: rgba(0,0,0,0.78); border: 1px solid rgba(255,255,255,0.22); color: #fff; font-size: 0.72rem; font-weight: 800; backdrop-filter: blur(12px); }
        .media-status-overlay { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; background: rgba(8,8,8,0.72); color: #fff; }
        .media-status-overlay.compact { padding: 12px; }
        .media-status-overlay.compact span { font-size: 0.72rem; }
        .media-spinner { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: media-spin 0.8s linear infinite; }
        @keyframes media-spin { to { transform: rotate(360deg); } }
        .retry-media-btn { margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: #fff; color: #111; font-weight: 800; cursor: pointer; }
        .call-controls { padding: 20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); flex-shrink: 0; display: flex; justify-content: center; }
        .controls-inner { display: flex; gap: 12px; background: rgba(12, 12, 12, 0.92); padding: 12px 20px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(30px); }
        .action-btn { width: 50px; height: 50px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.05); color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: all 0.2s; }
        .action-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
        .action-btn label { font-size: 0.5rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
        .action-btn svg { width: 20px; height: 20px; }
        .action-btn.muted, .action-btn.camera-off { color: #fff; background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.28); }
        .action-btn.sharing { color: #fff; background: rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.4); }
        .action-btn.active { color: #fff; border-color: #fff; background: rgba(255,255,255,0.12); }
        .action-btn.end-call { background: #fff; border: none; width: 60px; color: #111; }
        .action-btn.end-call:hover { background: #e5e5e5; }
        .call-chat-panel { position: absolute; top: 76px; right: 18px; bottom: 104px; z-index: 900; width: min(360px, calc(100vw - 32px)); display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(12, 12, 12, 0.96); color: white; box-shadow: 0 20px 50px rgba(0,0,0,0.55); backdrop-filter: blur(20px); }
        .call-chat-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .call-chat-header h3 { margin: 0; font-size: 1rem; line-height: 1.2; }
        .call-chat-header span { color: #a3a3a3; font-size: 0.74rem; }
        .call-chat-close { width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .call-chat-delete { height: 34px; border-radius: 10px; border: none; background: #fff; color: #111; display: flex; align-items: center; gap: 6px; padding: 0 10px; cursor: pointer; font-weight: 800; }
        .call-chat-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .call-chat-message { max-width: 88%; display: flex; flex-direction: column; gap: 3px; }
        .call-chat-message.own { align-self: flex-end; align-items: flex-end; }
        .call-chat-message.other { align-self: flex-start; align-items: flex-start; }
        .call-chat-message.selected .call-chat-bubble { outline: 2px solid #fff; outline-offset: 2px; }
        .call-chat-meta { color: #a3a3a3; font-size: 0.68rem; padding: 0 4px; }
        .call-chat-row { display: flex; align-items: center; gap: 8px; }
        .call-chat-select { width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #a3a3a3; display: flex; align-items: center; justify-content: center; cursor: pointer; flex: 0 0 auto; }
        .call-chat-select.active { background: #fff; border-color: #fff; color: #111; }
        .call-chat-bubble { padding: 9px 11px; border-radius: 12px; background: rgba(255,255,255,0.08); color: white; font-size: 0.9rem; line-height: 1.35; word-break: break-word; }
        .call-chat-message.own .call-chat-bubble { background: #fff; color: #111; }
        .call-chat-empty { margin: auto; color: #a3a3a3; font-size: 0.9rem; }
        .call-chat-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(255,255,255,0.1); }
        .call-emoji-wrap { position: relative; flex: 0 0 auto; }
        .call-emoji-button { width: 42px; height: 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .call-emoji-picker { position: absolute; left: 0; bottom: calc(100% + 10px); z-index: 20; width: min(320px, calc(100vw - 56px)); overflow: hidden; border-radius: 14px; box-shadow: 0 18px 42px rgba(0,0,0,0.5); }
        .call-chat-form input { flex: 1; min-width: 0; height: 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: white; outline: none; padding: 0 12px; font-size: 0.9rem; }
        .call-chat-form input::placeholder { color: #a3a3a3; }
        .call-chat-form > button { width: 42px; height: 40px; border-radius: 10px; border: none; background: #fff; color: #111; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .call-chat-form > button:disabled { opacity: 0.45; cursor: not-allowed; }
        .settings-modal { --settings-width: min(360px, calc(100vw - 32px)); position: absolute; bottom: 104px; left: calc((100vw - var(--settings-width)) / 2); z-index: 1000; width: var(--settings-width); background: rgba(12, 12, 12, 0.96); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); color: white; }
        .settings-content { display: flex; flex-direction: column; gap: 14px; }
        .settings-content h3 { margin: 0; color: white; font-size: 1.05rem; line-height: 1.2; font-weight: 800; }
        .setting-group { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .setting-group label { color: #d4d4d4; display: flex; align-items: center; gap: 8px; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
        .setting-group select { width: 100%; min-width: 0; max-width: 100%; height: 42px; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; background-color: rgba(255,255,255,0.06); color: white; padding: 0 38px 0 12px; font-size: 0.9rem; outline: none; appearance: none; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
        }
        .setting-group select:focus { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.16); }
        .setting-group select option { background: #111; color: white; }
        .close-settings { width: 100%; height: 42px; border: none; border-radius: 10px; background: white; color: #111; font-size: 0.92rem; font-weight: 800; cursor: pointer; transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .close-settings:hover { background: #e5e7eb; }
        @media (max-width: 600px) {
          .call-header { padding: 10px 16px; }
          .call-controls { padding: 15px; }
          .controls-inner { padding: 10px 16px; gap: 8px; border-radius: 20px; }
          .action-btn { width: 44px; height: 44px; border-radius: 12px; }
          .action-btn label { display: none; }
          .action-btn.end-call { width: 54px; }
          .user-avatar { width: 60px; height: 60px; font-size: 1.5rem; }
          .call-chat-panel { top: 60px; left: 14px; right: 14px; bottom: 92px; width: auto; border-radius: 14px; }
          .call-emoji-picker { width: calc(100vw - 56px); }
          .settings-modal { --settings-width: calc(100vw - 28px); bottom: 92px; left: 14px; right: 14px; width: auto; padding: 16px; border-radius: 14px; }
        }
      `}</style>
    </div>
  );
};

const RemoteVideo = ({ stream, user, socketId, onSpeaking, connectionState }) => {
  const [playError, setPlayError] = useState(false);
  const videoRef = useRef();

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) return undefined;

    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');

    const playVideo = async () => {
      try {
        await videoEl.play();
        setPlayError(false);
      } catch {
        setPlayError(true);
      }
    };

    playVideo();
    const handleAddTrack = () => {
      videoEl.srcObject = stream;
      playVideo();
    };
    stream.addEventListener('addtrack', handleAddTrack);
    return () => stream.removeEventListener('addtrack', handleAddTrack);
  }, [stream, socketId]);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return undefined;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let animationId;
      let lastSpeaking = false;

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i += 1) sum += dataArray[i];
        const average = sum / bufferLength;
        const speaking = average > 30;
        if (speaking !== lastSpeaking) {
          lastSpeaking = speaking;
          onSpeaking?.(speaking);
        }
        animationId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
      return () => {
        cancelAnimationFrame(animationId);
        if (audioContext.state !== 'closed') audioContext.close();
      };
    } catch (err) {
      console.error(`[WebRTC] Audio analysis error for ${socketId}:`, err);
      return undefined;
    }
  }, [stream, socketId, onSpeaking]);

  const connecting = !stream || connectionState === 'connecting' || connectionState === 'new';
  const failed = connectionState === 'failed' || connectionState === 'disconnected';

  return (
    <>
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {user?.isCameraOff && (
            <div className="camera-off-placeholder">
              <div className="user-avatar" style={{ fontSize: '1rem' }}>{user?.name?.slice(0, 2).toUpperCase() || 'NA'}</div>
            </div>
          )}
          {playError && (
            <div className="play-error-overlay" onClick={() => videoRef.current?.play()}>
              <span>Click to play</span>
            </div>
          )}
        </>
      ) : (
        <div className="camera-off-placeholder">
          <div className="user-avatar" style={{ fontSize: '1rem' }}>{user?.name?.slice(0, 2).toUpperCase() || '...'}</div>
        </div>
      )}
      <div className="participant-label">
        {user?.name || 'Guest'} {user?.isMuted && <MicOff size={10} />}
        {connecting && <span className="conn-pill">Connecting</span>}
        {failed && <span className="conn-pill">Reconnecting</span>}
      </div>
      <style>{`
        .play-error-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 10; border-radius: 20px;
        }
        .play-error-overlay span {
          background: #fff; padding: 8px 16px; border-radius: 20px;
          font-size: 0.8rem; font-weight: 600; color: #111;
        }
        .conn-pill {
          margin-left: 6px; font-size: 0.58rem; text-transform: uppercase;
          letter-spacing: 0.04em; color: #d4d4d4;
        }
      `}</style>
    </>
  );
};

export default CallOverlay;
