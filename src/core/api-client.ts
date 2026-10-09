/**
 * ApiClient — thin, typed wrapper over the WhizAI platform HTTP API.
 *
 * Responsibilities:
 *   - Attach auth headers
 *   - Provide capability/run/artifact accessors used by the execution engine
 *   - Expose an upload function consumed by AssetResolver
 *
 * This is NOT a general-purpose HTTP client. It only exposes the minimal
 * surface required for CLI execution: capabilities, runs, artifacts, upload.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import fs from 'fs';
import type {
  Capability,
  ListCapabilitiesResponse,
  Run,
  Artifact,
  ListArtifactsResponse,
  ExecuteCapabilityResponse,
  CliConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://api.whizurai.com';
const USER_AGENT = 'whiz-cli/1.1.0';

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
};

export interface UploadResult {
  url: string;
  id?: string;
  artifactId?: string;
}

export class ApiClient {
  private http: AxiosInstance;
  private baseUrl: string;

  constructor(config: CliConfig) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
    });

    // Normalize error responses
    this.http.interceptors.response.use(
      (r) => r,
      (err: AxiosError) => {
        const data = err.response?.data as any;
        const message =
          data?.error?.message ||
          data?.message ||
          data?.error ||
          err.message;
        const code =
          data?.error?.code ||
          data?.code ||
          `HTTP_${err.response?.status ?? 'UNKNOWN'}`;
        const wrapped = new ApiError(message, code, err.response?.status);
        return Promise.reject(wrapped);
      }
    );
  }

  // ─── Capabilities ─────────────────────────────────────────────────────────

  async listCapabilities(opts?: {
    status?: string;
    category?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListCapabilitiesResponse> {
    const res = await this.http.get('/v1/capabilities', { params: opts });
    const data = res.data as ListCapabilitiesResponse;
    return {
      ...data,
      capabilities: (data.capabilities ?? []).map(normalizeCapability),
    };
  }

  async getCapability(idOrSlug: string): Promise<Capability> {
    const res = await this.http.get(`/v1/capabilities/${encodeURIComponent(idOrSlug)}`);
    // Platform wraps the response as { capability: {...} }; tolerate both shapes.
    const data = res.data as Capability | { capability: Capability };
    const cap = ('capability' in data ? data.capability : data) as Capability;
    return normalizeCapability(cap);
  }

  async executeCapability(
    idOrSlug: string,
    payload: {
      input: Record<string, unknown>;
      idempotencyKey?: string;
      webhookUrl?: string;
      routing?: { provider?: string; model?: string };
      metadata?: Record<string, string>;
    }
  ): Promise<ExecuteCapabilityResponse> {
    const body: Record<string, unknown> = {
      input: payload.input,
    };
    if (payload.idempotencyKey) body.idempotencyKey = payload.idempotencyKey;
    if (payload.webhookUrl) body.webhookUrl = payload.webhookUrl;
    if (payload.routing) body.routing = payload.routing;
    if (payload.metadata) body.metadata = payload.metadata;

    const headers: Record<string, string> = {};
    if (payload.idempotencyKey) {
      headers['x-idempotency-key'] = payload.idempotencyKey;
    }

    const res = await this.http.post(
      `/v1/capabilities/${encodeURIComponent(idOrSlug)}/execute`,
      body,
      { headers }
    );
    return res.data as ExecuteCapabilityResponse;
  }

  async dryRunCapability(
    idOrSlug: string,
    input: Record<string, unknown>
  ): Promise<{
    valid: boolean;
    status?: string;
    resolvedInputs?: Record<string, unknown>;
    resolvedArtifacts?: Record<string, unknown>;
    estimatedCost?: number;
    warnings?: unknown[];
    errors?: unknown[];
  }> {
    const res = await this.http.post(
      `/v1/capabilities/${encodeURIComponent(idOrSlug)}/dry-run`,
      { input }
    );
    const data = res.data as {
      status?: string;
      valid?: boolean;
      resolvedInputs?: Record<string, unknown>;
      resolvedArtifacts?: Record<string, unknown>;
      estimatedCost?: number;
      warnings?: unknown[];
      errors?: unknown[];
    };
    // Platform returns { status: "valid" | "invalid", ... }; older CLI code
    // expected { valid: boolean }. Normalize so callers see both fields.
    const valid =
      typeof data.valid === 'boolean'
        ? data.valid
        : data.status === 'valid' || (Array.isArray(data.errors) && data.errors.length === 0 && data.status !== 'invalid');
    return { ...data, valid };
  }

  /**
   * Cancel a capability run (POST /v1/capabilities/capability-runs/:runId/cancel).
   * Idempotent for an already-cancelled run. Marks the run and cancels its
   * workflow run best-effort; it does not stop work already on a worker.
   */
  async cancelCapabilityRun(runId: string): Promise<Run> {
    const res = await this.http.post(
      `/v1/capabilities/capability-runs/${encodeURIComponent(runId)}/cancel`
    );
    return res.data as Run;
  }

  // ─── Runs ─────────────────────────────────────────────────────────────────

  async getRun(runId: string): Promise<Run> {
    const res = await this.http.get(`/v1/workflow-runs/${runId}`);
    return res.data as Run;
  }

  async listRuns(opts?: {
    capabilityId?: string;
    capabilitySlug?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ runs: Run[]; total?: number }> {
    const res = await this.http.get('/v1/workflow-runs', { params: opts });
    return res.data as { runs: Run[]; total?: number };
  }

  async getRunLogs(runId: string): Promise<string[]> {
    const res = await this.http.get(`/v1/workflow-runs/${runId}/logs`);
    const data = res.data as string[] | { logs: string[] };
    return Array.isArray(data) ? data : data.logs ?? [];
  }

  async getRunArtifacts(runId: string): Promise<Artifact[]> {
    const res = await this.http.get(`/v1/workflow-runs/${runId}/artifacts`);
    const data = res.data as Artifact[] | { artifacts: Artifact[] };
    return Array.isArray(data) ? data : data.artifacts ?? [];
  }

  // ─── Artifacts ────────────────────────────────────────────────────────────

  async listArtifacts(opts?: {
    runId?: string;
    type?: string;
    limit?: number;
    query?: string;
  }): Promise<ListArtifactsResponse> {
    const res = await this.http.get('/v1/artifacts', { params: opts });
    return res.data as ListArtifactsResponse;
  }

  async getArtifact(id: string): Promise<Artifact> {
    const res = await this.http.get(`/v1/artifacts/${id}`);
    return res.data as Artifact;
  }

  // ─── Asset upload ─────────────────────────────────────────────────────────

  /**
   * Upload a local file and return the resulting asset URL.
   * Used by AssetResolver when a local path is provided.
   *
   * Uses a simple base64 JSON upload body to avoid external FormData deps.
   * Falls back gracefully if the upload endpoint does not yet exist.
   */
  async uploadFile(filePath: string): Promise<UploadResult> {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = EXT_MIME[ext] ?? 'application/octet-stream';
    const filename = filePath.split('/').pop() ?? 'upload';

    try {
      const res = await this.http.post(
        '/v1/assets/upload',
        { file: `data:${mimeType};base64,${base64}`, filename },
        { timeout: 120_000 }
      );
      return res.data as UploadResult;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new Error(
          'Asset upload endpoint not available. Provide a URL instead of a local file path.'
        );
      }
      throw err;
    }
  }

  /**
   * Lookup an artifact by ID and return its URL.
   * Used by AssetResolver for artifact_id: and asset_id: references.
   */
  async lookupArtifact(id: string): Promise<{ url: string }> {
    const artifact = await this.getArtifact(id);
    if (!artifact.url) {
      throw new Error(`Artifact ${id} has no URL`);
    }
    return { url: artifact.url };
  }
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isValidation(): boolean {
    return this.status === 400;
  }
}

