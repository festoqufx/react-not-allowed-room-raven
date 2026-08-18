export const isSecureMediaContext = () => (
  typeof window !== 'undefined' && Boolean(window.isSecureContext)
);

export const canUseMediaDevices = () => (
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
);

export const getMediaErrorMessage = (error) => {
  const name = error?.name || '';
  const message = String(error?.message || '');

  if (!isSecureMediaContext() || name === 'SecurityError') {
    return 'Camera needs a secure page (https or localhost). Open this app from localhost instead of a raw IP address.';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera or microphone permission was blocked. Allow access in the browser address bar, then retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera or microphone was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('Could not start video source')) {
    return 'The camera is already in use by another app or browser tab. Close it and retry.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'This camera does not support the selected video settings. Try another camera.';
  }
  if (name === 'AbortError') {
    return 'The camera request was interrupted. Please try again.';
  }
  if (name === 'CAMERA_UNSUPPORTED' || !canUseMediaDevices()) {
    return 'This browser cannot access the camera.';
  }
  return message || 'Could not start the camera.';
};

const videoConstraint = ({ deviceId, facingMode } = {}) => {
  if (deviceId) return { deviceId: { exact: deviceId } };
  if (facingMode) return { facingMode: { ideal: facingMode } };
  return true;
};

const audioConstraint = ({ deviceId } = {}) => {
  if (deviceId) return { deviceId: { exact: deviceId } };
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
};

let mediaChain = Promise.resolve();

const withMediaLock = (task) => {
  const run = mediaChain.then(task, task);
  mediaChain = run.then(() => undefined, () => undefined);
  return run;
};

const hasLiveTrack = (stream, kind) => (
  Boolean(stream?.getTracks?.().some((track) => track.kind === kind && track.readyState === 'live'))
);

const isUsableStream = (stream, { video = true, audio = true } = {}) => {
  if (!stream) return false;
  if (video && !hasLiveTrack(stream, 'video')) return false;
  if (audio && !hasLiveTrack(stream, 'audio')) return false;
  return true;
};

async function requestUserMedia({
  video = true,
  audio = true,
  videoDeviceId = '',
  audioDeviceId = '',
  facingMode = 'user',
} = {}) {
  if (!canUseMediaDevices()) {
    const error = new Error('CAMERA_UNSUPPORTED');
    error.name = 'CAMERA_UNSUPPORTED';
    throw error;
  }

  const attempts = [];

  if (video && audio) {
    attempts.push({
      video: videoConstraint({ deviceId: videoDeviceId, facingMode }),
      audio: audioConstraint({ deviceId: audioDeviceId }),
    });
    attempts.push({ video: true, audio: true });
    attempts.push({
      video: videoConstraint({ deviceId: videoDeviceId, facingMode }),
      audio: true,
    });
    attempts.push({ video: true, audio: audioConstraint({ deviceId: audioDeviceId }) });
    attempts.push({ video: true, audio: false });
  } else if (video) {
    attempts.push({ video: videoConstraint({ deviceId: videoDeviceId, facingMode }), audio: false });
    attempts.push({ video: true, audio: false });
  } else if (audio) {
    attempts.push({ video: false, audio: audioConstraint({ deviceId: audioDeviceId }) });
    attempts.push({ video: false, audio: true });
  }

  let lastError;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Could not start the camera.');
}

export function getUserMediaWithFallback(options = {}) {
  return withMediaLock(() => requestUserMedia(options));
}

const mediaSession = {
  refs: 0,
  stream: null,
  acquiring: null,
  releaseTimer: null,
};

const RELEASE_DELAY_MS = 450;

const assignSessionStream = (stream) => {
  if (mediaSession.stream && mediaSession.stream !== stream) {
    stopStream(mediaSession.stream);
  }
  mediaSession.stream = stream;
  return stream;
};

export async function acquireCallMedia(options = {}) {
  const { replace = false, ...mediaOptions } = options;
  if (!replace) mediaSession.refs += 1;

  if (mediaSession.releaseTimer) {
    window.clearTimeout(mediaSession.releaseTimer);
    mediaSession.releaseTimer = null;
  }

  if (!replace && isUsableStream(mediaSession.stream, mediaOptions) && !mediaSession.acquiring) {
    return mediaSession.stream;
  }

  if (!replace && mediaSession.acquiring) {
    return mediaSession.acquiring;
  }

  mediaSession.acquiring = withMediaLock(async () => {
    if (!replace && isUsableStream(mediaSession.stream, mediaOptions)) {
      return mediaSession.stream;
    }

    try {
      const stream = await requestUserMedia(mediaOptions);
      if (mediaSession.refs <= 0) {
        stopStream(stream);
        return stream;
      }
      return assignSessionStream(stream);
    } catch (error) {
      if (!replace) mediaSession.refs = Math.max(0, mediaSession.refs - 1);
      throw error;
    }
  }).finally(() => {
    mediaSession.acquiring = null;
  });

  return mediaSession.acquiring;
}

export function releaseCallMedia({ immediate = false } = {}) {
  mediaSession.refs = Math.max(0, mediaSession.refs - 1);

  const finish = () => {
    if (mediaSession.refs > 0) return;
    stopStream(mediaSession.stream);
    mediaSession.stream = null;
  };

  if (mediaSession.releaseTimer) {
    window.clearTimeout(mediaSession.releaseTimer);
    mediaSession.releaseTimer = null;
  }

  if (immediate) {
    finish();
    return;
  }

  mediaSession.releaseTimer = window.setTimeout(finish, RELEASE_DELAY_MS);
}

export const stopStream = (stream) => {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // already stopped
    }
  });
};

export const replaceStreamTrack = (stream, nextTrack) => {
  if (!stream || !nextTrack) return stream;
  stream.getTracks()
    .filter((track) => track.kind === nextTrack.kind)
    .forEach((track) => {
      stream.removeTrack(track);
      track.stop();
    });
  stream.addTrack(nextTrack);
  return stream;
};

export async function listMediaDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { video: [], audio: [], audioOutput: [] };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    video: devices.filter((device) => device.kind === 'videoinput' && device.deviceId),
    audio: devices.filter((device) => device.kind === 'audioinput' && device.deviceId),
    audioOutput: devices.filter((device) => device.kind === 'audiooutput' && device.deviceId),
  };
}

export function getIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((url) => url.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  return servers;
}

export const attachStreamToVideo = (videoEl, stream, { muted = true } = {}) => {
  if (!videoEl) return Promise.resolve();

  videoEl.muted = muted;
  videoEl.defaultMuted = muted;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('webkit-playsinline', '');
  if (muted) videoEl.setAttribute('muted', '');
  else videoEl.removeAttribute('muted');
  videoEl.srcObject = stream || null;

  if (!stream) return Promise.resolve();

  const play = () => videoEl.play().catch(() => {});
  if (videoEl.readyState >= 1) return play();

  return new Promise((resolve) => {
    const onReady = () => {
      videoEl.removeEventListener('loadedmetadata', onReady);
      videoEl.removeEventListener('canplay', onReady);
      resolve(play());
    };
    videoEl.addEventListener('loadedmetadata', onReady);
    videoEl.addEventListener('canplay', onReady);
  });
};
