#!/usr/bin/env node
// Initial Firefox build adapter for SaltApocalypse's existing Chrome dist output.
// Run from work/ via `npm run build:firefox`. This is a prototype, not proof of runtime compatibility.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const src = path.join(cwd, 'dist');
const dest = path.join(cwd, 'dist-firefox');
if (!fs.existsSync(path.join(src, 'manifest.json'))) {
  console.error('Missing dist/manifest.json; first run npm run build in work/');
  process.exit(2);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, {recursive:true});
const manifestFile = path.join(dest, 'manifest.json');
const m = JSON.parse(fs.readFileSync(manifestFile,'utf8'));

m.name = 'COR3 Helper Unified';
m.description = 'Firefox MV3 build of COR3 Helper Unified — safe auto-jobs, loadout optimizer, and market tracker.';
m.permissions = (m.permissions || []).filter(x => x !== 'sidePanel');
delete m.side_panel;
delete m.devtools_page; // optional Chrome-only panel, not required for popup usability
m.background = { scripts: ['console-logger.js', 'errors.js', 'background.js'] };
m.browser_specific_settings = {
  gecko: {
    id: 'cor3-helper-unified@lr7.local',
    data_collection_permissions: { required: ['none'] }
  }
};
delete m.version_name;
// This extension is only used on COR3 domains. Limit web-exposed injection scripts.
if (Array.isArray(m.web_accessible_resources)) {
  for (const r of m.web_accessible_resources) {
    r.matches = ['https://cor3.gg/*','https://os.cor3.gg/*'];
  }
}
fs.writeFileSync(manifestFile,JSON.stringify(m,null,2)+'\n');

// Chrome MV3 background service workers use importScripts in the bundled banner.
// Firefox MV3 background.scripts executes in a page context, where importScripts
// may be absent; the dependencies above load before background.js instead.
const bg = path.join(dest,'background.js');
if (!fs.existsSync(bg)) { console.error('Missing compiled background.js'); process.exit(1); }
let code = fs.readFileSync(bg, 'utf8');
const before = code;
code = code.replace(/^\s*importScripts\('console-logger\.js'\);\s*importScripts\('errors\.js'\);\s*/, '');
if (code === before) {
  console.warn('WARNING: did not recognize expected background importScripts banner. Inspect background.js manually.');
}
fs.writeFileSync(bg,code);
console.log('Created Firefox prototype:',dest);
console.log('IMPORTANT: build success does not mean browser runtime is verified.');
