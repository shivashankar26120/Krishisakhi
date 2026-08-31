import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { to: '/disease', icon: '🔬', colorClass: 'bg-green',   titleKey: 'dashboard.diseaseCard',  descKey: 'dashboard.diseaseDesc',  bg: 'linear-gradient(135deg,#e8f5ec,#d1f0db)' },
  { to: '/chat',    icon: '💬', colorClass: 'bg-blue',    titleKey: 'dashboard.chatCard',    descKey: 'dashboard.chatDesc',    bg: 'linear-gradient(135deg,#e8f0fe,#d3e3fd)' },
  { to: '/schemes', icon: '📋', colorClass: 'bg-orange',  titleKey: 'dashboard.schemesCard', descKey: 'dashboard.schemesDesc', bg: 'linear-gradient(135deg,#fff3e0,#ffe0b2)' },
  { to: '/mandi',   icon: '💰', colorClass: 'bg-gold',    titleKey: 'dashboard.mandiCard',   descKey: 'dashboard.mandiDesc',   bg: 'linear-gradient(135deg,#fff8e6,#ffeeb8)' },
];

const ICON_BG = {
  'bg-green':  'linear-gradient(135deg,#2d7a45,#1e6135)',
  'bg-blue':   'linear-gradient(135deg,#1565c0,#0d47a1)',
  'bg-orange': 'linear-gradient(135deg,#e65100,#bf360c)',
  'bg-gold':   'linear-gradient(135deg,#f5a623,#d4891a)',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const { farmer } = useAuth();
  const firstName = farmer?.full_name?.split(' ')[0] || '';

  return (
    <div className="ks-page">
      {/* Hero */}
      <div className="ks-hero">
        <div className="greeting">
          👋 {t('dashboard.greeting')}{firstName ? `, ${firstName}` : ''}!
        </div>
        <h1 style={{ whiteSpace: 'pre-line' }}>{t('dashboard.heroTitle')}</h1>
        <p>{t('dashboard.heroSubtitle')}</p>
      </div>

      <div className="ks-page-content" style={{ paddingTop: 24 }}>
        <p className="ks-section-label">{t('dashboard.subtitle')}</p>

        {/* Feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
          {FEATURES.map((f, i) => (
            <Link
              key={f.to}
              to={f.to}
              className={`ks-feature-card anim-fade-up anim-delay-${i + 1}`}
              style={{ background: f.bg }}
              aria-label={t(f.titleKey)}
            >
              <div
                className="card-icon"
                style={{ background: ICON_BG[f.colorClass] }}
              >
                {f.icon}
              </div>
              <h3>{t(f.titleKey)}</h3>
              <p>{t(f.descKey)}</p>
            </Link>
          ))}
        </div>

        {/* Quick tips */}
        <div className="ks-card anim-fade-up" style={{ marginBottom: 16 }}>
          <div className="ks-card-body">
            <p className="ks-section-label">💡 Tip</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ks-text-2)' }}>
              {t('i18n') === 'i18n'
                ? 'Upload a clear photo of a single leaf for the best disease detection results.'
                : 'ಉತ್ತಮ ರೋಗ ಪತ್ತೆಗಾಗಿ ಒಂದೇ ಎಲೆಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
