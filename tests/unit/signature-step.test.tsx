import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignatureStep } from '../../src/features/signature/SignatureStep';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { ServiceError } from '../../src/services/types';

/** jsdom has no canvas, so the pad is faked; the real one is exercised in the Playwright suite. */
const pads: FakePad[] = [];
vi.mock('signature_pad', () => ({
  default: class FakePad {
    data: Array<{ points: Array<{ x: number; y: number }> }> = [];
    handlers: Record<string, () => void> = {};
    constructor() {
      pads.push(this as never);
    }
    addEventListener(name: string, fn: () => void) {
      this.handlers[name] = fn;
    }
    off() {}
    toData() {
      return this.data;
    }
    fromData(d: FakePad['data']) {
      this.data = d;
    }
    clear() {
      this.data = [];
    }
    toDataURL() {
      return 'data:image/png;base64,DRAWN';
    }
  },
}));
type FakePad = {
  data: Array<{ points: Array<{ x: number; y: number }> }>;
  handlers: Record<string, () => void>;
};

const stroke = (length: number) => {
  const pad = pads.at(-1)!;
  pad.data = [{ points: [{ x: 0, y: 0 }, { x: length, y: 0 }] }];
  act(() => pad.handlers.endStroke!());
};

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const png = () => new File([new Uint8Array(PNG_HEAD)], 'sig.png', { type: 'image/png' });

function setup(opts: { onSubmit?: (s: unknown) => Promise<void> } = {}) {
  const onBack = vi.fn();
  const onSubmit = vi.fn(opts.onSubmit ?? (async () => {}));
  const processImage = vi.fn(async () => 'data:image/png;base64,UPLOADED');
  render(
    <I18nProvider>
      <SignatureStep onBack={onBack} onSubmit={onSubmit} processImage={processImage} />
    </I18nProvider>,
  );
  const user = userEvent.setup();
  return {
    user,
    onBack,
    onSubmit,
    processImage,
    submit: () => screen.getByRole('button', { name: /sign and submit|signing|submitting|وقّع وأرسل|جارٍ/i }),
    fileInput: () => document.querySelector('input[type="file"]') as HTMLInputElement,
  };
}

beforeEach(() => {
  pads.length = 0;
});

describe('SignatureStep', () => {
  it('shows the JSON closing statement, two tabs with Draw selected, and an inactive Submit', () => {
    const { submit } = setup();
    expect(screen.getByText(/By signing below, I affirm/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Draw' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Upload' })).toHaveAttribute('aria-selected', 'false');
    expect(submit()).toHaveAttribute('aria-disabled', 'true');
  });

  it('activates Submit only after a real stroke, and rejects an accidental dot', () => {
    const { submit } = setup();
    stroke(3);
    expect(submit()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/too short/i)).toBeInTheDocument();
    stroke(80);
    expect(submit()).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText(/too short/i)).toBeNull();
  });

  it('Clear and Undo take the signature back', async () => {
    const { user, submit } = setup();
    stroke(80);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(submit()).toHaveAttribute('aria-disabled', 'true');
    stroke(80);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(submit()).toHaveAttribute('aria-disabled', 'true');
  });

  it('accepts an uploaded PNG, shows a preview, and submits the upload', async () => {
    const { user, submit, fileInput, onSubmit } = setup();
    await user.click(screen.getByRole('tab', { name: 'Upload' }));
    await user.upload(fileInput(), png());
    expect(await screen.findByRole('img', { name: 'Your uploaded signature' })).toBeInTheDocument();
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ method: 'upload', dataUrl: 'data:image/png;base64,UPLOADED' }));
  });

  it.each([
    ['an SVG', new File(['<svg/>'], 's.svg', { type: 'image/svg+xml' }), /PNG or JPEG image/],
    ['a PDF', new File(['%PDF'], 's.pdf', { type: 'application/pdf' }), /PNG or JPEG image/],
    ['an empty file', new File([], 's.png', { type: 'image/png' }), /empty/],
    ['HTML pretending to be a PNG', new File(['<html><script>1</script></html>'], 's.png', { type: 'image/png' }), /PNG or JPEG image/],
  ])('rejects %s with a clear message', async (_n, file, message) => {
    const { user, fileInput, processImage, submit } = setup();
    await user.click(screen.getByRole('tab', { name: 'Upload' }));
    fireEvent.change(fileInput(), { target: { files: [file] } });
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(processImage).not.toHaveBeenCalled();
    expect(submit()).toHaveAttribute('aria-disabled', 'true');
  });

  it('rejects an oversize image', async () => {
    const { user, fileInput } = setup();
    await user.click(screen.getByRole('tab', { name: 'Upload' }));
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    fireEvent.change(fileInput(), { target: { files: [big] } });
    expect(await screen.findByText(/larger than 2 MB/)).toBeInTheDocument();
  });

  it('keeps each tab\'s work when switching, and submits only the tab that is showing', async () => {
    const { user, submit, fileInput, onSubmit } = setup();
    stroke(80); // draw tab has a signature
    await user.click(screen.getByRole('tab', { name: 'Upload' }));
    expect(submit()).toHaveAttribute('aria-disabled', 'true'); // upload tab has none yet
    await user.upload(fileInput(), png());
    await screen.findByRole('img', { name: 'Your uploaded signature' });
    await user.click(screen.getByRole('tab', { name: 'Draw' }));
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ method: 'draw', dataUrl: 'data:image/png;base64,DRAWN' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('allows one submission at a time and shows a stable pending label', async () => {
    let finish!: () => void;
    const { user, submit, onSubmit } = setup({ onSubmit: () => new Promise<void>((r) => (finish = r)) });
    stroke(80);
    await user.dblClick(submit());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submit()).toHaveAttribute('aria-busy', 'true');
    expect(submit()).toHaveTextContent('Submitting…');
    finish();
    await waitFor(() => expect(submit()).toHaveAttribute('aria-busy', 'false'));
  });

  it.each([
    [new ServiceError('network', 'x'), /can’t reach the server/i],
    [new ServiceError('invalid_submission', 'x'), /couldn’t submit/i],
  ])('keeps the signature and offers a retry after a failure', async (err, text) => {
    let calls = 0;
    const { user, submit, onSubmit } = setup({
      onSubmit: async () => {
        if (calls++ === 0) throw err;
      },
    });
    stroke(80);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(submit()).not.toHaveAttribute('aria-disabled', 'true'); // signature still there
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes back to the terms', async () => {
    const { user, onBack } = setup();
    await user.click(screen.getByRole('button', { name: 'Back to terms' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
