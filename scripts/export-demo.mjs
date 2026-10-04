import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
const root = process.cwd();
const input = path.resolve(root, process.argv[2] || ".demo/data.json");
const data = JSON.parse(await readFile(input, "utf8"));
if (!Array.isArray(data.invitations))
  throw new Error("Format de démo invalide.");
const dir = path.join(root, ".private-backups");
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(dir, `demo-${stamp}.json`);
await writeFile(
  backup,
  JSON.stringify(
    { exportedAt: new Date().toISOString(), source: "local-demo", ...data },
    null,
    2,
  ),
  { flag: "wx", mode: 0o600 },
);
const rows = data.invitations
  .filter((i) => i.active)
  .map((i) => ({
    Nom: i.name,
    Téléphone: i.phone,
    Catégorie: i.category,
    "Nombre de places": i.quota,
    Commentaire: i.comment,
  }));
// Un CSV d'import est une donnée brute ; ne l'ouvrir dans Excel qu'après vérification des cellules.
// La copie séparée pour Excel neutralise les formules et ne sert pas à importer les téléphones.
await writeFile(
  path.join(dir, `invites-import-${stamp}.csv`),
  "\uFEFF" + Papa.unparse(rows, { delimiter: ";" }),
  { flag: "wx", mode: 0o600 },
);
const safe = rows.map((row) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v,
    ]),
  ),
);
await writeFile(
  path.join(dir, `invites-excel-${stamp}.csv`),
  "\uFEFF" + Papa.unparse(safe, { delimiter: ";" }),
  { flag: "wx", mode: 0o600 },
);
console.log(
  `Sauvegarde privée créée (${data.invitations.length} invitations, dont ${rows.length} actives).\nDossier : ${dir}\nLe JSON inclut les tokens : ne pas partager ni versionner.\nNettoyez invites-import pour retirer les données fictives avant import Supabase.\nLes réponses, admissions et tokens de démo ne sont pas transférés par le CSV.`,
);
