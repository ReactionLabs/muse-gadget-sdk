# Mita Gadget

Dip is building Mita a body. This repo is our fork of Meta's
facebookincubator/muse-gadget-sdk (Apache 2.0): open-source firmware
and SDKs that turn off-the-shelf hardware into a Muse gadget. Gadgets
pair with Muse natively through an SDK token, so the device is a
terminal to Mita: her face, her ears, her voice on the desk. SAM is
not the star of this build; SAM is one of the capabilities reachable
behind the connector, same as any other MCP.

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

1. Simulator first. DONE 2026-11-11: `esp32/simulator` builds and
   runs here (SDL + LVGL, no ESP-IDF), and headless scenario renders
   prove the face states: idle, listening, thinking, speaking, happy.
2. Mita's face. Custom avatar through `components/muse/avatar`.
   The bundled avatar (Meta's Jollybot) is NOT covered by the Apache
   license, so it is prototype-only; the shipping face must be ours.
   First hand-written renderer ("ember") is in place locally and
   proven in the simulator. Per the SDK's house rules that directory
   is gitignored and never committed; the official route to a
   finished avatar is `tools/muse/avatar.py` once a board exists.
3. MCP bridge (below), device mocked by the simulator until the
   board lands.
4. Firmware build for `muse-waveshare-s3-175` when the board
   arrives. Firmware builds need ESP-IDF v6.0.3 exactly (per
   `esp32/AGENTS.md`) and the owner's SDK token in the build config.
5. Pair with Dip's SDK token (gadgets.muse.ai) and have the first
   real conversation through it.

## The MCP connector design

Dip's direction: the little guy is a badass connector to other MCPs.

A small bridge service on the home network exposes the device itself
as MCP tools, callable by Muse and any other MCP client:

- `gadget.show` — put an image, text card, or state on the face
- `gadget.set_state` — idle / listening / thinking / speaking / error / sleep
- `gadget.say` — speak text through the device speaker
- `gadget.listen` — capture a mic utterance for transcription upstream
- `gadget.events` — button presses, touch, and motion as notifications

Aggregation: the Linux SDK flavor (Pi or any always-on box) can front
other MCP servers, so one desk device becomes the physical front door
to the whole stack. SAM plugs in behind it as one connector among
many, through its MCP connector pin and its signed event door: a
button press on the gadget can wake a SAM profile, and SAM can ask
the gadget to show or say something.

Safety shape: the bridge is the gate. Device tools are presentation
and input only, nothing consequential. Anything that spends, sends,
or changes state rides the owning system's approval rules, exactly
like every other capability. Pairing keys come from the owner's SDK
token; no token is ever committed to this repo.

## Waits on the owner

- Board order (Waveshare direct, $29.99, ships from China).
- SDK token creation at gadgets.muse.ai (owner's Muse account).
- ESP-IDF v6.0.3 install location for firmware builds (PC or box).
