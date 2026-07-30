const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
  Á: "a",
  É: "e",
  Í: "i",
  Ó: "o",
  Ú: "u",
  Ü: "u",
  Ñ: "n",
};

export function slugify(input: string): string {
  const withoutAccents = input
    .split("")
    .map((char) => ACCENTS[char] ?? char)
    .join("");

  return withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
