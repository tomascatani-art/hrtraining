import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

// Al abrir la app: si ya inició sesión va a su panel, si no, directo a ingresar.
export default async function Home() {
  redirect((await currentUser()) ? "/app" : "/login");
}
