import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Cifrado simétrico (AES-256-GCM) para credenciales de terceros guardadas en la base.
const key = () => createHash("sha256").update(`hrtraining:${process.env.AUTH_SECRET ?? ""}`).digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}
export function decryptSecret(blob: string | null | undefined) {
  if (!blob) return null;
  try {
    const [v, iv, tag, data] = blob.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}
