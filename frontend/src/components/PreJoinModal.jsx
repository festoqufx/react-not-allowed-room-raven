import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, Volume2, RefreshCw, AlertTriangle } from 'lucide-react';
import MediaVideo from './MediaVideo';
import {
  acquireCallMedia,
  releaseCallMedia,
  getMediaErrorMessage,
  canUseMediaDevices,
} from '../lib/media';
import './PreJoinModal.css';

const PreJoinModal = ({ onJoin, userName }) => {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [mediaLoading, setMediaLoading] = useState(true);
  const streamRef = useRef(null);
  const micOnRef = useRef(micOn);
  const videoOnRef = useRef(videoOn);

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    videoOnRef.current = videoOn;
  }, [videoOn]);

  const startPreview = useCallback(async (nextVideoOn = videoOnRef.current, nextMicOn = micOnRef.current) => {
    setMediaLoading(true);
    setMediaError('');
    try {
      if (!canUseMediaDevices()) {
        throw Object.assign(new Error('CAMERA_UNSUPPORTED'), { name: 'CAMERA_UNSUPPORTED' });
      }

      const newStream = await acquireCallMedia({
        video: nextVideoOn,
        audio: nextMicOn || nextVideoOn,
        replace: Boolean(streamRef.current),
      });

      if (!nextMicOn) {
        newStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      if (!nextVideoOn) {
        newStream.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      streamRef.current = newStream;
      setStream(newStream);
      setMediaLoading(false);
      return newStream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      streamRef.current = null;
      setStream(null);
      setMediaLoading(false);
      setMediaError(getMediaErrorMessage(err));
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await startPreview(true, true);
      if (cancelled) {
        streamRef.current = null;
      }
    };

    boot();

    return () => {
      cancelled = true;
      releaseCallMedia();
      streamRef.current = null;
    };
  }, [startPreview]);

  useEffect(() => {
    const current = streamRef.current;
    if (!current) return;
    current.getAudioTracks().forEach((track) => {
      track.enabled = micOn;
    });
  }, [micOn]);

  useEffect(() => {
    const current = streamRef.current;
    if (!current) return;

    const hasLiveVideo = current.getVideoTracks().some((track) => track.readyState === 'live');
    if (videoOn && !hasLiveVideo) {
      startPreview(true, micOnRef.current);
      return;
    }

    current.getVideoTracks().forEach((track) => {
      track.enabled = videoOn;
    });
  }, [videoOn, startPreview]);

  const handleJoin = () => {
    releaseCallMedia({ immediate: true });
    streamRef.current = null;
    onJoin({ micOn, videoOn });
  };

  return (
    <div className="prejoin-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass card prejoin-card"
      >
        <div className="prejoin-grid">
          <div className="preview-wrapper">
            {videoOn && stream ? (
              <MediaVideo stream={stream} muted mirror className="preview-video" />
            ) : (
              <div className="preview-avatar-wrap">
                <div className="user-avatar preview-avatar">
                  {userName?.charAt(0).toUpperCase() || '?'}
                </div>
              </div>
            )}

            {(mediaLoading || mediaError) && (
              <div className="preview-status">
                {mediaLoading && !mediaError && (
                  <>
                    <div className="preview-spinner" />
                    <strong>Starting camera…</strong>
                    <span>Allow camera access if prompted.</span>
                  </>
                )}
                {mediaError && (
                  <>
                    <AlertTriangle size={22} />
                    <strong>Camera did not load</strong>
                    <span>{mediaError}</span>
                    <button type="button" className="preview-retry" onClick={() => startPreview(videoOn, micOn)}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="preview-overlay">
              <button
                onClick={() => setMicOn((prev) => !prev)}
                className={`media-btn ${micOn ? 'on' : 'off'}`}
                title={micOn ? 'Mute' : 'Unmute'}
                type="button"
              >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                onClick={() => setVideoOn((prev) => !prev)}
                className={`media-btn ${videoOn ? 'on' : 'off'}`}
                title={videoOn ? 'Stop Video' : 'Start Video'}
                type="button"
              >
                {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            </div>
          </div>

          <div className="prejoin-info">
            <h1 className="text-gradient">Ready to join?</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Check your audio and video settings before entering the room.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Volume2 size={18} />
                <span>Microphone is {micOn ? 'On' : 'Off'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Video size={18} />
                <span>Camera is {videoOn ? 'On' : 'Off'}</span>
              </div>
            </div>

            <button
              onClick={handleJoin}
              className="btn btn-primary"
              style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '16px', width: '100%' }}
              type="button"
            >
              Join Room Now
            </button>
            <p style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              Joining as <strong>{userName}</strong>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PreJoinModal;
