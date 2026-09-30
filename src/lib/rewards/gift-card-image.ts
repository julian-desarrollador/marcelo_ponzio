import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 840;
const GOLD = "#e4ca69";
const INK = "#f7f1e4";
const MUTED = "#c9c1b0";

const FONT_DIR = path.join(process.cwd(), "src/lib/rewards/fonts");

let fontCssPromise: Promise<string> | null = null;

function loadFontCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const [serif, sans] = await Promise.all([
        readFile(path.join(FONT_DIR, "PlayfairDisplay-Bold.ttf")),
        readFile(path.join(FONT_DIR, "Montserrat-Medium.ttf")),
      ]);
      return `@font-face{font-family:'CardSerif';src:url('data:font/ttf;base64,${serif.toString("base64")}') format('truetype');}@font-face{font-family:'CardSans';src:url('data:font/ttf;base64,${sans.toString("base64")}') format('truetype');}`;
    })();
  }
  return fontCssPromise;
}

export type GiftCardImageInput = {
  customerName: string;
  title: string;
  description: string;
  code: string;
  expiresAt: Date;
};

function stripEmoji(value: string): string {
  return value.replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200D|\uFE0F/gu, "");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function formatUntil(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function textEl(
  value: string,
  y: number,
  opts: { family: string; size: number; fill: string; spacing?: number },
): string {
  const spacing = opts.spacing ? ` letter-spacing="${opts.spacing}"` : "";
  return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle" font-family="${opts.family}" font-size="${opts.size}" fill="${opts.fill}"${spacing}>${xmlEscape(value)}</text>`;
}

export async function giftCardSvg(input: GiftCardImageInput): Promise<string> {
  const fontCss = await loadFontCss();
  const name = stripEmoji(input.customerName).replace(/\s+/g, " ").trim() || "Vos";
  const title = stripEmoji(input.title);
  const description = stripEmoji(input.description);
  const titleLines = wrap(title, 22, 3);
  const titleSize = title.trim().length > 28 ? 40 : 48;
  const descriptionLines = wrap(description, 40, 3);
  const nameLines = wrap(name, 24, 2);

  const parts: string[] = [];
  let y = 118;

  parts.push(textEl("MARCELO PONZIO", y, { family: "CardSerif", size: 28, fill: GOLD, spacing: 5 }));
  y += 36;
  parts.push(textEl("ESTILISTA", y, { family: "CardSans", size: 14, fill: GOLD, spacing: 8 }));
  y += 36;
  parts.push(`<line x1="270" y1="${y}" x2="570" y2="${y}" stroke="${GOLD}" stroke-width="1" opacity="0.7"/>`);
  y += 88;
  parts.push(textEl("GIFT CARD", y, { family: "CardSerif", size: 68, fill: GOLD, spacing: 3 }));
  y += 28;
  parts.push(
    `<polygon points="${WIDTH / 2},${y} ${WIDTH / 2 + 5},${y + 6} ${WIDTH / 2},${y + 12} ${WIDTH / 2 - 5},${y + 6}" fill="${GOLD}"/>`,
  );
  y += 64;

  for (const line of titleLines.length > 0 ? titleLines : ["Gift card"]) {
    parts.push(textEl(line, y, { family: "CardSerif", size: titleSize, fill: INK }));
    y += titleSize + 10;
  }
  y += 8;

  for (const line of descriptionLines) {
    parts.push(textEl(line, y, { family: "CardSans", size: 22, fill: MUTED }));
    y += 32;
  }
  if (descriptionLines.length > 0) y += 16;

  parts.push(textEl("Para", y, { family: "CardSans", size: 16, fill: GOLD, spacing: 4 }));
  y += 40;
  for (const line of nameLines) {
    parts.push(textEl(line, y, { family: "CardSerif", size: 32, fill: INK }));
    y += 42;
  }

  y += 28;
  const boxTop = y;
  const boxHeight = 132;
  parts.push(
    `<rect x="150" y="${boxTop}" width="540" height="${boxHeight}" rx="16" fill="none" stroke="${GOLD}" stroke-width="1.5"/>`,
  );
  parts.push(textEl("CÓDIGO DE CANJE", boxTop + 42, { family: "CardSans", size: 14, fill: GOLD, spacing: 3 }));
  parts.push(textEl(input.code, boxTop + 92, { family: "CardSerif", size: 36, fill: GOLD, spacing: 2 }));
  y = boxTop + boxHeight + 56;

  parts.push(
    textEl(`Válida hasta ${formatUntil(input.expiresAt)}`, y, { family: "CardSans", size: 20, fill: MUTED }),
  );
  y += 64;
  parts.push(textEl("Mostrá esta gift card en el salón", y, { family: "CardSans", size: 18, fill: MUTED }));
  y += 28;
  parts.push(textEl("o usala al reservar en tu perfil.", y, { family: "CardSans", size: 18, fill: MUTED }));

  const height = y + 88;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
  <defs>
    <style>
      ${fontCss}
    </style>
    <radialGradient id="glow" cx="50%" cy="28%" r="42%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.16"/>
      <stop offset="70%" stop-color="#111111" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${height}" fill="#111111"/>
  <rect width="${WIDTH}" height="${height}" fill="url(#glow)"/>
  <rect x="28" y="28" width="${WIDTH - 56}" height="${height - 56}" fill="none" stroke="${GOLD}" stroke-width="1.25" opacity="0.85"/>
  <rect x="40" y="40" width="${WIDTH - 80}" height="${height - 80}" fill="none" stroke="${GOLD}" stroke-width="0.6" opacity="0.45"/>
  ${parts.join("\n  ")}
</svg>`;
}

export async function renderGiftCardJpeg(input: GiftCardImageInput): Promise<Buffer> {
  const svg = await giftCardSvg(input);
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
