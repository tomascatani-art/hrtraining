"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { previewImport, commitImport } from "@/app/app/athletes/import/actions";
import { Submit } from "./forms";
import { sportLabel } from "@/lib/catalog";

export function ImportWizard({ mailReady }: { mailReady: boolean }) {
  const [preview, previewAction] = useActionState(previewImport, undefined);
  const [result, commitAction] = useActionState(commitImport, undefined);
  const sendMail = false; // Diego: las invitaciones van solo por WhatsApp
  const rows = preview?.rows ?? [];
  const ok = rows.filter((r) => !r.errors.length);
  const bad = rows.length - ok.length;

  if (result?.created) {
    return (
      <div className="card card-pad text-center">
        <CheckCircle2 size={40} className="mx-auto mb-3 text-volt" />
        <h2 className="h2">Se cargaron {result.created} alumnos</h2>
        <p className="mt-2 text-sm muted">
          {result.mailed ? `Le mandamos la invitación por mail a ${result.mailed}. ` : "Cada uno tiene su enlace de invitación en su perfil para compartirlo por WhatsApp. "}
          {result.groups?.length ? `Grupos nuevos: ${result.groups.join(", ")}.` : ""}
        </p>
        <Link href="/app/athletes" className="btn-primary mt-5">Ver alumnos</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card card-pad">
          <div className="label mb-2 text-volt">Paso 1</div>
          <h3 className="font-semibold text-white">Descargá la plantilla</h3>
          <p className="mt-1 text-sm muted">Una fila por alumno. Solo nombre y email son obligatorios. Si ya tenés tu planilla, podés subirla igual: reconocemos columnas como “Nombre”, “Mail”, “Grupo” o “Peso”.</p>
          <a href="/api/export/athletes-template" className="btn-ghost mt-4"><Download size={16} />Plantilla de Excel</a>
        </div>
        <form action={previewAction} className="card card-pad">
          <div className="label mb-2 text-volt">Paso 2</div>
          <h3 className="font-semibold text-white">Subí tu planilla</h3>
          <p className="mt-1 text-sm muted">Excel (.xlsx) o CSV. Antes de cargar nada te mostramos cómo quedó.</p>
          <input name="file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="input mt-4 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-white" />
          <div className="mt-3"><Submit pendingText="Leyendo…"><FileSpreadsheet size={16} />Revisar planilla</Submit></div>
          {preview?.error && <p className="mt-3 text-sm text-red-300">{preview.error}</p>}
          {preview?.missing?.length ? <p className="mt-3 text-sm text-red-300">No encontramos las columnas: {preview.missing.join(" y ")}. Revisá la primera fila de la planilla.</p> : null}
        </form>
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <h3 className="h2 flex-1">Paso 3 · Revisá y confirmá</h3>
            <span className="chip-volt">{ok.length} listos</span>
            {bad > 0 && <span className="chip-red">{bad} con errores (no se cargan)</span>}
          </div>
          <div className="max-h-[50vh] overflow-auto border-t border-ink-700">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-ink-850"><tr className="text-left text-xs muted">
                <th className="px-4 py-2 font-medium">Fila</th><th className="px-2 py-2 font-medium">Nombre</th><th className="px-2 py-2 font-medium">Email</th><th className="px-2 py-2 font-medium">Deporte</th><th className="px-2 py-2 font-medium">Grupo</th><th className="px-2 py-2 font-medium">Estado</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t border-ink-700 align-top">
                    <td className="num px-4 py-2 muted">{r.line}</td>
                    <td className="px-2 py-2 text-white">{r.name || "—"}</td>
                    <td className="px-2 py-2 text-neutral-300">{r.email || "—"}</td>
                    <td className="px-2 py-2 text-neutral-300">{sportLabel(r.sport)}</td>
                    <td className="px-2 py-2 text-neutral-300">{r.group ?? "—"}</td>
                    <td className="px-2 py-2 text-xs">
                      {r.errors.length ? <span className="flex items-start gap-1 text-red-300"><XCircle size={14} className="mt-0.5 shrink-0" />{r.errors.join(" · ")}</span>
                        : r.warnings.length ? <span className="flex items-start gap-1 text-amber-300"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{r.warnings.join(" · ")}</span>
                        : <span className="flex items-center gap-1 text-volt"><CheckCircle2 size={14} />OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={commitAction} className="flex flex-wrap items-center gap-4 border-t border-ink-700 p-4 sm:p-5">
            <input type="hidden" name="rows" value={JSON.stringify(ok)} />
            <input type="hidden" name="sendMail" value={sendMail ? "1" : "0"} />
            <p className="flex-1 text-sm muted">Después le mandás a cada uno su link por WhatsApp desde su perfil.</p>
            <Submit pendingText="Cargando…" disabled={!ok.length}>Cargar {ok.length} alumnos</Submit>
          </form>
          {result?.error && <p className="px-5 pb-4 text-sm text-red-300">{result.error}</p>}
        </div>
      )}
    </div>
  );
}
