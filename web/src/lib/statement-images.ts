/**
 * Figures live inside the statement as reference definitions at the end:
 *
 *   ![Figure 1][img1]
 *   [img1]: data:image/png;base64,...
 *
 * so the body stays readable while the picture travels with the text in every
 * export and needs nothing but the statement to render.
 */
const DEFINITION = /^\[([A-Za-z0-9_-]+)\]:\s*(data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)\s*$/;

export type StatementImage = { name: string; uri: string };

export function splitStatement(value: string): { body: string; images: StatementImage[] } {
  const images: StatementImage[] = [];
  const kept: string[] = [];
  for (const line of value.split("\n")) {
    const found = DEFINITION.exec(line.trim());
    if (found) images.push({ name: found[1], uri: found[2] });
    else kept.push(line);
  }
  return { body: kept.join("\n").replace(/\s+$/, ""), images };
}

export function joinStatement(body: string, images: StatementImage[]): string {
  if (images.length === 0) return body;
  return `${body.replace(/\s+$/, "")}\n\n${images.map((i) => `[${i.name}]: ${i.uri}`).join("\n")}\n`;
}

export function nextImageName(images: StatementImage[]): string {
  let n = images.length + 1;
  while (images.some((i) => i.name === `img${n}`)) n += 1;
  return `img${n}`;
}

const MAX_URI_CHARS = 120_000;
const MAX_SIDE = 1400;

/** A picture as a data URI small enough to sit in a statement, shrunk until it fits. */
export async function imageToDataUri(file: File): Promise<string> {
  const source = await createImageBitmap(file);
  const keepsAlpha = file.type === "image/png" || file.type === "image/gif" || file.type === "image/webp";
  let scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot process images");
    if (!keepsAlpha) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    const lossy = canvas.toDataURL("image/webp", 0.85);
    const best = [png, lossy.startsWith("data:image/webp") ? lossy : ""].filter(Boolean).sort((a, b) => a.length - b.length)[0];
    if (best.length <= MAX_URI_CHARS) return best;
    scale *= 0.8;
  }
  throw new Error("That picture is too detailed to embed. Crop it or use a simpler one.");
}
