import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, farmerApi } from '../services/api';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [farmer, setFarmer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ks_farmer')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Sync language with profile preference
  const syncLanguage = useCallback((farmerData) => {
    if (farmerData?.preferred_language) {
      const lang = farmerData.preferred_language;
      if (lang !== i18n.language) {
        i18n.changeLanguage(lang);
        localStorage.setItem('ks_lang', lang);
      }
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('ks_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(({ data }) => {
        setFarmer(data.farmer);
        localStorage.setItem('ks_farmer', JSON.stringify(data.farmer));
        syncLanguage(data.farmer);
      })
      .catch(() => {
        localStorage.removeItem('ks_token');
        localStorage.removeItem('ks_farmer');
      })
      .finally(() => setLoading(false));
  }, [syncLanguage]);

  // Listen for global 401
  useEffect(() => {
    const handler = () => { setFarmer(null); };
    window.addEventListener('ks_unauthorized', handler);
    return () => window.removeEventListener('ks_unauthorized', handler);
  }, []);

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('ks_token', data.token);
    localStorage.setItem('ks_farmer', JSON.stringify(data.farmer));
    setFarmer(data.farmer);
    syncLanguage(data.farmer);
    return data.farmer;
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    localStorage.setItem('ks_token', data.token);
    localStorage.setItem('ks_farmer', JSON.stringify(data.farmer));
    setFarmer(data.farmer);
    return data.farmer;
  };

  const logout = () => {
    localStorage.removeItem('ks_token');
    localStorage.removeItem('ks_farmer');
    setFarmer(null);
  };

  const refreshProfile = async () => {
    try {
      const { data } = await farmerApi.getProfile();
      const updated = { ...farmer, profile: data.profile };
      setFarmer(updated);
      localStorage.setItem('ks_farmer', JSON.stringify(updated));
      return data.profile;
    } catch { return null; }
  };

  return (
    <AuthContext.Provider value={{ farmer, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
