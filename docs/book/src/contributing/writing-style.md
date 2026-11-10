# Writing Style Guide for This Manual

This page explains how we write the SoilFER LIMS user manual and in-app help. Please follow these rules whenever you add or edit a page.

---

## 1. Who We Write For

Picture **Amina**, a technician in a regional soil laboratory. She is skilled with pH meters, sieves, balances, and titrations, and has done this work for twelve years. English may be her second or third language. She reads this guide on a shared bench computer while a batch is running.

**The golden rule:** A laboratory staff member should be able to finish their task using only the page in front of them, without asking anyone and without reading a second page.

---

## 2. Words and Sentences

- **Keep sentences short.** Aim for an average of under 20 words per sentence, with one idea per sentence.
- **Use everyday words:**
  - Write *check*, not *verify*.
  - Write *send*, not *submit* (except when referring to a button literally named **Submit**).
  - Write *fix*, not *remediate*.
  - Write *before you start*, not *prerequisites*.
- **Say "you" and use the active voice.** Write *"Click **Save**"*, not *"The Save button should be clicked"*.
- **Soil laboratory terms are welcome; code and IT jargon are not.**
  - Laboratory terms like *blank*, *duplicate*, *reference soil (CRM or LRM)*, *calibration*, *sieve*, and *aliquot* are fine. Define each term the first time it appears on a page and link it to the [Glossary](../reference/glossary.md).
  - Never put internal database codes, configuration keys, API paths, table names, or words like *payload*, *endpoint*, *idempotent*, or *snapshot* in user instructions.
- **Match real screen labels.** When you name a button, menu item, or status badge, copy the exact text shown on screen in **bold** (checked against the English translation file). Explain any status badge in plain words the first time it appears.

---

## 3. Standard Layout for Every Task Page

Use these six sections in the same order on every task page so readers always know where to look:

1. **What this is for:** One or two plain sentences explaining the goal of the page.
2. **Before you start:** What you need ready before you begin (such as your role, the sample containers, or an instrument file).
3. **Steps:** A numbered list with one action per step and **bold** button names. After any step that changes the screen, add a short *"You should see…"* line.
4. **What happens next:** Who picks up the work next and which screen it moves to.
5. **If something goes wrong:** The three to five most common problems, written as *"If you see X → do Y"*.
6. **For the QA person (optional, at the bottom):** Technical rules, formulas, policy presets, and ISO/IEC 17025 notes for quality managers and auditors. Keeping this at the bottom preserves full technical depth without getting in the way of bench work.

---

## 4. Settings Vary by Laboratory

SoilFER LIMS is used by many laboratories with different quality rules. Never write a fixed number as if every laboratory uses it.

- **Do not write:** *"The maximum batch size is 20 samples."*
- **Write instead:** *"Your laboratory decides the batch size (many laboratories use 20 samples)."* Then link to [Per-Lab Settings, Presets & Method Overrides](../usage/lab-settings-and-presets.md).

---

## 5. Screenshots and Diagrams

- Include at least one screenshot on every task page, plus one for any tricky step.
- Take screenshots only from a local training copy with fictional **"Demo Soil Lab"** data. Never include real laboratory names, staff names, email addresses, coordinates, or server addresses.
- Crop screenshots to the area that matters, highlight where to click with a red box or numbered circle, and keep image width under 1400 pixels.
- Give every image clear alt text describing what is on screen (for example, *"Workbench with 3 samples ready to record"*).
- Store task screenshots under `docs/book/src/img/screens/<area>/<page>-<n>.png`.

---

## 6. Pre-Review Checklist for Documentation Pull Requests

Before marking a documentation pull request ready for review, check all five items:

1. **Click-through check:** Follow every step on a running training copy of the current version.
2. **Label check:** Confirm every **bold** button and menu name matches the real interface labels.
3. **No code words in user steps:** Check that technical codes, formulas, and configuration keys appear only inside the **For the QA person** section, the **For IT** chapters, or the **Reference** pages.
4. **Readability check:** Confirm that average sentence length stays under 20 words.
5. **Build and link check:** Run `mdbook build docs/book` and confirm the book builds cleanly with no broken links.
