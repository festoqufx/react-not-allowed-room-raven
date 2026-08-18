import { isDuplicateRequest } from './preventDuplicateRequests';

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (isDuplicateRequest(error)) return null;

  if (!error?.response) {
    if (error?.code === 'ECONNABORTED') {
      return 'The server took too long to respond. Please try again.';
    }
    if (import.meta.env.DEV) {
      return 'Cannot reach the server. Start the API on port 9000, then try again.';
    }
    return 'Cannot reach the server. Set VITE_BACKEND_URL to your public API origin in Vercel, then redeploy.';
  }

  return error.response.data?.message || fallback;
};
