import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/UI/StateComponents';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="ks-page">
      <div className="ks-page-content" style={{ paddingTop: 60 }}>
        <EmptyState
          icon="🧭"
          title={t('common.notFound')}
          desc={t('common.pageNotFound')}
          action={
            <Link to="/" className="btn btn-primary mt-3">
              {t('common.goHome')}
            </Link>
          }
        />
      </div>
    </div>
  );
}
