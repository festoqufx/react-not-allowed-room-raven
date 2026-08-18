import { isDuplicateRequest } from './preventDuplicateRequests';

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (isDuplicateRequest(error)) return null;

  if (!error?.response) {
    if (error?.code === 'ECONNABORTED') {
      return 'The server took too long to respond. Please try again.';
    }
    return 'Cannot reach the server. Start the API on port 9000, then try again.';
  }

  return error.response.data?.message || fallback;
};
