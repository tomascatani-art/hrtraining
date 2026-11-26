"use client";
import { useEffect } from "react";

/** Si algo falla al cargar (por ejemplo, la app quedó abierta durante una actualización), se recarga sola una vez. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    try {
      const k = "hr-reload-at";
      const last = Number(sessionStorage.getItem(k) || 0);
      if (Date.now() - last > 30000) { sessionStorage.setItem(k, String(Date.now())); window.location.reload(); }
    } catch {}
  }, [error]);
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#050505", color: "#fff", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Se actualizó la app</div>
          <p style={{ color: "#a3a3a3", fontSize: 15 }}>Tocá el botón para volver a cargarla.</p>
          <button onClick={() => window.location.reload()} style={{ background: "#ffd60a", color: "#000", border: 0, borderRadius: 14, padding: "12px 22px", fontWeight: 700, fontSize: 16 }}>Volver a cargar</button>
        </div>
      </body>
    </html>
  );
}
