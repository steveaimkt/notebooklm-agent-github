/**
 * NotebookLM MCP Client (Local Build)
 *
 * Uses a locally built notebooklm-mcp server (dist/index.js).
 * Useful for development and testing local changes.
 *
 * Usage:
 *   node mcp_client_local.mjs health
 *   node mcp_client_local.mjs auth
 *   node mcp_client_local.mjs list
 *   node mcp_client_local.mjs ask <question> <notebook_url> [show]
 */
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const server = spawn('node', ['./notebooklm-mcp/dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
  cwd: projectRoot
});

let msgId = 0;
const pending = new Map();
let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

server.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Request timeout'));
    }, 180000); // 3 min timeout
    pending.set(id, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    server.stdin.write(msg + '\n');
  });
}

async function main() {
  // Initialize
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'notebooklm-client', version: '1.0.0' }
  });

  const cmd = process.argv[2];

  if (cmd === 'ask') {
    const question = process.argv[3];
    const notebookUrl = process.argv[4];
    const showBrowser = process.argv[5] === 'show';
    console.log(`\n=== Asking NotebookLM ===`);
    console.log(`Q: ${question}`);
    console.log(`Notebook: ${notebookUrl}\n`);

    const res = await sendRequest('tools/call', {
      name: 'ask_question',
      arguments: {
        question,
        notebook_url: notebookUrl,
        show_browser: showBrowser,
        browser_options: {
          show: showBrowser,
          headless: !showBrowser,
          timeout_ms: 60000
        }
      }
    });
    console.log('\n=== RESPONSE ===');
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'health') {
    const res = await sendRequest('tools/call', { name: 'get_health', arguments: {} });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'auth') {
    console.log('Opening browser for authentication...');
    const res = await sendRequest('tools/call', {
      name: 'setup_auth',
      arguments: { show_browser: true, browser_options: { show: true, headless: false, timeout_ms: 300000 } }
    });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'list') {
    const res = await sendRequest('tools/call', { name: 'list_notebooks', arguments: {} });
    console.log(JSON.stringify(res.result, null, 2));
  } else {
    console.log('Usage: node mcp_client_local.mjs <command> [args]');
    console.log('Commands: health, auth, list, ask <question> <notebook_url> [show]');
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 3000);
}

main().catch(console.error);
