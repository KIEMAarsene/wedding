// Lecture seule : ne jamais afficher les valeurs de secrets détectées.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
const candidates = [
  ...new Set(
    execFileSync("git", [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ])
      .toString()
      .split("\0")
      .filter(Boolean),
  ),
];
const sensitivePaths =
  /(^|\/)(\.phone-test|\.demo(?:-phone)?|\.private-backups|\.vercel|\.supabase)(\/|$)|(^|\/)\.env(?!\.example$|\.test\.example$)|\.(key|pem|pfx|p12|cer|crt)$/i;
const secrets = [];
for (const file of [".env.local", ".env.test"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (!match || !/PASSWORD|SECRET|SERVICE_ROLE|TOKEN/.test(match[1]))
      continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value.length >= 8) secrets.push(value);
  }
}
const findings = [];
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /eyJhbGciOi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
];
for (const file of candidates) {
  if (sensitivePaths.test(file.replaceAll("\\", "/")))
    findings.push(`${file}: fichier privé publiable`);
  if (!existsSync(file)) continue;
  const body = readFileSync(file, "utf8");
  if (
    patterns.some((p) => p.test(body)) ||
    secrets.some((value) => body.includes(value))
  )
    findings.push(`${file}: valeur sensible détectée`);
}
function walk(folder) {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|json|html|map)$/.test(entry.name)) {
      const body = readFileSync(file, "utf8");
      if (
        secrets.some((value) => body.includes(value)) ||
        patterns.some((p) => p.test(body))
      )
        findings.push(`${file}: secret dans un artefact client`);
    }
  }
}
walk(".next/static");
for (const file of [
  ".next/server/app/index.html",
  ".next/server/app/index.rsc",
]) {
  if (
    existsSync(file) &&
    secrets.some((value) => readFileSync(file, "utf8").includes(value))
  )
    findings.push(`${file}: secret dans la page publique`);
}
if (findings.length) {
  console.error([...new Set(findings)].join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `PASS : ${candidates.length} fichiers destinés à Git et artefacts client contrôlés ; aucun secret détecté. Contrôle heuristique à refaire avant chaque push.`,
  );
