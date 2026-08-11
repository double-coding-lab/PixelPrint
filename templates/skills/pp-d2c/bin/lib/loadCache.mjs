import fs from 'node:fs';
import path from 'node:path';

export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, 'pp-d2c.config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(projectRoot) {
  const p = path.join(projectRoot, 'pp-d2c.config.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadCache(projectRoot, cacheKey) {
  const nodesDir = path.join(projectRoot, '.d2c-cache', cacheKey, 'nodes');
  if (!fs.existsSync(nodesDir)) {
    return { error: `cache dir not found: ${nodesDir}`, nodes: {} };
  }
  const nodes = {};
  const files = fs.readdirSync(nodesDir).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(nodesDir, f), 'utf8');
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      continue;
    }
    collectNodes(json, nodes);
  }
  return { nodes };
}

function collectNodes(node, acc) {
  if (!node || typeof node !== 'object') return;
  if (node.id && node.type) acc[node.id] = node;
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectNodes(c, acc);
  }
  if (node.document) collectNodes(node.document, acc);
  if (node.node) collectNodes(node.node, acc);
  if (node.nodes && typeof node.nodes === 'object' && !Array.isArray(node.nodes)) {
    for (const k of Object.keys(node.nodes)) collectNodes(node.nodes[k], acc);
  }
}
