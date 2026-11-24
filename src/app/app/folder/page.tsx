import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FolderPanel } from "@/components/folder-panel";
import { AnthropometryPanel } from "@/components/anthropometry-panel";

export const metadata = { title: "Mi carpeta" };

export default async function MyFolder({ searchParams }: { searchParams: Promise<{ carpeta?: string }> }) {
  const u = await requireUser(["ATHLETE"]);
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Mi carpeta" subtitle="Tu antropometría, estudios y documentos en un solo lugar. Solo los ven vos y tus entrenadores." />
      <h2 className="h2 mb-3">Antropometría</h2>
      <AnthropometryPanel athleteId={u.id} canEdit={false} />
      <h2 className="h2 mb-3 mt-8">Documentos</h2>
      <FolderPanel athleteId={u.id} viewerId={u.id} staff={false} base="/app/folder" active={sp.carpeta} />
    </>
  );
}
