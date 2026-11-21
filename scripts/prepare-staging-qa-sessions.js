import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import process from "node:process";
import { navigateToStagingLogin, prepareSequentialLoginPages, QA_CHROME_ARGS } from "./staging-qa-session.js";

const projectRef = "ntucgiieksrwebwvcmun";
const stagingOrigin = "https://techkarvo-staging.vercel.app";
const sessionDir = resolve(process.env.TK_QA_SESSION_DIR || join(tmpdir(), "techkarvo-staging-qa-session"));
const chromePath = process.env.TK_QA_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const repoRelativeSessionPath = relative(resolve(process.cwd()), sessionDir);

if (!stdin.isTTY) {
  throw new Error("Run the staging QA session setup in an interactive PowerShell or terminal window.");
}

if (existsSync(sessionDir)) {
  throw new Error("A QA session directory already exists. Preserve it and choose a new TK_QA_SESSION_DIR.");
}

if (!repoRelativeSessionPath.startsWith(`..${sep}`) && repoRelativeSessionPath !== "..") {
  throw new Error("QA session files must be stored outside the repository. Choose a TK_QA_SESSION_DIR under LOCALAPPDATA or TEMP.");
}

let browser;
let client;
let freelancer;
let prompt;

async function openLogin(context, role) {
  let page = context.pages()[0] || await context.newPage();
  page = await navigateToStagingLogin(page, `${stagingOrigin}/login`);
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
  process.stdout.write(`${role} нэвтрэх цонх staging дээр нээлттэй, login form бэлэн байна.\n`);
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

function secureDirectory(directory) {
  mkdirSync(directory, { mode: 0o700 });
  if (process.platform === "win32" && process.env.USERNAME) {
    const account = process.env.USERDOMAIN
      ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
      : process.env.USERNAME;
    execFileSync("icacls", [directory, "/inheritance:r", "/grant:r", `${account}:(OI)(CI)F`], {
      windowsHide: true,
      stdio: "ignore"
    });
  }
}

function saveSessions(clientState, freelancerState) {
  if (existsSync(sessionDir)) {
    throw new Error("The selected session directory appeared during setup. No existing files were changed; choose a new directory.");
  }

  mkdirSync(dirname(sessionDir), { recursive: true, mode: 0o700 });
  const pendingDir = `${sessionDir}.pending-${process.pid}`;
  if (existsSync(pendingDir)) {
    throw new Error("A pending session directory already exists. It was preserved; choose another session directory.");
  }

  secureDirectory(pendingDir);
  writeFileSync(join(pendingDir, "client.json"), clientState, { mode: 0o600, flag: "wx" });
  writeFileSync(join(pendingDir, "freelancer.json"), freelancerState, { mode: 0o600, flag: "wx" });
  if (existsSync(sessionDir)) {
    throw new Error("The selected session directory appeared while saving. Existing files were preserved.");
  }
  renameSync(pendingDir, sessionDir);
}

try {
  if (!existsSync(chromePath)) {
    throw new Error("Chrome was not found at the configured path. Set TK_QA_CHROME_PATH to the installed Chrome executable.");
  }

  browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
    args: QA_CHROME_ARGS
  });
  client = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  freelancer = await browser.newContext({ viewport: { width: 1440, height: 960 } });

  // Prepare and validate both login forms before handing either window to the user.
  const [clientPage, freelancerPage] = await prepareSequentialLoginPages(
    [client, freelancer],
    (context) => openLogin(context, context === client ? "Client" : "Freelancer")
  );
  prompt = createInterface({ input: stdin, output: stdout });
  process.stdout.write("Зориулалтын staging Client болон Freelancer QA аккаунтаар тус тусын цонхонд нэвтэрнэ үү. Нууц үг, token-ийг чат эсвэл terminal-д бүү оруул. Хоёулаа dashboard-д орсны дараа энд `READY` гэж бичнэ үү.\n");

  while (true) {
    await prompt.question("Хоёр QA session бэлэн болсны дараа READY-г оруулна уу: ");
    const clientOk = await verifySession(clientPage, "Client");
    const freelancerOk = await verifySession(freelancerPage, "Freelancer");
    if (clientOk && freelancerOk) break;
    process.stdout.write("Нэг эсвэл хоёр цонх зөв role-ийн staging dashboard/session-д хараахан ороогүй байна. Login-оо дуусгаад дахин READY гэж бичнэ үү.\n");
  }

  saveSessions(
    JSON.stringify(await client.storageState()),
    JSON.stringify(await freelancer.storageState())
  );
  process.stdout.write("Хоёр staging session тусгаарлагдсан local temporary storage-д хадгалагдлаа. Нууц мэдээлэл дэлгэцэнд хэвлэгдээгүй.\n");
} finally {
  prompt?.close();
  await Promise.allSettled([client?.close(), freelancer?.close()].filter(Boolean));
  await browser?.close().catch(() => {});
}
