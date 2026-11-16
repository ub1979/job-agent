// Fixed form inspection and answer operations. No model-provided code or selectors run here.
import { randomUUID } from "node:crypto";

export function inspectForm() {
  const forms = Array.from(document.forms).filter(
    (f) =>
      f.querySelector("input[type=file]") ||
      /application|resume|curriculum|cover letter/i.test(f.innerText || ""),
  );
  const scopes = forms.length
    ? forms
    : document.querySelector("input[type=file]")
      ? [document]
      : [];
  for (const scope of scopes)
    if (scope.setAttribute)
      scope.setAttribute("data-job-agent-application", "true");
  const fields = [];
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const labelText = (label) => {
    const copy = label.cloneNode(true);
    for (const control of copy.querySelectorAll(
      "input,textarea,select,button,[role=listbox],[role=option],[class*=single-value],[class*=singleValue]",
    ))
      control.remove();
    return copy.textContent;
  };
  for (const el of new Set(
    scopes.flatMap((scope) =>
      Array.from(scope.querySelectorAll("input,textarea,select")),
    ),
  )) {
    const type =
      el.getAttribute("role") === "combobox"
        ? "combobox"
        : el.tagName === "SELECT"
          ? "select"
          : (el.type || "text").toLowerCase();
    if (
      el.disabled ||
      el.readOnly ||
      [
        "hidden",
        "submit",
        "button",
        "reset",
        "image",
        "password",
        "search",
      ].includes(type)
    )
      continue;
    if (el.closest("form")?.querySelector("input[type=password]")) continue;
    if (type !== "file" && !el.getClientRects().length) continue;
    const labelled = (el.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.innerText || "")
      .join(" ");
    let label = clean(
      el.getAttribute("aria-label") ||
        Array.from(el.labels || [])
          .map(labelText)
          .join(" ") ||
        labelled ||
        el.placeholder ||
        el.name ||
        el.id,
    );
    if (type === "file")
      label = clean(
        [el.id, el.name, labelled, label].filter(Boolean).join(" "),
      );
    if (!label || /captcha|recaptcha|honeypot|search/i.test(label)) continue;
    let id = el.getAttribute("data-job-agent-field");
    if (!id) {
      id = "ja-" + crypto.randomUUID();
      el.setAttribute("data-job-agent-field", id);
    }
    let value = el.value || "";
    if (type === "combobox") {
      const control =
        el.closest('[class*="control"]') || el.parentElement?.parentElement;
      if (control) control.setAttribute("data-job-agent-control", id);
      const selected = control?.querySelector(
        '[class*="single-value"], [class*="singleValue"], [class*="single_value"]',
      );
      value = clean(selected?.innerText || value);
    }
    const required =
      !!el.required ||
      el.getAttribute("aria-required") === "true" ||
      /\*/.test(
        Array.from(el.labels || [])
          .map(labelText)
          .join(" "),
      );
    const blocked =
      type === "checkbox" ||
      /password|captcha|consent|certif(?:y|ication of)|declaration|terms|privacy|signature|gender|ethnic|race\b|disab|veteran|(?:date|year) of birth|birth date|nationality|citizenship|religion|sexual|national insurance|social security|passport/i.test(
        label,
      );
    const options =
      type === "select"
        ? Array.from(el.options)
            .slice(0, 120)
            .map((o) => ({ label: clean(o.text), value: o.value }))
        : [];
    fields.push({
      id,
      label: label.slice(0, 1500),
      type,
      required,
      value:
        type === "file"
          ? Array.from(el.files || [])
              .map((f) => f.name)
              .join(", ")
          : String(value).slice(0, 4000),
      options,
      blocked,
      max_length: el.maxLength > 0 ? el.maxLength : 4000,
    });
    if (fields.length >= 160) break;
  }
  return fields;
}

export function readField(el) {
  const type =
    el.getAttribute("role") === "combobox"
      ? "combobox"
      : el.tagName === "SELECT"
        ? "select"
        : el.type;
  let value = el.value || "";
  if (type === "combobox") {
    const control =
      el.closest('[class*="control"]') || el.parentElement?.parentElement;
    value = (
      control?.querySelector(
        '[class*="single-value"], [class*="singleValue"], [class*="single_value"]',
      )?.innerText || value
    ).trim();
  }
  return {
    value,
    invalid: el.getAttribute("aria-invalid") === "true",
    files: type === "file" ? Array.from(el.files || []).map((f) => f.name) : [],
  };
}

const normal = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+\+\d+$/, "")
    .replace(/[^a-z0-9]/g, "");
