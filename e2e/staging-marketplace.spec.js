import { test, expect } from "@playwright/test";
import process from "node:process";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const stagingBase = process.env.PLAYWRIGHT_BASE_URL || "";
const clientCredentials = { email: process.env.TK_QA_CLIENT_EMAIL, password: process.env.TK_QA_CLIENT_PASSWORD };
const freelancerCredentials = { email: process.env.TK_QA_FREELANCER_EMAIL, password: process.env.TK_QA_FREELANCER_PASSWORD };
const qaSessionDir = process.env.TK_QA_SESSION_DIR || join(tmpdir(), "techkarvo-staging-qa-session-r6");
const clientStorageState = process.env.TK_QA_CLIENT_STORAGE_STATE || join(qaSessionDir, "client.json");
const freelancerStorageState = process.env.TK_QA_FREELANCER_STORAGE_STATE || join(qaSessionDir, "freelancer.json");
const credentialLoginAvailable = clientCredentials.email && clientCredentials.password && freelancerCredentials.email && freelancerCredentials.password;
const sessionLoginAvailable = existsSync(clientStorageState) && existsSync(freelancerStorageState);
const credentialsAvailable = /^https:\/\/techkarvo-staging\.vercel\.app\/?$/.test(stagingBase)
  && (credentialLoginAvailable || sessionLoginAvailable);

function storageStateFor(role) {
  if (credentialLoginAvailable) return undefined;
  return role === "Client" ? clientStorageState : freelancerStorageState;
}

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=", "base64");

async function signIn(page, credentials, role) {
  const dashboardPath = role === "Client" ? "/client-dashboard" : "/freelancer-dashboard";
  if (credentials?.email && credentials?.password) {
    await page.goto("/login");
    await page.locator("#login-email").fill(credentials.email);
    await page.locator("#login-password").fill(credentials.password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
  } else {
    await page.goto(dashboardPath);
  }
  await page.waitForURL(role === "Client" ? /client-dashboard/ : /freelancer-dashboard/, { timeout: 60_000 });
  await page.getByText(role === "Client" ? /CLIENT DASHBOARD/i : /FREELANCER DASHBOARD/i).waitFor({ timeout: 60_000 });
}

async function profileIdFor(page) {
  const id = await page.evaluate((projectRef) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(`sb-${projectRef}-auth-token`) || "null");
      const session = parsed?.access_token ? parsed : parsed?.currentSession;
      return session?.user?.id || null;
    } catch {
      return null;
    }
  }, "ntucgiieksrwebwvcmun");
  expect(id, "authenticated staging session should identify its account").toMatch(/^[0-9a-f-]{36}$/i);
  return id;
}

async function authenticatedEmailFor(page) {
  return page.evaluate((projectRef) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(`sb-${projectRef}-auth-token`) || "null");
      const session = parsed?.access_token ? parsed : parsed?.currentSession;
      return String(session?.user?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }, "ntucgiieksrwebwvcmun");
}

function connectionCardFor(page, profileId) {
  return page.locator(`.connection-card:has(a[href="/profiles/${profileId}"])`).first();
}

