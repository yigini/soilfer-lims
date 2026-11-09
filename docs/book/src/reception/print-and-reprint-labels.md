# Print and Reprint Barcode Labels

## What This Is For

Print barcode stickers when you accept a sample at **Sample Reception**, print a replacement sticker if a label gets smudged or torn, or print a container sticker when you split a sample into sub-containers.

> *Screenshot placeholder — docs/book/src/img/screenshots/label-print-dialog.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Print labels** dialog showing **Format** (**Standard (101 × 54 mm)** and **Compact (50 × 25 mm)**), **Copies per label**, **Reason for reprint**, and the barcode preview.*

---

## Before You Start

- Sign in with an account that can print labels (**Sample Reception**, **Laboratory Technician**, or **Laboratory Manager**).
- Make sure the sample has already been accepted so it has a **Permanent Lab ID** (status **Received** or **Accepted**, not **Expected** or **Draft**).
- Check that your label printer is loaded with either **Standard (101 × 54 mm)** or **Compact (50 × 25 mm)** sticker stock.

---

## Steps

### Part 1: Print Labels Right After Accepting a Sample

1. When you click **Accept & Print Label** in **Sample Reception** (or click **Print Tag** on the **INTAKE CONFIRMED!** screen), the **Print labels** window opens automatically.
2. Under **Format**, choose the sticker size loaded in your printer:
   - **Standard (101 × 54 mm)** for main sample bags and drying trays.
   - **Compact (50 × 25 mm)** for smaller jars, tubes, or archive vials.
3. In **Copies per label**, enter how many stickers you need for this sample (for example, 1 for the bag and 1 for the drying tray).
4. Click **Print labels**.
   *You should see your browser's print window open with the formatted barcode label ready to send to the printer.*

### Part 2: Reprint a Damaged or Lost Sample Label Later

1. Click **Samples** in the left menu and open the sample that needs a new sticker.
2. Click **Print label** at the top right of the sample page.
   *You should see the **Print labels** window open with a **Reason for reprint** box.*
3. Select the **Format** and **Copies per label**.
4. In **Reason for reprint**, type why you are printing another sticker (for example, that the original bag label was scuffed during oven drying).
5. Click **Print labels**.

### Part 3: Print a Label for a Sub-Container or Aliquot

1. Open the sample in **Samples** and stay on the **Work & results** tab.
2. In the **Containers and aliquots** card, find the container row (**Bulk**, **Fine earth**, **Ground**, **Aliquot**, or **Archive**) and click **Print container label**.
3. Choose **Format** and **Copies per label**, then click **Print container label**.

---

## What Happens Next

Stick the printed label firmly onto the dry side of the bag, tray, or jar, and scan it once with your handheld scanner (if you use one) to verify it reads cleanly.

---

## If Something Goes Wrong

- *If you see* **Receive the sample and issue its laboratory code before printing.** *→* The sample is still in **Expected** or **Draft** status. Complete its check-in in **Sample Reception** first so the system issues its **Permanent Lab ID**.
- *If you see* **Enter a reason for the reprint.** *→* Because this sample already had its initial label printed, you must type a short explanation in **Reason for reprint** before the **Print labels** button will proceed.
- *If you see* **This code does not fit this label at a readable bar width. Choose the standard format or ask the laboratory manager to review the issued code.** *→* Switch **Format** from **Compact (50 × 25 mm)** to **Standard (101 × 54 mm)** so the barcode bars are wide enough for bench scanners to read reliably.

---

## For the QA Person

- The system records every initial print and reprint event in the audit log before opening the browser print dialog, capturing who printed the label, how many copies were requested, which format was used, and (for reprints) the **Reason for reprint**.
- Barcode density is checked automatically before printing so a long laboratory code is never squeezed onto a **Compact (50 × 25 mm)** label at a bar width that a scanner could misread.
