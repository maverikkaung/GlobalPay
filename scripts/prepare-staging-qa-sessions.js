import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import process from "node:process";

const projectRef = "ntucgiieksrwebwvcmun";
const stagingOrigin = "https://techkarvo-staging.vercel.app";
const sessionDir = process.env.TK_QA_SESSION_DIR || join(tmpdir(), "techkarvo-staging-qa-session-r8");

if (!stdin.isTTY) {
  throw new Error("Run the staging QA session setup in an interactive PowerShell or terminal window.");
}

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
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: false,
  args: ["--no-first-run", "--no-default-browser-check"]
});
const client = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const freelancer = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const prompt = createInterface({ input: stdin, output: stdout });

async function openLogin(context, role) {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(`${stagingOrigin}/login`);
  await page.evaluate((title) => { document.title = title; }, `TechKarvo Staging QA ${role} Login`);
  const authenticated = await page.evaluate(() => Object.keys(localStorage).some((key) => {
    if (!key.includes("auth-token")) return false;
    try {
      const session = JSON.parse(localStorage.getItem(key) || "null");
      return Boolean(session?.access_token || session?.currentSession?.access_token);
    } catch {
      return false;
    }
  }));
  if (authenticated) throw new Error(`The fresh ${role} browser context unexpectedly has an existing login.`);
  process.stdout.write(`${role} нэвтрэх цонх staging дээр нээлттэй.\n`);
  return page;
}

async function verifySession(page, role) {
  const expectedPath = role === "Client" ? /\/client-dashboard/ : /\/freelancer-dashboard/;
  const expectedHeading = role === "Client" ? /CLIENT DASHBOARD/i : /FREELANCER DASHBOARD/i;
  const currentUrl = new URL(page.url());
  if (currentUrl.origin !== stagingOrigin || !expectedPath.test(currentUrl.pathname)) return false;
  if (!await page.getByText(expectedHeading).count()) return false;
  return await page.evaluate(({ ref, deniedIdentity }) => {
    const key = `sb-${ref}-auth-token`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const session = parsed.access_token ? parsed : parsed.currentSession;
      const email = String(session?.user?.email || "").trim().toLowerCase();
      const identity = `${email} ${session?.user?.user_metadata?.full_name || ""}`.toLowerCase();
      return Boolean(session?.access_token && email && email !== deniedIdentity && !/qa[\s_-]*admin/i.test(identity) && /(qa|test)/i.test(identity));
    } catch {
      return false;
    }
  }, { ref: projectRef, deniedIdentity: "qa-admin@techkarvo.invalid" });
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
  process.stdout.write("Хоёр staging session Playwright-д нууцлалтай local temporary storage хэлбэрээр бэлэн боллоо. Токен болон profile агуулга дэлгэцэнд хэвлэгдээгүй.\n");
} finally {
  prompt.close();
  await Promise.allSettled([client.close(), freelancer.close()]);
  await browser.close().catch(() => {});
}
