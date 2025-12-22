// src/utils/api.ts
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  return fetch(`http://localhost:8080/api/v1${url}`, {
    ...options,
    headers
  });
};