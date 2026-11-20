import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import process from "node:process";

const projectRef = "ntucgiieksrwebwvcmun";
const stagingOrigin = "https://techkarvo-staging.vercel.app";
const sessionDir = join(tmpdir(), "techkarvo-staging-qa-session-r4");

if (existsSync(sessionDir)) {
  throw new Error("A QA session directory already exists. Preserve it and review it before starting another setup.");
}

mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
if (process.platform === "win32" && process.env.USERNAME) {
  const account = process.env.USERDOMAIN
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : process.env.USERNAME;
  execFileSync("icacls", [sessionDir, "/inheritance:r", "/grant:r", `${account}:(OI)(CI)F`], { windowsHide: true, stdio: "ignore" });
}

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const client = await chromium.launchPersistentContext(join(sessionDir, "client-profile"), {
  executablePath: chromePath,
  ignoreDefaultArgs: ["--no-sandbox"],
  headless: false,
  viewport: { width: 1440, height: 960 }
});
const freelancer = await chromium.launchPersistentContext(join(sessionDir, "freelancer-profile"), {
  executablePath: chromePath,
  ignoreDefaultArgs: ["--no-sandbox"],
  headless: false,
  viewport: { width: 1440, height: 960 }
});
const prompt = createInterface({ input: stdin, output: stdout });
let captured = false;

async function openLogin(context, role) {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(`${stagingOrigin}/login`);
  process.stdout.write(`${role} нэвтрэх цонх staging дээр нээлттэй.\n`);
  return page;
}

async function verifySession(page, role) {
  const expectedPath = role === "Client" ? /\/client-dashboard/ : /\/freelancer-dashboard/;
  const expectedHeading = role === "Client" ? /CLIENT DASHBOARD/i : /FREELANCER DASHBOARD/i;
  if (!expectedPath.test(new URL(page.url()).pathname)) return false;
  if (!await page.getByText(expectedHeading).count()) return false;
  return await page.evaluate((ref) => {
    const key = `sb-${ref}-auth-token`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed.access_token || parsed.currentSession?.access_token);
    } catch {
      return false;
    }
  }, projectRef);
}

try {
  const clientPage = await openLogin(client, "Client");
  const freelancerPage = await openLogin(freelancer, "Freelancer");
  process.stdout.write("Зөвхөн dedicated staging QA аккаунтаар тус тусын цонхонд нэвтэрнэ үү. Нууц үг, token чатанд болон terminal output-д оруулахгүй. Хоёулаа dashboard-д орсны дараа энд `READY` гэж мэдэгдэнэ үү.\n");

  while (true) {
    await prompt.question("Хоёр QA session бэлэн болсны дараа READY-г оруулна уу: ");
    const clientOk = await verifySession(clientPage, "Client");
    const freelancerOk = await verifySession(freelancerPage, "Freelancer");
    if (clientOk && freelancerOk) break;
    process.stdout.write("Нэг эсвэл хоёр цонх role-ийн dashboard/session-д хараахан ороогүй байна. Login-оо дуусгаад дахин READY гэж мэдэгдэнэ үү.\n");
  }

  writeFileSync(join(sessionDir, "client.json"), JSON.stringify(await client.storageState()), { mode: 0o600 });
  writeFileSync(join(sessionDir, "freelancer.json"), JSON.stringify(await freelancer.storageState()), { mode: 0o600 });
  captured = true;
  process.stdout.write("Хоёр staging session Playwright-д нууцлалтай local temporary storage хэлбэрээр бэлэн боллоо. Токен болон profile агуулга дэлгэцэнд хэвлэгдээгүй.\n");
} finally {
  prompt.close();
  await Promise.allSettled([client.close(), freelancer.close()]);
  if (captured) {
    rmSync(join(sessionDir, "client-profile"), { recursive: true, force: true });
    rmSync(join(sessionDir, "freelancer-profile"), { recursive: true, force: true });
  }
}
