# MikrotikEasy

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/rmukhtarov/mikrotikeasy)](https://github.com/rmukhtarov/mikrotikeasy/releases)
[![Docker image](https://img.shields.io/badge/docker-ghcr.io%2Frmukhtarov%2Fmikrotikeasy-2496ED?logo=docker&logoColor=white)](https://github.com/rmukhtarov/mikrotikeasy/pkgs/container/mikrotikeasy)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?logo=anthropic&logoColor=white)](https://claude.com/claude-code)

Step-by-step configuration of MikroTik routers for people who do not know RouterOS. Answer a few
questions, watch the result on a live diagram, and get a ready RouterOS v6 or v7 script. The interface is
available in Azerbaijani, Russian and English.

## Features

**Master (setup wizard).** It builds the script from fixed templates with no LLM, so the same answers always
give the same script.

- **Internet:** DHCP, static or PPPoE, or an LTE modem (built-in or USB).
- **Second WAN with failover:** a recursive internet check or a simple gateway check.
- **LAN:** any size from /16 to /30, with a DHCP server.
- **Ports:** a role for each port (LAN, guest, cameras or disabled) and a free-text note that becomes the
  port comment in Winbox.
- **Speed limits:** per port in hardware (RB3011, RB2011) and per IP or range with simple queues.
- **Guest network:** guests cannot see your devices.
- **Camera network:** cameras cannot reach the LAN, the LAN can watch them, and internet access is optional
  (time sync only by default).
- **WiFi:** the `wifi` package (hAP ax) or the `wireless` package (hAP ac, LTE models), with a guest WiFi.
- **Port forwarding** with hairpin NAT.
- **Security:** port scan protection and a bogon filter, plus a country filter for port forwards. The
  router downloads the country lists itself every day and checks them before importing.
- **Firewall and hardening:** generated in every script.
- **Live animated diagram:**
  - traffic, blocked connections and allowed forwards
  - a "cut the main line" failover simulation
  - a port map
  - click any part of the diagram to open the matching step
- **Schema check:** each generated script is validated against a RouterOS command schema and
  server-side lint rules.

**AI assistant (optional).** It turns a free-text description into a RouterOS v6 or v7 script, or reviews a
pasted `/export`. Any OpenAI-compatible endpoint works: LocalAI, Ollama, LM Studio or a hosted API. Each
answer goes through lint, a schema check and automatic fix passes. Set `AI_ENABLED=false` to run a plain
configurator with no AI wording and no LLM calls.

**Settings (gear icon).** Turn the AI on or off and set the LLM address, model and limits from the app.
You can also list the endpoint's models with *Test connection*. Values are saved on the data volume and
override `.env`, which stays as the fallback (*Back to .env*). The API key is encrypted on the server
(AES-256-GCM), never shown in the browser, and only sent to the address it was saved for. There is no
login, so anyone who can open the app can change these settings. Put the app behind a reverse proxy with
authentication if the network is not trusted.

## Quick start (Docker)

```sh
git clone https://github.com/rmukhtarov/mikrotikeasy.git
cd mikrotikeasy
sh install.sh
```

`install.sh` checks Docker and Compose, creates `.env` from `.env.example` and creates the data folder. It
then starts the app from one of three sources, in this order:

1. an image file next to the script
2. the published image `ghcr.io/rmukhtarov/mikrotikeasy`
3. a build from source

Finally it waits for the health check. Open `http://<host>:3090` when it finishes.

| Use case | How to run |
|---|---|
| Published image | `docker compose up -d` |
| Build from source | `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` |
| Offline host | Put `mikrotikeasy-image-<version>.tar.gz` from the release next to `install.sh`, then run `sh install.sh` |
| Portainer or Arcane | Paste `docker-compose.yml` and add the `.env` values as stack variables. Set `DATA_DIR` explicitly, because Portainer has no `$USER`. |
| Plain Docker | `docker run -d --name mikrotikeasy -p 3090:3090 -v /srv/mikrotikeasy:/data --env-file .env ghcr.io/rmukhtarov/mikrotikeasy:1.1.0` |
| Without Docker (Node.js 18 or newer, no npm packages) | `cp .env.example .env && node server.mjs` |

## Windows (single .exe, no installation)

Download `MikrotikEasy-<version>-win-x64.exe` (64-bit Windows) or `-win-x86.exe` (32-bit) from the
[releases](https://github.com/rmukhtarov/mikrotikeasy/releases) and double-click it.

- The app opens in your browser at `http://127.0.0.1:3090`. If that port is taken, it tries the next ports.
- Keep the console window open while you use the app. Closing the window stops it.
- Settings, the encrypted API key and the AI mistake memory are kept in `%LOCALAPPDATA%\MikrotikEasy`. An
  optional `.env` file is read from that folder or from the folder next to the `.exe`.
- The `.exe` is not code-signed, so Windows SmartScreen may warn the first time. Click *More info* and then
  *Run anyway*. Compare the file with `SHA256SUMS.txt` from the release.
- `NO_BROWSER=1` starts the app without opening a browser. `HOST=0.0.0.0` lets other computers on the LAN
  open it.

Build the executables yourself on Windows with the same Node.js 22 version: `node tools/build-exe.mjs`. The
build uses the Node.js single executable application feature with the official `node.exe` for each
architecture, checked by SHA-256.

## Settings (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `AI_ENABLED` | empty | `true` or `false`. When empty, AI is on only if `LLM_BASE_URL` is set. |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | empty | OpenAI-compatible endpoint. Examples for LocalAI, Ollama and hosted APIs are in `.env.example`. |
| `LLM_THINKING` | false | Keep this false for Qwen3-style models. With thinking on, one request can run for minutes. |
| `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS`, `FIX_ROUNDS` | 8000, 300000, 2 | Generation limits |
| `SETTINGS_SECRET` | random file in the data folder | Encryption secret for the API key saved from Settings |
| `MIKROTIKEASY_TAG` | 1.1.0 | Image tag to run |
| `APP_PORT` | 3090 | Port on the host |
| `DATA_DIR` | `/home/$USER/docker/mikrotikeasy/data` | Mistake memory of the AI assistant |
| `NET_SUBNET`, `NET_GATEWAY` | 192.168.62.0/24, .1 | Docker network. Change it if this range is already in use. |

Health check: `GET /healthz`. Version: `GET /api/info`.

## How the checks work

- `public/wizard-core.js` builds the Master script. The same module runs in the browser and on the server.
- `prompts.mjs` holds the rules for the LLM and a server-side lint that runs independently of the model.
  The lint looks for logic errors such as a firewall without a drop rule, dst-nat that hijacks LAN traffic,
  closed WireGuard or DHCPv6 ports, a WAN port inside a bridge, or empty interface lists.
- `schema.mjs` with `data/ros-schema.json` checks menus, properties and values against a command schema
  dumped from a real RouterOS 7 device (`tools/dump-*.rsc`, `tools/build-schema.mjs`). RouterOS 6 scripts
  are checked only for the menus that are the same on both versions.

Always test a generated script on a lab device before production, and keep an `/export` backup.

## Release bundle

`bash tools/package.sh 1.1.0` writes `dist/mikrotikeasy-1.1.0.tar.gz`. Pushing a `v*` tag builds the
multi-arch image (linux/amd64 and linux/arm64) and publishes it to GHCR (`.github/workflows/docker.yml`).

## Credits and notices

- Country IP lists come from [iwik.org/ipcountry](https://www.iwik.org/ipcountry/), based on MaxMind
  GeoLite2 data ([GeoLite2 EULA](https://www.maxmind.com/en/geolite2/eula)).
- Wordmark font: a subset of Exo 2 (SIL Open Font License 1.1, see `public/fonts/OFL.txt`).
- MikroTik and RouterOS are trademarks of MikroTik SIA. This project is independent and is not affiliated
  with or endorsed by MikroTik.
- Built with [Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE)
