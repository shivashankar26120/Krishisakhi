import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';

function getErrMsg(err) {
  return err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || 'Something went wrong.';
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      nav('/', { replace: true });
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ks-auth-page">
      <div className="ks-auth-hero">
        <div className="ks-auth-logo">🌿</div>
        <h1>Krishi Sakhi</h1>
        <p>{t('auth.tagline')}</p>
      </div>

      <div className="ks-auth-form-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('auth.login')}</h2>
          <LanguageSelector />
        </div>

        {error && (
          <div className="ks-error mb-3">
            <span className="err-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label fw-600" htmlFor="login-email">{t('auth.email')}</label>
            <input
              id="login-email"
              type="email" required
              className="form-control"
              placeholder="farmer@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              autoComplete="email"
            />
          </div>
          <div className="mb-4">
            <label className="form-label fw-600" htmlFor="login-password">{t('auth.password')}</label>
            <input
              id="login-password"
              type="password" required
              className="form-control"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            style={{ fontSize: 16, padding: '14px' }}
            disabled={loading}
          >
            {loading ? t('auth.loggingIn') : t('auth.loginCta')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--ks-text-2)', fontSize: 14 }}>
          {t('auth.noAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--ks-green-600)', fontWeight: 600 }}>
            {t('auth.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '', preferredLanguage: 'kn' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await register(form);
      nav('/', { replace: true });
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="ks-auth-page">
      <div className="ks-auth-hero">
        <div className="ks-auth-logo">🌿</div>
        <h1>Krishi Sakhi</h1>
        <p>{t('auth.tagline')}</p>
      </div>

      <div className="ks-auth-form-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('auth.register')}</h2>
          <LanguageSelector />
        </div>

        {error && (
          <div className="ks-error mb-3">
            <span className="err-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label fw-600" htmlFor="reg-name">{t('auth.fullName')}</label>
            <input id="reg-name" type="text" className="form-control" value={form.fullName} onChange={set('fullName')} placeholder="ರಾಮೇಶ್ ಕುಮಾರ್" autoComplete="name" />
          </div>
          <div className="mb-3">
            <label className="form-label fw-600" htmlFor="reg-email">{t('auth.email')}</label>
            <input id="reg-email" type="email" required className="form-control" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <div className="mb-3">
            <label className="form-label fw-600" htmlFor="reg-phone">{t('auth.phone')}</label>
            <input id="reg-phone" type="tel" className="form-control" value={form.phone} onChange={set('phone')} placeholder="+91 9876543210" autoComplete="tel" />
          </div>
          <div className="mb-3">
            <label className="form-label fw-600" htmlFor="reg-lang">{t('auth.language')}</label>
            <select id="reg-lang" className="form-select" value={form.preferredLanguage} onChange={set('preferredLanguage')}>
              <option value="kn">ಕನ್ನಡ</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="form-label fw-600" htmlFor="reg-password">{t('auth.password')}</label>
            <input id="reg-password" type="password" required minLength={8} className="form-control" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary w-100" style={{ fontSize: 16, padding: 14 }} disabled={loading}>
            {loading ? t('auth.registering') : t('auth.registerCta')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--ks-text-2)', fontSize: 14 }}>
          {t('auth.hasAccount')}{' '}
          <Link to="/login" style={{ color: 'var(--ks-green-600)', fontWeight: 600 }}>{t('auth.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
