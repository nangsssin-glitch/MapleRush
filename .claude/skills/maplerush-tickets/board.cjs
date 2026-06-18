#!/usr/bin/env node
// MapleRush ticket board — scans tickets/*.md frontmatter and prints a Jira-like board.
// Usage: node .claude/skills/maplerush-tickets/board.cjs
// No dependencies. Source of truth is the ticket files; nothing is written.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // repo root (.claude/skills/maplerush-tickets -> root)
const DIR = path.join(ROOT, 'tickets');

if (!fs.existsSync(DIR)) {
  console.error(`No tickets/ directory at ${DIR}`);
  process.exit(1);
}

const ORDER = ['in-progress', 'review', 'todo', 'backlog', 'done'];

function parseFront(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*-\s+/.test(line) && key) { // list item
      fm[key] = fm[key] || [];
      fm[key].push(line.replace(/^\s*-\s+/, '').trim());
      continue;
    }
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      let val = kv[2].trim();
      if (val === '[]') { fm[key] = []; }
      else if (val === '') { fm[key] = []; } // start of a block list
      else { fm[key] = val.replace(/^["']|["']$/g, ''); }
    }
  }
  return fm;
}

const tickets = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
  const fm = parseFront(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (fm) { fm._file = f; tickets.push(fm); }
}

const byId = {};
for (const t of tickets) byId[t.id] = t;
const isDone = (id) => byId[id] && byId[id].status === 'done';
const blocked = (t) => (Array.isArray(t.depends_on) ? t.depends_on : []).filter((d) => !isDone(d));

const groups = {};
for (const t of tickets) (groups[t.status] = groups[t.status] || []).push(t);

console.log(`\n  MapleRush board — ${tickets.length} tickets  (${DIR})\n`);
for (const status of ORDER) {
  const list = groups[status];
  if (!list || !list.length) continue;
  console.log(`  ── ${status.toUpperCase()} (${list.length}) ──`);
  for (const t of list.sort((a, b) => (a.id || '').localeCompare(b.id || ''))) {
    const owner = t.owner && t.owner !== 'unassigned' ? `@${t.owner}` : '·';
    const blk = blocked(t);
    const blkStr = blk.length ? `  ⛔blocked-by ${blk.join(',')}` : '';
    console.log(`     ${(t.id || '?').padEnd(7)} ${owner.padEnd(11)} ${t.title || t._file}${blkStr}`);
  }
  console.log('');
}
