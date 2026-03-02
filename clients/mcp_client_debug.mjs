/**
 * NotebookLM MCP Client (Debug Mode)
 *
 * Debug-focused client — browser always visible, stderr filtered for errors/auth messages.
 *
 * Usage:
 *   node mcp_client_debug.mjs auth
 *   node mcp_client_debug.mjs ask <question> <notebook_url>
 */
import { spawn } from 'child_process';

const server = spawn('npx', ['-y', 'notebooklm-mcp@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
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
  const text = data.toString();
  if (text.includes('Error') || text.includes('error') || text.includes('✅') || text.includes('🔐') || text.includes('Navigate') || text.includes('login') || text.includes('auth')) {
    process.stderr.write(text);
  }
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
    console.log(`Asking: "${question}" to notebook: ${notebookUrl}`);
    console.log('Browser will open visibly for debugging...');

    const res = await sendRequest('tools/call', {
      name: 'ask_question',
      arguments: {
        question,
        notebook_url: notebookUrl,
        show_browser: true,
        browser_options: {
          show: true,
          headless: false,
          timeout_ms: 60000
        }
      }
    });
    console.log('\n=== RESPONSE ===');
    console.log(JSON.stringify(res.result, null, 2));
  } else if (cmd === 'auth') {
    console.log('Opening browser for authentication...');
    const res = await sendRequest('tools/call', {
      name: 'setup_auth',
      arguments: {
        show_browser: true,
        browser_options: { show: true, headless: false, timeout_ms: 120000 }
      }
    });
    console.log(JSON.stringify(res.result, null, 2));
  } else {
    console.log('Usage: node mcp_client_debug.mjs <command> [args]');
    console.log('Commands: auth, ask <question> <notebook_url>');
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 3000);
}

main().catch(console.error);
