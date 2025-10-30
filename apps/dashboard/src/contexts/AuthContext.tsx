import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/v1';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  email_verified: boolean;
  is_superuser: boolean;
}

interface Organization {
  org_id: string;
  name: string;
  role: string;
  api_key?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, orgName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  selectOrganization: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up axios interceptors
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add response interceptor to handle 401 errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await refreshToken();
            return axios(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            await logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(response.data.user);
      setOrganizations(response.data.organizations);

      // Select first org by default
      if (response.data.organizations.length > 0) {
        setCurrentOrg(response.data.organizations[0]);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { user, organizations, tokens } = response.data;

      // Store tokens
      localStorage.setItem('access_token', tokens.accessToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);

      // Set authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

      // Update state
      setUser(user);
      setOrganizations(organizations);

      if (organizations.length > 0) {
        setCurrentOrg(organizations[0]);
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    orgName?: string
  ) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        org_name: orgName,
      });

      const { tokens } = response.data;

      // Store tokens
      localStorage.setItem('access_token', tokens.accessToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);

      // Set authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

      // Reload user data
      await loadUser();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens and state
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setOrganizations([]);
      setCurrentOrg(null);
    }
  };

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { tokens } = response.data;

      // Update tokens
      localStorage.setItem('access_token', tokens.accessToken);
      localStorage.setItem('refresh_token', tokens.refreshToken);

      // Set authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  };

  const selectOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.org_id === orgId);
    if (org) {
      setCurrentOrg(org);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrg,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshToken,
        selectOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