async function ensureAcceptedQaConnection(client, freelancer, postBody, clientId, freelancerId) {
  await freelancer.goto("/social");
  const post = freelancer.locator("article.social-card").filter({ hasText: postBody }).first();
  const action = post.getByRole("button", { name: /^(Connect|Request pending|Accept connect|Message)$/ });
  await expect(action).toBeVisible({ timeout: 60_000 });
  const initialAction = (await action.innerText()).trim();

  if (initialAction === "Connect") {
    await action.click();
    await expect(freelancer.getByText(/Connection request sent/i)).toBeVisible();
  } else if (initialAction === "Accept connect") {
    await action.click();
    await freelancer.waitForURL(/\/messages\?conversation=/, { timeout: 30_000 });
  }

  await client.goto("/connections");
  let clientCard = connectionCardFor(client, freelancerId);
  await expect(clientCard).toBeVisible({ timeout: 60_000 });
  if ((await clientCard.locator(".connection-status").innerText()).trim() === "Pending") {
    const accept = clientCard.getByRole("button", { name: "Accept", exact: true });
    if (await accept.count()) {
      await accept.click();
      await client.waitForURL(/\/messages\?conversation=/, { timeout: 30_000 });
    } else {
      await freelancer.goto("/connections");
      const freelancerCard = connectionCardFor(freelancer, clientId);
      await expect(freelancerCard.getByRole("button", { name: "Accept", exact: true })).toBeVisible({ timeout: 30_000 });
      await freelancerCard.getByRole("button", { name: "Accept", exact: true }).click();
      await freelancer.waitForURL(/\/messages\?conversation=/, { timeout: 30_000 });
    }
  }

  await client.goto("/connections");
  clientCard = connectionCardFor(client, freelancerId);
  await expect(clientCard.locator(".connection-status")).toHaveText("Accepted", { timeout: 60_000 });
  await freelancer.goto("/connections");
  const freelancerCard = connectionCardFor(freelancer, clientId);
  await expect(freelancerCard.locator(".connection-status")).toHaveText("Accepted", { timeout: 60_000 });
  await expect(clientCard.getByRole("button", { name: "Message", exact: true })).toBeVisible();
  await expect(freelancerCard.getByRole("button", { name: "Message", exact: true })).toBeVisible();
}

