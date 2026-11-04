import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/I18nProvider';
import { rasteriseImage, SignatureImageError, sniffImageType, validateSignatureFile } from '../../lib/signature';

/** Drag-and-drop or choose a file. Checks the claimed type and size, then the real bytes, then re-encodes. */
export function UploadZone({
  onChange,
  process = rasteriseImage,
}: {
  onChange: (dataUrl: string | null) => void;
  process?: (file: File) => Promise<string>;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [over, setOver] = useState(false);

  const reject = (key: MessageKey) => {
    setProblem(key);
    setPreview(null);
    onChange(null);
  };

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    const checked = validateSignatureFile(file);
    if (!checked.ok) return reject(`error.sig.${checked.reason}` as MessageKey);
    if (!(await sniffImageType(file))) return reject('error.sig.type');
    try {
      const dataUrl = await process(file);
      setPreview(dataUrl);
      onChange(dataUrl);
    } catch (err) {
      reject(err instanceof SignatureImageError ? (`error.sig.${err.reason}` as MessageKey) : 'error.sig.read');
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    void accept(e.target.files?.[0]);
    e.target.value = ''; // choosing the same file again must still fire
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    void accept(e.dataTransfer.files[0]); // one signature: a second dropped file replaces the first
  };

  return (
    <div className="upload">
      <label
        className="drop"
        data-over={over ? 'true' : 'false'}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input className="drop__input" type="file" accept="image/png,image/jpeg" onChange={onInput} aria-describedby="upload-hint" />
        <span className="drop__body">
          <Icon name="upload" size={22} />
          <span>
            {t('sign.upload.prompt')} <span className="drop__browse">{t('sign.upload.browse')}</span>
          </span>
        </span>
      </label>
      <p className="pad__hint" id="upload-hint">
        {t('sign.upload.hint')}
      </p>
      {problem && (
        <p className="field__error" role="alert">
          {t(problem)}
        </p>
      )}
      {preview && (
        <div className="upload__preview">
          <img src={preview} alt={t('sign.upload.preview')} />
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
          >
            {t('sign.upload.remove')}
          </Button>
        </div>
      )}
    </div>
  );
}
