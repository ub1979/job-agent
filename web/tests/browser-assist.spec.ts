import { test, expect } from "@playwright/test";
import { fillApplication } from "../../browser-extension/fill.js";

test("fills contact and selected documents, leaves screening and submit to user", async ({
  page,
}) => {
  await page.goto("/");
  await page.setContent(
    `<form id="application"><label>Full name<input name="full_name"></label><label>Email<input name="email"></label><label>Phone<input name="phone" value="Existing phone"></label><label>CV<input type="file" name="resume" accept=".pdf"></label><label>Cover letter<input type="file" name="cover_letter" accept=".docx"></label><label>Cover letter text<textarea name="cover_letter_text"></textarea></label><label>Work authorisation<input name="work_authorisation" required></label><label>Consent<input type="checkbox" required></label><button type="submit">Submit</button></form><div id="submission-count">0</div>`,
  );
  await page.evaluate(() =>
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      document.querySelector("#submission-count")!.textContent = "1";
    }),
  );
  const result = await page.evaluate(fillApplication, {
    origin: "http://127.0.0.1:9211",
    fields: {
      full_name: "Alex Example",
      email: "alex@example.com",
      phone: "Do not overwrite",
    },
    documents: [
      {
        kind: "cv",
        title: "CV",
        variants: [
          {
            name: "cv.pdf",
            mime: "application/pdf",
            base64: Buffer.from("Synthetic PDF").toString("base64"),
          },
        ],
      },
      {
        kind: "cover_letter",
        title: "Letter",
        text: "Reviewed letter text",
        variants: [
          {
            name: "cover_letter.docx",
            mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            base64: Buffer.from("Synthetic Word").toString("base64"),
          },
        ],
      },
    ],
  });
  await expect(page.getByLabel("Full name")).toHaveValue("Alex Example");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "alex@example.com",
  );
  await expect(page.getByLabel("Phone")).toHaveValue("Existing phone");
  expect(
    await page
      .getByLabel("CV", { exact: true })
      .evaluate((el: HTMLInputElement) => el.files?.[0].name),
  ).toBe("cv.pdf");
  expect(
    await page
      .getByLabel("Cover letter", { exact: true })
      .evaluate((el: HTMLInputElement) => el.files?.[0].name),
  ).toBe("cover_letter.docx");
  await expect(page.getByLabel("Cover letter text")).toHaveValue(
    "Reviewed letter text",
  );
  await expect(page.getByLabel("Work authorisation")).toHaveValue("");
  await expect(page.getByLabel("Consent")).not.toBeChecked();
  await expect(page.locator("#submission-count")).toHaveText("0");
  expect(result.skipped.length).toBeGreaterThan(0);
  await page.getByLabel("Work authorisation").fill("My own answer");
  await page.getByLabel("Consent").check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator("#submission-count")).toHaveText("1");
});

test("browser preparation rejects a different destination", async ({
  page,
}) => {
  await page.goto("/");
  let error = "";
  try {
    await page.evaluate(fillApplication, {
      origin: "https://different.example",
      fields: {},
      documents: [],
    });
  } catch (e) {
    error = String(e);
  }
  expect(error).toContain("does not match");
});

test("application can be prepared directly from the job sidebar", async ({
  page,
  request,
}) => {
  const headers = { "X-Job-Agent": "1" };
  const job = await (
    await request.post("/api/jobs", {
      headers,
      data: {
        title: "Synthetic browser role",
        url: "https://careers.example.com/apply",
      },
    })
  ).json();
  await request.post(`/api/jobs/${job.id}/documents`, {
    headers,
    data: {
      kind: "cv",
      title: "Reviewed application CV",
      content: "# Alex Example\nVerified experience.",
    },
  });
  await page.route("**/api/jobs/*/browser/open", (route) =>
    route.fulfill({
      json: {
        url: "https://careers.example.com/apply",
        title: "Example application",
        filled: ["Full name"],
        skipped: [],
      },
    }),
  );
  await page.goto("/#/job/" + job.id);
  await page.getByRole("button", { name: "Prepare application" }).click();
  await expect(
    page.getByRole("dialog", { name: "Prepare browser application" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open browser & prepare" }).click();
  await expect(
    page.getByText("Application browser ready", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Current page: https://careers.example.com/apply"),
  ).toBeVisible();
});

test("built-in browser prepares an application without extension or codes", async ({
  request,
}) => {
  const headers = { "X-Job-Agent": "1" };
  const job = await (
    await request.post("/api/jobs", {
      headers,
      data: {
        title: "Managed browser test",
        url: "http://127.0.0.1:9211/synthetic-application",
      },
    })
  ).json();
  const cv = await (
    await request.post(`/api/jobs/${job.id}/documents`, {
      headers,
      data: {
        kind: "cv",
        title: "Managed test CV",
        content: "# Alex Example\nVerified experience.",
      },
    })
  ).json();
  const result = await request.post(`/api/jobs/${job.id}/browser/open`, {
    headers,
    data: {
      cv_id: cv.id,
      application_url: "http://127.0.0.1:9211/synthetic-application",
      full_name: "Alex Example",
      email: "alex@example.com",
    },
  });
  expect(result.ok(), await result.text()).toBe(true);
  const state = await result.json();
  expect(state.filled.some((s: string) => s.includes("full name"))).toBe(true);
  expect(state.filled.some((s: string) => s.includes("cv.pdf"))).toBe(true);
  expect(state.skipped.some((s: string) => s.includes("authorisation"))).toBe(
    true,
  );
  const status = await (
    await request.get(`/api/jobs/${job.id}/browser/status`)
  ).json();
  expect(status.url).toBe("http://127.0.0.1:9211/synthetic-application");
  const wrong = await request.post(`/api/jobs/${job.id}/browser/fill`, {
    headers,
    data: { url: "https://different.example/form" },
  });
  expect(wrong.ok()).toBe(false);
  const updated = await (await request.get(`/api/jobs/${job.id}`)).json();
  expect(updated.job.status).not.toBe("applied");
});