async function selectMessageFolder(page, folder) {
  const tab = page.getByRole("tab", { name: folder === "job" ? /Job Messages/ : /Personal Messages/ });
  await expect(tab).toBeEnabled({ timeout: 60_000 });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

function readUnreadCount(label) {
  const match = label.match(/,\s*(\d+) unread/i);
  return Number(match?.[1] || 0);
}

test("staging Client acceptance makes the personal connection visible to both members", async ({ browser }) => {
  test.skip(!credentialsAvailable, "Set staging-only QA account variables to run authenticated staging browser coverage.");
  const clientContext = await browser.newContext({ storageState: storageStateFor("Client") });
  const freelancerContext = await browser.newContext({ storageState: storageStateFor("Freelancer") });
  const client = await clientContext.newPage();
  const freelancer = await freelancerContext.newPage();
  client.on("dialog", (dialog) => dialog.accept());
  try {
    await signIn(client, clientCredentials, "Client");
    await signIn(freelancer, freelancerCredentials, "Freelancer");
    const clientId = await profileIdFor(client);
    const freelancerId = await profileIdFor(freelancer);
    const postBody = `QA connection visibility ${Date.now()}`;
    await client.goto("/social");
    await client.locator("#social-post-body").fill(postBody);
    await client.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(client.getByText("Your professional post is live.")).toBeVisible();
    await freelancer.goto("/social");
    const post = freelancer.locator("article.social-card").filter({ hasText: postBody });
    await expect(post).toBeVisible();
    await ensureAcceptedQaConnection(client, freelancer, postBody, clientId, freelancerId);
  } finally {
    await clientContext.close();
    await freelancerContext.close();
  }
});
test("staging Client and Freelancer workflows: media, jobs, social, messaging, safety, contracts, reviews and settings", async ({ browser }) => {
  test.skip(!credentialsAvailable, "Set staging-only QA account variables to run authenticated staging browser coverage.");
  test.setTimeout(300_000);

  const clientContext = await browser.newContext({ storageState: storageStateFor("Client"), viewport: { width: 1440, height: 960 } });
  const freelancerContext = await browser.newContext({ storageState: storageStateFor("Freelancer"), viewport: { width: 1440, height: 960 } });
  const client = await clientContext.newPage();
  const freelancer = await freelancerContext.newPage();
  const runtimeErrors = [];
  const failedRequests = [];
  for (const page of [client, freelancer]) {
    page.setDefaultNavigationTimeout(60_000);
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "request failed";
      if (failure !== "net::ERR_ABORTED" && failure !== "NS_BINDING_ABORTED") {
        failedRequests.push(`${request.method()} ${request.url().split("?")[0]} · ${failure}`);
      }
    });
  }
  client.on("dialog", (dialog) => dialog.accept());
  freelancer.on("dialog", (dialog) => dialog.accept());

  try {
    await signIn(client, clientCredentials, "Client");
    await signIn(freelancer, freelancerCredentials, "Freelancer");
    const clientId = await profileIdFor(client);
    const freelancerId = await profileIdFor(freelancer);

    // Role-specific dashboard menu, keyboard close, theme persistence, and mobile menu fit.
    const clientQuick = client.getByRole("button", { name: "Quick actions" });
    await clientQuick.click();
    const clientMenu = client.getByRole("navigation", { name: "Client quick actions" });
    const clientActions = await clientMenu.getByRole("link").allTextContents();
    expect(clientActions).toEqual(["Post a Job", "My Applicants", "My Freelancers", "My Projects", "Reviews"]);
    expect(clientActions.some((item) => /Messages|Notifications|Profile|Theme|Log Out/i.test(item))).toBe(false);
    await client.keyboard.press("Escape");
    await expect(clientMenu).toBeHidden();
    await client.getByRole("button", { name: "Profile menu" }).click();
    await client.getByRole("switch").click();
    await expect.poll(() => client.locator("html").getAttribute("data-theme")).toBe("light");
    await client.reload();
    await expect.poll(() => client.locator("html").getAttribute("data-theme")).toBe("light");
    await client.setViewportSize({ width: 390, height: 844 });
    await client.getByRole("button", { name: "Quick actions" }).click();
    await expect(client.getByRole("navigation", { name: "Client quick actions" })).toBeVisible();
    const clientViewport = await client.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(clientViewport.scroll).toBeLessThanOrEqual(clientViewport.width + 2);
    await client.setViewportSize({ width: 1440, height: 960 });

    await freelancer.getByRole("button", { name: "Quick actions" }).click();
    const freelancerMenu = freelancer.getByRole("navigation", { name: "Freelancer quick actions" });
    const freelancerActions = await freelancerMenu.getByRole("link").allTextContents();
    expect(freelancerActions).toEqual(["Find Jobs", "My Applications", "My Portfolio", "Reviews"]);
    expect(freelancerActions.some((item) => /Messages|Notifications|Profile|Theme|Log Out/i.test(item))).toBe(false);
    await freelancer.keyboard.press("Escape");

    // Dedicated QA accounts only: client and freelancer profile photos/cover photos.
    await client.goto("/client-profile");
    await client.getByLabel("Profile photo").setInputFiles({ name: "qa-client-avatar.png", mimeType: "image/png", buffer: tinyPng });
    await client.getByLabel("Cover photo").setInputFiles({ name: "qa-client-cover.png", mimeType: "image/png", buffer: tinyPng });
    await client.getByLabel("Country / City").fill("QA staging");
    await client.getByRole("button", { name: "Save profile" }).click();
    await expect(client.getByText("Your profile and photos have been saved.")).toBeVisible({ timeout: 30_000 });

    await freelancer.goto("/freelancer-profile");
    await freelancer.getByLabel("Profile photo").setInputFiles({ name: "qa-freelancer-avatar.png", mimeType: "image/png", buffer: tinyPng });
    await freelancer.getByLabel("Cover photo").setInputFiles({ name: "qa-freelancer-cover.png", mimeType: "image/png", buffer: tinyPng });
    await freelancer.getByLabel("Country / City").fill("QA staging");
    await freelancer.getByLabel("Professional Title").fill("QA Test Freelancer");
    await freelancer.getByLabel("About Me").fill("Test profile for safe staging marketplace verification.");
    await freelancer.getByLabel("Skills").fill("React, Playwright, accessibility");
    await freelancer.getByLabel("Years of Experience").selectOption("Less than 1 year");
    await freelancer.getByRole("button", { name: "Save Profile" }).click();
    await expect(freelancer.getByText("Your profile and photos have been saved.")).toBeVisible({ timeout: 30_000 });

    // Client job post → job feed search/sort → freelancer application → client hire.
    const jobTitle = `QA regression job ${Date.now()}`;
    await client.goto("/post-job");
    await client.getByLabel("Job Title").fill(jobTitle);
    await client.getByLabel("Job Category").selectOption({ index: 1 });
    await client.getByLabel("Job Description").fill("A staging-only e2e project. No payment or external work is involved.");
    await client.getByLabel("Required Skills").fill("React, Playwright, accessibility");
    await client.getByLabel("Budget (USD)").fill("275");
    await client.getByRole("button", { name: "Publish Job" }).click();
    await expect(client.getByText("Your project is live.")).toBeVisible();

    await freelancer.goto("/jobs");
    const jobSearch = freelancer.getByRole("searchbox", { name: /search open jobs/i });
    await jobSearch.fill(jobTitle);
    await freelancer.getByRole("button", { name: "Search", exact: true }).click();
    const jobCard = freelancer.locator(".job-card").filter({ hasText: jobTitle });
    await expect(jobCard).toBeVisible();
    await freelancer.locator("#jobs-sort").selectOption("title");
    await jobCard.getByRole("link", { name: "View Details" }).click();
    await freelancer.getByRole("button", { name: "Apply for This Job" }).click();
    await freelancer.getByLabel("Country / City").fill("QA staging");
    await freelancer.getByLabel("Professional Title").fill("QA Test Freelancer");
    await freelancer.getByLabel("About Me").fill("Test profile for safe staging marketplace verification.");
    await freelancer.getByLabel("Skills").fill("React, Playwright, accessibility");
    await freelancer.getByLabel("Years of Experience").selectOption({ index: 1 });
    await freelancer.getByLabel("Cover Letter").fill("I can deliver this staging test project.");
    await freelancer.getByLabel("Expected Salary (USD)").fill("250");
    await freelancer.getByRole("button", { name: "Submit Application" }).click();
    await expect(freelancer.getByText("Application submitted.")).toBeVisible();

    await client.goto("/job-applicants");
    const applicant = client.locator(".applicant-card").filter({ hasText: jobTitle });
    await expect(applicant).toBeVisible({ timeout: 60_000 });
    const applicantSearch = client.getByRole("searchbox", { name: "Search applicants" });
    const applicantJobFilter = client.getByRole("combobox", { name: "Job", exact: true });
    await applicantSearch.fill(jobTitle);
    await applicantJobFilter.selectOption({ index: 1 }, { timeout: 15_000 });
    const applicantJobValue = await applicantJobFilter.evaluate((select) => select.value);
    expect(applicantJobValue).not.toBe("all");
    await expect(applicantJobFilter).toHaveValue(applicantJobValue);
    await client.getByRole("combobox", { name: "Status", exact: true }).selectOption("Pending");
    await expect(client.locator(".applicant-card")).toHaveCount(1);
    await applicantJobFilter.selectOption("all", { timeout: 15_000 });
    await client.getByRole("combobox", { name: "Status", exact: true }).selectOption("all");
    await applicantSearch.fill("");
    await expect(applicant).toBeVisible();
    await applicant.getByRole("button", { name: "Accept" }).click();
    await expect(applicant.getByText("Accepted")).toBeVisible();

    // Job Messages, two-way delivery, and read receipts.
    await applicant.getByRole("link", { name: "Message" }).click();
    await client.waitForURL(/\/messages\?application=/);
    await expect(client.getByRole("tab", { name: /Job Messages/ })).toHaveAttribute("aria-selected", "true");
    const jobMessage = `QA job message ${Date.now()}`;
    await client.locator("#message-body").fill(jobMessage);
    await client.getByRole("button", { name: "Send", exact: true }).click();
    await expect(client.getByText(jobMessage)).toBeVisible();
    await freelancer.goto("/messages");
    await selectMessageFolder(freelancer, "job");
    await expect(freelancer.getByText(jobMessage)).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => client.getByText("Seen", { exact: true }).count(), { timeout: 30_000 }).toBeGreaterThan(0);
    await selectMessageFolder(freelancer, "personal");
    await expect(freelancer.getByText(jobMessage)).toHaveCount(0);

    // Public post with an image; likes/comments update notifications and owner edits/deletes their own QA post.
    await client.goto("/social");
    const postBody = `QA image post ${Date.now()}`;
    await client.locator("#social-post-body").fill(postBody);
    await client.locator(".social-image-picker input[type=file]").setInputFiles({ name: "qa-feed-image.png", mimeType: "image/png", buffer: tinyPng });
    await expect(client.locator(".social-composer-preview")).toBeVisible();
    const notificationButton = client.getByRole("button", { name: /^Notifications,/ });
    await client.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(client.getByText("Your professional post is live.")).toBeVisible();
    const ownPost = client.locator("article.social-card").filter({ hasText: postBody }).first();
    await expect(ownPost.locator("img.social-post-image")).toBeVisible();

    await freelancer.goto("/social");
    const otherPost = freelancer.locator("article.social-card").filter({ hasText: postBody }).first();
    await expect(otherPost).toBeVisible();
    const socialActionStartedAt = Date.now() - 1000;
    await otherPost.getByRole("button", { name: "Like" }).click();
    await otherPost.getByRole("button", { name: "Comment", exact: true }).first().click();
    await otherPost.getByLabel("Write a comment").fill("QA staging notification and comment check.");
    await otherPost.getByRole("button", { name: "Comment", exact: true }).last().click();
    await expect(otherPost.getByText("QA staging notification and comment check.")).toBeVisible();
    await notificationButton.click();
    const preview = client.getByRole("region", { name: "Recent notifications" });
    await expect(preview).toBeVisible();
    const socialNotificationItems = preview.locator("button.notification-preview-item").filter({ hasText: /reaction on your post|comment on your post/i });
    await expect.poll(async () => socialNotificationItems.evaluateAll((items, startedAt) => items.some((item) => {
      const createdAt = Date.parse(item.querySelector("time")?.dateTime || "");
      return item.classList.contains("unread") && createdAt >= startedAt;
    }), socialActionStartedAt), { timeout: 30_000 }).toBe(true);
    const unreadSocialNotification = preview.locator("button.notification-preview-item.unread")
      .filter({ hasText: /reaction on your post|comment on your post/i }).first();
    const openedNotificationTitle = (await unreadSocialNotification.locator("strong").textContent()).trim();
    const unreadBeforeMarking = readUnreadCount(await notificationButton.getAttribute("aria-label"));
    await unreadSocialNotification.click();
    await expect(client).toHaveURL(/\/social\?post=/);
    await client.goto("/notifications");
    const openedNotification = client.locator("article.notification-card").filter({ hasText: openedNotificationTitle }).first();
    await expect(openedNotification).toHaveClass(/read/);
    await expect.poll(async () => readUnreadCount(await client.getByRole("button", { name: /^Notifications,/ }).getAttribute("aria-label")), { timeout: 30_000 }).toBe(unreadBeforeMarking - 1);
    const unreadMessagesBeforePersonalChat = readUnreadCount(await client.getByRole("link", { name: /^Messages,/ }).getAttribute("aria-label"));

    await client.goto("/social");
    const editablePost = client.locator("article.social-card").filter({ hasText: postBody }).first();
    await editablePost.getByRole("button", { name: "Edit", exact: true }).click();
    await client.locator("#social-post-body").fill(`${postBody} edited`);
    await client.getByRole("button", { name: "Save changes" }).click();
    const editedPost = client.locator("article.social-card").filter({ hasText: `${postBody} edited` }).first();
    await expect(editedPost).toBeVisible();
    await editedPost.getByRole("button", { name: "Share", exact: true }).click();
    await expect(client.getByRole("status").filter({ hasText: /shareable link|copying was blocked/i })).toBeVisible();

    // Accepted personal connection, shared-post preview, real-time message, read receipt and safe deletion.
    await freelancer.goto("/social");
    await ensureAcceptedQaConnection(client, freelancer, `${postBody} edited`, clientId, freelancerId);
    await freelancer.goto("/social");
    const sharedPost = freelancer.locator("article.social-card").filter({ hasText: `${postBody} edited` }).first();
    await expect(sharedPost.getByRole("button", { name: "Message", exact: true })).toBeVisible();
    await sharedPost.getByRole("button", { name: "Message", exact: true }).click();
    await freelancer.waitForURL(/\/messages\?.*sharePost=/);
    await expect(freelancer.locator(".message-share-draft")).toBeVisible();
    const personalMessage = `QA personal message ${Date.now()}`;
    await freelancer.locator("#message-body").fill(personalMessage);
    await freelancer.getByRole("button", { name: "Share in conversation" }).click();
    const sentPersonalMessage = freelancer.locator(".message-bubble").filter({ hasText: personalMessage });
    await expect(sentPersonalMessage.locator(".message-shared-post")).toBeVisible();
    await client.goto("/messages");
    await selectMessageFolder(client, "personal");
    await expect(client.getByText(personalMessage)).toBeVisible({ timeout: 60_000 });
    const receivedPersonalMessage = client.locator(".message-bubble").filter({ hasText: personalMessage });
    await expect(receivedPersonalMessage.locator(".message-shared-post")).toBeVisible();
    await expect.poll(async () => readUnreadCount(await client.getByRole("link", { name: /^Messages,/ }).getAttribute("aria-label")), { timeout: 30_000 }).toBeLessThanOrEqual(unreadMessagesBeforePersonalChat);
    await expect.poll(async () => freelancer.getByText("Seen", { exact: true }).count(), { timeout: 30_000 }).toBeGreaterThan(0);
    await client.goto("/social");
    const postToDelete = client.locator("article.social-card").filter({ hasText: `${postBody} edited` }).first();
    await postToDelete.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(postToDelete).toHaveCount(0);
    await selectMessageFolder(freelancer, "personal");
    const messageBubble = freelancer.locator(".message-bubble").filter({ hasText: personalMessage });
    await messageBubble.getByRole("button", { name: "Delete for Everyone" }).click();
    await expect(freelancer.locator(".message-bubble").filter({ hasText: "[Message removed]" }).last()
      .getByText("[Message removed]", { exact: true })).toBeVisible();
    await client.goto("/messages");
    await selectMessageFolder(client, "personal");
    const clientRedactedMessage = client.locator(".message-bubble").filter({ hasText: "[Message removed]" }).last();
    await expect(clientRedactedMessage.getByText("[Message removed]", { exact: true })).toBeVisible();
    await expect(client.getByText(personalMessage, { exact: true })).toHaveCount(0);

    // Active contract must prevent blocking; complete it, then verify block/unblock, mute and report.
    const safety = client.locator(".member-safety-actions").first();
    // Open the job conversation from its application before checking contract protection.
    await client.goto("/job-applicants");
    const activeApplicant = client.locator(".applicant-card").filter({ hasText: jobTitle });
    await activeApplicant.getByRole("link", { name: "Message" }).click();
    await expect(safety).toBeVisible();
    await safety.getByRole("button", { name: "Block" }).click();
    await expect(safety.getByRole("alert")).toBeVisible();
    await client.goto("/my-projects");
    const currentProject = client.locator(".my-project-card").filter({ hasText: jobTitle });
    await expect(currentProject).toBeVisible();
    const currentProjectStatus = (await currentProject.locator(".my-project-status").textContent()).trim().toLowerCase();
    if (currentProjectStatus === "open") {
      await currentProject.getByRole("button", { name: "Mark complete" }).click();
      await expect(client.getByText("Project marked complete.")).toBeVisible();
    } else {
      expect(currentProjectStatus).toBe("completed");
    }

    await client.goto("/messages");
    await selectMessageFolder(client, "personal");
    const personalSafety = client.locator(".member-safety-actions").first();
    await personalSafety.getByRole("button", { name: "Mute" }).click();
    await expect(personalSafety.getByText("Their posts are muted in your feed.")).toBeVisible();
    await personalSafety.getByRole("button", { name: "Unmute" }).click();
    await expect(personalSafety.getByText("Member unmuted.")).toBeVisible();
    await personalSafety.getByRole("button", { name: "Block" }).click();
    await expect(personalSafety.getByText("Member blocked.")).toBeVisible();
    await personalSafety.getByRole("button", { name: "Unblock" }).click();
    await expect(personalSafety.getByText("Member unblocked.")).toBeVisible();
    await personalSafety.getByRole("button", { name: "Report" }).click();
    await personalSafety.getByLabel("Details (optional)").fill("Automated staging QA report test; not a real incident.");
    await personalSafety.getByRole("button", { name: "Send report" }).click();
    await expect(personalSafety.getByText("Report sent to TechKarvo support for review.")).toBeVisible();

    await client.goto("/messages");
    await selectMessageFolder(client, "personal");
    await client.getByRole("button", { name: "Delete for Me" }).click();
    await expect(client.getByText("No personal conversations yet")).toBeVisible();
    await freelancer.reload();
    await selectMessageFolder(freelancer, "personal");
    await expect(freelancer.locator(`.conversation-item[data-other-id="${clientId}"]`)).toBeVisible();

    // Account settings: private account info, verified password update, and safe email-change validation.
    await client.goto("/account-settings");
    await expect(client.getByText("Verified", { exact: true })).toBeVisible();
    const clientEmail = await authenticatedEmailFor(client);
    expect(clientEmail).toBeTruthy();
    await expect(client.getByText(clientEmail, { exact: true })).toBeVisible();
    await client.locator("#settings-new-email").fill(clientEmail);
    await client.locator("#settings-email-password").fill("");
    await client.getByRole("button", { name: "Request verified email change" }).click();
    await expect(client.getByRole("alert").filter({ hasText: "Enter a different email address." })).toBeVisible();
    if (process.env.TK_QA_CLIENT_NEXT_PASSWORD) {
      await client.locator("#settings-current-password").fill(clientCredentials.password);
      await client.locator("#settings-new-password").fill(process.env.TK_QA_CLIENT_NEXT_PASSWORD);
      await client.locator("#settings-confirm-password").fill(process.env.TK_QA_CLIENT_NEXT_PASSWORD);
      await client.getByRole("button", { name: "Change password" }).click();
      await expect(client.getByText("Your password has been updated.")).toBeVisible();
    }
    await client.setViewportSize({ width: 768, height: 900 });
    const tablet = await client.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(tablet.scroll).toBeLessThanOrEqual(tablet.width + 2);
    await client.setViewportSize({ width: 390, height: 844 });
    const mobile = await client.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(mobile.scroll).toBeLessThanOrEqual(mobile.width + 2);

    expect(runtimeErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  } finally {
    await clientContext.close();
    await freelancerContext.close();
  }
});

