# SAM Gadget

Our build on Meta's Muse Gadget SDK. This repo is a fork of
facebookincubator/muse-gadget-sdk (Apache 2.0). The SDK is the body;
the brain stays where it already lives (Muse, and our own SAM runtime).
The gadget is a connector with a face, not another agent.

## Hardware target

- Waveshare ESP32-S3-Touch-AMOLED-1.75 (the standard version).
  Ready-made SDK config: `esp32/devices/sdkconfig.muse-waveshare-s3-175`.
  The cased twin (1.75C) is `sdkconfig.muse-waveshare-s3-175c`.
- Round 466x466 AMOLED touchscreen, dual microphone array, speaker
  header, 6-axis IMU (motion/gesture), Wi-Fi + BLE 5.
- Power: USB-C, plus a 3.7V MX1.25 lithium battery header with an
  AXP2101 power management chip (charge/discharge onboard). A LiPo
  pouch plugs straight in for untethered desk duty.

## Build order

1. Simulator first. `esp32/simulator` compiles the production gadget
   UI for the desktop (SDL + LVGL, no ESP-IDF needed) and renders the
   face states: boot, idle, listening, thinking, speaking, error, off.
   Prove the face here before any hardware exists.
2. Our face. Custom avatar through `components/muse/avatar`
   (the simulator picks up the custom renderer automatically).
3. MCP bridge skeleton (below), device mocked by the simulator.
4. Firmware build for `muse-waveshare-s3-175` when the board lands.
   Firmware builds need ESP-IDF v6.0.1 exactly.
5. Pair (SDK token from gadgets.muse.ai, created by the owner) and
   make the first real call.

## The MCP connector design

Dip's direction: the little guy is a badass connector to other MCPs.

A small bridge service on the home network exposes the device itself
as MCP tools, callable by any MCP client (Muse, SAM, Claude):

- `gadget.show` — put an image, text card, or state on the face
- `gadget.set_state` — idle / listening / thinking / speaking / error / sleep
- `gadget.say` — speak text through the device speaker
- `gadget.listen` — capture a mic utterance for transcription upstream
- `gadget.events` — button presses, touch, and motion as notifications

Aggregation: the Linux SDK flavor (Pi or any always-on box) can front
other MCP servers, so one desk device becomes the physical front door
to the whole stack (Nines, Second Shift, whatever gets plugged in).

SAM wiring, two doors SAM already has:

- Outbound: SAM pins the bridge as an MCP connector and calls the
  gadget tools the same way it calls any connector.
- Inbound: device events (a button press, a wake tap) POST to SAM's
  signed event door and wake a profile. The gadget can start a SAM
  turn, not just receive one.

Safety shape: the bridge is the gate. Device tools are presentation
and input only, nothing consequential. Anything that spends, sends,
or changes state still rides SAM's approval gate, exactly like every
other SAM capability. Pairing keys come from the owner's SDK token;
no token is ever committed to this repo.

## Waits on the owner

- Board order (Waveshare direct, $29.99, ships from China).
- SDK token creation at gadgets.muse.ai (owner's Muse account).
- ESP-IDF v6.0.1 install location for firmware builds (PC or box).
