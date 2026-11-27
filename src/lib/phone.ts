/** Celular para WhatsApp: solo dígitos y con 549 adelante si es un número argentino sin código de país. */
export function waPhone(v: unknown) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "549" + d;
  return d.slice(0, 15);
}
