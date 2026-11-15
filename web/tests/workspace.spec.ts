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
        filtered_out: 5,
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Find jobs", exact: true }).click();
  await page
    .getByPlaceholder("e.g. Head of AI or Director of AI")
    .fill("Head of AI or Director of AI");
  await page.locator("form").getByRole("button", { name: "Find jobs" }).click();
  await expect(
    page.getByText("5 unrelated results filtered · Duplicate links removed"),
  ).toBeVisible();
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

test("multiple CVs, review, profile selection and LinkedIn persist", async ({
  page,
}) => {
  await page.goto("/#/profile");
  await page.getByLabel("Upload CV files").setInputFiles([
    {
      name: "leadership.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Led a team delivering AI strategy."),
    },
    {
      name: "technical.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Built machine learning systems."),
    },
    {
      name: "broken.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a PDF"),
    },
  ]);
  await expect(page.getByText(/2 of 3 files processed/)).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("broken.pdf");
  await page
    .locator(".cv-row")
    .filter({ hasText: "leadership.txt" })
    .getByRole("button", { name: "Review document" })
    .click();
  await page
    .getByRole("textbox", { name: "Document name", exact: true })
    .fill("AI leadership CV");
  await page
    .getByRole("textbox", { name: /^Document text/ })
    .fill("Led a team delivering AI strategy. Reviewed.");
  await page.getByLabel(/I have reviewed this text/).check();
  await page
    .getByRole("button", { name: "Use as profile", exact: true })
    .click();
  await expect(page.getByLabel("Verified career facts")).toHaveValue(
    "Led a team delivering AI strategy. Reviewed.",
  );
  await page
    .getByLabel("LinkedIn profile link")
    .fill("https://www.linkedin.com/in/alex-example");
  await page
    .getByLabel("LinkedIn profile text")
    .fill("AI strategy and technical leadership.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Your profile is saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("LinkedIn profile link")).toHaveValue(
    "https://www.linkedin.com/in/alex-example",
  );
  await expect(
    page.locator(".cv-row").filter({ hasText: "AI leadership CV" }),
  ).toContainText("Selected for profile");
  await page
    .locator(".cv-row")
    .filter({ hasText: "technical.txt" })
    .getByRole("button", { name: "Review document" })
    .click();
  await expect(
    page.getByRole("textbox", { name: /^Document text/ }),
  ).toHaveValue("Built machine learning systems.");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Verified career facts")).toHaveValue(
    "Led a team delivering AI strategy. Reviewed.",
  );
});

test("responsive layout audit across main screens", async ({
  page,
}, testInfo) => {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["", "find", "profile", "new", "settings", "jobs"]) {
      await page.goto("/#/" + route);
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} overflows at ${width}`,
      ).toBe(true);
      if (route === "find") {
        const geometry = await page
          .locator(".search-form .input")
          .evaluateAll((controls) =>
            controls.map((el) => {
              const r = el.getBoundingClientRect();
              const css = getComputedStyle(el);
              const c = document.createElement("canvas").getContext("2d")!;
              c.font = `${css.fontSize} ${css.fontFamily}`;
              const textWidth =
                el.tagName === "SELECT"
                  ? c.measureText(
                      (el as HTMLSelectElement).selectedOptions[0].text,
                    ).width
                  : 0;
              return {
                height: r.height,
                textWidth,
                space:
                  r.width -
                  parseFloat(css.paddingLeft) -
                  parseFloat(css.paddingRight) -
                  2,
              };
            }),
          );
        expect(new Set(geometry.map((c) => c.height)).size).toBe(1);
        for (const control of geometry)
          expect(control.textWidth).toBeLessThanOrEqual(control.space);
        if (width === 1440 || width === 390)
          await page.screenshot({
            path: testInfo.outputPath(`search-${width}.png`),
            fullPage: true,
          });
      }
      if (route === "profile" && width === 1440)
        await page.screenshot({
          path: testInfo.outputPath("cv-library.png"),
          fullPage: true,
        });
    }
  }
});

test("online research consent and approval keep findings outside library until reviewed", async ({
  page,
}) => {
  let searched = false;
  await page.route("**/api/profile/research", async (route) => {
    expect(route.request().postDataJSON().consent).toBe(true);
    searched = true;
    await route.fulfill({
      json: {
        candidates: [
          {
            id: "candidate123",
            title: "Research profile",
            text: "Possible publication by Alex.",
            url: "https://example.com/alex",
          },
        ],
      },
    });
  });
  await page.route(
    "**/api/profile/research/candidate123/approve",
    async (route) => {
      const body = route.request().postDataJSON();
      expect(body.approved).toBe(true);
      expect(body.text).toBe("Confirmed coauthored paper.");
      await route.fulfill({ json: { id: "approved-source" } });
    },
  );
  await page.goto("/#/profile");
  await page
    .getByText("Would you like to check your public online information?")
    .click();
  await page
    .getByRole("textbox", { name: "Public profile search", exact: true })
    .fill("Alex Example University");
  await expect(
    page.getByRole("button", { name: "Search public information" }),
  ).toBeDisabled();
  expect(searched).toBe(false);
  await page
    .getByLabel("I approve searching online using this exact query.")
    .check();
  await page.getByRole("button", { name: "Search public information" }).click();
  await page.getByRole("button", { name: "Review finding" }).click();
  await page
    .getByRole("textbox", { name: "Facts I approve", exact: true })
    .fill("Confirmed coauthored paper.");
  await page
    .getByRole("button", { name: "Approve and add to library" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("0 findings awaiting review.", { exact: false }),
  ).toBeVisible();
});