test("staging Client applicant job, status, and search filters work on existing QA records", async ({ browser }) => {
  test.skip(!credentialsAvailable, "Set staging-only QA account variables to run authenticated staging browser coverage.");
  const context = await browser.newContext({ storageState: storageStateFor("Client") });
  const page = await context.newPage();
  try {
  await signIn(page, clientCredentials, "Client");
  await page.goto("/job-applicants");
  const firstApplicant = page.locator(".applicant-card").first();
  await expect(firstApplicant).toBeVisible({ timeout: 60_000 });
  const jobTitle = (await firstApplicant.locator(".applicant-job-summary strong").textContent()).trim();
  const status = (await firstApplicant.locator(".applicant-status").textContent()).trim();
  const search = page.getByRole("searchbox", { name: "Search applicants" });
  await search.fill(jobTitle);
  const jobFilter = page.getByRole("combobox", { name: "Job", exact: true });
  await jobFilter.selectOption({ index: 1 }, { timeout: 15_000 });
  const value = await jobFilter.evaluate((select) => select.value);
  expect(value).not.toBe("all");
  await expect(jobFilter).toHaveValue(value);
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption(status, { timeout: 15_000 });
  await expect(page.locator(".applicant-card")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("oldest", { timeout: 15_000 });
  await expect(firstApplicant).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true);
  } finally {
    await context.close();
  }
});

