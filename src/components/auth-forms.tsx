"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, registerAction, acceptInviteAction } from "@/app/(auth)/actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full" disabled={pending}>{pending ? "Procesando…" : children}</button>;
}
function ErrorBox({ msg }: { msg?: string }) {
  return msg ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{msg}</div> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div><span className="label mb-1.5 block">Email</span><input className="input" name="email" type="email" autoComplete="email" required /></div>
      <div><span className="label mb-1.5 block">Contraseña</span><input className="input" name="password" type="password" autoComplete="current-password" required /></div>
      <ErrorBox msg={state?.error} />
      <Submit>Ingresar</Submit>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><span className="label mb-1.5 block">Tu nombre</span><input className="input" name="name" required /></div>
      <div><span className="label mb-1.5 block">Gimnasio, club o equipo</span><input className="input" name="org" required /></div>
      <div><span className="label mb-1.5 block">Email</span><input className="input" name="email" type="email" required /></div>
      <div><span className="label mb-1.5 block">Contraseña</span><input className="input" name="password" type="password" minLength={8} required /></div>
      <ErrorBox msg={state?.error} />
      <Submit>Crear cuenta</Submit>
    </form>
  );
}

export function InviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div><span className="label mb-1.5 block">Elegí una contraseña</span><input className="input" name="password" type="password" minLength={8} required /></div>
      <ErrorBox msg={state?.error} />
      <Submit>Activar mi cuenta</Submit>
    </form>
  );
}
