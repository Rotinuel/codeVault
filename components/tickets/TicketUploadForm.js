"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { BOOKMAKERS } from "@/lib/constants";

const MAX_SIDE = 1600;
const MAX_BYTES = 1.8 * 1024 * 1024;

/**
 * Re-encode the photo as JPEG in the browser: keeps uploads small and strips
 * EXIF metadata (GPS location, device) before anything leaves the phone.
 */
async function compressImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file couldn't be read as an image");
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const q of [0.85, 0.75, 0.65, 0.5]) {
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    if ((dataUrl.length * 3) / 4 <= MAX_BYTES) return dataUrl;
  }
  throw new Error("Image is too large even after compression. Try a smaller screenshot.");
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { bookmaker: "SportyBet", bookmakerOther: "", ticketRef: "", stake: "", payout: "", wonAt: today(), codeUsed: "", note: "", showcaseConsent: true };

export function TicketUploadForm({ onUploaded }) {
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => image?.preview && URL.revokeObjectURL(image.preview), [image]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
      toast.error("Choose a photo or screenshot (JPG, PNG or WebP)");
      return;
    }
    setPreparing(true);
    try {
      const dataUrl = await compressImage(file);
      setImage({ dataUrl, preview: URL.createObjectURL(file) });
      setErrors((x) => ({ ...x, image: undefined }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPreparing(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!image) {
      setErrors({ image: "Add a photo or screenshot of the winning ticket" });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await apiFetch("/api/winning-tickets", {
        method: "POST",
        body: { ...form, stake: Number(form.stake), payout: Number(form.payout), image: image.dataUrl },
      });
      toast.success("Ticket submitted! We'll notify you once it's reviewed.");
      setForm({ ...EMPTY, wonAt: today() });
      setImage(null);
      onUploaded?.();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5" noValidate>
      <h2 className="text-base font-semibold text-slate-900">Upload a winning ticket</h2>
      <p className="mt-1 text-sm text-slate-500">A clear photo or screenshot showing the ticket ID, stake, winnings and &ldquo;Won&rdquo; status.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" id="ticket-image" onChange={onFile} />
          {image ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="Selected ticket" className="aspect-[3/4] w-full object-contain" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink-900/80 text-white hover:bg-ink-900"
                aria-label="Remove image"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="ticket-image"
              className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center text-sm transition-colors ${
                errors.image ? "border-rose-300 bg-rose-50/50 text-rose-700" : "border-slate-300 text-slate-500 hover:border-brand-400 hover:bg-brand-50/40"
              }`}
            >
              <ImagePlus className="size-8" aria-hidden="true" />
              <span className="font-medium">{preparing ? "Preparing image…" : "Tap to add ticket image"}</span>
              <span className="text-xs">JPG, PNG or WebP</span>
            </label>
          )}
          {errors.image && <p className="mt-1.5 text-xs font-medium text-rose-600" role="alert">{errors.image}</p>}
        </div>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Field label="Bookmaker" htmlFor="bookmaker" required error={errors.bookmaker}>
            <Select id="bookmaker" value={form.bookmaker} onChange={set("bookmaker")}>
              {BOOKMAKERS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </Field>
          {form.bookmaker === "Other" ? (
            <Field label="Bookmaker name" htmlFor="bookmakerOther" required error={errors.bookmakerOther}>
              <Input id="bookmakerOther" value={form.bookmakerOther} onChange={set("bookmakerOther")} maxLength={40} error={errors.bookmakerOther} />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label="Ticket / booking ID" htmlFor="ticketRef" required error={errors.ticketRef} hint="As printed on the slip, e.g. 8K2XQ9 or 1234567890">
            <Input id="ticketRef" value={form.ticketRef} onChange={set("ticketRef")} maxLength={60} autoComplete="off" error={errors.ticketRef} />
          </Field>
          <Field label="Date won" htmlFor="wonAt" required error={errors.wonAt}>
            <Input id="wonAt" type="date" value={form.wonAt} max={today()} onChange={set("wonAt")} error={errors.wonAt} />
          </Field>
          <Field label="Stake (₦)" htmlFor="stake" required error={errors.stake}>
            <Input id="stake" type="number" inputMode="decimal" min="1" step="any" value={form.stake} onChange={set("stake")} error={errors.stake} />
          </Field>
          <Field label="Amount won (₦)" htmlFor="payout" required error={errors.payout}>
            <Input id="payout" type="number" inputMode="decimal" min="1" step="any" value={form.payout} onChange={set("payout")} error={errors.payout} />
          </Field>
          <Field label="CodeVault code used" htmlFor="codeUsed" error={errors.codeUsed} hint="Optional" className="sm:col-span-2">
            <Input id="codeUsed" value={form.codeUsed} onChange={set("codeUsed")} maxLength={60} placeholder="e.g. PR4M-88LZ" />
          </Field>
          <Field label="Note for the reviewer" htmlFor="note" error={errors.note} hint="Optional" className="sm:col-span-2">
            <Textarea id="note" rows={2} value={form.note} onChange={set("note")} maxLength={300} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              id="showcaseConsent"
              checked={form.showcaseConsent}
              onChange={set("showcaseConsent")}
              label="Show this ticket on the CodeVault homepage. Your name is never shown; we'll only show the ticket and the amount won."
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="size-4 text-brand-600" aria-hidden="true" /> Every ticket is checked by our team. Fake or edited tickets are rejected.
        </p>
        <Button type="submit" loading={busy} disabled={preparing}>
          Submit for review
        </Button>
      </div>
    </form>
  );
}