// ─── Response normalization ──────────────────────────────────────────────────
//
// The platform's capability payload uses richer field shapes than the flat
// CapabilityInputField type the CLI's downstream consumers (inspect, run-spec,
// generate) expect. Normalize once at the API boundary so the rest of the CLI
// keeps working against a single shape.
//
// Platform inputContract field shape:
//   {
//     label, workflowInput, description, helpText, required, default,
//     options, exposed, uiControl, visibility, validation: { type, enum, ... }
//   }
//
// Flat CLI shape:
//   { name, type, label?, description?, required?, default?, enum? }

function normalizeCapability<T extends Capability>(cap: T): T {
  if (!cap || !Array.isArray((cap as Capability).inputContract)) {
    return cap;
  }
  const inputContract = (cap as Capability).inputContract!.map((f) =>
    normalizeInputField(f as unknown as Record<string, unknown>)
  );
  return { ...cap, inputContract } as T;
}

function normalizeInputField(raw: Record<string, unknown>): Record<string, unknown> {
  const validation = (raw.validation as Record<string, unknown> | undefined) ?? {};
  const name =
    (raw.name as string | undefined) ??
    (raw.workflowInput as string | undefined) ??
    (raw.label as string | undefined) ??
    'unknown';
  const type =
    (raw.type as string | undefined) ??
    (validation.type as string | undefined) ??
    'string';
  const description =
    (raw.description as string | undefined) ?? (raw.helpText as string | undefined);
  const enumValues =
    (raw.enum as unknown[] | undefined) ??
    (validation.enum as unknown[] | undefined) ??
    (raw.options as unknown[] | undefined);

  return {
    ...raw,
    name,
    type,
    ...(description !== undefined ? { description } : {}),
    ...(enumValues !== undefined ? { enum: enumValues } : {}),
  };
}
