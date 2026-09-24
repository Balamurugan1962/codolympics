/** The Clipboard API only exists on secure origins, and the hall serves http over the LAN, so fall back to a selection. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the selection method */ }
  const box = document.createElement("textarea");
  box.value = text;
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  try { return document.execCommand("copy"); } finally { document.body.removeChild(box); }
}
