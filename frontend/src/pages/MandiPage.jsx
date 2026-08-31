import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { marketApi } from '../services/api';
import { LoadingSpinner, ErrorState, PageHeader } from '../components/UI/StateComponents';

function PriceCard({ item, t }) {
  return (
    <div className="ks-price-card mb-3">
      <div className="price-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{item.commodity}</div>
            {item.variety && <div style={{ fontSize: 13, opacity: 0.8 }}>{item.variety}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.8 }}>
            <div>📍 {item.market || item.district}</div>
            <div>{item.arrival_date}</div>
          </div>
        </div>
      </div>
      <div className="ks-price-grid">
        <div className="ks-price-item">
          <div className="ks-price-value">₹{item.min_price || item.minimum_price || '—'}</div>
          <div className="ks-price-label">{t('mandi.minPrice')}</div>
        </div>
        <div className="ks-price-item" style={{ background: 'var(--ks-green-50)' }}>
          <div className="ks-price-value" style={{ color: 'var(--ks-green-700)', fontSize: 22 }}>
            ₹{item.modal_price || '—'}
          </div>
          <div className="ks-price-label">{t('mandi.modalPrice')}</div>
        </div>
        <div className="ks-price-item">
          <div className="ks-price-value">₹{item.max_price || item.maximum_price || '—'}</div>
          <div className="ks-price-label">{t('mandi.maxPrice')}</div>
        </div>
      </div>
      {item.state && (
        <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--ks-text-3)', borderTop: '1px solid var(--ks-border)' }}>
          {item.state} • {t('mandi.perQuintal')}
        </div>
      )}
    </div>
  );
}

export default function MandiPage() {
  const { t } = useTranslation();
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [search, setSearch] = useState('');
  const [commodity, setCommodity] = useState('');
  const [state, setState] = useState('Karnataka');

  const load = async () => {
    setLoading(true); setError(''); setUnavailable(false);
    try {
      const params = {};
      if (commodity) params.commodity = commodity;
      if (state) params.state = state;
      const { data } = await marketApi.getPrices(params);
      if (data.available === false) { setUnavailable(true); }
      else { setPrices(data.prices || data.records || []); }
    } catch (err) {
      if (err?.response?.status === 503) { setUnavailable(true); }
      else { setError(err?.response?.data?.error || t('common.serverError')); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = prices.filter(p =>
    !search || p.commodity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ks-page">
      <PageHeader title={t('mandi.title')} subtitle={t('mandi.subtitle')} />
      <div className="ks-page-content">

        {unavailable ? (
          <div className="ks-coming-soon">
            <div className="cs-icon">📊</div>
            <h2>{t('mandi.comingSoon')}</h2>
            <p>{t('mandi.unavailable')}</p>
            <div style={{ background: 'var(--ks-green-50)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: 20, marginTop: 24, textAlign: 'left' }}>
              <p className="ks-section-label">📋 Data Source</p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ks-text-2)' }}>
                {t('mandi.source')} — AGMARKNET / eNAM API
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="form-control" type="search" placeholder={t('mandi.search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('mandi.search')} />
              <button className="btn btn-outline-primary" style={{ flexShrink: 0 }} onClick={load} aria-label="Refresh">↻</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="form-control" type="text" placeholder={t('mandi.commodity')} value={commodity} onChange={(e) => setCommodity(e.target.value)} aria-label={t('mandi.commodity')} style={{ flex: 1 }} />
              <input className="form-control" type="text" placeholder={t('mandi.state')} value={state} onChange={(e) => setState(e.target.value)} aria-label={t('mandi.state')} style={{ flex: 1 }} />
              <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={load}>Search</button>
            </div>

            {error && <ErrorState message={error} onRetry={load} />}
            {loading ? <LoadingSpinner text={t('mandi.loading')} /> : (
              <>
                {filtered.length === 0 ? (
                  <div className="ks-empty">
                    <div className="empty-icon">📈</div>
                    <h4>{t('mandi.noData')}</h4>
                  </div>
                ) : (
                  <>
                    {filtered.map((item, i) => <PriceCard key={i} item={item} t={t} />)}
                    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ks-text-3)', marginTop: 8 }}>
                      {t('mandi.source')}
                    </p>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
