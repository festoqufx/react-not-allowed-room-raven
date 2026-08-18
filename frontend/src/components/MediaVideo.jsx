import React, { useEffect, useRef } from 'react';
import { attachStreamToVideo } from '../lib/media';

const MediaVideo = ({
  stream,
  muted = true,
  mirror = false,
  className,
  style,
  onClick,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return undefined;

    attachStreamToVideo(videoEl, stream, { muted });

    return () => {
      if (videoEl.srcObject) videoEl.srcObject = null;
    };
  }, [stream, muted]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted={muted}
      playsInline
      className={className}
      onClick={onClick}
      style={{
        ...style,
        transform: mirror ? 'scaleX(-1)' : style?.transform,
      }}
    />
  );
};

export default MediaVideo;
