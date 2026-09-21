/**
 * The languages the judge offers, in the words a participant sees.
 *
 * The judge's own list (`/api/languages`) carries compiler versions and is the
 * source of truth for what can be submitted; this is the short form for
 * places that name a language in passing, and the fallback before that list
 * has loaded.
 */
export const LANGUAGES: readonly { value: string; label: string }[] = [
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "python", label: "Python 3" },
  { value: "pypy", label: "PyPy 3" },
  { value: "java", label: "Java 21" },
  { value: "javascript", label: "JavaScript" },
];

export function languageName(key: string): string {
  return LANGUAGES.find((l) => l.value === key)?.label ?? key;
}
