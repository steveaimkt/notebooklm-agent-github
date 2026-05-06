#!/usr/bin/env node
/**
 * 환경 점검 스크립트
 * - Node.js 18+ 확인
 * - npx 사용 가능 여부
 *
 * 종료 코드: 0 통과 / 1 실패
 */
import { execSync } from 'child_process';
import { platform, arch, release } from 'os';

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
let ok = true;

console.log(`Node.js: v${process.versions.node} (${process.arch})`);
if (nodeMajor < 18) {
  console.log('  ❌ Node.js 18 이상이 필요합니다. https://nodejs.org 에서 LTS를 설치하세요.');
  ok = false;
} else {
  console.log('  ✅ Node 18+');
}

try {
  const npxVer = execSync('npx --version', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  console.log(`npx: ${npxVer}`);
  console.log('  ✅ npx 사용 가능');
} catch {
  console.log('  ❌ npx를 찾을 수 없습니다. npm을 재설치하세요.');
  ok = false;
}

console.log(`OS: ${platform()} ${release()} (${arch()})`);

if (!ok) {
  console.log('\n환경 점검 실패. 위 항목을 해결한 뒤 다시 실행하세요.');
  process.exit(1);
}

console.log('\n환경 점검 통과.');
process.exit(0);
