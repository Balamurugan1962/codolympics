/** The judge's language list, cached briefly so every submit does not hit the judge. */
import { judge, type Language } from "./judge";

let cache: { at: number; list: Language[] } | null = null;

export async function languages(): Promise<Language[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.list;
  try {
    const list = await judge.languages();
    cache = { at: Date.now(), list };
    return list;
  } catch {
    return cache?.list ?? [];
  }
}

export async function allowedLanguage(key: string): Promise<boolean> {
  return (await languages()).some((l) => l.key === key);
}
