# Prepare Several Samples at Once & Create Containers

## What This Is For

Confirm **Air Drying** or **Sample Preparation** for a whole tray of samples at once in **Workbench**. You can also register labelled child containers (**Fine earth**, **Ground**, **Aliquot**, or **Archive**) when splitting a sample into jars or packets.

> *Screenshot placeholder — docs/book/src/img/screenshots/preparation-batch-and-containers.png (pending local training seed on [#370](https://github.com/yigini/soilfer-lims/issues/370)): The **Workbench** table footer showing **Confirm Sample Preparation Complete** for multiple selected rows, and the **Containers and aliquots** panel on a sample page.*

---

## Before You Start

- Sign in with a **Laboratory Technician** or **Laboratory Manager** account on the **Sign in to SoilFER LIMS** screen.
- For batch confirmation, make sure all samples on your tray have completed the same preparation step.
- For container creation, make sure your account has permission to manage containers and print labels.

---

## Steps

### Part 1: Confirm Drying or Preparation for Several Samples at Once

1. Click **Workbench** in the left menu and choose **Air Drying** or **Sample Preparation** in the **Work type:** selector.
2. Make sure you are in **Table View** (if you are in single-card mode, click **Table View** at the top right).
3. For each sample on your tray, tick its three **Operational Checklist** boxes. Fill in any required **Drying**, **Sieving**, **Grinding**, or **Splitting** fields on its row.
4. Tick the selection checkbox on the far left of each completed sample row. You can also tick the top-left header checkbox to select all visible rows.
   *You should see the footer at the bottom of the table show how many rows are selected.*
5. Click **Confirm Air Drying Complete** or **Confirm Sample Preparation Complete** at the bottom right of the table.
   *You should see every selected sample row update to **Checklist Verified** and **Recorded**.*

### Part 2: Register Sub-Containers and Aliquots for a Sample

1. Click **Samples** in the left menu and open the sample you just prepared.
2. Stay on the **Work & results** tab and look at the **Containers and aliquots** card at the top.
   *You should see the sample's root container (**Bulk**) listed.*
3. To register a new jar, packet, or weighed portion taken from that sample:
   - Under **Kind**, choose **Fine earth** (sieved under 2 mm), **Ground** (finely milled), **Aliquot** (weighed test portion), or **Archive** (retained jar).
   - Under **Parent container**, select the container the soil was taken from (such as the **Root bulk container** or **Fine earth** container).
   - Under **Mass (g, optional)**, enter the mass of soil placed in the new container.
4. Click **Create container**.
   *You should see the new child container appear in the **Containers and aliquots** tree with status **Active**.*
5. Click **Print container label** next to the new container to print a barcode sticker for that jar or packet.

---

## What Happens Next

When technicians later record wet-chemistry readings in **Workbench**, they can select the specific **Aliquot** container they weighed from. This links the analytical result directly to that physical sub-container.

---

## If Something Goes Wrong

- *If you see* **Choose the parent container this material came from.** *→* Every **Fine earth**, **Ground**, **Aliquot**, or **Archive** container must be linked to an **Active** parent under **Parent container**. Only a **Bulk** container can use **Root bulk container**.
- *If one row in a batch confirmation fails while others succeed →* Check the message on that row. If your laboratory's **Policies** require structured weights or temperatures, fill in the missing numbers and click **Confirm Complete**.

---

## For the QA Person

- The **Containers and aliquots** tree tracks parent-to-child lineage from the original **Bulk** bag through **Fine earth**, **Ground**, **Aliquot**, and **Archive** containers. It also displays which analytical attempt (**Linked to attempt**) used each aliquot.
- Even when you confirm several rows at once in **Table View**, the server validates and records an individual receipt for each sample.
