import { test, expect } from "@playwright/test";

test("profile, job chat, document revision, submission and archive", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your next chapter/ }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "My profile", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex Example");
  await page
    .getByLabel("Verified career facts")
    .fill("Designed accessible interfaces at Example Studio.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Your profile is saved.")).toBeVisible();
  await page.getByRole("button", { name: "New job", exact: true }).click();
  await page.getByLabel("Job title", { exact: true }).fill("Product designer");
  await page.getByLabel("Company", { exact: true }).fill("Example Studio");
  await page.getByLabel("Location", { exact: true }).fill("London or remote");
  await page
    .getByLabel("Job description")
    .fill("Design accessible interfaces. Remote within the UK.");
  await page.getByRole("button", { name: "Save job & start talking" }).click();
  await expect(
    page.getByRole("heading", { name: "Product designer", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Message", { exact: true }).fill("Draft my CV");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: /CV — Product designer/ }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("chat.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /CV — Product designer/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await download;
  await page.getByRole("button", { name: "Edit this draft" }).click();
  await page
    .getByLabel("Edit document", { exact: true })
    .fill(
      "# Alex Example\n\n## Experience\nDesigned accessible interfaces at Example Studio.\nRevised for clarity.",
    );
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Revised for clarity.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Review status: Applied" }).click();
  await page.getByRole("button", { name: "Confirm update" }).click();
  await expect(page.locator(".conversation-heading .job-tag")).toHaveText(
    "Applied",
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submitted cv", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".conversation-heading .job-tag")).toHaveText(
    "Applied",
  );
  await page.getByRole("button", { name: "Archive job", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore to active jobs" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("responsive home, theme and settings", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: testInfo.outputPath("dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "AI settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Your assistant. Your choice of AI." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(
    page.getByText("Connection ready. This model answered successfully."),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Job Agent home" }).click();
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "My profile", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("search defaults to matching titles", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/search", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        jobs: [],
        errors: [],
        source: "Freehire",
        coverage: "5 unrelated candidates hidden.",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Find jobs", exact: true }).click();
  await page
    .getByPlaceholder("e.g. Head of AI or Director of AI")
    .fill("Head of AI or Director of AI");
  await page.locator("form").getByRole("button", { name: "Find jobs" }).click();
  await expect(page.getByText("5 unrelated candidates hidden.")).toBeVisible();
  expect(requests[0].query).toBe("Head of AI or Director of AI");
  expect(requests[0].match_mode).toBe("title");
  expect(requests[0].sources).toBe("all");
  await page
    .getByRole("combobox", { name: "Match results", exact: true })
    .selectOption("broad");
  await page.locator("form").getByRole("button", { name: "Find jobs" }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].match_mode).toBe("broad");
});
