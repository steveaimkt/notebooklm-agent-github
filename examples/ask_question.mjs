/**
 * 간단한 NotebookLM 질문 예제
 *
 * NotebookLM MCP 서버에 질문을 보내고 응답을 받는 최소 예제입니다.
 *
 * 사용법:
 *   node examples/ask_question.mjs "질문 내용" "https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID"
 */
import { spawn } from 'child_process';

const question = process.argv[2];
const notebookUrl = process.argv[3];

if (!question || !notebookUrl) {
  console.log('사용법: node examples/ask_question.mjs <질문> <노트북_URL>');
  console.log('예시: node examples/ask_question.mjs "이 노트북의 핵심 내용을 요약해줘" "https://notebooklm.google.com/notebook/abc123"');
  process.exit(1);
}

const server = spawn('npx', ['-y', 'notebooklm-mcp@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let msgId = 0;
let buffer = '';
const pending = new Map();

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

server.stderr.on('data', () => {}); // suppress

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function main() {
  // 1. MCP 서버 초기화
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'example-client', version: '1.0.0' }
  });

  console.log(`📖 노트북: ${notebookUrl}`);
  console.log(`❓ 질문: ${question}\n`);
  console.log('⏳ NotebookLM에서 답변을 가져오는 중...\n');

  // 2. 질문 전송
  const res = await send('tools/call', {
    name: 'ask_question',
    arguments: { question, notebook_url: notebookUrl }
  });

  // 3. 응답 출력
  const content = res.result?.content?.[0]?.text;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      console.log('=== 답변 ===');
      console.log(parsed.answer || content);
    } catch {
      console.log('=== 답변 ===');
      console.log(content);
    }
  } else {
    console.log('응답을 받지 못했습니다.');
    console.log(JSON.stringify(res.result, null, 2));
  }

  server.stdin.end();
  setTimeout(() => process.exit(0), 2000);
}

main().catch(console.error);
