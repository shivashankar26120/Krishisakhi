import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { diseaseApi } from '../services/api';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '../components/UI/StateComponents';

function confidenceColor(c) {
  if (c >= 0.8) return 'var(--ks-green-600)';
  if (c >= 0.55) return 'var(--ks-gold)';
  return '#e74c3c';
}

export function DiseasePage() {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const [image, setImage] = useState(null);      // { file, preview }
  const [cropName, setCropName] = useState('');
  const [withGradcam, setWithGradcam] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return; }
    setImage({ file, preview: URL.createObjectURL(file) });
    setResult(null); setError('');
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const analyze = async () => {
    if (!image) { setError(t('disease.noImage')); return; }
    setLoading(true); setError('');
    const fd = new FormData();
    fd.append('file', image.file);
    fd.append('with_gradcam', withGradcam ? 'true' : 'false');
    if (cropName) fd.append('crop_name', cropName);
    try {
      const { data } = await diseaseApi.predict(fd);
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.error || t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null); setResult(null); setError('');
    if (image?.preview) URL.revokeObjectURL(image.preview);
  };

  return (
    <div className="ks-page">
      <PageHeader title={t('disease.title')} subtitle={t('disease.subtitle')} />
      <div className="ks-page-content">

        {/* Upload / Preview */}
        {!result && (
          <>
            {!image ? (
              <>
                <div
                  className={`ks-upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                  aria-label={t('disease.uploadBtn')}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture={false}
                    onChange={(e) => handleFile(e.target.files[0])}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <div className="upload-icon">📷</div>
                  <div className="upload-text">{t('disease.dragDrop')}</div>
                  <div className="upload-hint">{t('disease.uploadHint')}</div>
                </div>

                {/* Camera button */}
                <div className="d-flex gap-2 mt-3">
                  <button
                    className="btn btn-outline-primary flex-1"
                    style={{ flex: 1 }}
                    onClick={() => cameraRef.current?.click()}
                  >
                    📸 {t('disease.cameraBtn')}
                  </button>
                  <button
                    className="btn btn-outline-primary flex-1"
                    style={{ flex: 1 }}
                    onClick={() => fileRef.current?.click()}
                  >
                    🖼️ {t('disease.uploadBtn')}
                  </button>
                </div>

                {/* Hidden camera input */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files[0])}
                  aria-label="Take photo with camera"
                />
              </>
            ) : (
              <>
                <div className="ks-image-preview mb-3">
                  <img src={image.preview} alt="Selected crop" />
                  <div className="preview-actions">
                    <button className="btn btn-sm btn-light" onClick={reset} aria-label="Remove image">✕</button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-600" htmlFor="crop-name">{t('disease.cropLabel')}</label>
                  <input
                    id="crop-name"
                    type="text"
                    className="form-control"
                    placeholder={t('disease.cropPlaceholder')}
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                  />
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="with-gradcam"
                    checked={withGradcam}
                    onChange={(e) => setWithGradcam(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="with-gradcam">
                    {t('disease.withGradcam')}
                  </label>
                </div>

                {error && <ErrorState message={error} />}

                <button
                  className="btn btn-primary w-100"
                  style={{ fontSize: 16, padding: 14 }}
                  onClick={analyze}
                  disabled={loading}
                >
                  {loading ? t('disease.analyzing') : t('disease.analyzeBtn')}
                </button>
                {loading && <LoadingSpinner text={t('disease.analyzing')} />}
              </>
            )}
          </>
        )}

        {/* Result */}
        {result && (
          <div className="anim-fade-up">
            <div className="ks-result-card mb-3">
              <div className="ks-result-header">
                <p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.8 }}>{t('disease.predicted')}</p>
                <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700 }}>
                  {result.predicted_disease}
                </h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{t('disease.confidence')}</span>
                  <span style={{ fontWeight: 700 }}>{Math.round((result.confidence || 0) * 100)}%</span>
                </div>
                <div className="ks-confidence-bar">
                  <div
                    className="ks-confidence-fill"
                    style={{ width: `${Math.round((result.confidence || 0) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Low confidence warning */}
              {result.low_confidence && (
                <div className="ks-low-confidence mx-3 mt-3">
                  <span>⚠️</span>
                  <p>{t('disease.lowConfidence')}</p>
                </div>
              )}

              {/* Top 5 */}
              {result.top5?.length > 0 && (
                <div style={{ padding: '16px 20px' }}>
                  <p className="ks-section-label">{t('disease.top5')}</p>
                  {result.top5.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--ks-border)', fontSize: 14 }}>
                      <span style={{ color: 'var(--ks-text-2)' }}>{item.class || item.class_}</span>
                      <span style={{ fontWeight: 600, color: confidenceColor(item.confidence) }}>
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Original + Grad-CAM */}
            {(image?.preview || result.gradcam_image) && (
              <div style={{ display: 'grid', gridTemplateColumns: result.gradcam_image ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
                {image?.preview && (
                  <div className="ks-gradcam">
                    <img src={image.preview} alt="Original crop" />
                    <span className="gradcam-label">Original</span>
                  </div>
                )}
                {result.gradcam_image && (
                  <div className="ks-gradcam">
                    <img
                      src={`data:image/jpeg;base64,${result.gradcam_image}`}
                      alt={t('disease.gradcam')}
                    />
                    <span className="gradcam-label">{t('disease.gradcam')}</span>
                  </div>
                )}
              </div>
            )}

            {result.gradcam_image && (
              <p style={{ fontSize: 12, color: 'var(--ks-text-3)', textAlign: 'center', marginBottom: 16 }}>
                📍 {t('disease.gradcamHint')}
              </p>
            )}

            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary flex-1" style={{ flex: 1 }} onClick={reset}>
                {t('disease.tryAnother')}
              </button>
              <Link to="/disease/history" className="btn btn-primary flex-1" style={{ flex: 1 }}>
                {t('disease.history')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DiseaseHistoryPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = async (p = 1) => {
    setLoading(true); setError('');
    try {
      const { data } = await diseaseApi.getHistory(p);
      setHistory(data.analyses);
      setPagination(data.pagination);
    } catch (err) {
      setError(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useState(() => { load(1); }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorState message={error} onRetry={() => load(page)} />;

  if (selected) {
    return (
      <div className="ks-page">
        <div className="ks-page-header d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-link p-0" onClick={() => setSelected(null)} aria-label={t('common.back')}>←</button>
          <h1 style={{ margin: 0, fontSize: 18 }}>{t('disease.result')}</h1>
        </div>
        <div className="ks-page-content">
          <div className="ks-result-card">
            <div className="ks-result-header">
              <p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.8 }}>{t('disease.predicted')}</p>
              <h2 style={{ margin: 0, fontSize: 20 }}>{selected.predicted_disease}</h2>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.85 }}>
                {Math.round((selected.confidence || 0) * 100)}% {t('disease.confidence')}
              </p>
            </div>
            <div style={{ padding: 20 }}>
              {selected.crop_name && <p><strong>{t('disease.cropLabel')}:</strong> {selected.crop_name}</p>}
              {selected.notes && <p><strong>Notes:</strong> {selected.notes}</p>}
              <p style={{ fontSize: 12, color: 'var(--ks-text-3)' }}>{new Date(selected.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ks-page">
      <div className="ks-page-header d-flex align-items-center gap-2">
        <Link to="/disease" className="btn btn-sm btn-link p-0" aria-label={t('common.back')}>←</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>{t('disease.history')}</h1>
        </div>
      </div>
      <div className="ks-page-content">
        {history.length === 0 ? (
          <EmptyState icon="🌿" title={t('disease.historyEmpty')} desc={t('disease.historyEmptyDesc')}
            action={<Link to="/disease" className="btn btn-primary mt-3">{t('disease.analyzeBtn')}</Link>} />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((item) => (
                <button
                  key={item.id}
                  className="ks-history-item"
                  style={{ width: '100%', textAlign: 'left', background: 'var(--ks-surface)', border: '1px solid var(--ks-border)' }}
                  onClick={() => setSelected(item)}
                  aria-label={`${item.predicted_disease} - ${Math.round((item.confidence||0)*100)}%`}
                >
                  <div className="ks-history-thumb">
                    {item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : '🍃'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{item.predicted_disease}</div>
                    <div style={{ fontSize: 12, color: 'var(--ks-text-3)' }}>
                      {Math.round((item.confidence||0)*100)}% • {item.crop_name || '—'} • {new Date(item.created_at).toLocaleDateString()}
                    </div>
                    {item.low_confidence && <span style={{ fontSize: 11, color: '#e67e22' }}>⚠️ Low confidence</span>}
                  </div>
                  <span style={{ color: 'var(--ks-text-3)', fontSize: 18 }}>›</span>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                <button className="btn btn-sm btn-outline-primary" disabled={page === 1}
                  onClick={() => { setPage(p => p - 1); load(page - 1); }}>‹</button>
                <span style={{ fontSize: 13, padding: '6px 12px' }}>{page} / {pagination.pages}</span>
                <button className="btn btn-sm btn-outline-primary" disabled={page >= pagination.pages}
                  onClick={() => { setPage(p => p + 1); load(page + 1); }}>›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
