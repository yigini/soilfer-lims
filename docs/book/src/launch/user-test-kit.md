# First Real User Test Kit (1-Hour Session)

> *Time:* 60 minutes (plus 15 minutes before to set up and 15 minutes after to write down fixes).
> *Who can do this:* Pilot lead, Laboratory Manager, or trainer running a first usability check with one receptionist and one bench technician who have never seen SoilFER LIMS.

Before training your whole laboratory, run one quiet one-hour session with two real colleagues who have never seen SoilFER LIMS: one reception clerk and one laboratory technician. Watching first-time users try five everyday tasks shows you right away which words or steps still feel unclear.

---

## 1. Setup: What to Prepare Before They Sit Down

Prepare everything in a test lab (or inside a clearly named training project on a test copy of SoilFER LIMS) so no practice clicks touch real client records.

### Preparation Checklist (15 minutes before the session)

- *A test lab and two fresh logins:*
  - Create one reception account (**Sample Reception Officer**) and one bench account (**Laboratory Technician**).
  - Switch on a Soil pH method, mark one pH meter **Ready / Calibrated**, and register one active check soil bottle so nothing blocks the bench run.
- *Three practice soil samples on the table (physical bags labelled with masking tape):*
  - *Sample 1 (for Task 1):* Not checked in yet. Put the bag on the counter with a note saying *Farmer topsoil, 0–20 cm, about 500 g, dry and intact, Soil pH requested*.
  - *Sample 2 (for Task 2):* Already checked in as **Accepted** before the session starts. That way the technician can start Task 2 smoothly even if Task 1 runs out of time.
  - *Sample 3 (for Tasks 3 and 4):* Already checked in as **Accepted**, with both **Air Drying** and **Sample Preparation** finished before the session starts, and Soil pH ordered and assigned to the test technician account.
- *Printed pages beside the keyboard:*
  - One printed copy of the *Observation Sheet* (Section 3 below) on a clipboard for you.
  - Printed copies of the manual pages listed in Section 2, plus [Reception Card: Receiving a Box in 8 Steps](../print/reception-card.md) and [Technician Bench Card: Running a Batch & QC](../print/technician-bench-card.md), placed next to the computer so participants can look things up whenever they choose.
- *A timer:* Keep a quiet phone or bench timer next to your clipboard so the whole session stays calm and finishes within one hour.

### The Golden Rule: Don't Help Unless They're Stuck for 2 Minutes

Read this aloud before Task 1 begins:

> *"Today we are testing the screen and the manual—we are not testing you. You cannot break anything here. Please say out loud what you are looking for as you move the mouse. Use the printed pages or the screen help whenever you like. I will stay quiet and take notes, and I won't step in unless you are stuck for 2 full minutes."*

Follow the rule strictly: *don't help unless they're stuck for 2 minutes*. When someone pauses or looks uncertain, stay quiet and keep watching—those 30 to 90 seconds show whether a real lab worker can find their way using the screen and the manual.

---

## 2. Five Short Tasks (45 Minutes Total)

Hand over or read each task as a plain everyday request—do not read out button or menu names. Start your timer as soon as you finish reading the request.

### Task 1: Receive a Sample *(Receptionist — Time limit: 10 minutes)*

- *Plain request:*
  *"A farmer just brought in this bag of topsoil (Sample 1, 0–20 cm, about 500 g, dry and intact) and asked for a Soil pH test. Please check this sample in and bring up its barcode label on screen."*
- *Manual pages they may use:* [Receive One Sample (Project or Walk-In)](../reception/receive-one-sample.md) and [Reception Card: Receiving a Box in 8 Steps](../print/reception-card.md).
- *How it should end:* You should see **INTAKE CONFIRMED!**, the sample status change to **Accepted**, its **Permanent Lab ID** appear, and the **Print labels** window open.

### Task 2: Record Drying *(Technician — Time limit: 8 minutes)*

- *Plain request:*
  *"Sample 2 has finished air-drying in the drying room at 35 °C (weight before drying: 480 g; weight after drying: 455 g). Please record in the system that drying is finished so the sample can move on to sieving."*
- *Manual page they may use:* [Record Sample Drying](../preparation/record-drying.md).
- *How it should end:* You should see a green **Checklist Verified** badge on Sample 2's row in **Workbench** under **Air Drying**, and **Drying step:** change to **✓ Completed**.

### Task 3: Enter a pH Result with a Duplicate *(Technician — Time limit: 12 minutes)*

- *Plain request:*
  *"Sample 3 is already dried and sieved and is waiting for Soil pH. On your pH meter you measured Sample 3 twice: 6.42 the first time and 6.45 on the duplicate (and your blank read 6.95 and check soil matched its target). Please enter Sample 3's pH result and its duplicate, and check that quality control passes."*
- *Manual pages they may use:* [Start an Analytical Run and Print a Bench Worksheet](../bench/start-run-and-print-worksheet.md), [Enter Results, Replicates, and Raw Calculations](../bench/enter-results-and-replicates.md), [Record Blanks, Duplicates, and Reference Soils in a Run](../bench/enter-qc-and-evaluate.md), and [Technician Bench Card: Running a Batch & QC](../print/technician-bench-card.md).
- *How it should end:* You should see the sample row change to **Draft saved** (with **Pair passes** if your method uses side-by-side **Rep 1** and **Rep 2** boxes), or see **QC observations saved** after clicking **Save observations** and a passing **Verdict** after clicking **Evaluate QC** if your run uses a batch duplicate row.

