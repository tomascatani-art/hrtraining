import "server-only";
import { db } from "./db";
import { realVideo } from "./video";

/** Video que usa el club para cada ejercicio: el link que cargó el club o, si no, el del ejercicio. */
export async function exerciseVideos(orgId: string, exerciseIds: string[]) {
  const ids = [...new Set(exerciseIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const [links, exs] = await Promise.all([
    db.exerciseLink.findMany({ where: { orgId, exerciseId: { in: ids } } }),
    db.exercise.findMany({ where: { id: { in: ids } }, select: { id: true, videoUrl: true } }),
  ]);
  for (const e of exs) { const v = realVideo(e.videoUrl); if (v) map.set(e.id, v); }
  for (const l of links) { const v = realVideo(l.url); if (v) map.set(l.exerciseId, v); }
  return map;
}