const equivalent = (a, b) => {
  if (normal(a) === normal(b)) return true;
  const degrees = [
    ["phd", "doctorofphilosophyphd", "doctorofphilosophy"],
    ["msc", "mastersdegree", "masterofscience", "masterofsciencemsc"],
    ["bsc", "bachelorsdegree", "bachelorofscience", "bachelorofsciencebsc"],
  ];
  return degrees.some(
    (group) => group.includes(normal(a)) && group.includes(normal(b)),
  );
};
const locatorFor = (page, id) => page.locator(`[data-job-agent-field="${id}"]`);
async function focusDropdown(page, field) {
  const input = locatorFor(page, field.id);
  // Keyboard focus avoids placeholder overlays and closes another select's menu.
  // ArrowDown only opens a choice menu; no Enter or application button is used.
  await input.focus({ timeout: 3000 });
  await input.press("ArrowDown");
  return input;
}

export async function inspectPage(page) {
  await page
    .waitForSelector("input[type=file], form", { timeout: 8000 })
    .catch(() => {});
  let fields = await page.evaluate(inspectForm);
  for (const field of fields
    .filter((f) => f.type === "combobox" && !f.blocked && !f.value)
    .slice(0, 18)) {
    const input = locatorFor(page, field.id);
    try {
      await focusDropdown(page, field);
      await page
        .locator('[role="option"]:visible')
        .first()
        .waitFor({ timeout: 1500 })
        .catch(() => {});
      const options = await page
        .locator('[role="option"]:visible')
        .allTextContents();
      field.options = options
        .slice(0, 100)
        .map((label) => ({ label: label.trim(), value: label.trim() }));
      await input.press("Escape");
    } catch {
      field.inspection_note =
        "Options could not be read; the selected answer will be checked against the live menu.";
    }
  }
  return {
    snapshot_id: randomUUID(),
    url: page.url(),
    title: await page.title(),
    fields,
  };
}

