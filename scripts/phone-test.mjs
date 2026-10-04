import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { isIP } from "node:net";
const ip = process.argv.slice(2).find((v) => v !== "--");
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter(Boolean)
  .map((i) => i.address);
if (isIP(ip) !== 4 || !addresses.includes(ip) || ip === "127.0.0.1")
  throw new Error(
    "Indiquez l’adresse IPv4 Wi-Fi de ce PC : pnpm phone:test -- 192.168.1.65",
  );
if (
  !existsSync(".phone-test/server.key") ||
  !existsSync(".phone-test/server.pem")
)
  throw new Error(
    "Générez d’abord le certificat : python scripts/create-phone-cert.py " + ip,
  );
const port = "3443",
  url = `https://${ip}:${port}`;
console.log(
  `Test sur téléphone : ${url}\nMême Wi-Fi, certificat .phone-test/ca.cer à approuver sur le téléphone.\nAucun déploiement public. Serveur arrêté avec Ctrl+C.`,
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    port,
    "--experimental-https",
    "--experimental-https-key",
    ".phone-test/server.key",
    "--experimental-https-cert",
    ".phone-test/server.pem",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DEMO_MODE: "true",
      APP_URL: url,
      PHONE_TEST_HOST: ip,
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => child.kill("SIGINT"));
