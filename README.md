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

### `whizzy generate` — scaffold a run spec manifest

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
