#!/usr/bin/env node

/**
 * 穹弯 halfsphere - 基地节点监控脚本
 * 
 * 用法:
 * 1. 在 halfsphere Settings → 基地 中添加节点，获取 node_id
 * 2. 在下方 CONFIG 区域填入账号密码和节点信息
 * 3. npm install @supabase/supabase-js  (如未安装)
 * 4. node scripts/network-monitor.mjs
 * 
 * Windows 定时任务:
 *   schtasks /create /tn "HalfsphereMonitor" /tr "node C:\full\path\to\scripts\network-monitor.mjs" /sc minute /mo 5
 */

import { createClient } from '@supabase/supabase-js';
import { createConnection } from 'net';

// ==================== 配置区域 ====================
const CONFIG = {
  // Supabase 配置（从 halfsphere .env.local 或 Vercel 环境变量复制）
  supabaseUrl: 'https://hrtynofmjcumuanjvpxz.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydHlub2ZtamN1bXVhbmp2cHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTI2MDgsImV4cCI6MjA2Mjk4ODYwOH0.5aR3Ut-y-zrMIXpYs5Bhnq7yVYjYtK1q8HhVgFJJX3c',

  // halfsphere 登录账号
  email: '',        // ← 填你的 halfsphere 邮箱
  password: '',     // ← 填你的 halfsphere 密码

  // 节点列表：从 halfsphere Settings → 基地 获取 node_id
  // 然后填上对应的 host 和 port 用于本地测速
  nodes: [
    // 示例:
    // { id: '550e8400-e29b-41d4-a716-446655440000', host: '1.2.3.4', port: 443, name: '香港-01' },
  ],

  // 测速超时 (ms)
  timeout: 5000,

  // 慢节点阈值 (ms)
  slowThreshold: 500,
};
// ==================== 配置区域结束 ====================

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: CONFIG.email,
    password: CONFIG.password,
  });
  if (error) throw new Error(`登录失败: ${error.message}`);
  return data.session;
}

function ping(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = createConnection(port, host);
    socket.setTimeout(CONFIG.timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(Date.now() - start);
    });

    socket.on('error', () => resolve(null));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

async function sync(session, nodeId, latency, status) {
  const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/network_snapshots`, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.supabaseAnonKey,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      node_id: nodeId,
      latency_ms: latency,
      status,
      user_id: session.user.id,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error');
    throw new Error(`Sync failed: ${res.status} ${text}`);
  }
  return true;
}

async function main() {
  // 配置校验
  if (!CONFIG.email || !CONFIG.password) {
    console.error('[monitor] ❌ 请在 CONFIG 中填写 email 和 password');
    process.exit(1);
  }
  if (CONFIG.nodes.length === 0) {
    console.error('[monitor] ❌ 请在 CONFIG.nodes 中配置至少一个节点');
    console.error('[monitor] 提示: 先在 halfsphere Settings → 基地 添加节点，获取 node_id');
    process.exit(1);
  }

  console.log(`[monitor] 🔐 登录 halfsphere (${CONFIG.email})...`);
  const session = await login();
  console.log(`[monitor] ✅ 登录成功，开始测速 ${CONFIG.nodes.length} 个节点...\n`);

  let online = 0, slow = 0, offline = 0;

  for (const node of CONFIG.nodes) {
    const latency = await ping(node.host, node.port);
    let status;
    if (latency === null) {
      status = 'offline';
      offline++;
    } else if (latency > CONFIG.slowThreshold) {
      status = 'slow';
      slow++;
    } else {
      status = 'online';
      online++;
    }

    const latencyStr = latency === null ? 'TIMEOUT' : `${latency}ms`;
    const icon = status === 'online' ? '🟢' : status === 'slow' ? '🟡' : '🔴';
    console.log(`  ${icon} ${node.name.padEnd(16)} ${latencyStr.padStart(8)}  [${status}]`);

    try {
      await sync(session, node.id, latency, status);
    } catch (err) {
      console.error(`     ⚠️ 上报失败: ${err.message}`);
    }
  }

  console.log(`\n[monitor] ✅ 完成  在线:${online}  缓慢:${slow}  离线:${offline}`);
}

main().catch((err) => {
  console.error('[monitor] 💥 异常:', err.message);
  process.exit(1);
});
