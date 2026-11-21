import { stagingProjectRef } from "../scripts/staging-qa-storage.js";

const backendOrigin = `https://${stagingProjectRef}.supabase.co`;
const objectPath = "/storage/v1/object/techkarvo-marketplace";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function requestJson(request) {
  try { return request.postDataJSON(); } catch { return null; }
}

export function isStagingBackend(url, pathname) {
  return url.origin === backendOrigin && url.pathname === pathname;
}

function isNewInsert(response, pathname) {
  const request = response.request();
  const headers = request.headers();
  return response.status() === 201 && request.method() === "POST"
    && isStagingBackend(new URL(request.url()), pathname)
    && !/resolution\s*=/i.test(headers.prefer || "") && headers["x-upsert"] !== "true";
}

export async function guardQaDeletions(page, accountId, otherId, fixtureImage, blocked) {
  const media = new Set();
  const posts = new Set();
  const messages = new Set();
  const safetyRecords = new Set();
  const ownsPath = (path) => typeof path === "string" && path.startsWith(`${accountId}/`)
    && /^[0-9a-f-]{36}\.png$/i.test(path.slice(accountId.length + 1));

  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(request.url());
    if (url.origin !== backendOrigin) return;
    if (url.pathname.startsWith(`${objectPath}/`) && request.method() === "POST" && response.ok()
      && request.headers()["x-upsert"] === "false") {
      const path = url.pathname.slice(objectPath.length + 1);
      if (ownsPath(path) && request.postDataBuffer()?.includes(fixtureImage)) media.add(path);
    }
    if ((url.pathname === "/rest/v1/muted_users" || url.pathname === "/rest/v1/user_blocks")
      && isNewInsert(response, url.pathname)) {
      const data = requestJson(request);
      const fields = url.pathname.endsWith("muted_users") ? ["user_id", "muted_user_id"] : ["blocker_id", "blocked_id"];
      if (data?.[fields[0]] === accountId && data?.[fields[1]] === otherId) safetyRecords.add(url.pathname);
    }
  });

  await page.route((url) => url.origin === backendOrigin, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const redact = method === "POST" && url.pathname === "/rest/v1/rpc/techkarvo_delete_message_for_everyone";
    if (method !== "DELETE" && !redact) return route.fallback();
    const eq = (key, value) => url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === `eq.${value}`;
    let allowed = false;
    let category = "other deletion";
    if (redact) {
      category = "message";
      const data = requestJson(request);
      allowed = Boolean(data && Object.keys(data).length === 1 && messages.has(data.p_message_id));
    } else if (url.pathname === objectPath) {
      category = "media";
      const paths = requestJson(request)?.prefixes;
      allowed = Array.isArray(paths) && paths.length > 0 && paths.every((path) => media.has(path));
    } else if (url.pathname === "/rest/v1/posts") {
      category = "post";
      const postId = url.searchParams.get("id")?.slice(3);
      allowed = posts.has(postId) && eq("author_id", accountId) && eq("id", postId);
    } else if (url.pathname === "/rest/v1/muted_users" || url.pathname === "/rest/v1/user_blocks") {
      category = "temporary safety setting";
      const fields = url.pathname.endsWith("muted_users") ? ["user_id", "muted_user_id"] : ["blocker_id", "blocked_id"];
      allowed = eq(fields[0], accountId) && eq(fields[1], otherId) && safetyRecords.delete(url.pathname);
    } else if (url.pathname === "/rest/v1/conversation_hides") {
      category = "conversation hide";
    }
    if (allowed) return route.fallback();
    blocked.push(category);
    return route.fulfill({ status: 403, json: { message: "QA deletion scope was not verified." } });
  });

  return {
    async recordPost(response, body) {
      const data = requestJson(response.request());
      if (!isNewInsert(response, "/rest/v1/posts") || data?.author_id !== accountId || data.body !== body) {
        throw new Error("Could not verify creation of the QA post.");
      }
      const { id } = await response.json();
      if (!uuid.test(id)) throw new Error("Created QA post did not return an ID.");
      posts.add(id);
    },
    async recordMessage(insert, read, body) {
      const data = requestJson(insert.request());
      if (!isNewInsert(insert, "/rest/v1/messages") || data?.sender_id !== accountId || data.body !== body
        || !uuid.test(data.conversation_id) || !read.ok() || read.request().method() !== "GET"
        || !isStagingBackend(new URL(read.url()), "/rest/v1/messages")) {
        throw new Error("Could not verify creation of the QA message.");
      }
      const rows = await read.json();
      const matching = rows.filter((row) => row.sender_id === accountId && row.body === body
        && row.conversation_id === data.conversation_id);
      if (matching.length !== 1 || !uuid.test(matching[0].id)) throw new Error("Created QA message could not be identified.");
      messages.add(matching[0].id);
      return data.conversation_id;
    }
  };
}
