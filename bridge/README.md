# Muse Gadget Bridge

The gadget as an MCP connector (see `../MITA-GADGET.md` for the full
design). A zero-dependency Node stdio MCP server:

```sh
node bridge/server.mjs   # speaks MCP over stdio
node bridge/test.mjs     # smoke test against the simulator
```

## Tools

| Tool | Status | Notes |
|---|---|---|
| `gadget.set_state` | real (simulator) | Renders the face state through `esp32/simulator` |
| `gadget.show` | real (simulator) | Caption card on the face |
| `gadget.say` | mock | Records the line, reports `mocked: true`; live with hardware |
| `gadget.listen` | mock | No mic until the board lands |
| `gadget.events` | queue | Reads `bridge/.state.json`; hardware (or tests) inject events |

State lives in `bridge/.state.json` (runtime file, not committed).
Rendered frames land in `bridge/frames/`.

## Wiring

- Muse: register as a local MCP server / custom connector once the
  device end is real; until then the stdio server is the contract.
- SAM: pin as an MCP connector, and let gadget events POST to SAM's
  signed event door so a button press can wake a profile. SAM stays
  one capability behind the connector, not the face of the device.
- The bridge is the gate: presentation and input only. Anything
  consequential rides the owning system's approval rules.
