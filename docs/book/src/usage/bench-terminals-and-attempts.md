# Technician: Shared Bench Terminals, Attempts & Repeats

## What This Is For

Work safely on a shared computer at the laboratory bench without mixing up two technicians' names or losing unsaved drafts. This page also explains how SoilFER LIMS tracks **Attempts**, typing corrections, and repeated tests.

| What do you need to do? | Open this section or page |
|---|---|
| Lock or unlock a shared bench screen, switch analysts, or handle a returned sample | [Use Shared Bench Mode and Fix Returned or Repeated Work](../bench/shared-bench-and-returned-work.md) |
| Request an out-of-range override or a dilution repeat at the bench | [Enter Results, Replicates, and Raw Calculations](../bench/enter-results-and-replicates.md) |
| Review failed quality control runs or order repeats as a manager | [Quality Control, Control Charts & Failed QC](qc-management.md) |

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-mode-and-attempts.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Technician Workbench** top bar showing **Turn on bench mode**, **Switch analyst**, **Workbench density** (**Standard** / **Bench**), and the **Enter your PIN to unlock** overlay.*

---

## Before You Start

- Sign in with your own **Laboratory Technician** account on the **Sign in to SoilFER LIMS** screen. Never type results while signed in under a colleague's name.
- Set your personal 4 to 8 digit bench **PIN** when prompted (**Set a 4 to 8 digit bench PIN. Confirm with your password.**).

---

## Steps

### Working on a Shared Bench Computer

1. In **Workbench**, click **Bench** next to **Workbench density** if you are wearing gloves or using a touch screen.
   *Buttons and input boxes expand so they are easy to tap accurately.*
2. Make sure bench mode is active (**Turn on bench mode**).
   *If you step away from the computer, the screen locks automatically and shows **Locked for** your name with **Enter your PIN to unlock**.*
3. When you return to the bench, type your **PIN** and click **Unlock** to continue on the exact cell you were editing.
4. When a colleague needs to use the same computer, click **Switch analyst** in the top bar.
   *The system saves your drafts to the server first, clears your local session, and opens the sign-in screen for the next person.*

### How Attempts, Corrections, and Repeats Work

1. Every test ordered on a sample has one task row. Each time you measure that test, the system saves a numbered attempt under **Attempts** (such as **Attempt #1** or *Attempt #2*).
2. Earlier attempts are never erased when a test is repeated:
   - If you made a pure typing mistake from your paper notebook before review, use a transcription correction (**Use a transcription correction for a typo.**). The corrected number is saved with a reason while keeping the old number in the audit log.
   - If an extract was spilled, an instrument drifted, or a reading was **Above calibration range**, record a repeat (**Preparation error**, **Instrument fault**, or **Above range: dilution required**). The earlier attempt is marked **Invalidated** and a new attempt opens.
   - If a reviewer asks for a second check (**Review outlier**, **Duplicate disagreement**, or **Confirmation**), the earlier attempt is marked **Questioned** while you record the new attempt.

---

## What Happens Next

When a test has more than one attempt under **Attempts**, the reviewer sees all attempts side by side on the sample's **Review** tab. They then select which value will appear on the Certificate of Analysis.

---

## If Something Goes Wrong

- *If you click* **Switch analyst** *and see a warning that changes are not sent yet →* Do not close the browser tab. Reconnect the network cable or Wi-Fi and try again so your unsent drafts sync safely to the server first.
- *If you see* **Too many wrong PINs. Try again in a few minutes.** *→* Wait a few minutes before entering your **PIN** again, or sign in with your full account **Password**.
- *If you see* **This laboratory’s configured attempt limit has been reached.** *→* Your laboratory limits how many times the same test can be repeated without an investigation. Ask your **Laboratory Manager** to review the issue in **QA Dashboard**.

---

## For the QA Person

- Bench mode (**Turn on bench mode**) protects data integrity on shared terminals in two ways: an automatic idle screen lock that blocks stray keystrokes or barcode scans while the analyst is away, and an optional **Enter your PIN to record** check whenever results are committed.
- Separating the test order from numbered **Attempts** (**Open**, **Recorded**, **Submitted**, **Accepted**, **Questioned**, **Invalidated**, **Superseded**) ensures complete ISO/IEC 17025 auditability across every repeat, dilution, and manager review decision.
