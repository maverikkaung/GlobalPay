import { expect, test } from "@playwright/test";

const backend = "https://e2e-placeholder.invalid";
const owner = "31000000-0000-4000-8000-000000000001";
const client = "31000000-0000-4000-8000-000000000002";
const freelancer = "31000000-0000-4000-8000-000000000003";
const profilePath = `/profiles/${owner}`;
const safeProject = {
  id: "one", title: "Transit wayfinding", description: "A bilingual route finder.",
  project_url: "https://work.example.test/transit", image_url: "https://work.example.test/preview.png"
};
const unsafeProject = {
  id: "two", title: "Field journal", description: "A project with an unavailable link.",
  project_url: "javascript:alert(1)", image_url: "https://person:password@work.example.test/preview.png"
};

async function mockProfile(page, baseURL, { viewer = client, blocked = false, ownBlock = false, failBlock = false, failReviews = false, accepted = false } = {}) {
  const origin = new URL(baseURL).origin;
  const requests = [];
  if (viewer) await page.addInitScript(({ origin, viewer }) => {
    if (location.origin === origin) localStorage.setItem("sb-e2e-placeholder-auth-token", JSON.stringify({
      access_token: "fixture", refresh_token: "fixture", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: viewer }
    }));
  }, { origin, viewer });
  await page.routeWebSocket("wss://e2e-placeholder.invalid/**", (socket) => socket.close());
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.href === safeProject.image_url) return route.fulfill({ status: 404 });
    if (url.origin !== backend) return route.abort();
    const table = url.pathname.replace("/rest/v1/", "");
    requests.push({ method: request.method(), table, select: url.searchParams.get("select") });
    if (request.method() === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "*/0" } });
    if (table === "rpc/techkarvo_is_platform_admin") return route.fulfill({ json: false });
    if (table === "rpc/techkarvo_is_blocked_with") {
      expect(request.postDataJSON()).toEqual({ p_other_user_id: owner });
      return failBlock ? route.fulfill({ status: 500, json: { message: "Fixture unavailable" } })
        : route.fulfill({ json: blocked });
    }
    if (table === "reviews_public" && failReviews) return route.fulfill({ status: 500, json: { message: "Fixture unavailable" } });
    const rows = {
      profiles: [{ id: viewer, full_name: "Fixture viewer", account_type: viewer === client ? "client" : "freelancer" }],
      freelancer_public_profiles: [{
        id: owner, full_name: "Nadi Design", account_type: "freelancer", professional_title: "Wayfinding designer",
        country: "Myanmar", bio: "I design for public transport.", skills: "Research, Burmese, Research",
        experience: "Two projects", portfolio_url: "https://work.example.test/"
      }],
      reviews_public: [{ id: "review-one", rating: 4, body: "Clear communication", created_at: "2026-11-20T12:00:00Z" }],
      portfolio_items: [safeProject, unsafeProject],
      user_blocks: ownBlock ? [{ blocked_id: owner }] : [],
      connections: accepted ? [{ id: "fixture-connection", requester_id: client, recipient_id: owner, status: "Accepted" }] : [],
      conversations: { id: "fixture-thread" }
    };
    return route.fulfill({ json: rows[table] || [] });
  });
  return requests;
}

test("anonymous profile navigation goes through login without fetching member data", async ({ page, baseURL }) => {
  const requests = await mockProfile(page, baseURL, { viewer: null });
  await page.goto(profilePath);
  await expect(page).toHaveURL(/\/login$/);
  expect(requests.filter(({ table }) => /public_profiles|portfolio_items|reviews_public/.test(table))).toEqual([]);
});

