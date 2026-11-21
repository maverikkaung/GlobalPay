import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const stagingOrigin = "https://techkarvo-staging.vercel.app";
export const stagingProjectRef = "ntucgiieksrwebwvcmun";

export function qaSessionPaths(env) {
  const directory = env.TK_QA_SESSION_DIR || join(tmpdir(), "techkarvo-staging-qa-session");
  return {
    directory,
    Client: env.TK_QA_CLIENT_STORAGE_STATE || join(directory, "client.json"),
    Freelancer: env.TK_QA_FREELANCER_STORAGE_STATE || join(directory, "freelancer.json")
  };
}

function storedSession(state) {
  try {
    const entry = state?.origins?.find(({ origin }) => origin === stagingOrigin)
      ?.localStorage?.find(({ name }) => name === `sb-${stagingProjectRef}-auth-token`);
    const raw = JSON.parse(entry?.value ?? "null");
    return raw?.access_token ? raw : raw?.currentSession;
  } catch {
    return null;
  }
}

function complete(session) {
  return Boolean(session?.user?.id && session.access_token && session.refresh_token
    && Number.isFinite(session.expires_at));
}

export function sessionStatus(state, now = Date.now()) {
  const session = storedSession(state);
  if (!complete(session)) return "missing or invalid";
  return session.expires_at * 1000 <= now ? "expired access token; refresh available" : "unexpired";
}

export function shouldPersistSession(previous, current, now = Date.now()) {
  const original = storedSession(previous);
  const latest = storedSession(current);
  return complete(original) && complete(latest)
    && latest.user.id === original.user.id
    && latest.expires_at >= original.expires_at
    && latest.expires_at * 1000 > now
    && latest.refresh_token !== original.refresh_token;
}

export async function persistRotatedSession(path, previous, current) {
  if (!shouldPersistSession(previous, current)) return false;
  const pending = `${path}.pending-${randomUUID()}`;
  try {
    await writeFile(pending, JSON.stringify(current), { mode: 0o600, flag: "wx" });
    try {
      await rename(pending, path);
    } catch (error) {
      await unlink(pending).catch(() => {});
      throw error;
    }
  } catch (error) {
    // Filesystem error details include the path to the private session file.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Could not save refreshed QA session (${error.code || "unknown error"}).`);
  }
  return true;
}
