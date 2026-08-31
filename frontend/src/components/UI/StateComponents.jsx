import { useTranslation } from 'react-i18next';

export function LoadingSpinner({ text }) {
  const { t } = useTranslation();
  return (
    <div className="ks-loading">
      <div className="ks-spinner" />
      <p className="text-muted-ks" style={{ margin: 0, fontSize: 14 }}>
        {text || t('common.loading')}
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="ks-error" style={{ margin: '16px 0' }}>
      <span className="err-icon">⚠️</span>
      <div>
        <p>{message || t('common.error')}</p>
        {onRetry && (
          <button className="btn btn-sm btn-outline-primary mt-2" onClick={onRetry}>
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon = '🌱', title, desc, action }) {
  return (
    <div className="ks-empty">
      <div className="empty-icon">{icon}</div>
      {title && <h4>{title}</h4>}
      {desc && <p>{desc}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="ks-page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