async function dropdown(page, field, answer) {
  const input = locatorFor(page, field.id);
  if (field.type === "select") {
    const options = await input
      .locator("option")
      .evaluateAll((nodes) =>
        nodes.map((o) => ({ label: o.textContent.trim(), value: o.value })),
      );
    const match = options.find(
      (o) =>
        equivalent(o.label, answer.value) || equivalent(o.value, answer.value),
    );
    if (!match) return { error: "No exact matching option is available." };
    await input.selectOption(match.value);
    return { value: match.label };
  }
  const choose = async (value) => {
    await focusDropdown(page, field);
    // React-select loads matching remote options after input events.
    await input.fill(value, { timeout: 2500 });
    let options = [];
    for (let tries = 0; tries < 16; tries++) {
      options = await page.locator('[role="option"]:visible').allTextContents();
      const index = options.findIndex((label) => equivalent(label, value));
      if (index >= 0) {
        const option = page.locator('[role="option"]:visible').nth(index);
        await option.click();
        return options[index].trim();
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    await input.fill("");
    await input.press("Escape");
    await input.press("Tab");
    return null;
  };
  let chosen = await choose(answer.value);
  if (
    !chosen &&
    answer.fallback_value === "Other" &&
    /school|university|institution/i.test(field.label)
  )
    chosen = await choose("Other");
  return chosen
    ? { value: chosen, fallback: !equivalent(chosen, answer.value) }
    : {
        error:
          "No exact matching option is available. Your typed search was cleared; choose manually.",
      };
}

export async function fillAnswers(page, snapshot, answers) {
  if (snapshot.url !== page.url())
    throw new Error(
      "The browser page changed. Review a new answer plan first.",
    );
  const results = [];
  for (const answer of answers) {
    const field = snapshot.fields.find((f) => f.id === answer.field_id);
    if (
      !field ||
      field.blocked ||
      ["checkbox", "file", "radio"].includes(field.type)
    ) {
      results.push({
        field_id: answer.field_id,
        status: "skipped",
        reason: "This field needs manual review.",
      });
      continue;
    }
    if (!answer.value?.trim()) {
      results.push({
        field_id: field.id,
        label: field.label,
        status: "unanswered",
        reason: "No answer supplied.",
      });
      continue;
    }
    const input = locatorFor(page, field.id);
    try {
      if ((await input.count()) !== 1)
        throw new Error("The form changed. Inspect it again.");
      const current = await input.evaluate(readField);
      if (current.value) {
        const same =
          equivalent(current.value, answer.value) ||
          (answer.fallback_value === "Other" &&
            equivalent(current.value, "Other"));
        results.push({
          field_id: field.id,
          label: field.label,
          status: same ? "already_filled" : "preserved",
          value: current.value,
          reason: same
            ? "Already filled."
            : "Existing answer preserved; review it yourself.",
        });
        continue;
      }
      let result;
      if (["combobox", "select"].includes(field.type))
        result = await dropdown(page, field, answer);
      else {
        await input.fill(answer.value.slice(0, field.max_length || 4000));
        await input.press("Tab");
        result = { value: answer.value };
      }
      if (result.error)
        results.push({
          field_id: field.id,
          label: field.label,
          status: "unanswered",
          reason: result.error,
        });
      else {
        const actual = await input.evaluate(readField);
        const verified =
          equivalent(actual.value, result.value) && !actual.invalid;
        results.push({
          field_id: field.id,
          label: field.label,
          status: verified ? "filled" : "needs_review",
          value: actual.value,
          reason: result.fallback
            ? "Institution not listed; selected the reviewed Other fallback."
            : verified
              ? "Value checked on the page."
              : "The page did not retain a valid matching value.",
        });
      }
    } catch (error) {
      results.push({
        field_id: field.id,
        label: field.label,
        status: "unanswered",
        reason: /form changed/i.test(error.message)
          ? "The form changed. Inspect it again."
          : "This control could not be completed. Review it on the site, then refresh the answer plan.",
      });
    }
  }
  return {
    results,
    notice:
      "No Apply or Submit button was clicked. Review every answer and attachment before submitting yourself.",
  };
}

export async function attachFiles(page, bundle) {
  const uploads = [];
  const fields = (await page.evaluate(inspectForm)).filter(
    (f) => f.type === "file",
  );
  for (const field of fields) {
    const kind = /cover/i.test(field.label)
      ? "cover_letter"
      : /resume|résumé|curriculum|\bcv\b/i.test(field.label)
        ? "cv"
        : null;
    const doc = bundle.documents.find((d) => d.kind === kind);
    if (!doc) {
      uploads.push({
        label: field.label,
        status: "unanswered",
        reason: "No matching document selected.",
      });
      continue;
    }
    if (field.value) {
      uploads.push({
        label: field.label,
        status: "preserved",
        filename: field.value,
      });
      continue;
    }
    const input = locatorFor(page, field.id);
    try {
      const accepts = ((await input.getAttribute("accept")) || "")
        .toLowerCase()
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const file = [...doc.variants]
        .sort(
          (a, b) =>
            Number(b.mime === "application/pdf") -
            Number(a.mime === "application/pdf"),
        )
        .find(
          (v) =>
            !accepts.length ||
            accepts.some(
              (a) =>
                a === "*/*" ||
                a === v.mime ||
                a === "." + v.name.split(".").pop() ||
                (a.endsWith("/*") && v.mime.startsWith(a.slice(0, -1))),
            ),
        );
      if (!file) {
        uploads.push({
          label: field.label,
          status: "unanswered",
          reason: "Selected document has no compatible file format.",
        });
        continue;
      }
      const payload = {
        name: file.name,
        mimeType: file.mime,
        buffer: Buffer.from(file.base64, "base64"),
      };
      let visible = false,
        displayed = false,
        uploadError = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        await input.setInputFiles(payload);
        for (let tries = 0; tries < 30; tries++) {
          const state = await page.evaluate((name) => {
            const text = document.body.innerText;
            return {
              visible: text.includes(name),
              error:
                (text.match(
                  /Cannot read properties[^\n]*uploadFile[^\n]*|(?:upload failed|failed to upload|unable to upload|failed to fetch)[^\n]*/i,
                ) || [])[0] || "",
            };
          }, file.name);
          displayed = state.visible;
          uploadError = state.error;
          visible = displayed && !uploadError;
          if (displayed) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (displayed || !uploadError || attempt === 1) break;
        // Some recruitment pages enable Attach before their upload SDK is ready.
        // Retry only our own explicitly failed upload, never an existing user file.
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      const stillPresent = await input.count();
      const chosen = stillPresent
        ? (await input.evaluate(readField)).files.includes(file.name)
        : false;
      uploads.push({
        label: field.label,
        filename: file.name,
        status: visible
          ? "attached"
          : uploadError
            ? displayed
              ? "needs_review"
              : "failed"
            : chosen
              ? "selected"
              : "needs_review",
        reason: visible
          ? "Filename is displayed by the application page; final server validation occurs only on submission."
          : uploadError
            ? "The site reported an upload error: " + uploadError
            : "File input was set but no upload completion indicator was found; check the page.",
      });
    } catch (error) {
      uploads.push({
        label: field.label,
        status: "failed",
        reason: /form changed/i.test(error.message)
          ? "The form changed. Inspect it again."
          : "This control could not be completed. Review it on the site, then refresh the answer plan.",
      });
    }
  }
  return uploads;
}
