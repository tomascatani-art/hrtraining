import Link from "next/link";
import { FileText, Film, Image as ImageIcon, Download, FolderOpen } from "lucide-react";
import { db } from "@/lib/db";
import { PROFILE_FOLDERS, folderLabel } from "@/lib/catalog";
import { Card, Empty, fmtDate } from "./ui";
import { Uploader } from "./uploader";
import { Submit, ConfirmSubmit } from "./forms";
import { deleteFile, moveFile } from "@/app/app/files/actions";

const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`);
const Icon = ({ k }: { k: string }) => (k === "VIDEO" ? <Film size={18} /> : k === "IMAGEN" ? <ImageIcon size={18} /> : <FileText size={18} />);

/** Carpeta del perfil: documentos del deportista ordenados por sección. La ven el deportista y sus entrenadores. */
export async function FolderPanel({ athleteId, viewerId, staff, base, active }: { athleteId: string; viewerId: string; staff: boolean; base: string; active?: string }) {
  const files = await db.fileAsset.findMany({ where: { athleteId }, include: { owner: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const keyOf = (f: { folder: string | null }) => f.folder ?? "OTROS";
  const counts = Object.fromEntries(PROFILE_FOLDERS.map((f) => [f.key, files.filter((x) => keyOf(x) === f.key).length]));
  const shown = active ? files.filter((f) => keyOf(f) === active) : files;
  const sep = base.includes("?") ? "&" : "?";
  const folders = PROFILE_FOLDERS.map((f) => ({ key: f.key, label: f.label }));

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-4 xl:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROFILE_FOLDERS.map((f) => (
            <Link key={f.key} href={active === f.key ? base : `${base}${sep}carpeta=${f.key}`}
              className={`card flex min-w-0 items-start gap-3 p-3 transition hover:border-volt/50 ${active === f.key ? "border-volt" : ""}`}>
              <FolderOpen size={20} className={counts[f.key] ? "shrink-0 text-volt" : "shrink-0 text-neutral-500"} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-white">{f.label}</span>
                <span className="block text-xs muted">{counts[f.key]} {counts[f.key] === 1 ? "archivo" : "archivos"}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-white">{active ? folderLabel(active) : "Todos los archivos"}</h3>
          {active && <Link href={base} className="text-sm text-volt">Ver todo</Link>}
        </div>
        {shown.length === 0 ? (
          <Empty title={active ? "Esta carpeta está vacía" : "Todavía no hay archivos"}>Subí PDFs, planillas o fotos y elegí la carpeta.</Empty>
        ) : (
          <ul className="space-y-2">
            {shown.map((f) => (
              <li key={f.id} className="card flex flex-wrap items-center gap-3 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-volt"><Icon k={f.kind} /></span>
                <div className="min-w-0 flex-1">
                  <a href={`/api/files/${f.id}`} target="_blank" className="block truncate font-medium text-white hover:text-volt">{f.name}</a>
                  <div className="text-xs muted">{folderLabel(f.folder)} · {size(f.size)} · {f.owner.name} · {fmtDate(f.createdAt)}</div>
                  {f.note && <div className="mt-1 text-sm text-neutral-300">{f.note}</div>}
                </div>
                <a href={`/api/files/${f.id}?download=1`} className="btn-ghost btn-sm" aria-label={`Descargar ${f.name}`}><Download size={14} /></a>
                {(staff || f.ownerId === viewerId) && (
                  <>
                    <form action={moveFile} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={f.id} />
                      <select name="folder" defaultValue={keyOf(f)} className="input h-8 py-0 text-xs" aria-label="Mover a carpeta">
                        {PROFILE_FOLDERS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                      <Submit className="btn-ghost btn-sm" pendingText="…">Mover</Submit>
                    </form>
                    <form action={deleteFile}><input type="hidden" name="id" value={f.id} /><ConfirmSubmit message={`¿Eliminar ${f.name}?`}>Eliminar</ConfirmSubmit></form>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Card title="Subir a la carpeta">
        <Uploader folders={folders} defaultFolder={active} defaultAthlete={athleteId} label="Subir documento o foto" compact />
        <p className="mt-3 text-xs muted">Solo lo ven {staff ? "el deportista y sus entrenadores" : "vos y tus entrenadores"}. Los estudios médicos se guardan como respaldo: la app no los interpreta.</p>
      </Card>
    </div>
  );
}
