import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import LanguageSelector from '../LanguageSelector';

// Lucide icons as inline SVG to avoid bundle bloat
const icons = {
  home:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  leaf:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0118 4.36a6 6 0 01-2.35 9.17A5 5 0 0111 20z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  chat:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  schemes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  mandi:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  user:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const NAV_ITEMS = [
  { to: '/',        key: 'nav.home',    icon: 'home'    },
  { to: '/disease', key: 'nav.disease', icon: 'leaf'    },
  { to: '/chat',    key: 'nav.chat',    icon: 'chat'    },
  { to: '/schemes', key: 'nav.schemes', icon: 'schemes' },
  { to: '/mandi',   key: 'nav.mandi',   icon: 'mandi'   },
];

export function TopNavbar() {
  const { t } = useTranslation();
  const { farmer, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="ks-navbar">
      <Link to="/" className="brand">
        <div className="brand-icon">🌿</div>
        <div>
          <span className="brand-name">Krishi Sakhi</span>
          <span className="brand-sub">ಕೃಷಿ ಸಖಿ</span>
        </div>
      </Link>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <LanguageSelector />

        {/* Desktop nav */}
        <div className="ks-desktop-nav" style={{ alignItems: 'center', gap: 4 }}>
          {NAV_ITEMS.map(n => (
            <Link
              key={n.to}
              to={n.to}
              className={`nav-link ${location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)) ? 'active' : ''}`}
            >
              {t(n.key)}
            </Link>
          ))}
        </div>

        {farmer && (
          <div className="d-flex align-items-center gap-2">
            <Link to="/profile" className="btn btn-sm btn-outline-primary d-none d-lg-inline-flex">
              {icons.user}
              <span style={{ marginLeft: 6, fontSize: 13 }}>{farmer.full_name?.split(' ')[0] || t('nav.profile')}</span>
            </Link>
            <button className="btn btn-sm btn-outline-secondary d-none d-lg-inline-flex" onClick={logout}>
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav className="ks-bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(n => (
        <Link
          key={n.to}
          to={n.to}
          className={`nav-item ${location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to)) ? 'active' : ''}`}
          aria-current={location.pathname === n.to ? 'page' : undefined}
        >
          <span className="nav-icon">{icons[n.icon]}</span>
          <span>{t(n.key)}</span>
        </Link>
      ))}
    </nav>
  );
}
