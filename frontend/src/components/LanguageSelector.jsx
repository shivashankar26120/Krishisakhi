import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

export default function LanguageSelector({ className = '' }) {
  const { i18n: i18nInstance } = useTranslation();
  const current = i18nInstance.language?.startsWith('kn') ? 'kn' : 'en';

  const set = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('ks_lang', lang);
  };

  return (
    <div className={`ks-lang-toggle ${className}`} role="group" aria-label="Language selector">
      <button
        className={current === 'kn' ? 'active' : ''}
        onClick={() => set('kn')}
        aria-pressed={current === 'kn'}
      >
        ಕನ್ನಡ
      </button>
      <button
        className={current === 'en' ? 'active' : ''}
        onClick={() => set('en')}
        aria-pressed={current === 'en'}
      >
        EN
      </button>
    </div>
  );
}
