/** Dirección de la foto de perfil (con versión, para que el navegador no muestre la vieja). */
export function avatarSrc(u: { id: string; avatarKey?: string | null; avatarAt?: Date | null } | null | undefined) {
  if (!u?.avatarKey) return null;
  return `/api/avatar/${u.id}?v=${u.avatarAt ? +u.avatarAt : 0}`;
}
