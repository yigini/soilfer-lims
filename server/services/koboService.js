/**
 * KoboToolbox API Service
 * Handles direct integration with Kobo forms for field sample data collection
 */
const axios = require('axios');

class KoboService {
    /**
     * Helper for resilient HTTP GET requests with exponential backoff retry.
     */
    async _requestWithRetry(url, options, maxRetries = 3) {
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                return await axios.get(url, { ...options, timeout: options.timeout || 30000 });
            } catch (err) {
                attempt++;
                const status = err.response?.status;
                const isTransient = !status || status >= 500 || status === 429;
                if (attempt >= maxRetries || !isTransient) {
                    throw err;
                }
                const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
                console.warn(`[KOBO] Transient error on attempt ${attempt}/${maxRetries}. Retrying in ${backoffMs}ms: ${err.message}`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
    }

    /**
     * Fetch submissions from a Kobo form with pagination and timeout
     * @param {string} serverUrl - Kobo server URL (e.g., https://kf.kobotoolbox.org)
     * @param {string} formId - Kobo asset UID
     * @param {string} apiToken - API token for authentication
     * @param {string} since - Optional: Only fetch submissions after this ID
     * @returns {Promise<Array>} Array of submissions
     */
    async fetchSubmissions(serverUrl, formId, apiToken, since = null) {
        try {
            const url = `${serverUrl}/api/v2/assets/${formId}/data.json`;
            const PAGE_SIZE = 1000;
            let start = 0;
            let allSubmissions = [];
            let hasMore = true;

            while (hasMore) {
                const params = {
                    limit: PAGE_SIZE,
                    start: start
                };
                if (since) {
                    params.query = JSON.stringify({ _id: { $gt: parseInt(since) } });
                }

                const response = await this._requestWithRetry(url, {
                    headers: { 'Authorization': `Token ${apiToken}` },
                    params,
                    timeout: 30000
                });

                const results = response.data.results || [];
                allSubmissions = allSubmissions.concat(results);

                if (results.length < PAGE_SIZE || !response.data.next) {
                    hasMore = false;
                } else {
                    start += PAGE_SIZE;
                }
            }

            console.log(`[KOBO] Total ${allSubmissions.length} submissions fetched from form ${formId}`);
            return allSubmissions;
        } catch (error) {
            console.error('[KOBO] Error fetching submissions:', error.response?.data || error.message);
            throw new Error(`Failed to fetch Kobo submissions: ${error.response?.data?.detail || error.message}`);
        }
    }

    /**
     * Test connection to Kobo API
     * @param {string} serverUrl - Kobo server URL
     * @param {string} formId - Kobo asset UID
     * @param {string} apiToken - API token
     * @returns {Promise<{success: boolean, formName?: string, submissionCount?: number, error?: string}>}
     */
    async testConnection(serverUrl, formId, apiToken) {
        try {
            const url = `${serverUrl}/api/v2/assets/${formId}/`;

            const response = await this._requestWithRetry(url, {
                headers: {
                    'Authorization': `Token ${apiToken}`
                },
                timeout: 15000
            });

            return {
                success: true,
                formName: response.data.name,
                submissionCount: response.data.deployment__submission_count || 0,
                formUrl: response.data.url
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.detail || error.message
            };
        }
    }

    /**
     * Get form field structure for mapping
     * @param {string} serverUrl - Kobo server URL
     * @param {string} formId - Kobo asset UID
     * @param {string} apiToken - API token
     * @returns {Promise<Array>} Array of field definitions
     */
    async getFormFields(serverUrl, formId, apiToken) {
        try {
            const url = `${serverUrl}/api/v2/assets/${formId}/`;

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Token ${apiToken}`
                }
            });

            const content = response.data.content || {};
            const survey = content.survey || [];

            const fields = survey
                .filter(item => item.type !== 'begin_group' && item.type !== 'end_group')
                .map(item => ({
                    name: item.name || item.$autoname,
                    type: item.type,
                    label: item.label?.[0] || item.name
                }));

            return fields;
        } catch (error) {
            console.error('[KOBO] Error getting form fields:', error.message);
            throw new Error(`Failed to get form fields: ${error.message}`);
        }
    }

    /**
     * Get nested value from object using path notation
     * e.g., "soilFER_collect/soil_description_sampling/Site_identification/site_id"
     */
    getNestedValue(obj, path) {
        if (!path) return undefined;

        // Try direct key first
        if (obj[path] !== undefined) return obj[path];

        // Try nested path with /
        const parts = path.split('/');
        let value = obj;
        for (const part of parts) {
            if (value === undefined || value === null) return undefined;
            value = value[part];
        }
        return value;
    }

    /**
     * Find value in submission by checking multiple possible field paths
     */
    findValue(submission, possiblePaths) {
        for (const path of possiblePaths) {
            // Check all keys that end with this path component
            for (const key of Object.keys(submission)) {
                if (key === path || key.endsWith('/' + path)) {
                    const val = submission[key];
                    if (val !== undefined && val !== null && val !== '') {
                        return val;
                    }
                }
            }
        }
        return undefined;
    }

    /**
     * Transform Kobo submission to LIMS sample format
     * Handles nested Kobo field paths automatically
     */
    transformSubmission(submission, fieldMapping, labId) {
        // Find values using flexible path matching
        const findField = (fieldNames) => {
            for (const name of fieldNames) {
                const value = this.findValue(submission, [name]);
                if (value !== undefined) return value;
            }
            return '';
        };

        // Extract key fields handling nested paths
        const siteId = findField(['site_id', 'codigo_sitio']) || '';
        const barcodeD1 = String(findField(['barcode_d1', 'codigo_barras_p1', 'barcode_d1_scan']) || '').trim();
        const barcodeD2 = String(findField(['barcode_d2', 'codigo_barras_p2', 'barcode_d2_scan']) || '').trim();
        const samplingSucceeded = String(findField(['sampling_succeeded', 'muestreo_exitoso']) || '').toLowerCase() === 'yes';
        const d1Text = String(findField(['d1_text', 'd1_texto']) || '').trim();
        const d2Text = String(findField(['d2_text', 'd2_texto']) || '').trim();

        // Get coordinates from _geolocation or geopoint field
        let lat = 0, lng = 0;
        if (submission._geolocation && Array.isArray(submission._geolocation)) {
            lat = submission._geolocation[0] || 0;
            lng = submission._geolocation[1] || 0;
        } else {
            const geopoint = findField(['geopoint', 'gps']);
            if (geopoint && typeof geopoint === 'string') {
                const parts = geopoint.split(' ');
                lat = parseFloat(parts[0]) || 0;
                lng = parseFloat(parts[1]) || 0;
            }
        }

        // Collection date
        const collectedAt = submission.today || submission.start || submission._submission_time || new Date().toISOString();

        // Validate sample ID
        const isValidSampleId = (id) => {
            if (!id || id.length < 3) return false;
            if (id.startsWith('http://') || id.startsWith('https://')) return false;
            if (id.includes('.org') || id.includes('.com') || id.includes('.net')) return false;
            // Skip numeric-only IDs like "1", "2" (test data)
            if (/^\d+$/.test(id) && id.length < 5) return false;
            return true;
        };

        // Determine sample IDs - use barcode if valid, otherwise fallback to site_id + suffix
        let sampleIdD1 = isValidSampleId(barcodeD1) ? barcodeD1 : null;
        let sampleIdD2 = isValidSampleId(barcodeD2) ? barcodeD2 : null;

        // Fallback to site_id if barcode not valid but sampling happened
        if (!sampleIdD1 && siteId && (d1Text || samplingSucceeded)) {
            sampleIdD1 = `${siteId}_D1`;
        }
        if (!sampleIdD2 && siteId && (d2Text || samplingSucceeded)) {
            sampleIdD2 = `${siteId}_D2`;
        }

        // Validate fallback IDs
        if (!isValidSampleId(sampleIdD1)) sampleIdD1 = null;
        if (!isValidSampleId(sampleIdD2)) sampleIdD2 = null;

        const samples = [];
        const baseData = {
            site_id: siteId,
            lat: lat,
            lng: lng,
            collected_at: collectedAt,
            kobo_submission_id: submission._id,
            kobo_uuid: submission._uuid,
            submission_time: submission._submission_time,
            labId: labId,
            attachments: submission._attachments || [],
            raw_data: submission  // Store ALL Kobo data
        };

        if (sampleIdD1) {
            samples.push({
                ...baseData,
                original_id: sampleIdD1,
                depth: 'D1'
            });
        }

        if (sampleIdD2) {
            samples.push({
                ...baseData,
                original_id: sampleIdD2,
                depth: 'D2'
            });
        }

        return samples;
    }
}

module.exports = new KoboService();
