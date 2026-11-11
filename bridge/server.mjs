#!/usr/bin/env node
/*
 * Muse Gadget Bridge: the gadget as an MCP connector.
 *
 * A zero-dependency stdio MCP server that exposes the gadget as tools.
 * Until the physical board lands, the "device" is the SDK's desktop
 * simulator (esp32/simulator): gadget.set_state and gadget.show really
 * render the face through it. gadget.say / gadget.listen are honest
 * mocks that record intent and say so; they go live with the hardware.
 *
 * Run:  node bridge/server.mjs
 * Test: node bridge/test.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const simBin = join(repo, "esp32", "simulator", "build", "muse_simulator");
const framesDir = join(here, "frames");
const stateFile = join(here, ".state.json");
mkdirSync(framesDir, { recursive: true });

const STATES = ["boot", "idle", "listening", "thinking", "speaking", "error", "off", "happy"];

function loadState() {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return { face: "idle", caption: "Mita", events: [], said: [] };
  }
}
function saveState(s) {
  writeFileSync(stateFile, JSON.stringify(s, null, 2));
}

function render(face, caption) {
  if (!existsSync(simBin)) {
    return { error: `simulator not built: ${simBin} (build esp32/simulator first)` };
  }
  const scenario = join(framesDir, "current.scenario");
  writeFileSync(scenario, `face=${face}\ncaption=${caption}\nlevel=0.6\n`);
  const ppm = join(framesDir, "current.ppm");
  const r = spawnSync(simBin, ["--headless", "--scenario", scenario, "--screenshot", ppm, "--run-ms", "600"], {
    timeout: 30000,
  });
  if (r.status !== 0 || !existsSync(ppm)) {
    return { error: `simulator render failed (status ${r.status})` };
  }
  return { frame_ppm: ppm };
}

const TOOLS = [
  {
    name: "gadget.set_state",
    description: "Set the gadget's face state. Renders through the simulator until the board lands.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", enum: STATES },
        caption: { type: "string", description: "Caption under the face (default: current)" },
      },
      required: ["state"],
    },
  },
  {
    name: "gadget.show",
    description: "Show a caption card on the gadget face.",
    inputSchema: {
      type: "object",
      properties: {
        caption: { type: "string" },
        state: { type: "string", enum: STATES, description: "Face state (default idle)" },
      },
      required: ["caption"],
    },
  },
  {
    name: "gadget.say",
    description: "Speak text through the gadget speaker. MOCK until the physical board lands: records the line and reports mocked:true.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "gadget.listen",
    description: "Capture a mic utterance. MOCK until the physical board lands.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "gadget.events",
    description: "Read queued gadget events (button presses, touch, motion). Queue lives in bridge/.state.json; empty until hardware or a test injects events.",
    inputSchema: { type: "object", properties: {} },
  },
];

function callTool(name, args = {}) {
  const state = loadState();
  switch (name) {
    case "gadget.set_state": {
      if (!STATES.includes(args.state)) return { error: `unknown state ${args.state}` };
      state.face = args.state;
      if (typeof args.caption === "string") state.caption = args.caption.slice(0, 24);
      const out = render(state.face, state.caption);
      saveState(state);
      return out.error ? out : { ok: true, face: state.face, caption: state.caption, ...out };
    }
    case "gadget.show": {
      const face = STATES.includes(args.state) ? args.state : "idle";
      state.face = face;
      state.caption = String(args.caption ?? "").slice(0, 24);
      const out = render(face, state.caption);
      saveState(state);
      return out.error ? out : { ok: true, face, caption: state.caption, ...out };
    }
    case "gadget.say": {
      const text = String(args.text ?? "").slice(0, 500);
      state.said.push({ text, at: new Date().toISOString(), mocked: true });
      saveState(state);
      return { ok: true, mocked: true, note: "No speaker until the board lands; the line was recorded, not spoken.", text };
    }
    case "gadget.listen":
      return { ok: true, mocked: true, note: "No microphone until the board lands.", transcript: null };
    case "gadget.events":
      return { ok: true, events: state.events, mocked: state.events.length === 0 };
    default:
      return { error: `unknown tool ${name}` };
  }
}

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "muse-gadget-bridge", version: "0.1.0" },
    });
  } else if (method === "notifications/initialized") {
    /* no reply */
  } else if (method === "tools/list") {
    reply(id, { tools: TOOLS });
  } else if (method === "tools/call") {
    const out = callTool(params?.name, params?.arguments);
    if (out.error) {
      reply(id, { content: [{ type: "text", text: JSON.stringify(out) }], isError: true });
    } else {
      reply(id, { content: [{ type: "text", text: JSON.stringify(out) }] });
    }
  } else if (id !== undefined) {
    replyError(id, -32601, `method not found: ${method}`);
  }
});
