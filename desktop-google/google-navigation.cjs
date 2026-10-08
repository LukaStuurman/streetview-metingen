"use strict";

/**
 * Google Maps in Electron needs to be able to redirect to Google's consent
 * domain for an actual user choice (accept/reject), then back to Maps.
 * Match exact hostnames, NEVER look for merely 'google' substrings.
 */
const mapsHosts = new Set(["www.google.com", "www.google.nl", "google.com", "google.nl"]);
const consentHosts = new Set(["consent.google.com", "consent.google.nl"]);

function parseHttpsUrl(address) {
  try {
    const u = new URL(address);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

function isGoogleConsentUrl(address) {
  const u = parseHttpsUrl(address);
  if (!u) return false;
  return consentHosts.has(u.hostname) ||
    (mapsHosts.has(u.hostname) && /^\/consent(?:\/|$)/.test(u.pathname));
}

function isAllowedGoogleNavigation(address) {
  const u = parseHttpsUrl(address);
  if (!u) return false;
  if (isGoogleConsentUrl(address)) return true;
  // Google Maps sometimes follows www.google.com -> google.com.
  return mapsHosts.has(u.hostname) && /^\/maps(?:\/|$)/.test(u.pathname);
}

function isGoogleStorageOrigin(address) {
  const u = parseHttpsUrl(address);
  return !!u && (
    consentHosts.has(u.hostname) ||
    mapsHosts.has(u.hostname) ||
    u.hostname === "accounts.google.com" || u.hostname === "accounts.google.nl"
  );
}

module.exports = {
  isGoogleConsentUrl, isAllowedGoogleNavigation, isGoogleStorageOrigin
};
