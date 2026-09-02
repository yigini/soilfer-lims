const prisma = require('../prisma');
const fs = require('fs');
const path = require('path');

async function backfillSpectralProvenance() {
    console.log('[BACKFILL] Starting spectral provenance backfill (Volume XI: backfill where known, mark UNVERIFIED, never guess)...');

    const scans = await prisma.spectralData.findMany();
    console.log(`[BACKFILL] Found ${scans.length} spectral records to evaluate.`);

    let updatedCount = 0;
    let unverifiedCount = 0;
    let axisFixedCount = 0;

    for (const scan of scans) {
        let needsUpdate = false;
        const updates = {};

        // 1. Evaluate Axis Direction
        let computedDirection = scan.axisDirection;
        if (scan.wavelengths) {
            try {
                const w = JSON.parse(scan.wavelengths);
                if (Array.isArray(w) && w.length >= 2) {
                    if (w[0] > w[w.length - 1]) {
                        computedDirection = 'DESCENDING';
                    } else if (w[0] < w[w.length - 1]) {
                        computedDirection = 'ASCENDING';
                    } else {
                        computedDirection = 'UNORDERED';
                    }
                }
            } catch (e) {}
        }

        if (computedDirection && computedDirection !== scan.axisDirection) {
            updates.axisDirection = computedDirection;
            needsUpdate = true;
            axisFixedCount++;
        }

        // 2. Evaluate Quantity
        // Check if raw source file or explicit metadata asserted the quantity
        let verifiedQuantity = scan.quantity;
        let hasAssertion = false;

        // Check metadata
        if (scan.metadata) {
            try {
                const meta = JSON.parse(scan.metadata);
                if (meta.quantity && meta.quantity !== 'UNVERIFIED') {
                    verifiedQuantity = meta.quantity;
                    hasAssertion = true;
                }
            } catch (e) {}
        }

        // Check source file header for ##YUNITS= or explicit unit
        if (!hasAssertion && scan.sourceFile) {
            try {
                const fullPath = path.isAbsolute(scan.sourceFile)
                    ? scan.sourceFile
                    : path.join(__dirname, '..', scan.sourceFile);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const yunitMatch = content.match(/##YUNITS=\s*([^\r\n]+)/i);
                    if (yunitMatch) {
                        const rawUnit = yunitMatch[1].trim().toUpperCase();
                        if (rawUnit.includes('ABSORB') || rawUnit.includes('AU')) {
                            verifiedQuantity = 'ABSORBANCE';
                            hasAssertion = true;
                        } else if (rawUnit.includes('REFLECT')) {
                            verifiedQuantity = 'REFLECTANCE';
                            hasAssertion = true;
                        } else if (rawUnit.includes('TRANSMIT')) {
                            verifiedQuantity = 'TRANSMITTANCE';
                            hasAssertion = true;
                        }
                    }
                }
            } catch (e) {}
        }

        // If not asserted anywhere, Volume XI rule: mark UNVERIFIED, never guess
        if (!hasAssertion) {
            verifiedQuantity = 'UNVERIFIED';
        }

        if (verifiedQuantity !== scan.quantity) {
            updates.quantity = verifiedQuantity;
            needsUpdate = true;
            if (verifiedQuantity === 'UNVERIFIED') unverifiedCount++;
        }

        if (needsUpdate) {
            await prisma.spectralData.update({
                where: { id: scan.id },
                data: updates
            });
            updatedCount++;
        }
    }

    console.log(`[BACKFILL] Completed: ${updatedCount} records updated (${unverifiedCount} marked UNVERIFIED, ${axisFixedCount} axisDirections aligned).`);
}

backfillSpectralProvenance()
    .catch(err => {
        console.error('[BACKFILL] Error during spectral backfill:', err);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });
