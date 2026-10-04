import { test, expect, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:3000";
async function login(page: Page, role = "admin") {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill("demo@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "");
  await page.getByLabel("Rôle en démonstration").selectOption(role);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(role === "admin" ? /\/admin$/ : /\/accueil$/);
}
async function post(page: Page, data: Record<string, unknown>) {
  return page.request.post("/api", { headers: { Origin: origin }, data });
}
test("les espaces privés exigent une session, y compris les API", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api?command=list")).status()).toBe(401);
  expect(
    (
      await post(page, {
        command: "admit",
        id: crypto.randomUUID(),
        count: 1,
        requestId: crypto.randomUUID(),
      })
    ).status(),
  ).toBe(401);
});
test("création, RSVP, QR, recherche manuelle, entrées partielles et complet", async ({
  page,
}, info) => {
  await login(page);
  await page.getByRole("button", { name: "Nouvelle invitation" }).click();
  const name = `Famille E2E ${info.project.name} ${Date.now()}`;
  await page.getByLabel("Nom de la personne / famille").fill(name);
  await page.getByLabel("Places autorisées").fill("5");
  await page
    .getByRole("button", { name: "Enregistrer l’invitation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const list = await (await page.request.get("/api?command=list")).json();
  const i = list.find((r: { name: string }) => r.name === name);
  expect(i).toBeTruthy();
  const manipulated = await post(page, {
    command: "rsvp",
    token: i.invite_token,
    status: "confirmed",
    count: 6,
  });
  expect(manipulated.status()).toBe(400);
  await page.goto(`/i/${i.invite_token}`);
  await page.getByLabel("Nombre de personnes présentes").selectOption("3");
  await page.getByRole("button", { name: "Oui, nous serons présents" }).click();
  await expect(page.getByText("Votre laissez-passer")).toBeVisible();
  await expect(
    page.getByText("Présence confirmée : 3 personnes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Invitation : ${i.code}`, { exact: true }),
  ).toBeVisible();
  for (const text of [
    "11h00",
    "Église Saint Camille",
    "13h30",
    "Mairie de Bogodogo",
    "14h30",
    "Espace Dieudonné – Salle Princesse",
  ])
    await expect(
      page.locator(".wedding-programme").getByText(text, { exact: true }),
    ).toBeVisible();
  await expect(page.locator(".pass-help")).toContainText("arriver séparément");
  await expect(page.locator(".pass-help")).toContainText(
    "jusqu’à ce que les 3 personnes confirmées aient été admises",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Votre laissez-passer")).toBeVisible();
  if (info.project.name === "mobile") {
    await page.screenshot({
      path: "test-results/invitation-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/accueil");
  await page.getByLabel("Recherche à l’accueil").fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(
    page.getByText("INVITATION VALIDE", { exact: true }),
  ).toBeVisible();
  const admission = page.getByRole("region", {
    name: "Vérification et admission",
  });
  for (const label of [
    "Places autorisées",
    "Personnes confirmées",
    "Déjà entrées",
    "Places restantes",
  ])
    await expect(admission.getByText(label, { exact: true })).toBeVisible();
  if (info.project.name === "mobile") {
    await expect
      .poll(async () =>
        admission.evaluate((el) => el.getBoundingClientRect().top),
      )
      .toBeLessThan(40);
  }
  await page.getByRole("button", { name: "Augmenter le nombre" }).click();
  await page
    .getByRole("button", { name: "Enregistrer l’entrée", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("2/3");
  const exceeded = await post(page, {
    command: "admit",
    id: i.id,
    count: 2,
    requestId: crypto.randomUUID(),
  });
  expect(exceeded.status()).toBe(400);
  await page
    .getByRole("button", { name: "Enregistrer l’entrée", exact: true })
    .click();
  await expect(
    page.getByText("INVITATION COMPLÈTE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Invitation déjà entièrement utilisée. Aucune place restante.",
    ),
  ).toBeVisible();
  expect(
    (
      await post(page, {
        command: "rsvp",
        token: i.invite_token,
        status: "confirmed",
        count: 2,
      })
    ).status(),
  ).toBe(400);
});
test("QR token, annulation, concurrence et idempotence API", async ({
  page,
}) => {
  await login(page);
  const created = await (
    await post(page, {
      command: "save",
      row: {
        name: "Couple Concurrence",
        phone: "",
        category: "Amis",
        quota: 5,
        comment: "",
      },
    })
  ).json();
  await post(page, {
    command: "rsvp",
    token: created.invite_token,
    status: "confirmed",
    count: 3,
  });
  const calls = await Promise.all([
    post(page, {
      command: "admit",
      id: created.id,
      count: 2,
      requestId: crypto.randomUUID(),
    }),
    post(page, {
      command: "admit",
      id: created.id,
      count: 2,
      requestId: crypto.randomUUID(),
    }),
  ]);
  expect(calls.map((r) => r.status()).sort()).toEqual([200, 400]);
  const requestId = crypto.randomUUID();
  const op = { command: "admit", id: created.id, count: 1, requestId };
  expect((await post(page, op)).status()).toBe(200);
  const replay = await (await post(page, op)).json();
  expect(replay.admitted).toBe(3);
  expect(replay).not.toHaveProperty("invite_token");
  expect(replay).not.toHaveProperty("pass_token");
  expect(replay).not.toHaveProperty("comment");
  const scan = await (
    await page.request.get(`/api?command=scan&token=${created.pass_token}`)
  ).json();
  expect(scan).not.toHaveProperty("invite_token");
  expect(scan).not.toHaveProperty("pass_token");
  await post(page, {
    command: "action",
    id: created.id,
    action: "active",
    value: { active: false },
  });
  expect(
    (
      await post(page, {
        command: "admit",
        id: created.id,
        count: 1,
        requestId: crypto.randomUUID(),
      })
    ).status(),
  ).toBe(400);
  await page.goto("/accueil");
  await page.getByRole("button", { name: "Scanner le QR" }).click();
  await page.getByText("Saisir le token du QR").click();
  await page.getByLabel("Token sécurisé").fill(created.pass_token);
  await page.getByRole("button", { name: "Vérifier", exact: true }).click();
  await expect(
    page.getByText("INVITATION ANNULÉE", { exact: true }),
  ).toBeVisible();
});
test("rôle accueil, CSRF et mode hors connexion", async ({ page, context }) => {
  await login(page, "accueil");
  expect((await page.request.get("/api?command=list")).status()).toBe(403);
  expect(
    (
      await post(page, {
        command: "save",
        row: { name: "Pirate", phone: "", category: "Amis", quota: 300 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api", {
        headers: { Origin: "https://evil.example" },
        data: { command: "logout" },
      })
    ).status(),
  ).toBe(403);
  await context.setOffline(true);
  await expect(page.locator('.offline[role="alert"]')).toContainText(
    "Admissions suspendues",
  );
  await context.setOffline(false);
});
test("import CSV avec aperçu et statistiques mobile", async ({
  page,
}, info) => {
  await login(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "invitations.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Nom;Téléphone;Catégorie;Nombre de places;Commentaire\nImport E2E; ;Amis;2;Test",
    ),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Importer ces invitations" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Import terminé");
  if (info.project.name === "mobile") {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/admin-mobile.png",
      fullPage: true,
    });
  } else
    await page.screenshot({
      path: "test-results/admin-desktop.png",
      fullPage: true,
    });
});

test("une réponse réseau perdue puis un rechargement ne double pas l’entrée", async ({
  page,
}) => {
  await login(page);
  const i = await (
    await post(page, {
      command: "save",
      row: {
        name: `Reprise réseau ${Date.now()}`,
        phone: "",
        category: "Recette",
        quota: 2,
        comment: "",
      },
    })
  ).json();
  await post(page, {
    command: "rsvp",
    token: i.invite_token,
    status: "confirmed",
    count: 2,
  });
  await page.goto("/accueil");
  await page.getByLabel("Recherche à l’accueil").fill(i.name);
  await page.getByRole("button", { name: new RegExp(i.name) }).click();
  let lost = false;
  let sessionExpired = true;
  await page.route("**/api", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.command === "admit" &&
      !lost
    ) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else if (
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.command === "admit" &&
      sessionExpired
    ) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Session expirée. Reconnectez-vous." }),
      });
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Enregistrer l’entrée", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Vérifier / réessayer la même admission",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Vérifier / réessayer la même admission" })
    .click();
  await expect(page.locator(".notice.error")).toContainText("Session expirée");
  await expect(
    page.getByRole("button", {
      name: "Vérifier / réessayer la même admission",
    }),
  ).toBeVisible();
  sessionExpired = false;
  await page.reload();
  await page
    .getByRole("button", { name: "Vérifier / réessayer la même admission" })
    .click();
  await expect(page.getByRole("status")).toContainText("1/2");
  const rows = await (await page.request.get("/api?command=list")).json();
  expect(rows.find((r: { id: string }) => r.id === i.id).admitted).toBe(1);
  const logs = await (await page.request.get("/api?command=audit")).json();
  expect(
    logs.filter(
      (r: { invitation_id: string; action: string }) =>
        r.invitation_id === i.id && r.action === "admission",
    ),
  ).toHaveLength(1);
});

test("le scanner décode le QR généré avec un flux caméra simulé", async ({
  page,
}, info) => {
  await login(page);
  const i = await (
    await post(page, {
      command: "save",
      row: {
        name: `Scanner optique ${Date.now()}`,
        phone: "",
        category: "Recette",
        quota: 2,
        comment: "",
      },
    })
  ).json();
  await post(page, {
    command: "rsvp",
    token: i.invite_token,
    status: "confirmed",
    count: 2,
  });
  await page.goto(`/i/${i.invite_token}`);
  await expect(page.locator("canvas")).toHaveJSProperty("width", 240);
  const png = await page
    .locator("canvas")
    .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await page.addInitScript((data) => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 480;
        const image = new Image();
        image.src = data;
        await image.decode();
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, 480, 480);
        return canvas.captureStream(10);
      },
    });
  }, png);
  await page.goto("/accueil");
  await page.getByRole("button", { name: "Scanner le QR" }).click();
  await page.getByRole("button", { name: "Ouvrir la caméra" }).click();
  await expect(
    page.getByText("INVITATION VALIDE", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: i.name })).toBeVisible();
  const all = await (await page.request.get("/api?command=list")).json();
  expect(all.find((r: { id: string }) => r.id === i.id).admitted).toBe(0);
  if (info.project.name === "mobile")
    await page.screenshot({
      path: "test-results/accueil-mobile.png",
      fullPage: true,
    });
});

