import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { FolderPanel } from "@/components/folder-panel";

export const metadata = { title: "Mi carpeta" };

export default async function MyFolder({ searchParams }: { searchParams: Promise<{ carpeta?: string }> }) {
  const u = await requireUser(["ATHLETE"]);
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Mi carpeta" subtitle="Tu antropometría, estudios y documentos en un solo lugar. Solo los ven vos y tus entrenadores." />
      <FolderPanel athleteId={u.id} viewerId={u.id} staff={false} base="/app/folder" active={sp.carpeta} />
    </>
  );
}
