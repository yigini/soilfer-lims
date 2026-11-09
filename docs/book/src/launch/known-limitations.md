# Known Limitations for the Pilot

> *Time:* 5 minutes to read before day one.
> *Who can do this:* Laboratory Managers, QA Officers, Bench Technicians, and Reception Clerks.

Every software pilot has a few sharp edges that are good to know in advance. Share this short list with your team before live testing begins. Nobody will waste time guessing why a button is disabled.

---

## 1. Blank and Control Slots Expect Numeric Readings

- *What happens:* In **Workbench**, batch **Blank** and **Control** positions compare numeric measurements against your method's **Maximum blank value** and recovery windows. Typing letters such as *ND* or *nil* into a numeric blank field will not pass numeric validation.
- *What to do instead:* Enter the actual numeric reading from your instrument, such as 0 or 0.02. If a sample reading falls below your method's detection or quantification limit, SoilFER LIMS automatically applies your **Values between detection and quantification limits** policy (**Report below quantification limit** or **Report value with a flag**).

---

## 2. Expected Samples from KoboToolbox Cannot Skip Reception

- *What happens:* Samples synchronized from **KoboToolbox Integration** or uploaded from an Excel manifest appear in **Sample Reception** with status **Expected** (**Not received yet**). Technicians will not see them in **My Work** or **Workbench**.
- *What to do instead:* A **Sample Reception Officer** must physically inspect the soil bag when the box arrives at the counter. Once they click **Accept Sample** in **Sample Reception**, drying and preparation can begin.

---

## 3. Bench Tests Stay Locked Until Drying & Preparation Are Confirmed

- *What happens:* When a sample is first accepted at reception (**Accepted**), its chemical and spectral test rows are locked. They cannot be submitted in **Workbench** until required drying and preparation steps are completed.
- *What to do instead:* Complete the drying checklist and click **Confirm Complete**, then record the sieving or grinding step. The sample then moves to **Processing** and all assigned bench tests unlock automatically.

---

## 4. Reference Material Lots Must Have Assigned Values Before Use

- *What happens:* A technician selects a **Laboratory reference material (LRM)** or **Certified reference material (CRM)** lot on a batch control slot. If that lot has no **Assigned value** entered for the batch's analyte and method, the screen shows **No reference value exists for this analyte and method.**
- *What to do instead:* Ask the **Laboratory Manager** or administrator to open **Admin Panel** → **Quality** (**Reference materials**). They can select the lot, click **Add assigned value**, and save the reference value and unit for that analyte.

---

## 5. Invitations Use Direct One-Time Links (Not Automatic Emails)

- *What happens:* When an administrator clicks **Invite Team Member** in **Laboratory Staff**, SoilFER LIMS generates a **One-Time Activation Link** on screen (**Manual Link Generated**). It does not send an automated external email.
- *What to do instead:* Click **Copy Activation Link** and send the link directly to the staff member over your laboratory's email or messaging channel within 24 hours.

---

## 6. Offline Entry Saves Text and Numbers Only (Wait to Upload Large Files)

- *What happens:* If your laboratory internet drops briefly while you are typing readings in **Workbench**, your numeric readings and notes stay saved in your browser. However, large spectrometer uploads (**Batch Upload OPUS/CSV**) and PDF report generation (**Certificate of Analysis**) require an active server connection.
- *What to do instead:* Keep typing your bench numbers normally if the connection flickers. Wait until the connection badge is back online before uploading spectral files or issuing PDF reports.

---

## Related Guides

- [Day-One & Week-One Parallel-Run Guide](./day-one-guide.md)
- [One-Page Pilot Feedback Form](./pilot-feedback-form.md)
- [Common Problems & Solutions](../troubleshooting/common-issues.md)

---

### For the QA Person

- *Intentional safeguards vs. bugs:* Items 2, 3, and 4 above are intentional quality safeguards. Unreceived bags, un-sieved soil, or uncertified reference lots cannot accidentally slip into an approved client report.