test("deux écrans accueil périmés restent sûrs et le dashboard reflète les entrées", async ({
  page,
  browser,
}) => {
  await login(page);
  const i = await (
    await post(page, {
      command: "save",
      row: {
        name: `Deux téléphones ${Date.now()}`,
        phone: "",
        category: "Recette",
        quota: 5,
        comment: "",
      },
    })
  ).json();
  await post(page, {
    command: "rsvp",
    token: i.invite_token,
    status: "confirmed",
    count: 3,
  });
  const baseline = await (await page.request.get("/api?command=list")).json();
  const present = baseline.reduce(
    (n: number, r: { admitted: number }) => n + r.admitted,
    0,
  );
  const secondContext = await browser.newContext({ baseURL: origin });
  const second = await secondContext.newPage();
  try {
    await login(second, "accueil");
    await page.goto("/accueil");
    for (const phone of [page, second]) {
      await phone.getByLabel("Recherche à l’accueil").fill(i.name);
      await phone.getByRole("button", { name: new RegExp(i.name) }).click();
      await expect(
        phone.locator(".admission-numbers .remaining dd"),
      ).toHaveText("3");
      await phone.getByRole("button", { name: "Augmenter le nombre" }).click();
    }
    await Promise.all([
      page
        .getByRole("button", { name: "Enregistrer l’entrée", exact: true })
        .click(),
      second
        .getByRole("button", { name: "Enregistrer l’entrée", exact: true })
        .click(),
    ]);
    await expect
      .poll(async () => {
        const a = await page.locator(".notice.success").count();
        const b = await second.locator(".notice.success").count();
        return a + b;
      })
      .toBe(1);
    await expect
      .poll(async () => {
        const a = await page.locator(".notice.error").count();
        const b = await second.locator(".notice.error").count();
        return a + b;
      })
      .toBe(1);
    const errorPage = (await page.locator(".notice.error").count())
      ? page
      : second;
    await expect(errorPage.locator(".notice.error")).toContainText(
      "Places restantes insuffisantes",
    );
    await expect(
      errorPage.locator(".admission-numbers .remaining dd"),
    ).toHaveText("1");
    await errorPage
      .getByRole("button", { name: "Enregistrer l’entrée", exact: true })
      .click();
    await expect(
      errorPage.getByText("INVITATION COMPLÈTE", { exact: true }),
    ).toBeVisible();
    const rows = await (await page.request.get("/api?command=list")).json();
    expect(rows.find((r: { id: string }) => r.id === i.id).admitted).toBe(3);
    await page.goto("/admin");
    await expect(
      page
        .locator(".stat-card")
        .filter({ hasText: "Personnes accueillies" })
        .locator(":scope > strong"),
    ).toHaveText(String(present + 3));
  } finally {
    await secondContext.close();
  }
});