test("a blocking relationship never reads the profile or its related content", async ({ browser, baseURL }) => {
  for (const ownBlock of [false, true]) {
    const page = await browser.newPage({ baseURL });
    const requests = await mockProfile(page, baseURL, { blocked: true, ownBlock });
    await page.goto(profilePath);
    await expect(page.getByRole("heading", { name: "Profile unavailable" })).toBeVisible();
    expect(requests.filter(({ table }) => /public_profiles|portfolio_items|reviews_public|connections|posts/.test(table))).toEqual([]);
    if (ownBlock) await expect(page.getByRole("button", { name: "Unblock" })).toBeVisible();
    else await expect(page.getByRole("button", { name: "Unblock" })).toHaveCount(0);
    await page.close();
  }
});

test("failed block verification offers retry without looking up the profile", async ({ page, baseURL }) => {
  const requests = await mockProfile(page, baseURL, { failBlock: true });
  await page.goto(profilePath);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(requests.filter(({ table }) => /public_profiles|portfolio_items|reviews_public/.test(table))).toEqual([]);
});

test("clients get safe project links, scoped review fields and keyboard sections in both themes", async ({ page, baseURL }) => {
  const requests = await mockProfile(page, baseURL);
  await page.goto(profilePath);
  await expect(page.getByRole("heading", { name: "Nadi Design" })).toBeVisible();
  await expect(page.getByText("Research", { exact: true })).toHaveCount(1);
  await expect(page.getByText("1 completed-project review")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Field journal" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open project: Transit wayfinding/ })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByRole("link", { name: /Open project: Field journal/ })).toHaveCount(0);
  const portfolio = page.getByRole("navigation", { name: "Profile sections" }).getByRole("link", { name: "Portfolio" });
  await portfolio.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#portfolio-projects$/);
  await expect(page.locator("#portfolio-projects")).toBeFocused();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [375, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
  expect(requests.find(({ table }) => table === "reviews_public")?.select).toBe("id,rating,body,created_at");
  expect(requests.filter(({ table, select }) => /public_profiles/.test(table) && /\*|email|phone/.test(select))).toEqual([]);
  expect(requests.filter(({ method, table }) => method === "POST" && !table.startsWith("rpc/"))).toEqual([]);
});

test("a non-owner Freelancer does not request portfolio rows and failed reviews show an error", async ({ page, baseURL }) => {
  const requests = await mockProfile(page, baseURL, { viewer: freelancer, failReviews: true });
  await page.goto(profilePath);
  await expect(page.getByRole("heading", { name: "Nadi Design" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "External portfolio" })).toBeVisible();
  await expect(page.getByText("Reviews are unavailable.")).toBeVisible();
  await expect(page.getByText("No completed-project reviews yet.")).toHaveCount(0);
  expect(requests.some(({ table }) => table === "portfolio_items")).toBe(false);
});

test("the owner can reach existing edit screens and return to their portfolio preview", async ({ page, baseURL }) => {
  const requests = await mockProfile(page, baseURL, { viewer: owner });
  await page.goto(profilePath);
  await page.getByRole("link", { name: "Manage portfolio" }).click();
  await expect(page.getByLabel("Project title")).toBeVisible();
  await page.getByRole("article").filter({ hasText: "Transit wayfinding" }).getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Project title")).toHaveValue("Transit wayfinding");
  await page.getByRole("link", { name: "Preview portfolio" }).click();
  await expect(page.locator("#portfolio-projects")).toBeFocused();
  await page.getByRole("link", { name: "Edit profile" }).click();
  await expect(page).toHaveURL(/\/freelancer-profile$/);
  await expect(page.getByRole("link", { name: "Preview profile" })).toBeVisible();
  expect(requests.some(({ table }) => table === "rpc/techkarvo_is_blocked_with")).toBe(false);
});

test("an accepted connection opens the existing thread without a connection write", async ({ page, baseURL }) => {
  const requests = await mockProfile(page, baseURL, { accepted: true });
  await page.goto(profilePath);
  await page.getByRole("button", { name: "Message", exact: true }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=fixture-thread$/);
  expect(requests.filter(({ table, method }) => table === "connections" && method !== "GET")).toEqual([]);
});
