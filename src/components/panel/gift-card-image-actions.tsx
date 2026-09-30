"use client";

import { useState } from "react";

type Props = {
  cardId: string;
  code: string;
  preview?: boolean;
};

function imageHref(cardId: string): string {
  return `/api/panel-turnos/recompensas/gift-cards/${encodeURIComponent(cardId)}/imagen`;
}

async function fetchJpeg(cardId: string): Promise<Blob> {
  const res = await fetch(imageHref(cardId), { credentials: "same-origin" });
  if (!res.ok) throw new Error("image");
  return res.blob();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function GiftCardImageActions({ cardId, code, preview = false }: Props) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const filename = `${code}.jpg`;

  async function download() {
    setBusy("download");
    setNote(null);
    try {
      const blob = await fetchJpeg(cardId);
      saveBlob(blob, filename);
    } catch {
      setNote("No se pudo descargar la imagen.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setNote(null);
    try {
      const blob = await fetchJpeg(cardId);
      const file = new File([blob], filename, { type: "image/jpeg" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      saveBlob(blob, filename);
      setNote("En la compu no se puede adjuntar sola. La imagen se descargó: adjuntala en WhatsApp.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote("No se pudo compartir. Probá descargarla.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageHref(cardId)}
          alt={`Gift card ${code}`}
          className="mx-auto mb-3 w-full max-w-[260px] rounded-2xl border border-[#e4ca69]/40"
        />
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void download()}
          className="h-11 flex-1 cursor-pointer rounded-full bg-[#B88E2F] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "download" ? "Descargando…" : "Descargar"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void share()}
          className="h-11 flex-1 cursor-pointer rounded-full border border-[#B88E2F] text-[14px] font-semibold text-[#8B6914] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "share" ? "Compartiendo…" : "Compartir"}
        </button>
      </div>
      {note ? <p className="mt-2 text-[13px] text-gray-600">{note}</p> : null}
    </div>
  );
}
