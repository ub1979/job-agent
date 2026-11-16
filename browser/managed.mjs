import { chromium } from "../web/node_modules/playwright-core/index.mjs";
import { fillApplication } from "../browser-extension/fill.js";
import readline from "node:readline";
import { inspectPage, fillAnswers, attachFiles } from "./forms.mjs";
let context;
const pages = new Map();
const snapshots = new Map();
async function browser() {
  if (context) return context;
  const headless = process.env.JOB_AGENT_BROWSER_HEADLESS === "1";
  for (const channel of headless
    ? [undefined]
    : ["chrome", "msedge", undefined]) {
    try {
      context = await chromium.launchPersistentContext(process.argv[2], {
        headless,
        channel,
        viewport: null,
      });
      break;
    } catch {}
  }
  if (context)
    context.on("close", () => {
      context = null;
      pages.clear();
      snapshots.clear();
    });
  if (!context)
    throw new Error(
      "No supported browser could start. Install Chrome or Edge on this computer, then retry.",
    );
  return context;
}
async function guarded(page, action) {
  await page.evaluate(() => {
    if (!window.__jobAgentApplicationAudit) {
      window.__jobAgentApplicationAudit = {
        active: false,
        apply_clicks: 0,
        submit_events: 0,
      };
      document.addEventListener(
        "click",
        (event) => {
          const button = event.target.closest("button,input[type=submit],a");
          if (
            window.__jobAgentApplicationAudit.active &&
            button &&
            /^(?:apply(?: now)?|submit(?: application)?)(?:\s|$)/i.test(
              (button.innerText || button.value || "").trim(),
            )
          ) {
            window.__jobAgentApplicationAudit.apply_clicks++;
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        true,
      );
      document.addEventListener(
        "submit",
        (event) => {
          if (window.__jobAgentApplicationAudit.active) {
            window.__jobAgentApplicationAudit.submit_events++;
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        true,
      );
    }
    window.__jobAgentApplicationAudit.active = true;
  });
  try {
    const result = await action();
    return {
      ...result,
      safety: await page.evaluate(() => ({
        apply_or_submit_clicks: window.__jobAgentApplicationAudit.apply_clicks,
        submit_events: window.__jobAgentApplicationAudit.submit_events,
      })),
    };
  } finally {
    await page
      .evaluate(() => {
        if (window.__jobAgentApplicationAudit)
          window.__jobAgentApplicationAudit.active = false;
      })
      .catch(() => {});
  }
}
async function run(request) {
  const key = request.key;
  if (request.command === "close") {
    if (context) await context.close();
    context = null;
    return { closed: true };
  }
  if (request.command === "open") {
    const ctx = await browser();
    let page = pages.get(key);
    if (!page || page.isClosed()) {
      page = await ctx.newPage();
      pages.set(key, page);
    }
    page.on("popup", (popup) => pages.set(key, popup));
    snapshots.delete(key);
    const greenhouse = /(^|\.)greenhouse\.io$/.test(
      new URL(request.url).hostname,
    );
    // Greenhouse renders Attach before its async upload credentials are ready.
    // Register before navigation so an early credentials response is not missed.
    const uploadReady = greenhouse
      ? page
          .waitForResponse(
            (response) =>
              response.url().includes("uncacheable_attributes") &&
              response.ok(),
            { timeout: 15000 },
          )
          .then((response) => response.finished())
          .catch(() => {})
      : Promise.resolve();
    await page.goto(request.url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await uploadReady;
    await page.bringToFront();
    const result = {
      url: page.url(),
      title: await page.title(),
      filled: [],
      skipped: [],
    };
    if (request.bundle) {
      if (new URL(page.url()).origin !== request.bundle.origin) {
        result.skipped.push(
          "The site redirected. Review the destination, log in or open its application form, then choose Fill current application page.",
        );
        return result;
      }
      await page
        .waitForSelector("input[type=file], form", { timeout: 8000 })
        .catch(() => {});
      const automatic = await guarded(page, async () => ({
        ...(await page.evaluate(fillApplication, {
          ...request.bundle,
          skip_files: true,
        })),
        uploads: await attachFiles(page, request.bundle),
      }));
      Object.assign(result, automatic);
      result.filled.push(
        ...result.uploads
          .filter((u) => u.status === "attached" || u.status === "selected")
          .map((u) => u.label + ": " + u.filename),
      );
      result.skipped.push(
        ...result.uploads
          .filter(
            (u) => !["attached", "selected", "preserved"].includes(u.status),
          )
          .map((u) => u.label + ": " + u.reason),
      );
    }
    return result;
  }
  const page = pages.get(key);
  if (!page || page.isClosed())
    throw new Error("Open the application browser first.");
  await page.bringToFront();
  if (request.command === "status")
    return { url: page.url(), title: await page.title() };
  if (request.approved_url !== page.url())
    throw new Error(
      "The browser page changed. Refresh the browser status and check its destination first.",
    );
  if (!/^https?:$/.test(new URL(page.url()).protocol))
    throw new Error("Only http(s) application pages are supported.");
  if (request.command === "fill") {
    const bundle = { ...request.bundle, origin: new URL(page.url()).origin };
    const result = await guarded(page, async () => ({
      ...(await page.evaluate(fillApplication, {
        ...bundle,
        skip_files: true,
      })),
      uploads: await attachFiles(page, bundle),
    }));
    result.filled.push(
      ...result.uploads
        .filter((u) => u.status === "attached" || u.status === "selected")
        .map((u) => u.label + ": " + u.filename),
    );
    return { url: page.url(), title: await page.title(), ...result };
  }
  if (request.command === "inspect") {
    const snapshot = await guarded(page, () => inspectPage(page));
    snapshots.set(key, snapshot);
    return snapshot;
  }
  if (request.command === "answers") {
    const snapshot = snapshots.get(key);
    if (!snapshot || snapshot.snapshot_id !== request.snapshot_id)
      throw new Error(
        "The form inspection changed. Review a new answer plan first.",
      );
    return {
      url: page.url(),
      title: await page.title(),
      ...(await guarded(page, () =>
        fillAnswers(page, snapshot, request.answers),
      )),
    };
  }
  if (request.command === "capture") {
    let target = page.locator('[data-job-agent-application="true"]').first();
    const bytes = (await target.count())
      ? await target.screenshot({ type: "png", timeout: 10000 })
      : await page.screenshot({ type: "png", fullPage: true, timeout: 10000 });
    return { base64: bytes.toString("base64") };
  }
  if (request.command === "selection")
    return {
      url: page.url(),
      title: await page.title(),
      text: await page.evaluate(() => window.getSelection()?.toString() || ""),
    };
  throw new Error("Unknown browser operation.");
}
for await (const line of readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})) {
  try {
    const request = JSON.parse(line);
    console.log(JSON.stringify({ result: await run(request) }));
    if (request.command === "close") break;
  } catch (error) {
    const safe =
      /No supported browser|Open the application|page changed|inspection changed|Only http|Unknown browser/.test(
        error.message,
      )
        ? error.message
        : "The browser could not complete this step. Check the browser window and try again.";
    console.log(JSON.stringify({ error: safe }));
  }
}
if (context) await context.close();
