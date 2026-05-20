/**
 * Canonical types for the WhizAI CLI execution model.
 *
 * Every CLI command compiles to a RunSpec and submits it through a single
 * execution path. No command is allowed to bypass this shape.
 */

// ─── Asset ────────────────────────────────────────────────────────────────────

/**
 * All forms of asset references the CLI accepts. The AssetResolver converts
 * all of these into a CanonicalAssetRef before the spec is submitted.
 */
export type AssetInput =
  | { type: 'local'; path: string }
  | { type: 'url'; url: string }
  | { type: 'asset_id'; id: string }
  | { type: 'artifact_id'; id: string }
  | { type: 'base64'; data: string; mimeType: string };

export interface CanonicalAssetRef {
  /** Resolved URL after any local upload or artifact resolution. */
  url: string;
  /** Original input form, for audit/replay. */
  originalInput: AssetInput;
  /** MIME type when known. */
  mimeType?: string;
  /** SHA-256 hash of the content, if computed locally. */
  contentHash?: string;
}

// ─── RunSpec ──────────────────────────────────────────────────────────────────

/**
 * Normalized run spec — the single shape all CLI interfaces compile to.
 * This mirrors the platform execution model, not the CLI command syntax.
 */
export interface RunSpec {
  /**
   * Capability slug (`image.edit`, `video.generate`) or raw workflow slug
   * (`image-edit-v1`) for advanced usage. The platform resolves this to a
   * workflow run.
   */
  target: string;

  /**
   * Resolved input payload. All asset refs are canonical URLs by this point.
   */
  inputs: Record<string, unknown>;

  /**
   * Execution behavior controls.
   */
  execution: {
    /** Prefer async execution; do not wait for the result inline. */
    async?: boolean;
    /** After submitting, poll and stream progress to stdout. */
    watch?: boolean;
    /** Validate and print the spec without submitting. */
    dryRun?: boolean;
    /** Idempotency key — reuse a previous run if the key matches. */
    idempotencyKey?: string;
  };

  /**
   * Provider/model routing overrides. These are advanced options; the
   * platform workflow policy defines sensible defaults.
   */
  routing?: {
    provider?: string;
    model?: string;
  };

  /**
   * Output handling preferences.
   */
  output?: {
    /** Print full JSON result to stdout instead of human-readable display. */
    json?: boolean;
    /** Directory or file path to write downloaded artifacts. */
    path?: string;
    /** Automatically download artifacts when the run completes. */
    download?: boolean;
  };

  /**
   * Webhook URL to call when the run completes (automation/CI use).
   */
  webhookUrl?: string;

  /**
   * Passthrough metadata recorded with the run for traceability.
   */
  metadata?: Record<string, string>;
}

// ─── Run lifecycle ────────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface Run {
  id: string;
  /** Underlying workflow run ID for debugging. */
  workflowRunId?: string;
  capabilityId?: string;
  capabilitySlug?: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  artifacts?: Artifact[];
  error?: { message: string; code: string };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RunStep {
  id: string;
  name: string;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ─── Artifact ─────────────────────────────────────────────────────────────────

export interface Artifact {
  id: string;
  type: string;
  name?: string;
  url?: string;
  runId?: string;
  stepId?: string;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── Capability ───────────────────────────────────────────────────────────────

export interface CapabilityInputField {
  name: string;
  type: string;
  label?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  /** JSON Schema for complex types. */
  schema?: Record<string, unknown>;
}

export interface Capability {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  status: 'draft' | 'published' | 'deprecated';
  version: string;
  inputContract?: CapabilityInputField[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  workflows?: {
    primary?: {
      workflowId: string;
      workflowSlug?: string;
      workflowVersion?: string;
    };
  };
}

// ─── API response envelopes ───────────────────────────────────────────────────

export interface ListCapabilitiesResponse {
  capabilities: Capability[];
  total?: number;
  nextCursor?: string;
}

export interface ExecuteCapabilityResponse {
  run: Run;
}

export interface ListArtifactsResponse {
  artifacts: Artifact[];
  total?: number;
}

// ─── CLI config ───────────────────────────────────────────────────────────────

export interface CliConfig {
  apiKey?: string;
  baseUrl: string;
  defaultOutput?: 'human' | 'json';
}

// ─── Polling options ──────────────────────────────────────────────────────────

export interface PollOptions {
  /** Polling interval in ms. Default: 2000 */
  intervalMs?: number;
  /** Timeout in ms. Default: 600_000 (10 min) */
  timeoutMs?: number;
  onUpdate?: (run: Run) => void;
}
