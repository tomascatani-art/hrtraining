"use client";
import { useState } from "react";
import { Uploader } from "./uploader";

export function VideoField({ defaultValue }: { defaultValue?: string | null }) {
  const [v, setV] = useState(defaultValue ?? "");
  return (
    <div className="space-y-2">
      <input name="videoUrl" value={v} onChange={(e) => setV(e.target.value)} className="input" placeholder="https://youtube.com/… o subí un archivo" />
      <Uploader accept="video/*" label="Subir video demostrativo" compact allowShare={false} onUploaded={(f) => setV(`/api/files/${f.id}`)} />
    </div>
  );
}
