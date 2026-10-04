import Papa from "papaparse";
import { invitationInput } from "./domain";
export function parseImport(text: string) {
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  if (result.errors.length)
    throw new Error(`CSV invalide : ${result.errors[0].message}`);
  if (result.data.length < 1 || result.data.length > 500)
    throw new Error("Choisissez un CSV contenant 1 à 500 lignes.");
  return result.data.map((r, n) => {
    const v = invitationInput.safeParse({
      name: r.Nom,
      phone: r["Téléphone"] || "",
      category: r["Catégorie"] || "Amis",
      quota: Number(r["Nombre de places"]),
      comment: r.Commentaire || "",
    });
    if (!v.success)
      throw new Error(`Ligne ${n + 2} : ${v.error.issues[0].message}`);
    return v.data;
  });
}
export function csvDownload(name: string, rows: Record<string, unknown>[]) {
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v,
      ]),
    ),
  );
  const blob = new Blob(["\uFEFF" + Papa.unparse(safe, { delimiter: ";" })], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
