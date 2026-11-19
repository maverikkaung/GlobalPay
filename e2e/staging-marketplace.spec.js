import { test, expect } from "@playwright/test";
import process from "node:process";
import { Buffer } from "node:buffer";

const stagingBase = process.env.PLAYWRIGHT_BASE_URL || "";
const clientCredentials = { email: process.env.TK_QA_CLIENT_EMAIL, password: process.env.TK_QA_CLIENT_PASSWORD };
const freelancerCredentials = { email: process.env.TK_QA_FREELANCER_EMAIL, password: process.env.TK_QA_FREELANCER_PASSWORD };
const credentialsAvailable = /^https:\/\/techkarvo-staging\.vercel\.app\/?$/.test(stagingBase)
  && clientCredentials.email && clientCredentials.password && freelancerCredentials.email && freelancerCredentials.password;

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=", "base64");

async function signIn(page, credentials, role) {
  await page.goto("/login");
  await page.locator("#login-email").fill(credentials.email);
  await page.locator("#login-password").fill(credentials.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(role === "Client" ? /client-dashboard/ : /freelancer-dashboard/, { timeout: 60_000 });
  await page.getByText(role === "Client" ? /CLIENT DASHBOARD/i : /FREELANCER DASHBOARD/i).waitFor({ timeout: 60_000 });
}

function readUnreadCount(label) {
  const match = label.match(/,\s*(\d+) unread/i);
  return Number(match?.[1] || 0);
}

test("staging Client and Freelancer workflows: media, jobs, social, messaging, safety, contracts, reviews and settings", async ({ browser }) => {
  test.skip(!credentialsAvailable, "Set staging-only QA account variables to run authenticated staging browser coverage.");
  test.setTimeout(300_000);

  const clientContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const freelancerContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const client = await clientContext.newPage();
  const freelancer = await freelancerContext.newPage();
  const runtimeErrors = [];
  const failedRequests = [];
  for (const page of [client, freelancer]) {
    page.setDefaultNavigationTimeout(60_000);
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url().split("?")[0]} · ${request.failure()?.errorText || "request failed"}`));
  }
  client.on("dialog", (dialog) => dialog.accept());
  freelancer.on("dialog", (dialog) => dialog.accept());

  try {
    await signIn(client, clientCredentials, "Client");
    await signIn(freelancer, freelancerCredentials, "Freelancer");

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
    await freelancer.getByRole("tab", { name: /Job Messages/ }).click();
    await expect(freelancer.getByText(jobMessage)).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => client.getByText("Seen", { exact: true }).count(), { timeout: 30_000 }).toBeGreaterThan(0);
    await freelancer.getByRole("tab", { name: /Personal Messages/ }).click();
    await expect(freelancer.getByText(jobMessage)).toHaveCount(0);

    // Public post with an image; likes/comments update notifications and owner edits/deletes their own QA post.
    await client.goto("/social");
    const postBody = `QA image post ${Date.now()}`;
    await client.locator("#social-post-body").fill(postBody);
    await client.locator(".social-image-picker input[type=file]").setInputFiles({ name: "qa-feed-image.png", mimeType: "image/png", buffer: tinyPng });
    await expect(client.locator(".social-composer-preview")).toBeVisible();
    const notificationButton = client.getByRole("button", { name: /^Notifications,/ });
    const baselineNotifications = readUnreadCount(await notificationButton.getAttribute("aria-label"));
    await client.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(client.getByText("Your professional post is live.")).toBeVisible();
    const ownPost = client.locator("article.social-card").filter({ hasText: postBody }).first();
    await expect(ownPost.locator("img.social-post-image")).toBeVisible();

    await freelancer.goto("/social");
    const otherPost = freelancer.locator("article.social-card").filter({ hasText: postBody }).first();
    await expect(otherPost).toBeVisible();
    await otherPost.getByRole("button", { name: "Like" }).click();
    await otherPost.getByRole("button", { name: "Comment", exact: true }).first().click();
    await otherPost.getByLabel("Write a comment").fill("QA staging notification and comment check.");
    await otherPost.getByRole("button", { name: "Comment", exact: true }).last().click();
    await expect(otherPost.getByText("QA staging notification and comment check.")).toBeVisible();
    await expect.poll(async () => readUnreadCount(await notificationButton.getAttribute("aria-label")), { timeout: 30_000 }).toBeGreaterThan(baselineNotifications);
    await notificationButton.click();
    const preview = client.getByRole("region", { name: "Recent notifications" });
    await expect(preview).toBeVisible();
    await expect(preview.getByText(/reaction on your post|comment on your post/i).first()).toBeVisible();
    const unreadSocialNotification = preview.locator("button.notification-preview-item.unread")
      .filter({ hasText: /reaction on your post|comment on your post/i }).first();
    const openedNotificationTitle = (await unreadSocialNotification.locator("strong").textContent()).trim();
    await unreadSocialNotification.click();
    await expect(client).toHaveURL(/\/social\?post=/);
    await client.goto("/notifications");
    const openedNotification = client.locator("article.notification-card").filter({ hasText: openedNotificationTitle }).first();
    await expect(openedNotification).toHaveClass(/read/);
    await expect.poll(async () => readUnreadCount(await client.getByRole("button", { name: /^Notifications,/ }).getAttribute("aria-label")), { timeout: 30_000 }).toBeLessThanOrEqual(baselineNotifications + 1);
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
    const connectPost = freelancer.locator("article.social-card").filter({ hasText: `${postBody} edited` }).first();
    const connectAction = connectPost.getByRole("button", { name: "Connect", exact: true });
    if (await connectAction.count()) {
      await connectAction.click();
      await expect(freelancer.getByText(/Connection request sent/i)).toBeVisible();
      await client.goto("/connections");
      const incomingRequest = client.locator(".connection-card").filter({ hasText: "TechKarvo QA Freelancer" }).first();
      await incomingRequest.getByRole("button", { name: "Accept", exact: true }).click();
    }
    await freelancer.goto("/social");
    const sharedPost = freelancer.locator("article.social-card").filter({ hasText: `${postBody} edited` }).first();
    await expect(sharedPost.getByRole("button", { name: "Message", exact: true })).toBeVisible();
    await sharedPost.getByRole("button", { name: "Message", exact: true }).click();
    await freelancer.waitForURL(/\/messages\?.*sharePost=/);
    await expect(freelancer.locator(".message-share-draft")).toBeVisible();
    const personalMessage = `QA personal message ${Date.now()}`;
    await freelancer.locator("#message-body").fill(personalMessage);
    await freelancer.getByRole("button", { name: "Share in conversation" }).click();
    await expect(freelancer.locator(".message-shared-post")).toBeVisible();
    await client.goto("/messages");
    await client.getByRole("tab", { name: /Personal Messages/ }).click();
    await expect(client.getByText(personalMessage)).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => readUnreadCount(await client.getByRole("link", { name: /^Messages,/ }).getAttribute("aria-label")), { timeout: 30_000 }).toBeLessThanOrEqual(unreadMessagesBeforePersonalChat);
    await expect.poll(async () => freelancer.getByText("Seen", { exact: true }).count(), { timeout: 30_000 }).toBeGreaterThan(0);
    const messageBubble = freelancer.locator(".message-bubble").filter({ hasText: personalMessage });
    await messageBubble.getByRole("button", { name: "Delete for Everyone" }).click();
    await expect(freelancer.getByText("[Message removed]")).toBeVisible();
    await client.goto("/messages");
    await client.getByRole("tab", { name: /Personal Messages/ }).click();
    await expect(client.getByText("[Message removed]")).toBeVisible();

    // Active contract must prevent blocking; complete it, then verify block/unblock, mute and report.
    const safety = client.locator(".member-safety-actions").filter({ hasText: "QA Test Freelancer" });
    // Open the job conversation from its application before checking contract protection.
    await client.goto("/job-applicants");
    const activeApplicant = client.locator(".applicant-card").filter({ hasText: jobTitle });
    await activeApplicant.getByRole("link", { name: "Message" }).click();
    await expect(safety).toBeVisible();
    await safety.getByRole("button", { name: "Block" }).click();
    await expect(safety.getByRole("alert")).toBeVisible();
    await client.goto("/my-projects");
    const activeProject = client.locator(".my-project-card").filter({ hasText: jobTitle });
    await activeProject.getByRole("button", { name: "Mark complete" }).click();
    await expect(client.getByText("Project marked complete.")).toBeVisible();

    await client.goto("/messages");
    await client.getByRole("tab", { name: /Personal Messages/ }).click();
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
    await client.getByRole("tab", { name: /Personal Messages/ }).click();
    await client.getByRole("button", { name: "Delete for Me" }).click();
    await expect(client.getByText("No personal conversations yet")).toBeVisible();
    await freelancer.reload();
    await freelancer.getByRole("tab", { name: /Personal Messages/ }).click();
    await expect(freelancer.getByRole("button", { name: /TechKarvo QA Client/ })).toBeVisible();

    // Account settings: private account info, verified password update, and safe email-change validation.
    await client.goto("/account-settings");
    await expect(client.getByText("Verified", { exact: true })).toBeVisible();
    await expect(client.getByText(clientCredentials.email, { exact: true })).toBeVisible();
    await client.locator("#settings-new-email").fill(clientCredentials.email);
    await client.locator("#settings-email-password").fill(clientCredentials.password);
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
