import { queryClient } from '../App';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_ATTRS_KEY = 'auth_attrs';

export const AuthService = {
  login: (username: string, attrs: string[] = []): void => {
    localStorage.setItem(AUTH_TOKEN_KEY, username);
    localStorage.setItem(AUTH_ATTRS_KEY, JSON.stringify(attrs));
  },

  logout: (redirect = false): void => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_ATTRS_KEY);
    queryClient.clear();
    if (redirect) {
      window.location.href = '/login';
    }
  },

  isAuthenticated: (): boolean => {
    const username = localStorage.getItem(AUTH_TOKEN_KEY);
    const attrs = AuthService.getAttributes();
    return (username !== null && username !== '') || attrs.length > 0;
  },

  getUsername: (): string | null => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getAttributes: (): string[] => {
    try {
      const raw = localStorage.getItem(AUTH_ATTRS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  },
}; 