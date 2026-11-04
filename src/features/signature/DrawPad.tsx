import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/I18nProvider';
import { MIN_STROKE_LENGTH, totalStrokeLength } from '../../lib/signature';

/**
 * Drawing surface (signature_pad does the smoothing). Reports a PNG data URL once there is at least
 * MIN_STROKE_LENGTH of ink, otherwise null. The canvas keeps its strokes when it is resized or hidden
 * and shown again (tab switch, rotation, window resize).
 */
export function DrawPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const onChangeRef = useRef(onChange);
  const [short, setShort] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const pad = new SignaturePad(canvas, { penColor: '#000000', minWidth: 1.2, maxWidth: 3.2 });
    padRef.current = pad;

    const sync = () => {
      const strokes = pad.toData().map((g) => g.points);
      const enough = totalStrokeLength(strokes) >= MIN_STROKE_LENGTH;
      setShort(strokes.length > 0 && !enough);
      onChangeRef.current(enough ? pad.toDataURL('image/png') : null);
    };
    pad.addEventListener('endStroke', sync);

    // Match the canvas bitmap to its CSS size and device pixel ratio, keeping the ink.
    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return; // hidden (inactive tab)
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);
      if (canvas.width === w && canvas.height === h) return;
      const ink = pad.toData();
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      pad.fromData(ink);
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(canvas);

    return () => {
      observer?.disconnect();
      pad.off();
    };
  }, []);

  const clear = () => {
    padRef.current?.clear();
    setShort(false);
    onChangeRef.current(null);
  };

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const ink = pad.toData();
    ink.pop();
    pad.fromData(ink);
    const enough = totalStrokeLength(ink.map((g) => g.points)) >= MIN_STROKE_LENGTH;
    setShort(ink.length > 0 && !enough);
    onChangeRef.current(enough ? pad.toDataURL('image/png') : null);
  };

  return (
    <div className="pad">
      <div className="pad__surface">
        <canvas ref={canvasRef} className="pad__canvas" role="img" aria-label={t('sign.draw.label')} />
        <span className="pad__line" aria-hidden="true" />
      </div>
      <p className="pad__hint" id="pad-hint">
        {t('sign.draw.hint')}
      </p>
      {short && (
        <p className="field__error" role="status">
          {t('sign.draw.short')}
        </p>
      )}
      <div className="pad__tools">
        <Button type="button" variant="quiet" onClick={undo}>
          <Icon name="undo" />
          <span>{t('sign.draw.undo')}</span>
        </Button>
        <Button type="button" variant="quiet" onClick={clear}>
          <Icon name="clear" />
          <span>{t('sign.draw.clear')}</span>
        </Button>
      </div>
    </div>
  );
}
