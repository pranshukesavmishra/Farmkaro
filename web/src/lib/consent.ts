/**
 * The land-record consent attestation, in one place.
 *
 * DPDP discipline: the statement the server records must be provably the one
 * the person was shown. Both lookup surfaces render THIS string beside their
 * consent checkbox, and the API records THIS string — there is no second copy
 * to drift.
 */
export const LAND_RECORD_CONSENT_STATEMENT =
  "I confirm this land is mine (or I am authorised to act for the owner) and I " +
  "consent to FarmKaro retrieving its land record for this listing.";
