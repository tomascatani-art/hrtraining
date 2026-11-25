import Link from "next/link";
import { FileText, Film, Image as ImageIcon, Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleAthleteIds } from "@/lib/access";
import { PageHeader, Card, Empty, fmtDate } from "@/components/ui";
import { Uploader } from "@/components/uploader";
import { Submit, ConfirmSubmit } from "@/components/forms";
import { deleteFile, toggleShare } from "./actions";

export const metadata = { title: "Archivos" };

const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`);

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const ids = await visibleAthleteIds(u);
  const staff = u.role !== "ATHLETE";
  const files = await db.fileAsset.findMany({
    where: {
      orgId: u.orgId, ...(sp.kind ? { kind: sp.kind } : {}),
      OR: staff ? [{ athleteId: null }, { athleteId: { in: ids } }, { shared: true }, { ownerId: u.id }] : [{ ownerId: u.id }, { athleteId: u.id }, { shared: true }],
    },
    include: { owner: true, athlete: true }, orderBy: { createdAt: "desc" },
  });
  const athletes = staff ? await db.user.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : undefined;
  const Icon = ({ k }: { k: string }) => (k === "VIDEO" ? <Film size={18} /> : k === "IMAGEN" ? <ImageIcon size={18} /> : <FileText size={18} />);

  return (
    <>
      <PageHeader title="Archivos y documentos" subtitle={staff ? "Videos, planillas, PDFs e imágenes. Asociá cada archivo a un alumno o compartilo con toda la organización." : "Documentos que te compartió tu entrenador y archivos que subiste."} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex gap-1">{[["", "Todos"], ["DOCUMENTO", "Documentos"], ["VIDEO", "Videos"], ["IMAGEN", "Imágenes"]].map(([k, l]) => <Link key={k} href={`/app/files${k ? `?kind=${k}` : ""}`} className={`tab ${(sp.kind ?? "") === k ? "tab-active" : ""}`}>{l}</Link>)}</div>
          {files.length === 0 ? <Empty title="No hay archivos" /> : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id} className="card flex flex-wrap items-center gap-3 p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-700 text-volt"><Icon k={f.kind} /></span>
                  <div className="min-w-0 flex-1">
                    <a href={`/api/files/${f.id}`} target="_blank" className="block truncate font-medium text-white hover:text-volt">{f.name}</a>
                    <div className="text-xs muted">{size(f.size)} · {f.owner.name} · {fmtDate(f.createdAt)}{f.athlete ? ` · ${f.athlete.name}` : ""}</div>
                  </div>
                  {f.shared && <span className="chip-volt">Compartido</span>}
                  {f.kind === "VIDEO" && <Link href={`/app/videos?file=${f.id}`} className="btn-ghost btn-sm">Analizar</Link>}
                  <a href={`/api/files/${f.id}?download=1`} className="btn-ghost btn-sm" aria-label="Descargar"><Download size={14} /></a>
                  {staff && <form action={toggleShare}><input type="hidden" name="id" value={f.id} /><Submit className="btn-ghost btn-sm" pendingText="…">{f.shared ? "Dejar de compartir" : "Compartir"}</Submit></form>}
                  {(staff || f.ownerId === u.id) && <form action={deleteFile}><input type="hidden" name="id" value={f.id} /><ConfirmSubmit message={`¿Eliminar ${f.name}?`}>Eliminar</ConfirmSubmit></form>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card title="Subir"><Uploader athletes={athletes} allowShare={staff} /></Card>
      </div>
    </>
  );
}