test("staging financial sandbox shows role-specific plans, nets simulated transfers, and fits all viewports", async ({ browser }) => {
  test.skip(!credentialsAvailable, "Set staging-only QA account variables to run authenticated financial browser coverage.");
  test.setTimeout(180_000);

  const cases = [
    {
      role: "Client",
      credentials: clientCredentials,
      planDetails: [
        ["free", "Free Client", "2 job posts / month", /0\.00 KAV \/ month · service fee: 2\.00%/],
        ["plus", "Plus Client", "10 job posts / month", /9\.99 KAV \/ month · service fee: 2\.00%/],
        ["gold", "Gold Client", "30 job posts / month", /19\.99 KAV \/ month · service fee: 1\.50%/],
        ["premium", "Premium Client", "100 job posts / month", /39\.99 KAV \/ month · service fee: 1\.00%/]
      ]
    },
    {
      role: "Freelancer",
      credentials: freelancerCredentials,
      planDetails: [
        ["free", "Free Freelancer", "5 applications / month", /0\.00 KAV \/ month · freelancer commission: 10\.00%/],
        ["plus", "Plus Freelancer", "30 applications / month", /4\.99 KAV \/ month · freelancer commission: 8\.00%/],
        ["gold", "Gold Freelancer", "80 applications / month", /9\.99 KAV \/ month · freelancer commission: 6\.00%/],
        ["premium", "Premium Freelancer", "200 applications / month", /19\.99 KAV \/ month · freelancer commission: 5\.00%/]
      ]
    }
  ];

  const cents = async (page) => {
    const value = await page.locator(".financial-wallet-card h2").innerText();
    return Math.round(Number(value.replace(/[^0-9.-]/g, "")) * 100);
  };

  for (const account of cases) {
    const context = await browser.newContext({ storageState: storageStateFor(account.role), viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    try {
      await signIn(page, account.credentials, account.role);
      await page.goto("/financial-sandbox");
      await expect(page.getByRole("heading", { name: "Membership & KAV Sandbox" })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("SIMULATED — NO FUNDS MOVED")).toBeVisible();
      await expect(page.getByText(/Reference only: 1 USDT = 1 KAV/)).toBeVisible();

      const planSection = page.locator(".financial-section").filter({ has: page.getByRole("heading", { name: `${account.role} membership`, exact: true }) });
      await expect(planSection).toHaveCount(1);
      await expect(planSection.locator(".financial-plan-card")).toHaveCount(4);
      for (const [slug, name, usage, priceAndFee] of account.planDetails) {
        const card = planSection.locator(`.financial-plan-card[data-plan-slug="${slug}"][data-account-type="${account.role.toLowerCase()}"]`);
        await expect(card).toHaveCount(1);
        await expect(card.getByRole("heading", { name, exact: true })).toBeVisible();
        await expect(card).toContainText(usage);
        await expect(card).toContainText(priceAndFee);
      }

      const initialCents = await cents(page);
      await page.locator("#sandbox-amount").fill("0.01");
      await page.getByRole("button", { name: "Simulate USDT deposit" }).click();
      await expect(page.getByRole("status")).toContainText("No funds moved.");
      await expect.poll(() => cents(page)).toBe(initialCents + 1);
      await expect(page.locator(".financial-transaction-list")).toContainText("sandbox deposit");

      await page.getByRole("button", { name: "Simulate withdrawal" }).click();
      await expect(page.getByRole("status")).toContainText("No payout occurred.");
      await expect.poll(() => cents(page)).toBe(initialCents);
      await expect(page.locator(".financial-transaction-list")).toContainText("sandbox withdrawal");

      for (const width of [1024, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true);
      }
    } finally {
      await context.close();
    }
  }
});
