import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/import-wizard";
import { mailConfigured } from "@/lib/mail";

export const metadata = { title: "Cargar desde Excel" };

export default async function ImportPage() {
  await requireUser(["COACH", "ADMIN"]);
  return (
    <>
      <PageHeader title="Cargar alumnos desde Excel" subtitle="Subí tu lista de alumnos de una sola vez. Cada uno recibe su invitación para elegir su contraseña." />
      <ImportWizard mailReady={mailConfigured()} />
    </>
  );
}
