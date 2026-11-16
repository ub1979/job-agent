// Self-contained so Chrome can inject the function only into the user-selected tab.
export function fillApplication(bundle) {
  if (location.origin !== bundle.origin)
    throw new Error(
      "This page does not match the approved application website. Create a code for this site.",
    );
  const filled = [],
    skipped = [];
  const fields = bundle.fields;
  const describe = (el) =>
    [
      el.getAttribute("aria-label"),
      el.name,
      el.id,
      el.getAttribute("placeholder"),
      ...(el.labels ? Array.from(el.labels).map((l) => l.innerText) : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[_-]+/g, " ");
  const valueFor = (label) => {
    if (
      /password|captcha|salary|gender|race|ethnic|disab|veteran|citizen|visa|sponsor|eligible|authori[sz]|legal|consent|reference|birth|age\b|address|postal|zip\b|national|right to work/.test(
        label,
      )
    )
      return null;
    if (/first name|given name/.test(label)) return fields.first_name;
    if (/last name|family name|surname/.test(label)) return fields.last_name;
    if (/full name|your name|^(name\s*)+$/.test(label)) return fields.full_name;
    if (/e ?mail/.test(label)) return fields.email;
    if (/phone|mobile|telephone/.test(label)) return fields.phone;
    if (/linkedin/.test(label)) return fields.linkedin;
    if (/github/.test(label)) return fields.github;
    if (/portfolio|personal website|website url/.test(label))
      return fields.website;
    return null;
  };
  const forms = Array.from(document.forms).filter(
    (form) =>
      form.querySelector("input[type=file]") ||
      /apply|application|resume|curriculum|cover letter/i.test(
        form.innerText || "",
      ),
  );
  const scopes = forms.length
    ? forms
    : document.querySelector("input[type=file]")
      ? [document]
      : [];
  if (!scopes.length)
    return {
      filled,
      skipped: [
        "No recognised application form found. Open the application form, then ask Job Agent to fill it.",
      ],
      notice: "No fields changed and nothing submitted.",
    };
  for (const el of new Set(
    scopes.flatMap((scope) =>
      Array.from(scope.querySelectorAll("input,textarea,select")),
    ),
  )) {
    const label = describe(el) || el.type || el.tagName;
    if (el.disabled || el.readOnly || el.type === "hidden") continue;
    if (el.closest("form")?.querySelector("input[type=password]")) {
      skipped.push("Sign-in form: complete login manually");
      continue;
    }
    if (el.type === "file") {
      if (bundle.skip_files) continue;
      const kind = /cover/.test(label)
        ? "cover_letter"
        : /resume|résumé|curriculum|\bcv\b/.test(label)
          ? "cv"
          : null;
      const doc = bundle.documents.find((d) => d.kind === kind);
      if (!doc || (el.files && el.files.length)) {
        skipped.push(label + ": attach/check manually");
        continue;
      }
      const accepts = (el.accept || "")
        .toLowerCase()
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const fits = (file) =>
        !accepts.length ||
        accepts.some(
          (a) =>
            a === "*/*" ||
            a === file.mime ||
            a === "." + file.name.split(".").pop() ||
            (a.endsWith("/*") && file.mime.startsWith(a.slice(0, -1))),
        );
      const file = [...doc.variants]
        .sort(
          (a, b) =>
            Number(b.mime === "application/pdf") -
            Number(a.mime === "application/pdf"),
        )
        .find(fits);
      if (!file) {
        skipped.push(
          label + ": no compatible file format; download and attach manually",
        );
        continue;
      }
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], file.name, { type: file.mime }));
      el.files = transfer.files;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      filled.push(label + ": " + file.name);
      continue;
    }
    if (
      el.tagName === "SELECT" ||
      [
        "checkbox",
        "radio",
        "submit",
        "button",
        "password",
        "reset",
        "image",
      ].includes(el.type)
    ) {
      if (
        el.required &&
        !["submit", "button", "reset", "image"].includes(el.type)
      )
        skipped.push(label + ": answer yourself");
      continue;
    }
    if (!el.getClientRects().length) continue;
    if (el.value) {
      continue;
    }
    const value =
      el.tagName === "TEXTAREA" && /cover letter|covering letter/.test(label)
        ? bundle.documents.find((d) => d.kind === "cover_letter")?.text
        : valueFor(label);
    if (!value) {
      if (el.required) skipped.push(label + ": answer yourself");
      continue;
    }
    const proto =
      el.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    filled.push(label);
  }
  // No buttons are clicked, no navigation performed and no submit API is called.
  return {
    filled,
    skipped,
    notice:
      "Review every field and attachment on the site. Existing values were preserved. Handle remaining questions, logins, CAPTCHAs and final Submit yourself.",
  };
}
