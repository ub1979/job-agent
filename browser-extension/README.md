# Job Agent application assistant (Chrome / Edge)

1. In `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select this `browser-extension` folder. It works on Windows, macOS and Linux. Installation is manual; the app does not change browser settings.
2. In Job Agent, open a job, draft/review its CV and optional cover letter, and choose **Documents → Prepare in browser**.
3. Paste the actual application form URL after any redirect. Select the exact documents and contact details you want to share, then create a browser code (10-minute lifetime).
4. On the application form, open the extension. Enter the local Job Agent address (default `http://127.0.0.1:9210`) and code. Load the selected documents and verify the destination.
5. Choose **Fill this page & attach documents**. Review its report and the site itself. Complete anything left blank and press the site's Submit button yourself.

The assistant never clicks buttons or calls a form's submit API, never logs in, accepts declarations, solves CAPTCHAs or invents screening answers. It fills common contact/link fields only when empty. Existing answers and attachments are preserved. It recognises labelled CV/resume and cover-letter file inputs, prefers PDF where accepted and can attach DOCX when required. It leaves ambiguous uploads and unsupported controls for manual completion. Some sites autosave edits or upload attachments immediately: pressing Fill explicitly shares the supplied fields and selected files with that site. Review the site before filling.

Custom widgets, cross-origin frames, closed shadow roots and multi-step applications may need manual assistance. It operates in the main frame of the active tab only. For a new step on the same website, paste/reload the code and request Fill again. For another domain, create a new code bound to it. It does not read your full career library, cookies, passwords or browsing history. Codes are scoped to one job/package, expire after ten minutes, and must be kept private. The extension stores no code or document package on disk. Closing the popup discards its in-memory package; paste the code again if needed.

Source inherits this repository's CC BY-NC-ND 4.0 license for original material. See ../LICENSING.md for exceptions.

## Import selected profile text (including information visible after you sign in)

In My profile enter the source URL, approve the import and choose **Create browser text-import code**. Sign in in your own browser and select the exact profile text you want to bring over. Open this extension, load the code and choose **Read my selected text**. Preview/edit the selection and explicitly choose **Send selected text for review**. Back in My profile, choose **Refresh imported findings**, review the finding and approve it if correct. This copies only your manual selection; it does not crawl or expand profile sections, fetch hidden certificates, log in for you, or automatically approve the text.
