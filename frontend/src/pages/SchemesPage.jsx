import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { schemesApi } from '../services/api';
import { LoadingSpinner, EmptyState, ErrorState, PageHeader } from '../components/UI/StateComponents';

const TYPE_ICONS = { subsidy: '💰', insurance: '🛡️', loan: '🏦', training: '📚', other: '📋' };

function SchemeCard({ scheme, lang, onClick }) {
  const { t } = useTranslation();
  const name = (lang === 'kn' && scheme.scheme_name_kn) ? scheme.scheme_name_kn : scheme.scheme_name;
  const desc = (lang === 'kn' && scheme.description_kn) ? scheme.description_kn : scheme.description;

  return (
    <div className="ks-scheme-card" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()} aria-label={name}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <span className={`ks-scheme-type type-${scheme.scheme_type || 'other'}`}>
            {TYPE_ICONS[scheme.scheme_type] || '📋'} {t(`schemes.${scheme.scheme_type || 'other'}`)}
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--ks-text)' }}>{name}</h3>
        </div>
        <span style={{ fontSize: 11, background: scheme.is_central ? 'var(--ks-green-100)' : '#e8f0fe', color: scheme.is_central ? 'var(--ks-green-700)' : '#1a5276', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', fontWeight: 600 }}>
          {scheme.is_central ? t('schemes.central') : t('schemes.state')}
        </span>
      </div>
      {desc && <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ks-text-2)', lineHeight: 1.5 }}>{desc}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ks-text-3)' }}>{scheme.ministry}</span>
        <span style={{ fontSize: 13, color: 'var(--ks-green-600)', fontWeight: 600 }}>{t('schemes.viewDetails')} →</span>
      </div>
    </div>
  );
}

function SchemeDetail({ scheme, lang, onBack }) {
  const { t } = useTranslation();
  const name = (lang === 'kn' && scheme.scheme_name_kn) ? scheme.scheme_name_kn : scheme.scheme_name;
  const desc = (lang === 'kn' && scheme.description_kn) ? scheme.description_kn : scheme.description;
  const eligibility = (lang === 'kn' && scheme.eligibility_kn) ? scheme.eligibility_kn : scheme.eligibility;
  const benefits = (lang === 'kn' && scheme.benefits_kn) ? scheme.benefits_kn : scheme.benefits;

  return (
    <div className="ks-page">
      <div className="ks-page-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-sm btn-link p-0" onClick={onBack} aria-label={t('schemes.back')}>←</button>
        <h1 style={{ margin: 0, fontSize: 18 }}>{t('schemes.title')}</h1>
      </div>
      <div className="ks-page-content">
        <div className="ks-card mb-3">
          <div style={{ background: 'linear-gradient(135deg,var(--ks-green-700),var(--ks-green-600))', padding: '24px 20px', color: '#fff' }}>
            <span className={`ks-scheme-type type-${scheme.scheme_type}`} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', marginBottom: 12 }}>
              {TYPE_ICONS[scheme.scheme_type]} {t(`schemes.${scheme.scheme_type || 'other'}`)}
            </span>
            <h2 style={{ margin: '10px 0 0', fontSize: 20, fontWeight: 700 }}>{name}</h2>
          </div>
          <div className="ks-card-body">
            {desc && (
              <div style={{ marginBottom: 20 }}>
                <p className="ks-section-label">{t('schemes.ministry')}</p>
                <p style={{ fontSize: 14, margin: 0 }}>{scheme.ministry}</p>
              </div>
            )}
            {desc && (
              <div style={{ marginBottom: 20 }}>
                <p className="ks-section-label">Description</p>
                <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{desc}</p>
              </div>
            )}
            {eligibility && (
              <div style={{ marginBottom: 20, background: 'var(--ks-green-50)', padding: 16, borderRadius: 10 }}>
                <p className="ks-section-label">✅ {t('schemes.eligibility')}</p>
                <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{eligibility}</p>
              </div>
            )}
            {benefits && (
              <div style={{ marginBottom: 20, background: '#fff8e6', padding: 16, borderRadius: 10 }}>
                <p className="ks-section-label">🎁 {t('schemes.benefits')}</p>
                <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>{benefits}</p>
              </div>
            )}
            {scheme.application_url && (
              <a
                href={scheme.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary w-100"
                style={{ fontSize: 15 }}
              >
                🔗 {t('schemes.officialLink')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SchemesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('kn') ? 'kn' : 'en';

  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [centralFilter, setCentralFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const TYPES = ['', 'subsidy', 'insurance', 'loan', 'training'];

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (search) params.q = search;
      if (typeFilter) params.type = typeFilter;
      if (centralFilter !== '') params.is_central = centralFilter;
      const { data } = await schemesApi.list(params);
      setSchemes(data.schemes || []);
    } catch {
      setError(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, centralFilter, t]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (selected) return <SchemeDetail scheme={selected} lang={lang} onBack={() => setSelected(null)} />;

  return (
    <div className="ks-page">
      <PageHeader title={t('schemes.title')} subtitle={t('schemes.subtitle')} />
      <div className="ks-page-content">
        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            className="form-control"
            type="search"
            placeholder={t('schemes.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('schemes.search')}
          />
        </div>

        {/* Type filters */}
        <div className="ks-filter-tabs mb-3">
          {TYPES.map(type => (
            <button
              key={type || 'all'}
              className={`ks-filter-tab ${typeFilter === type ? 'active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {type ? `${TYPE_ICONS[type]} ${t(`schemes.${type}`)}` : t('schemes.all')}
            </button>
          ))}
          <button className={`ks-filter-tab ${centralFilter === 'true' ? 'active' : ''}`} onClick={() => setCentralFilter(centralFilter === 'true' ? '' : 'true')}>{t('schemes.central')}</button>
          <button className={`ks-filter-tab ${centralFilter === 'false' ? 'active' : ''}`} onClick={() => setCentralFilter(centralFilter === 'false' ? '' : 'false')}>{t('schemes.state')}</button>
        </div>

        {error && <ErrorState message={error} onRetry={load} />}

        {loading ? <LoadingSpinner text={t('schemes.loading')} /> : schemes.length === 0 ? (
          <EmptyState icon="📋" title={t('schemes.noSchemes')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schemes.map(s => (
              <SchemeCard key={s.id} scheme={s} lang={lang} onClick={() => setSelected(s)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