### Task 4: Submit for Review *(Technician — Time limit: 8 minutes)*

- *Plain request:*
  *"Your pH numbers for Sample 3 look good. Please finish saving them and send Sample 3 to the lab manager for review."*
- *Manual page they may use:* [Review, Record, and Submit Completed Samples](../bench/record-and-submit-for-review.md).
- *How it should end:* You should see the row change to **Recorded** after confirming on **Review Determinations Before Recording**, and then see Sample 3 move to the **Sent & Completed** tab with status **Submitted** after submitting on the **Ready to Submit** tab (**Review & Submit Samples for Review**).

### Task 5: Find an Answer in Help *(Receptionist & Technician — Time limit: 6 minutes, 3 minutes each)*

- *Plain request:*
  - *To the receptionist:* *"Without asking me, use the help built into the screen to find out what you should do when a soil bag arrives torn and leaking."*
  - *To the technician:* *"Without asking me, use the help built into the screen to find out what happens when a batch fails its quality control check."*
- *Manual page they may use:* [Getting Help](../start/getting-help.md).
- *How it should end:* You should see each person click **Help** in the top bar to open **Help with this page** (or open the **Help Centre** showing **How can we help at the lab?**), find the matching guide, and tell you the answer in their own words.

---

## 3. One-Page Printable Observation Sheet

> *Tip:* Click the printer icon at the top of this page to print this observation sheet on A4 paper before the session.

| Session Details | Fill In Before Starting |
| :--- | :--- |
| *Date & Observer:* | ____________________________________________________________ |
| *Receptionist (first-time user):* | ____________________________________________________________ |
| *Technician (first-time user):* | ____________________________________________________________ |

| Task | Outcome (Tick One & Note Time) | Where They Hesitated | Words They Didn't Understand | Wrong Clicks |
| :--- | :--- | :--- | :--- | :--- |
| *1. Receive a sample*<br/>*(Limit: 10 min)* | [ ] Done<br/>[ ] Done with help<br/>[ ] Not done<br/>*Time:* ______ min | | | |
| *2. Record drying*<br/>*(Limit: 8 min)* | [ ] Done<br/>[ ] Done with help<br/>[ ] Not done<br/>*Time:* ______ min | | | |
| *3. Enter pH + duplicate*<br/>*(Limit: 12 min)* | [ ] Done<br/>[ ] Done with help<br/>[ ] Not done<br/>*Time:* ______ min | | | |
| *4. Submit for review*<br/>*(Limit: 8 min)* | [ ] Done<br/>[ ] Done with help<br/>[ ] Not done<br/>*Time:* ______ min | | | |
| *5. Find answer in Help*<br/>*(Limit: 6 min)* | [ ] Done<br/>[ ] Done with help<br/>[ ] Not done<br/>*Time:* ______ min | | | |

---

## 4. Five Closing Questions (Last 10 Minutes)

Ask these five everyday questions right after Task 5 and write down the exact words they use:

1. *"Which word confused you most?"*
2. *"At which step did you feel unsure about what to click next?"*
3. *"Did anything look finished when there was still another button left to click?"*
4. *"When you looked at the printed page or clicked **Help**, how easy was it to find the step you needed?"*
5. *"If you had to use this tomorrow at your real desk or bench, what is the one thing you would change first?"*

---

## 5. After the Test: Turning Your Notes into Fixes (15 Minutes)

Sit down for 15 minutes right after the session while everything is fresh. Turn every hesitation, unfamiliar word, or wrong click into *one line per problem* using three columns: the page, what confused them, and your suggested change.

| Page | What Confused Them | Suggested Change |
| :--- | :--- | :--- |
| *Example: `bench/record-and-submit-for-review.md`* | *Technician stopped after **Recorded** and thought the manager already had the sample.* | *Add a short reminder at the top of the page that **Ready to Submit** is a separate second step.* |
| *Example: `preparation/record-drying.md`* | *Technician looked for the save button before ticking all three checklist boxes.* | *Move the note about ticking all three boxes before **Confirm work is done** appears up into Step 4.* |
| *1.* | | |
| *2.* | | |
| *3.* | | |
| *4.* | | |
| *5.* | | |

Update the manual pages or bench cards for any wording fixes before running [Three-Session Lab Training Plan](./training-plan.md) with the rest of your staff, and pass any screen-label notes to the software team.

---

## Related Guides

- [Pilot Launch Kit](./index.md)
- [Three-Session Lab Training Plan](./training-plan.md)
- [Hands-On Practice Exercises & Answer Key](./practice-exercises.md)
- [One-Page Pilot Feedback Form](./pilot-feedback-form.md)

---

### For the QA Person

- *Keep practice clicks separate from live work:* Run this test inside a training copy of the server or a dedicated practice project so test samples never mix with live client reports.
