# Use Shared Bench Mode and Fix Returned or Repeated Work

## What This Is For

Share a bench computer safely between several technicians using **Turn on bench mode** and **Switch analyst**. This page also shows how to handle tests that need to be repeated when a reviewer returns an item (**Repeat requested** / **Returned**).

> *Screenshot placeholder — docs/book/src/img/screenshots/bench-shared-terminal-and-repeats.png (screenshot coming once the training data is ready): The **Technician Workbench** showing **Turn on bench mode**, **Switch analyst**, the **Enter your PIN to unlock** prompt, and a returned item with **Previous** result hint.*

---

## Before You Start

- Sign in with your own **Laboratory Technician** account on the **Sign in to SoilFER LIMS** screen.
- Make sure you know your account **Password** so you can set up your 4 to 8 digit bench **PIN** on first use.

---

## Steps

### Part 1: Set Your Bench PIN and Use a Shared Bench Computer

1. In the top right of **Workbench**, check that bench mode is active (if you have policy permission, click **Turn on bench mode**).
2. The first time you lock or record in bench mode, you will see **Set a 4 to 8 digit bench PIN. Confirm with your password.**
   - Type your account **Password**, type a 4 to 8 digit numeric **PIN**, and submit.
3. Whenever the bench computer sits idle for a few minutes, a lock screen covers the worksheet. It shows **Locked for** your name and **Enter your PIN to unlock**.
   - Type your **PIN** and click **Unlock** to return to your exact cell with all drafts preserved.
4. When your shift ends or another technician needs the computer, click **Switch analyst** in the top bar (or on the lock screen).
   *The system saves your drafts to the server, clears your local browser session, and opens the sign-in screen for your colleague.*

### Part 2: Handle a Test Returned by the Reviewer (**Repeat requested**)

1. When a manager or reviewer returns a test for a repeat check, the item reappears in your **My Work** tab in **Workbench** with status **Repeat requested** (or **Returned**).
2. Open the item in the **Worksheet** tab (or **Card View**).
   *You should see a **Previous** result hint showing the earlier value (**rejected** or **recorded**) and the reviewer's **Review note**.*
3. Check the repeat reason recorded by the reviewer:
   - If the reason is **QC batch failure**, add the item to a **new** analytical run (**Use a new batch for this repeat; the previous QC failure is retained.**).
   - If the reason is **Preparation error**, prepare a fresh sub-container in **Containers and aliquots** first. Select that new container under **Physical aliquot (optional)**.
   - If the reason is **Above range: dilution required**, dilute the extract, select your calculation template or enter the **Recorded dilution factor**, and measure the diluted sample.
4. Enter the new measurement, click **Record all ready** (or **Record this sample**), and then submit it again on the **Ready to Submit** tab.
   *Your new reading is saved as the next numbered try under **Tries**, while the original try remains preserved in the audit history.*

---

## What Happens Next

Once you record and submit the repeat try, the sample returns to the reviewer's queue (**Review Submissions**). The reviewer can then inspect both tries and choose the final report number.

---

## If Something Goes Wrong

- *If you click* **Switch analyst** *while offline and see* **change(s) are not sent yet, so they stay on this device. Reconnect and try again.** *→* Keep the window open, restore your network connection until the top pill shows **✓ Drafts saved**, and then click **Switch analyst**.
- *If you type the wrong PIN and see* **The PIN is not correct.** *(or* **Too many wrong PINs. Try again in a few minutes.***) →* Wait a few minutes if locked out, or click **Switch analyst** and sign in again with your full password.
- *If you try to repeat an item inside the same failed batch and see* **Use a new batch for this repeat; the previous QC failure is retained.** *→* Open the **My runs** tab and start a new run (**Start run**) for the repeat measurement.
- *If you see* **Record every replicate from the previous attempt before submitting.** (enter all required repeat readings from the earlier try before sending) *→* Make sure you entered values for all required replicates (**Rep 1**, **Rep 2**) on the new try before submitting.

---

## For the QA Person

- When a work item is reassigned or handed over between technicians, any server draft saved by the first technician displays **by** that technician's name so authorship is always clear.
- Every repeat try records its trigger reason (**Review outlier**, **Duplicate disagreement**, **Confirmation**, **QC batch failure**, **Above range: dilution required**, **Instrument fault**, **Preparation error**, or **Other**) and preserves all earlier tries under **Tries**.
