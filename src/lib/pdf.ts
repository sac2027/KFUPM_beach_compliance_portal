/**
 * Renders the printable declaration (.print-sheet) to an A4 PDF in the browser, so the file the student downloads,
 * the file stored in the record and the file emailed are one and the same.
 * Raster at 2× (html-to-image), placed on A4 pages (pdf-lib). Upgrade path: Cloudflare Browser Rendering for vector.
 *
 * The sheet is laid out at the printable width (182 mm) in the same physical units the browser's Print uses
 * (src/styles/print.css), so the PDF and the printed page agree. The standard wording is one page; a little overrun
 * is shrunk to fit; real overflow (long staff-edited text) continues on further pages.
 */
import { toCanvas } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';

const MM_PT = 72 / 25.4; // points per millimetre
const MM_PX = 96 / 25.4; // CSS pixels per millimetre
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_X_MM = 14;
const MARGIN_Y_MM = 12;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_X_MM; // 182
const CONTENT_H_MM = PAGE_H_MM - 2 * MARGIN_Y_MM; // 273
const PIXEL_RATIO = 2;
/** Overrun up to this share of a page is scaled down to keep one page; beyond it the content continues on a second page. */
const MAX_SHRINK = 0.12;
const ATTEMPTS = 3;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

/** True when the rectangle (in CSS px, relative to the captured element) contains any ink: some pixel that is not near-white. */
export function hasInk(canvas: HTMLCanvasElement, rect: { x: number; y: number; w: number; h: number }, ratio = PIXEL_RATIO): boolean {
  const x = Math.max(0, Math.floor(rect.x * ratio));
  const y = Math.max(0, Math.floor(rect.y * ratio));
  const w = Math.min(canvas.width - x, Math.ceil(rect.w * ratio));
  const h = Math.min(canvas.height - y, Math.ceil(rect.h * ratio));
  if (w <= 0 || h <= 0) return false;
  const { data } = canvas.getContext('2d')!.getImageData(x, y, w, h);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! > 40 && data[i]! + data[i + 1]! + data[i + 2]! < 600) return true; // opaque and darker than ~#c8c8c8
  }
  return false;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every image decoded before capture: a half-loaded image is simply left out of the raster (seen on Safari and on slow phones). */
async function imagesReady(root: HTMLElement): Promise<void> {
  await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
}

export async function renderDeclarationPdf(sheet: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  // Lay the sheet out at print width, off-screen but rendered, then capture it.
  const stage = document.createElement('div');
  stage.setAttribute('aria-hidden', 'true');
  stage.setAttribute('data-capture-stage', ''); // tests and tooling can ignore this transient off-screen element
  Object.assign(stage.style, { position: 'fixed', insetInlineStart: '-10000px', top: '0', width: `${CONTENT_W_MM}mm`, background: '#fff', zIndex: '-1' });
  const clone = sheet.cloneNode(true) as HTMLElement;
  clone.classList.add('print-sheet--capture');
  stage.appendChild(clone);
  document.body.appendChild(stage);
  try {
    await imagesReady(clone);
    const signature = clone.querySelector<HTMLElement>('.print-sheet__signature');

    // The signature is the point of the document: a capture without ink in its place is never accepted.
    let canvas: HTMLCanvasElement | null = null;
    for (let attempt = 0; attempt < ATTEMPTS && !canvas; attempt++) {
      if (attempt > 0) await wait(250 * attempt);
      const sheetBox = clone.getBoundingClientRect();
      const c = await toCanvas(clone, { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', cacheBust: false });
      const box = signature?.getBoundingClientRect();
      if (!box || hasInk(c, { x: box.left - sheetBox.left, y: box.top - sheetBox.top, w: box.width, h: box.height })) canvas = c;
    }
    if (!canvas) throw new Error('signature did not render');

    const pdf = await PDFDocument.create();
    pdf.setTitle('KFUPM Pre-Arrival Compliance Form');
    pdf.setProducer('KFUPM Pre-Arrival Compliance Portal');
    const pagePx = CONTENT_H_MM * MM_PX * PIXEL_RATIO; // canvas pixels that fill one page's content height
    const fitsOnePage = canvas.height <= pagePx * (1 + MAX_SHRINK);
    // Points per canvas pixel: the sheet's width on the page, shrunk only when a slight overrun is being fitted to one page.
    const scale = (CONTENT_W_MM * MM_PT) / canvas.width / (fitsOnePage && canvas.height > pagePx ? canvas.height / pagePx : 1);
    const sliceHeightPx = fitsOnePage ? canvas.height : Math.floor(pagePx);
    for (let y = 0; y < canvas.height; y += sliceHeightPx) {
      const h = Math.min(sliceHeightPx, canvas.height - y);
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = h;
      part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      const png = await pdf.embedPng(part.toDataURL('image/png'));
      const page = pdf.addPage([PAGE_W_MM * MM_PT, PAGE_H_MM * MM_PT]);
      page.drawImage(png, { x: MARGIN_X_MM * MM_PT, y: (PAGE_H_MM - MARGIN_Y_MM) * MM_PT - h * scale, width: canvas.width * scale, height: h * scale });
    }
    const bytes = await pdf.save();
    if (bytes.length > MAX_PDF_BYTES) throw new Error('pdf too large');
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
  } finally {
    stage.remove();
  }
}
