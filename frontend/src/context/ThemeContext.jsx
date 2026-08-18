import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'nar_theme';
const ThemeContext = createContext(null);

const getSystemTheme = () => (
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

const resolveTheme = (preference) => (
  preference === 'system' ? getSystemTheme() : preference
);

const applyTheme = (theme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#050505' : '#f4f4f4');
  }
};

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  });
  const [theme, setTheme] = useState(() => resolveTheme(preference));

  useEffect(() => {
    const nextTheme = resolveTheme(preference);
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (preference === 'system') {
        const nextTheme = getSystemTheme();
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const value = useMemo(() => ({
    theme,
    preference,
    setPreference,
    cyclePreference: () => {
      setPreference((current) => {
        if (current === 'system') return 'light';
        if (current === 'light') return 'dark';
        return 'system';
      });
    },
  }), [theme, preference]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
