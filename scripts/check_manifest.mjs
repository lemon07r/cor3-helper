#!/usr/bin/env node
// Run from work/: node ../scripts/check_manifest.mjs dist-firefox/manifest.json
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Expected path to built Firefox manifest.json');
  process.exit(2);
}
const root = path.dirname(path.resolve(file));
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const warnings = [];
const requiredFiles = new Set();
const add = (s) => { if (s) requiredFiles.add(s); };
if (m.manifest_version !== 3) errors.push('Manifest must be MV3');
if (!m.browser_specific_settings?.gecko?.id) errors.push('Firefox gecko ID missing');
if (!Array.isArray(m.background?.scripts) || m.background.scripts.length === 0) {
  errors.push('Firefox background.scripts missing; Chrome service_worker alone is insufficient for this target');
}
if (m.background?.service_worker) warnings.push('Firefox manifest still declares background.service_worker; verify supported behavior');
if (m.side_panel || m.permissions?.includes('sidePanel')) warnings.push('Chrome-only sidePanel present; must be feature-gated or removed for Firefox');
if (m.devtools_page) warnings.push('DevTools page present; verify Firefox support and resilience');
if (m.host_permissions?.some(s => s === '<all_urls>' || s === '*://*/*')) errors.push('Unrestricted host permission not allowed');
for (const s of m.background?.scripts || []) add(s);
for (const c of m.content_scripts || []) for (const s of c.js || []) add(s);
for (const res of m.web_accessible_resources || []) {
  for (const s of res.resources || []) {
    if (!s.includes('*')) add(s);
  }
}
for (const s of [m.action?.default_popup,m.action?.default_icon,m.options_page,m.sidebar_action?.default_panel,m.devtools_page]) add(s);
for (const s of Object.values(m.icons || {})) add(s);
for (const f of requiredFiles) {
  if (!fs.existsSync(path.join(root,f))) errors.push(`Referenced file missing: ${f}`);
}
console.log(`Manifest: ${file}`);
console.log(`Version: ${m.version}; referenced files checked: ${requiredFiles.size}`);
for (const w of warnings) console.warn('WARNING:',w);
for (const e of errors) console.error('ERROR:',e);
if (errors.length) process.exit(1);
console.log('PASS: static Firefox manifest checks');
