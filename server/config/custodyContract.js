const TYPES = Object.freeze(['RECEIVED', 'MOVED', 'ISSUED', 'RETURNED', 'SENT_OUT', 'DISPOSED']);
const LOCATION_PURPOSES = Object.freeze(['REAGENT', 'SAMPLE']);
const RECEIPT_FIELDS = Object.freeze(['custodyHandoverAt', 'custodyCarrierName', 'custodyTrackingNumber',
    'custodySenderSignature', 'receivingOfficerId', 'receivingOfficerName', 'receivingOfficerSignature']);
module.exports = { TYPES, LOCATION_PURPOSES, RECEIPT_FIELDS };
