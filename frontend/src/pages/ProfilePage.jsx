import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { farmerApi } from '../services/api';
import { LoadingSpinner, ErrorState, PageHeader } from '../components/UI/StateComponents';
import LanguageSelector from '../components/LanguageSelector';
import i18n from '../i18n';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { farmer, logout, refreshProfile } = useAuth();
  
  const [profile, setProfile] = useState({
    village: '',
    district: '',
    state: 'Karnataka',
    primaryCrops: [],
    landAreaAcres: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newCrop, setNewCrop] = useState('');

  useEffect(() => {
    farmerApi.getProfile()
      .then(({ data }) => {
        if (data.profile) {
          setProfile({
            village: data.profile.village || '',
            district: data.profile.district || '',
            state: data.profile.state || 'Karnataka',
            primaryCrops: data.profile.primary_crops || [],
            landAreaAcres: data.profile.land_area_acres || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addCrop = () => {
    const val = newCrop.trim();
    if (val && !profile.primaryCrops.includes(val)) {
      setProfile(p => ({ ...p, primaryCrops: [...p.primaryCrops, val] }));
      setNewCrop('');
    }
  };

  const removeCrop = (crop) => {
    setProfile(p => ({ ...p, primaryCrops: p.primaryCrops.filter(c => c !== crop) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await farmerApi.updateProfile({
        village: profile.village,
        district: profile.district,
        state: profile.state,
        primaryCrops: profile.primaryCrops,
        landAreaAcres: profile.landAreaAcres ? parseFloat(profile.landAreaAcres) : null,
      });
      await refreshProfile();
      setSuccess(t('profile.saved'));
    } catch (err) {
      setError(err?.response?.data?.error || t('common.serverError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="ks-page">
      <PageHeader title={t('profile.title')} />
      <div className="ks-page-content">

        {/* Farmer Card */}
        <div className="ks-card mb-4">
          <div className="ks-card-body d-flex align-items-center gap-3">
            <div className="ks-avatar">
              {farmer?.full_name ? farmer.full_name[0].toUpperCase() : '👨‍🌾'}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{farmer?.full_name || 'Farmer'}</h2>
              <p style={{ fontSize: 13, color: 'var(--ks-text-2)', margin: 0 }}>{farmer?.email}</p>
              {farmer?.phone && <p style={{ fontSize: 12, color: 'var(--ks-text-3)', margin: 0 }}>📞 {farmer.phone}</p>}
            </div>
          </div>
        </div>

        {/* Language Preference Card */}
        <div className="ks-card mb-4">
          <div className="ks-card-body d-flex justify-content-between align-items-center">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{t('profile.language')}</h3>
              <span style={{ fontSize: 12, color: 'var(--ks-text-3)' }}>
                {i18n.language?.startsWith('kn') ? 'ಕನ್ನಡ' : 'English'}
              </span>
            </div>
            <LanguageSelector />
          </div>
        </div>

        {/* Edit Form */}
        <div className="ks-card mb-4">
          <div className="ks-card-body">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('profile.title')}</h3>

            {error && <ErrorState message={error} />}
            {success && (
              <div className="alert alert-success py-2 px-3 mb-3" style={{ fontSize: 14 }}>
                ✓ {success}
              </div>
            )}

            <form onSubmit={submit}>
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-600" htmlFor="prof-village">{t('profile.village')}</label>
                  <input
                    id="prof-village"
                    type="text"
                    className="form-control"
                    value={profile.village}
                    onChange={e => setProfile(p => ({ ...p, village: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label fw-600" htmlFor="prof-district">{t('profile.district')}</label>
                  <input
                    id="prof-district"
                    type="text"
                    className="form-control"
                    value={profile.district}
                    onChange={e => setProfile(p => ({ ...p, district: e.target.value }))}
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-600" htmlFor="prof-state">{t('profile.state')}</label>
                  <input
                    id="prof-state"
                    type="text"
                    className="form-control"
                    value={profile.state}
                    onChange={e => setProfile(p => ({ ...p, state: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label fw-600" htmlFor="prof-land">{t('profile.landArea')}</label>
                  <input
                    id="prof-land"
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={profile.landAreaAcres}
                    onChange={e => setProfile(p => ({ ...p, landAreaAcres: e.target.value }))}
                  />
                </div>
              </div>

              {/* Crops tag input */}
              <div className="mb-4">
                <label className="form-label fw-600">{t('profile.crops')}</label>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {profile.primaryCrops.map(crop => (
                    <span key={crop} className="ks-crop-tag">
                      {crop}
                      <button type="button" onClick={() => removeCrop(crop)}>✕</button>
                    </span>
                  ))}
                </div>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t('profile.cropPlaceholder')}
                    value={newCrop}
                    onChange={e => setNewCrop(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCrop(); } }}
                  />
                  <button type="button" className="btn btn-outline-primary" onClick={addCrop}>
                    +
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={saving}
              >
                {saving ? t('profile.saving') : t('profile.save')}
              </button>
            </form>
          </div>
        </div>

        {/* Logout */}
        <button
          className="btn btn-outline-danger w-100 mb-4"
          onClick={logout}
        >
          {t('auth.logout')}
        </button>

      </div>
    </div>
  );
}
