import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { stagingProjectRef } from "../scripts/staging-qa-storage.js";

const run = promisify(execFile);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function hasOnlyQaPostDependencies({ postId, authorId, memberId, messageId, comment }) {
  if (![postId, authorId, memberId, messageId].every((id) => uuid.test(id)) || typeof comment !== "string") return false;
  const commentHash = createHash("sha256").update(comment).digest("hex");
  // The owner DELETE cascades comments and reactions and clears shared-message references.
  // Check all dependencies (including shares that the post owner cannot read under RLS).
  const sql = `select
    exists(select 1 from public.posts where id='${postId}' and author_id='${authorId}')
    and (select count(*)=1 and bool_and(user_id='${memberId}') from public.post_likes where post_id='${postId}')
    and (select count(*)=1 and bool_and(author_id='${memberId}' and
      encode(sha256(convert_to(body,'UTF8')),'hex')='${commentHash}') from public.post_comments where post_id='${postId}')
    and (select count(*)=1 and bool_and(id='${messageId}' and sender_id='${memberId}') from public.messages where shared_post_id='${postId}')
    as safe`;
  try {
    const { stdout } = await run("supabase", ["db", "query", `--remote=${stagingProjectRef}`, "--read-only", "--output-format", "json", sql], {
      timeout: 15000, windowsHide: true
    });
    return JSON.parse(stdout).rows?.[0]?.safe === true;
  } catch {
    return false;
  }
}
