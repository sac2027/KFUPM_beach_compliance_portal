import { ArrowLeft, ArrowRight, Download, Eraser, Languages, LogIn, MailCheck, MailWarning, PenLine, Printer, RotateCcw, Undo2, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

/**
 * One icon vocabulary (lucide, outline, 18 px, stroke 1.75), always beside a text label, never alone and never in a
 * tinted disc. Directional icons are chosen per writing direction rather than mirrored with a transform, so nothing in
 * the stylesheets ever flips (the brand artwork must never be mirrored, and a blanket test enforces that).
 */
const ICONS = {
  'sign-in': LogIn,
  forward: ArrowRight,
  back: ArrowLeft,
  sign: PenLine,
  download: Download,
  print: Printer,
  clear: Eraser,
  undo: Undo2,
  upload: Upload,
  language: Languages,
  'mail-sent': MailCheck,
  'mail-failed': MailWarning,
  retry: RotateCcw,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
const DIRECTIONAL: Partial<Record<IconName, IconName>> = { forward: 'back', back: 'forward' };

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const { dir } = useI18n();
  const Component = ICONS[dir === 'rtl' && DIRECTIONAL[name] ? DIRECTIONAL[name]! : name];
  return <Component className="icon" size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
