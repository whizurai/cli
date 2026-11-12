# @whizurai/cli

Schema-driven execution client for the WhizAI platform.

## Installation

```bash
npm install -g @whizurai/cli
```

## Authentication

```bash
# Set your API key
whizzy auth set-key sk_live_...

# Or log in interactively
whizzy auth login

# Check status and which API URL is active
whizzy auth status
```

For scripts and CI, `WHIZ_API_KEY` overrides the saved key for that process
(it is never written to `~/.whizurai/config.json`).

## Installing from GitHub Packages

`@whizurai/cli` depends on `@whizurai/sdk-js`, which is published to GitHub
Packages. The repo's `.npmrc` maps the `@whizurai` scope there; put a token with
`read:packages` on the whizurai org in your user `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=<token>`).

## Targeting a local or staging API

Three ways to override the API URL (highest precedence first):

```bash
# 1. Env var — one-off or in your shell profile
WHIZ_API_URL=http://localhost:3000 whizzy run image.edit --input cat.png --prompt "cinematic"

# 2. Persistent config — survives across sessions
whizzy auth set-url http://localhost:3000

# 3. Check what URL is currently active
whizzy auth status
# API URL:  http://localhost:3000
```

## Core commands

### `whizzy run` — execute a capability

```bash
# Interactive — prompts for required fields from schema
whizzy run image.edit

# Non-interactive with flags
whizzy run image.edit --input cat.png --prompt "cinematic lighting"

# Stream progress until done
whizzy run video.generate --input frame.png --prompt "slow push in" --duration 5 --watch

# Return immediately, get run ID
whizzy run video.generate --input frame.png --prompt "slow push in" --async

# Validate spec without submitting
whizzy run image.edit --input cat.png --prompt "test" --dry-run

# Execute a saved spec file
whizzy run spec.json

# Download artifacts on completion
whizzy run image.edit --input cat.png --prompt "cinematic" --download --output ./results
```

### `whizzy inspect` — explore capability schemas

```bash
# List all published capabilities
whizzy inspect

# Filter by category
whizzy inspect --category video

# Show full input schema for a capability
whizzy inspect image.edit

# Raw JSON
whizzy inspect image.edit --json
```

### `whizzy video-routes` — which video models each route tier can land on

```bash
# Tier defaults, then every reachable model (automatic or explicit-only)
whizzy video-routes

# Raw GET /v1/model-router/video-routes
whizzy video-routes --json
```

### `whizzy outcomes` — run a published outcome and get its result

```bash
# Start a run and wait for it: prints status changes, then the result and assets.
# Exits 1 if the run FAILED or was CANCELLED.
whizzy outcomes run product-shot --input prompt="a red bicycle" --input n=2 --wait

# Inputs from a file (each --input overrides a key), a variant, a replay-safe key
whizzy outcomes run product-shot --inputs-json inputs.json --variant square --idempotency-key order-1234

# Machine-readable: {"outcomeRun": {...}, "assets": [...]} with --wait
whizzy outcomes run product-shot -i prompt="a red bicycle" --wait --json

# A run started elsewhere
whizzy outcomes status <runId>
whizzy outcomes assets <runId>
```

- `--input key=value` takes the outcome's unlocked `fieldKey`s. The value is
  parsed as JSON when it parses (`n=2` → 2, `hd=true` → true), else kept as a
  string; quote it to force a string (`zip='"02134"'`).
- `--wait` polls every `--interval` ms (default 2000) up to `--timeout` ms
  (default 600000). Without it, `run` prints the run id and returns.
- Insufficient balance prints the error code and the link to add ACU.
- Goes through `@whizurai/sdk-js` (`client.outcomes`).

#### Interactive outcome runs

An interactive outcome runs as item invocations you authorize one command at a
time (platform doc: whizai-platform `docs/interactive-outcome-runs.md`).

```bash
# Review as you go: only the first step (the plan) is authorized
whizzy outcomes run interactive-five-shot-story -i idea="a fox learns to fly" --execution-policy review

# Items, every slot's chosen version and freshness, next actions, spend
whizzy outcomes workspace <runId>          # --json for the full workspace

# One command; prints {"result": ..., "workspace": ...}
whizzy outcomes command <runId> --json '{"action":"generate","operation":"image","targets":[{"itemId":"<itemId>"}]}'
whizzy outcomes command <runId> --json '{"action":"finish_remaining","expectedControlRevision":3,"preview":true}'
whizzy outcomes command <runId> --json '{"action":"pause","expectedControlRevision":3}' --client-action-id pause-0001
```

- `--json` takes one `InteractiveCommand` (`@whizurai/types`): `apply_edit`,
  `choose_version`, `generate`, `regenerate_item`, `regenerate_plan`,
  `replace_plan`, `finish_remaining`, `pause`, `cancel`, `retry`.
- A `clientActionId` is generated unless you pass `--client-action-id`
  (previews send none). Reusing your own key replays the original result.
- A stale command (409 `STATE_CHANGED` and friends) prints the code and the
  current control revision; re-read the workspace and send it again.


```bash
# Generate a spec template from schema
whizzy generate image.edit

# Save to file and edit before running
whizzy generate image.edit > spec.json

# Pre-fill flags into the spec
whizzy generate video.generate \
  --input frame.png \
  --prompt "slow push in" \
  --duration 5 \
  --provider kieai \
  --model kling-v2-6 > spec.json

# Execute the saved spec
whizzy run spec.json
```

### `whizzy watch` — attach to an existing run

```bash
whizzy watch run_abc123

# Output JSON on completion
whizzy watch run_abc123 --json
```

## Shared flags

These flags work across `run`, `generate`, and related commands:

| Flag | Description |
|---|---|
| `--input <asset>` | Primary asset: local file, URL, `asset_id:xxx`, or `artifact_id:xxx` |
| `--ref <asset>` | Reference asset |
| `--mask <asset>` | Mask asset |
| `--prompt <text>` | Prompt text |
| `--provider <name>` | Provider override (routing detail, not command taxonomy) |
| `--model <name>` | Model override |
| `--duration <n>` | Duration in seconds (video) |
| `--aspect <ratio>` | Aspect ratio e.g. `16:9` |
| `--size <value>` | Output size e.g. `1024x1024` |
| `--seed <n>` | Random seed |
| `--async` | Submit and return immediately |
| `--watch` | Stream progress until completion |
| `--dry-run` | Print resolved spec without submitting |
| `--json` | Output raw JSON result to stdout |
| `--output <path>` | Directory or file for downloaded artifacts |
| `--download` | Auto-download artifacts on completion |
| `--idempotency-key <key>` | Deduplication key |
| `--webhook-url <url>` | Callback URL on completion |
| `--meta <key=value>` | Metadata pair (repeatable) |

## Platform admin commands

```bash
whizzy auth login / logout / status / set-key / set-url
whizzy project list / create / show / delete
whizzy usage stats / realtime / cost / alerts
whizzy scaffold list / create
whizzy proxy start
```

## License

MIT
