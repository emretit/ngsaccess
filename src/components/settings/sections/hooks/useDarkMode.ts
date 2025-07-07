import { useState, useEffect } from 'react';

export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = (enabled: boolean) => {
    setIsDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const applyDarkMode = (enabled: boolean) => {
    toggleDarkMode(enabled);
  };

  useEffect(() => {
    // Check if dark mode is already applied
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  return {
    isDarkMode,
    toggleDarkMode,
    applyDarkMode
  };
};