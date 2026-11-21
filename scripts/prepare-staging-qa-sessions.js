import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import process from "node:process";
import { navigateToStagingLogin, prepareSequentialLoginPages, QA_CHROME_ARGS } from "./staging-qa-session.js";
import { qaSessionPaths, stagingOrigin, stagingProjectRef as projectRef } from "./staging-qa-storage.js";

const sessionDir = resolve(qaSessionPaths(process.env).directory);
const chromePath = process.env.TK_QA_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const repoRelativeSessionPath = relative(resolve(process.cwd()), sessionDir);
const freshSignup = process.argv.includes("--signup");
const backend = `https://${projectRef}.supabase.co`;

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
  if (freshSignup) {
    await page.getByRole("link", { name: "Sign Up", exact: true }).click();
    await page.waitForURL(`${stagingOrigin}/signup`);
    await page.locator("#signup-email").waitFor({ state: "visible" });
    await page.getByRole("button", { name: new RegExp(`^${role}\\b`, "i") }).click();
    await page.evaluate((title) => { document.title = title; }, `TechKarvo Staging QA ${role} Signup`);
  }
  process.stdout.write(`${role} staging ဖောင် အသင့်ဖြစ်ပါပြီ။\n`);
  return page;
}

async function guardFreshSignup(context, role) {
  let signupForwarded = false;
  await context.route((url) => /^\/(auth|rest|storage)\/v1\//.test(url.pathname), (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== backend) return route.abort();
    const method = request.method();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return route.fallback();
    if (method === "POST" && ["/auth/v1/token", "/auth/v1/verify", "/rest/v1/rpc/techkarvo_is_platform_admin"].includes(url.pathname)) return route.fallback();
    if (method === "POST" && url.pathname === "/auth/v1/signup" && !signupForwarded) {
      let data;
      try { data = request.postDataJSON()?.data; } catch { data = null; }
      if (data?.account_type === role.toLowerCase() && /\bQA\b/i.test(data.full_name || "")) {
        signupForwarded = true;
        return route.fallback();
      }
    }
    return route.fulfill({ status: 403, json: { message: "Staging QA account setup scope exceeded." } });
  });
  return () => signupForwarded;
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
  client = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block" });
  freelancer = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: "block" });
  const signupChecks = freshSignup ? await Promise.all([
    guardFreshSignup(client, "Client"), guardFreshSignup(freelancer, "Freelancer")
  ]) : [];

  // Prepare and validate both login forms before handing either window to the user.
  const [clientPage, freelancerPage] = await prepareSequentialLoginPages(
    [client, freelancer],
    (context) => openLogin(context, context === client ? "Client" : "Freelancer")
  );
  prompt = createInterface({ input: stdin, output: stdout });
  process.stdout.write(freshSignup
    ? "သက်ဆိုင်ရာ role ဖြင့် staging QA အကောင့်အသစ်ဖွင့်ပြီး အတည်ပြုပါ။ အမည်တွင် QA ထည့်ပြီး စကားဝှက်ကို browser ဖောင်ထဲတွင်သာ ထည့်ပါ။\n"
    : "QA အကောင့်နှစ်ခုဖြင့် သက်ဆိုင်ရာ staging dashboard သို့ ဝင်ပါ။ စကားဝှက်ကို browser ဖောင်ထဲတွင်သာ ထည့်ပါ။\n");

  while (true) {
    await prompt.question("Dashboard နှစ်ခုလုံး ပေါ်ပြီးလျှင် READY ဟု ရိုက်ပါ။ ");
    const clientOk = await verifySession(clientPage, "Client");
    const freelancerOk = await verifySession(freelancerPage, "Freelancer");
    if (clientOk && freelancerOk && signupChecks.every((didSubmit) => didSubmit())) break;
    process.stdout.write("သတ်မှတ် role နှစ်ခုလုံး၏ staging dashboard အဆင်သင့် ဖြစ်ရပါမည်။\n");
  }

  saveSessions(
    JSON.stringify(await client.storageState()),
    JSON.stringify(await freelancer.storageState())
  );
  process.stdout.write("QA session နှစ်ခုကို သီးခြား ကာကွယ်ထားသော ဖိုင်တွဲတွင် သိမ်းပြီးပါပြီ။\n");
} finally {
  prompt?.close();
  await Promise.allSettled([client?.close(), freelancer?.close()].filter(Boolean));
  await browser?.close().catch(() => {});
}
