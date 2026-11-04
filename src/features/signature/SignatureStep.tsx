import * as Tabs from '@radix-ui/react-tabs';
import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/I18nProvider';
import { loadTerms } from '../../lib/terms';
import { ServiceError } from '../../services/types';
import type { Signature, SignatureMethod } from '../../services/types';
import { DrawPad } from './DrawPad';
import { UploadZone } from './UploadZone';

const CLOSING = loadTerms().document.closing;

export function SignatureStep({
  onBack,
  onSubmit,
  onSessionExpired,
  processImage,
}: {
  onBack: () => void;
  onSubmit: (signature: Signature) => Promise<void>;
  onSessionExpired?: () => void;
  processImage?: (file: File) => Promise<string>;
}) {
  const { t, locale } = useI18n();
  const [method, setMethod] = useState<SignatureMethod>('draw');
  const [drawn, setDrawn] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const inFlight = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Only the tab that is showing counts: what the student sees is what is submitted.
  const dataUrl = method === 'draw' ? drawn : uploaded;
  const ready = dataUrl !== null;

  const submit = () => {
    if (inFlight.current) return;
    if (!dataUrl) {
      panelRef.current?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) canvas, [role="tabpanel"]:not([hidden]) input')?.focus();
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    onSubmit({ method, dataUrl })
      .catch((err: unknown) => {
        const code = err instanceof ServiceError ? err.code : 'network';
        if (code === 'session_expired' && onSessionExpired) return onSessionExpired();
        setFailure(code === 'network' ? 'error.network' : 'error.submit');
      })
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  };

  return (
    <section className="sign" aria-labelledby="sign-heading" ref={panelRef}>
      <h2 id="sign-heading" data-step-heading tabIndex={-1}>
        {t('sign.heading')}
      </h2>
      <p className="sign__closing">{CLOSING[locale]}</p>

      <Tabs.Root className="tabs" value={method} onValueChange={(v) => setMethod(v as SignatureMethod)} dir="ltr">
        <Tabs.List className="tabs__list" aria-label={t('sign.tabs.label')}>
          <Tabs.Trigger className="tabs__tab" value="draw">
            {t('sign.tab.draw')}
          </Tabs.Trigger>
          <Tabs.Trigger className="tabs__tab" value="upload">
            {t('sign.tab.upload')}
          </Tabs.Trigger>
        </Tabs.List>
        {/* forceMount: hidden tabs keep their work; switching never loses a signature. */}
        <Tabs.Content className="tabs__panel" value="draw" forceMount>
          <DrawPad onChange={setDrawn} />
        </Tabs.Content>
        <Tabs.Content className="tabs__panel" value="upload" forceMount>
          <UploadZone onChange={setUploaded} process={processImage} />
        </Tabs.Content>
      </Tabs.Root>

      {failure && (
        <p className="form__alert" role="alert">
          {t(failure)}
        </p>
      )}

      <div className="sign__actions">
        <Button type="button" busy={pending} onClick={submit} aria-disabled={ready ? undefined : 'true'} aria-describedby={ready ? undefined : 'sign-incomplete'}>
          <Icon name="sign" />
          <span>{pending ? t('sign.submitting') : t('sign.submit')}</span>
        </Button>
        <Button type="button" variant="quiet" onClick={onBack}>
          <Icon name="back" />
          <span>{t('sign.back')}</span>
        </Button>
      </div>
      {!ready && (
        <p id="sign-incomplete" className="terms__hint">
          {t('sign.incomplete')}
        </p>
      )}
    </section>
  );
}
