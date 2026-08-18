import { useEffect } from 'react';

export const usePageTitle = (title) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · NotAllowedRoom` : 'NotAllowedRoom';
    return () => {
      document.title = previous;
    };
  }, [title]);
};
