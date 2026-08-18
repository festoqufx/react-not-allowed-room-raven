import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BoltMark } from './Loader';
import './SplashScreen.css';

const ROTATING_MESSAGES = [
  'Connecting to rooms…',
  'Setting up your space…',
  'Almost there…',
];

const SplashScreen = ({ onDone }) => {
  const [phase, setPhase] = useState(1);
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(2), 700);
    const t2 = setTimeout(() => setPhase(3), 1400);
    const t3 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 320);
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  useEffect(() => {
    if (phase !== 3) return undefined;
    const iv = setInterval(
      () => setMsgIdx((i) => (i + 1) % ROTATING_MESSAGES.length),
      700
    );
    return () => clearInterval(iv);
  }, [phase]);

  const finish = () => {
    setVisible(false);
    setTimeout(onDone, 220);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="splash-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.28, ease: 'easeInOut' } }}
        >
          <div className="splash-glow" />

          <motion.p
            className="splash-title"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            NAR
          </motion.p>
          <motion.p
            className="splash-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.18 }}
          >
            Not Allowed Room
          </motion.p>

          <motion.div
            className="splash-bolt-wrap"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <BoltMark className="splash-bolt" />
          </motion.div>

          <div className="splash-msg-wrap">
            <AnimatePresence mode="wait">
              {phase >= 2 && (
                <motion.p
                  key={phase === 3 ? `p3-${msgIdx}` : 'p2'}
                  className="splash-msg"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {phase === 3 ? ROTATING_MESSAGES[msgIdx] : 'Getting things ready…'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="splash-dots" aria-hidden="true">
            <div className="splash-dot" />
            <div className="splash-dot" />
            <div className="splash-dot" />
          </div>

          <div className="splash-progress-track">
            <motion.div
              className="splash-progress-fill"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.4, ease: 'linear' }}
            />
          </div>

          <button type="button" className="splash-skip" onClick={finish}>
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
