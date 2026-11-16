import { test, expect } from "@playwright/test";
import { inspectPage, fillAnswers, attachFiles } from "../../browser/forms.mjs";

const form = `<style>.control{position:relative;min-height:40px}.control input{width:2px;opacity:0}.single-value{pointer-events:none}</style><form id="application"><h1>Faculty application</h1>
<label>Country<div class="control"><span class="single-value"></span><input id="country" role="combobox" aria-label="Country"></div></label>
<label>School<div class="control"><span class="single-value"></span><input id="school" role="combobox" aria-label="School"></div></label>
<label>Degree<select name="degree"><option value="">Choose a degree</option><option value="phd">Doctor of Philosophy (Ph.D.)</option><option value="msc">Master's Degree</option></select></label>
<label>Start year<input type="number" name="start" required></label>
<label>Teaching experience<textarea name="teaching" required></textarea></label>
<label>Phone<input name="phone" value="Existing phone"></label>
<label>Expected salary<input name="salary" required></label>
<label>I agree to terms<input type="checkbox" required></label>
<label>CV<input type="file" name="resume" accept=".pdf"><span class="upload-result"></span></label>
<button type="button" id="apply">Apply</button><button type="submit">Submit application</button>
<output id="clicks">0</output><output id="submits">0</output></form>
`;

async function setup(page: any) {
  await page.goto("/");
  await page.setContent(form);
  await page.evaluate(() => {
    const options: Record<string, string[]> = {
      country: ["Canada +1", "United States +1"],
      school: ["Other", "Real University"],
    };
    for (const input of document.querySelectorAll<HTMLInputElement>(
      "[role=combobox]",
    )) {
      const menu = document.createElement("div");
      menu.setAttribute("role", "listbox");
      input.parentElement!.append(menu);
      const render = () => {
        menu.replaceChildren();
        for (const label of options[input.id].filter((v) =>
          v.toLowerCase().includes(input.value.toLowerCase()),
        )) {
          const el = document.createElement("div");
          el.setAttribute("role", "option");
          el.textContent = label;
          el.onclick = () => {
            input.parentElement!.querySelector(".single-value")!.textContent =
              label;
            input.value = "";
            menu.replaceChildren();
          };
          menu.append(el);
        }
      };
      input.addEventListener("click", render);
      input.addEventListener("input", () => setTimeout(render, 40));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") menu.replaceChildren();
      });
    }
    document
      .querySelector<HTMLInputElement>("input[type=file]")!
      .addEventListener("change", (e) => {
        document.querySelector(".upload-result")!.textContent =
          (e.target as HTMLInputElement).files![0]?.name || "";
      });
    for (const button of document.querySelectorAll("button"))
      button.addEventListener("click", () => {
        const output = document.querySelector("#clicks")!;
        output.textContent = String(Number(output.textContent) + 1);
      });
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      document.querySelector("#submits")!.textContent = "1";
    });
  });
}

test("fills real custom dropdown options, academic fields and answers without applying or submitting", async ({
  page,
}) => {
  await setup(page);
  const snapshot = await inspectPage(page);
  const field = (label: string) =>
    snapshot.fields.find((f: any) => f.label === label)!;
  const values = [
    ["Country", "Canada"],
    ["School", "Example University"],
    ["Degree", "PhD"],
    ["Start year", "2012"],
    ["Teaching experience", "Nine years of AI teaching."],
    ["Phone", "Do not overwrite"],
    ["Expected salary", ""],
    ["I agree to terms", "Yes"],
  ];
  const result = await fillAnswers(
    page,
    snapshot,
    values.map(([label, value]) => ({
      field_id: field(label).id,
      value,
      fallback_value: label === "School" ? "Other" : "",
    })),
  );
  await expect(
    page.locator("#country").locator("..").locator(".single-value"),
  ).toHaveText("Canada +1");
  await expect(
    page.locator("#school").locator("..").locator(".single-value"),
  ).toHaveText("Other");
  await expect(page.getByLabel("Degree")).toHaveValue("phd");
  await expect(page.getByLabel("Start year")).toHaveValue("2012");
  await expect(page.getByLabel("Teaching experience")).toHaveValue(
    "Nine years of AI teaching.",
  );
  await expect(page.getByLabel("Phone")).toHaveValue("Existing phone");
  await expect(page.getByLabel("Expected salary")).toHaveValue("");
  await expect(page.getByLabel("I agree to terms")).not.toBeChecked();
  expect(result.results.filter((r: any) => r.status === "filled")).toHaveLength(
    5,
  );
  expect(result.results.find((r: any) => r.label === "Phone").status).toBe(
    "preserved",
  );
  await expect(page.locator("#clicks")).toHaveText("0");
  await expect(page.locator("#submits")).toHaveText("0");
  // A refreshed form cannot be filled through stale field IDs.
  await page.setContent(form);
  const stale = await fillAnswers(page, snapshot, [
    { field_id: field("Start year").id, value: "2020" },
  ]);
  expect(stale.results[0].status).toBe("unanswered");
  await expect(page.getByLabel("Start year")).toHaveValue("");
});

test("managed uploads verify the visible filename without clicking application buttons", async ({
  page,
}) => {
  await setup(page);
  const uploads = await attachFiles(page, {
    documents: [
      {
        kind: "cv",
        variants: [
          {
            name: "Alex_Demo_application.pdf",
            mime: "application/pdf",
            base64: Buffer.from("Synthetic file fixture").toString("base64"),
          },
        ],
      },
    ],
  });
  expect(uploads[0].status).toBe("attached");
  await expect(page.locator(".upload-result")).toHaveText(
    "Alex_Demo_application.pdf",
  );
  await expect(page.locator("#clicks")).toHaveText("0");
  await expect(page.locator("#submits")).toHaveText("0");
});

test("retries an explicit transient upload failure and does not mistake an error for success", async ({
  page,
}) => {
  await page.goto("/");
  await page.setContent(
    '<form><label>Resume/CV<input id="resume" type="file" aria-label="Attach"></label><span id="filename"></span><p id="error"></p><button type="submit">Submit application</button></form>',
  );
  await page.evaluate(() => {
    let attempts = 0;
    document
      .querySelector<HTMLInputElement>("#resume")!
      .addEventListener("change", (e) => {
        attempts++;
        if (attempts === 1) {
          document.querySelector("#error")!.textContent =
            "Cannot read properties of undefined (reading 'uploadFile')";
        } else {
          document.querySelector("#error")!.textContent = "";
          document.querySelector("#filename")!.textContent = (
            e.target as HTMLInputElement
          ).files![0].name;
        }
      });
  });
  const bundle = {
    documents: [
      {
        kind: "cv",
        variants: [
          {
            name: "Demo_application.pdf",
            mime: "application/pdf",
            base64: Buffer.from("Synthetic test PDF").toString("base64"),
          },
        ],
      },
    ],
  };
  const result = await attachFiles(page, bundle);
  expect(result[0].status).toBe("attached");
  await expect(page.locator("#filename")).toHaveText("Demo_application.pdf");
  await page.setContent(
    '<form><label>CV<input type="file" name="resume"></label><span>Demo_application.pdf</span><p>Cannot read properties of undefined (reading uploadFile)</p><button type="submit">Submit application</button></form>',
  );
  const ambiguous = await attachFiles(page, bundle);
  expect(ambiguous[0].status).toBe("needs_review");
});
