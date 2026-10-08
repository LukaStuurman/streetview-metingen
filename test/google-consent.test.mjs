import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  isGoogleConsentUrl, isAllowedGoogleNavigation, isGoogleStorageOrigin
} = require("../desktop-google/google-navigation.cjs");

test("Google cookie consent page can open, save choice, then return to Maps", () => {
  const flow = [
    "https://www.google.com/maps",
    "https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps&gl=NL",
    "https://consent.google.com/save?x=1",
    "https://www.google.com/maps/@51.4416,5.4697,3a,75y,100h"
  ];
  for(const url of flow) assert.equal(isAllowedGoogleNavigation(url), true, url);
  assert.equal(isGoogleConsentUrl(flow[1]), true);
  assert.equal(isGoogleConsentUrl(flow[2]), true);
  assert.equal(isGoogleConsentUrl(flow[0]), false);
});

test("support Dutch and Google-owned consent routes and storage permissions", () => {
  assert.equal(isAllowedGoogleNavigation("https://consent.google.nl/m?hl=nl"), true);
  assert.equal(isAllowedGoogleNavigation("https://www.google.nl/maps"), true);
  assert.equal(isAllowedGoogleNavigation("https://google.com/maps?hl=nl"), true);
  assert.equal(isGoogleConsentUrl("https://www.google.com/consent?continue=maps"), true);
  assert.equal(isGoogleStorageOrigin("https://accounts.google.com/"), true);
  assert.equal(isGoogleStorageOrigin("https://consent.google.com/m"), true);
  assert.equal(isGoogleStorageOrigin("https://www.google.com/maps"), true);
  assert.equal(isGoogleStorageOrigin("https://www.example.org"), false);
});

test("never allow lookalike domains, unsafe schemes or external user URLs", () => {
  const bad = [
    "http://consent.google.com/m",
    "https://consent.google.com.attacker.tld/m",
    "https://evil-google.com/maps",
    "javascript:alert(1)",
    "https://www.google.com.evil.tld/maps",
    "https://www.google.com@evil.tld/maps",
    "https://evil.tld@www.google.com/maps",
    "file:///C:/Windows/System32",
    "https://www.google.com/search?q=cookies",
    "https://accounts.google.com/signin",
    "https://www.google.com/maps-evil",
    "http://www.google.com/maps",
    "not-an-url"
  ];
  for (const url of bad) {
    assert.equal(isAllowedGoogleNavigation(url), false, url);
    assert.equal(isGoogleConsentUrl(url), false, url);
  }
});
