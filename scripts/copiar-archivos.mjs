// Copia todos los archivos (fotos, documentos, logos) del bucket viejo de Supabase al nuevo.
// Uso: OLD_SUPABASE_URL, OLD_SUPABASE_KEY, NEW_SUPABASE_URL, NEW_SUPABASE_KEY (y opcional SUPABASE_BUCKET).
const B = process.env.SUPABASE_BUCKET || "hrtraining";
const side = (p) => ({ url: process.env[`${p}_SUPABASE_URL`].replace(/\/+$/, ""), key: process.env[`${p}_SUPABASE_KEY`] });
const OLD = side("OLD"), NEW = side("NEW");
const h = (s, extra = {}) => ({ apikey: s.key, ...(s.key.startsWith("eyJ") ? { Authorization: `Bearer ${s.key}` } : {}), ...extra });

async function list(s, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${s.url}/storage/v1/object/list/${B}`, { method: "POST", headers: h(s, { "Content-Type": "application/json" }), body: JSON.stringify({ prefix, limit: 1000, offset }) });
    if (!r.ok) throw new Error(`No pude listar los archivos: ${r.status} ${await r.text()}`);
    const items = await r.json();
    for (const it of items) {
      const name = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id == null) out.push(...(await list(s, name))); // carpeta
      else out.push(name);
    }
    if (items.length < 1000) return out;
  }
}

const mk = await fetch(`${NEW.url}/storage/v1/bucket`, { method: "POST", headers: h(NEW, { "Content-Type": "application/json" }), body: JSON.stringify({ id: B, name: B, public: false }) });
if (!mk.ok && mk.status !== 409 && !/already exists/i.test(await mk.text())) throw new Error("No pude crear el bucket nuevo");

const files = await list(OLD);
console.log(`Archivos a copiar: ${files.length}`);
let ok = 0;
for (const f of files) {
  const enc = f.split("/").map(encodeURIComponent).join("/");
  const g = await fetch(`${OLD.url}/storage/v1/object/${B}/${enc}`, { headers: h(OLD) });
  if (!g.ok) throw new Error(`No pude bajar ${f}: ${g.status}`);
  const buf = Buffer.from(await g.arrayBuffer());
  const p = await fetch(`${NEW.url}/storage/v1/object/${B}/${enc}`, { method: "POST", headers: h(NEW, { "Content-Type": g.headers.get("content-type") || "application/octet-stream", "x-upsert": "true" }), body: buf });
  if (!p.ok) throw new Error(`No pude subir ${f}: ${p.status} ${await p.text()}`);
  ok++;
}
const after = await list(NEW);
console.log(`Copiados: ${ok}. En el bucket nuevo hay ${after.length} archivos.`);
if (after.length < files.length) throw new Error("Faltan archivos en el bucket nuevo");
