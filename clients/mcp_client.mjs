/**
 * NotebookLM MCP Client (npx)
 *
 * Full-featured CLI client for the NotebookLM MCP server.
 * Spawns the server via npx and communicates over JSON-RPC stdio.
 *
 * Usage:
 *   node mcp_client.mjs health
 *   node mcp_client.mjs auth
 *   node mcp_client.mjs list
 *   node mcp_client.mjs add <url> <name> <desc> <topics>
 *   node mcp_client.mjs ask <question> [notebook_url]
 *   node mcp_client.mjs select <id>
 */
import { spawn } from 'child_process';

const server = spawn('npx', ['-y', 'notebooklm-mcp@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let msgId = 0;
const pending = new Map();

// Parse JSON-RPC responses from stdout
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete line
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
  // Suppress stderr noise
});

function sendRequest(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    server.stdin.write(msg + '\n');
  });
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  // Initialize
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'notebooklm-client', version: '1.0.0' }
  });

  if (cmd === 'health') {
    const res = await sendRequest('tools/call', { name: 'get_health', arguments: {} });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'auth') {
    const res = await sendRequest('tools/call', {
      name: 'setup_auth',
      arguments: { show_browser: true }
    });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'list') {
    const res = await sendRequest('tools/call', { name: 'list_notebooks', arguments: {} });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'add') {
    const url = arg;
    const name = process.argv[4] || 'Notebook';
    const desc = process.argv[5] || 'NotebookLM notebook';
    const topics = (process.argv[6] || 'general').split(',');
    const res = await sendRequest('tools/call', {
      name: 'add_notebook',
      arguments: { url, name, description: desc, topics }
    });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'ask') {
    const question = arg;
    const notebookUrl = process.argv[4];
    const args = { question };
    if (notebookUrl) args.notebook_url = notebookUrl;
    const res = await sendRequest('tools/call', { name: 'ask_question', arguments: args });
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'select') {
    const res = await sendRequest('tools/call', { name: 'select_notebook', arguments: { id: arg } });
    console.log(JSON.stringify(res.result, null, 2));
  } else {
    console.log('Usage: node mcp_client.mjs <command> [args]');
    console.log('Commands: health, auth, list, add <url> <name> <desc> <topics>, ask <question> [notebook_url], select <id>');
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 2000);
}

main().catch(console.error);
