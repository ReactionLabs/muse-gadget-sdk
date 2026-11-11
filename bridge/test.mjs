#!/usr/bin/env node
/* Smoke test: initialize, list tools, set the face to listening, say a line. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const child = spawn("node", [join(here, "server.mjs")], { stdio: ["pipe", "pipe", "inherit"] });

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let seq = 0;
function send(method, params) {
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

const init = await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "bridge-test", version: "0" } });
console.log("server:", init.result.serverInfo.name, init.result.serverInfo.version);
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const list = await send("tools/list", {});
console.log("tools:", list.result.tools.map((t) => t.name).join(", "));

const set = await send("tools/call", { name: "gadget.set_state", arguments: { state: "listening", caption: "Mita" } });
const setOut = JSON.parse(set.result.content[0].text);
console.log("set_state:", JSON.stringify(setOut));
if (!setOut.ok || !existsSync(setOut.frame_ppm)) {
  console.error("FAIL: no frame rendered");
  process.exit(1);
}

const say = await send("tools/call", { name: "gadget.say", arguments: { text: "hello from the bridge" } });
console.log("say:", say.result.content[0].text);

child.kill();
console.log("PASS");
