"use client";
import { useFormStatus } from "react-dom";
import clsx from "clsx";

export function Submit({ children, className = "btn-primary", pendingText = "Guardando…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button className={clsx(className)} disabled={pending}>{pending ? pendingText : children}</button>;
}

export function ConfirmSubmit({ children, message, className = "btn-danger btn-sm" }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {pending ? "…" : children}
    </button>
  );
}

export function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2">
      <input readOnly className="input font-mono text-xs" value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(value)}>Copiar</button>
    </div>
  );
}
