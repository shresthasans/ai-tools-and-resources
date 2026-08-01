// Parses README.md into docs/data.js (static JSON embedded as JS for file:// compatibility).
const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', 'README.md');
const raw = fs.readFileSync(readmePath, 'utf8');
const lines = raw.split('\n');

const categories = [];
let currentCategory = null;
let currentEntry = null;

const entryRe = /^-\s+\*\*\[(.+?)\]\((.+?)\)\*\*\s*$/;
const catRe = /^##\s+(.+)$/;

for (const line of lines) {
  const catMatch = line.match(catRe);
  if (catMatch) {
    currentCategory = catMatch[1].trim();
    if (!categories.find(c => c.name === currentCategory)) {
      categories.push({ name: currentCategory, entries: [] });
    }
    currentEntry = null;
    continue;
  }
  const entryMatch = line.match(entryRe);
  if (entryMatch && currentCategory) {
    currentEntry = { name: entryMatch[1].trim(), url: entryMatch[2].trim(), desc: '' };
    categories.find(c => c.name === currentCategory).entries.push(currentEntry);
    continue;
  }
  if (currentEntry && line.trim() && !line.trim().startsWith('---') && !line.trim().startsWith('_Add more')) {
    currentEntry.desc = (currentEntry.desc ? currentEntry.desc + ' ' : '') + line.trim();
  }
}

// --- Heuristic tagging ---
function tagEntry(entry, categoryName) {
  const tags = new Set();
  const text = `${entry.name} ${entry.desc}`.toLowerCase();
  const url = entry.url.toLowerCase();

  if (url.includes('github.com')) {
    tags.add('Free');
    tags.add('Open Source');
  }
  if (/\bfree\b/.test(text)) tags.add('Free');
  if (/open[\s-]?source/.test(text)) tags.add('Open Source');
  if (/self-?host/.test(text)) tags.add('Self-Hosted');

  if (/\bios\b|\biphone\b|\bipad\b|\bandroid\b|mobile app|flutter/.test(text)) tags.add('Mobile');
  if (/\bmacos\b|\bmac\b|apple silicon|xcode|swiftui|homebrew/.test(text)) tags.add('Mac');
  if (/\bwindows\b|\.exe\b|uefi/.test(text)) tags.add('Windows');
  if (/\blinux\b/.test(text)) tags.add('Linux');
  if (/electron|desktop app|tauri|native desktop|cross-platform desktop/.test(text)) tags.add('Desktop');
  if (/browser-based|web-based|web app|no download|runs? (entirely )?in (the )?browser|chrome extension|webassembly|webgpu/.test(text)) tags.add('Web');
  if (/\bcli\b|command[\s-]?line|terminal/.test(text)) tags.add('CLI');

  if (/claude code|claude-code/.test(text)) tags.add('Claude Code');
  if (/\bskill\b|skills\b/.test(text)) tags.add('Skill');
  if (/\bmcp\b|model context protocol/.test(text)) tags.add('MCP');
  if (/\bagent\b|agents\b/.test(text)) tags.add('Agent');
  if (/course|training|curriculum|lesson|tutorial|learn\b/.test(text)) tags.add('Learning');

  if (tags.size === 0) tags.add('Other');
  return Array.from(tags).sort();
}

for (const cat of categories) {
  for (const entry of cat.entries) {
    entry.tags = tagEntry(entry, cat.name);
  }
}

// --- Merge in hand/agent-authored plain-language details, if present ---
const detailsPath = path.join(__dirname, '..', 'docs', 'details.json');
const details = fs.existsSync(detailsPath) ? JSON.parse(fs.readFileSync(detailsPath, 'utf8')) : {};
let matched = 0;
for (const cat of categories) {
  for (const entry of cat.entries) {
    if (details[entry.name]) {
      entry.details = details[entry.name];
      matched++;
    }
  }
}
if (Object.keys(details).length > 0) {
  console.log(`Matched details for ${matched}/${Object.keys(details).length} entries.`);
}

const allTags = new Set();
categories.forEach(c => c.entries.forEach(e => e.tags.forEach(t => allTags.add(t))));

const output = {
  categories,
  allTags: Array.from(allTags).sort(),
  generatedNote: 'Tags are auto-generated heuristically from name/description/URL — may be imprecise.'
};

const outPath = path.join(__dirname, '..', 'docs', 'data.js');
fs.writeFileSync(outPath, `window.RESOURCE_DATA = ${JSON.stringify(output, null, 2)};\n`);

console.log(`Parsed ${categories.length} categories, ${categories.reduce((s,c)=>s+c.entries.length,0)} entries.`);
console.log(`Tags found: ${Array.from(allTags).sort().join(', ')}`);
