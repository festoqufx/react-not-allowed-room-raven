import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

const LABELS = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
};

const ThemeToggle = ({ compact = false }) => {
  const { preference, cyclePreference } = useTheme();
  const next = preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      onClick={cyclePreference}
      aria-label={`Theme: ${LABELS[preference]}. Switch to ${LABELS[next]}.`}
      title={`${LABELS[preference]} · click for ${LABELS[next]}`}
    >
      {preference === 'dark' ? <Moon size={18} /> : preference === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
      {!compact && <span>{LABELS[preference]}</span>}
    </button>
  );
};

export default ThemeToggle;
