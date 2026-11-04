import { useI18n } from '../i18n/I18nProvider';
import { LanguageToggle } from './LanguageToggle';

/** One quiet bar: the Full Stacked lockup (unaltered, its transparent padding is the clear space) and the language switch. */
export function Masthead() {
  const { t } = useI18n();
  return (
    <header className="masthead">
      <div className="masthead__bar">
        <img className="masthead__logo" src="/brand/full-stacked-negative.png" alt={t('brand.logoAlt')} width={196} height={80} fetchPriority="high" />
        <LanguageToggle />
      </div>
    </header>
  );
}
