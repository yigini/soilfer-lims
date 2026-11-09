# Receive a Whole Box or Consignment

## What This Is For

Check in a shipping box, crate, or cooler containing many pre-registered soil bags from the same project in one session. You enter shared delivery and condition details once instead of typing them for each bag.

> *Screenshot placeholder — docs/book/src/img/screenshots/reception-consignment-batch.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Consignment Batch** screen showing **Scan or Enter Sample ID to add...**, **Shared batch observations**, and the batch sample table.*

---

## Before You Start

- Sign in with a **Sample Reception** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- Open the shipping box and count the physical soil bags inside.
- Locate the paper chain-of-custody sheet if one was packed with the box.
- Click **Sample Reception** in the left menu.

---

## Steps

1. On the **Sample Reception & Intake** screen, click **Consignment Batch**.
   *You should see the batch check-in workspace with a scan bar at the top.*
2. Click **Scan or Enter Sample ID to add...** and scan (or type) the barcode on each soil bag.
   *You should see each matched **Expected** sample appear as a row in the batch table.*
3. Compare the number of bags in your box against the manifest count shown on screen (**Declared count**).
4. In **Shared batch observations**, enter the courier name in **Delivered By**.
5. Type any notes that apply to the whole box in **Intake Notes / Visual Observations**.
6. If all bags share the same weight and moisture, enter **Mass to apply (g)** and **Moisture to apply**. Then click **Apply entered mass and moisture to all rows**.
   *You can still edit the weight or condition on any individual row that differs from the rest.*
7. If one bag is underweight but still acceptable, review its **Mass deficit** warning. Then tick **Acknowledge this sample’s mass warning** on that row.
8. If one bag arrived torn or leaking, remove it from the batch and record a non-conformance. See [Sample Arrived Damaged, Leaking, or Too Small](damaged-or-small-sample.md).
9. Click **Complete Intake** (or **Accept & Print Label**) to accept the consignment batch.
   *You should see every accepted sample receive its **Permanent Lab ID**, move to **Accepted**, and open **Print labels**.*

---

## What Happens Next

All accepted samples in the box move to **Accepted** (**Waiting for drying**) and appear in the preparation queue. Print the barcode labels for the box and place the labelled bags on your drying trays.

---

## If Something Goes Wrong

- *If one bag in the box shows* **Sample not found in manifest** *→* Set that bag aside and complete intake for the matched bags first. Then follow [Unknown or Duplicate Sample ID & Missing Location](unknown-or-duplicate-id.md) for the unmatched bag.
- *If the* **Complete Intake** *button stays disabled →* Check whether any row has an unacknowledged **Mass deficit** warning or a missing required field.
- *If the box contains more or fewer bags than the paper manifest lists →* Record the bags physically present on your desk. Note the missing or extra bag codes in **Intake Notes / Visual Observations** so the project coordinator can follow up.

---

## For the QA Person

- Batch intake validates every sample row individually against your laboratory's **Policies** and method mass rules before committing the batch.
- Shared batch notes and individual row overrides are stored on each sample's permanent intake record with the receiving officer's username and timestamp.
