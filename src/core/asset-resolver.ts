/**
 * AssetResolver — converts every form of asset input into a canonical URL ref
 * before the run spec is submitted.
 *
 * Supported input forms:
 *   - local file path  → upload via platform asset API, return URL
 *   - https?:// URL    → pass through as-is
 *   - asset_id:xxx     → resolve artifact URL from platform
 *   - artifact_id:xxx  → resolve artifact URL from platform
 *   - data:base64,...  → detect and forward as base64 type
 *
 * The resolver is intentionally unaware of capability semantics. It only
 * knows how to turn an opaque string reference into a canonical URL that
 * the platform workflow engine can consume.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AssetInput, CanonicalAssetRef } from './types';

const URL_RE = /^https?:\/\//i;
const ASSET_ID_RE = /^asset_id:(.+)$/;
const ARTIFACT_ID_RE = /^artifact_id:(.+)$/;
const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;

export interface AssetResolverOptions {
  /** Authenticated upload function. Provided by the API client at runtime. */
  uploadFn?: (filePath: string) => Promise<{ url: string; id?: string }>;
  /** Artifact lookup function. */
  lookupArtifactFn?: (id: string) => Promise<{ url: string }>;
}

export class AssetResolver {
  private uploadFn?: AssetResolverOptions['uploadFn'];
  private lookupArtifactFn?: AssetResolverOptions['lookupArtifactFn'];

  constructor(opts: AssetResolverOptions = {}) {
    this.uploadFn = opts.uploadFn;
    this.lookupArtifactFn = opts.lookupArtifactFn;
  }

  /**
   * Parse an arbitrary string into a typed AssetInput.
   */
  parse(raw: string): AssetInput {
    if (URL_RE.test(raw)) {
      return { type: 'url', url: raw };
    }

    const assetMatch = raw.match(ASSET_ID_RE);
    if (assetMatch) {
      return { type: 'asset_id', id: assetMatch[1] };
    }

    const artifactMatch = raw.match(ARTIFACT_ID_RE);
    if (artifactMatch) {
      return { type: 'artifact_id', id: artifactMatch[1] };
    }

    const dataMatch = raw.match(DATA_URI_RE);
    if (dataMatch) {
      return { type: 'base64', data: dataMatch[2], mimeType: dataMatch[1] };
    }

    // Treat as local file path (may not exist yet — resolved at resolve-time)
    return { type: 'local', path: path.resolve(raw) };
  }

  /**
   * Resolve an AssetInput to a CanonicalAssetRef.
   * Throws if a local file does not exist or an upload/lookup fails.
   */
  async resolve(input: AssetInput): Promise<CanonicalAssetRef> {
    switch (input.type) {
      case 'url': {
        return {
          url: input.url,
          originalInput: input,
        };
      }

      case 'asset_id': {
        if (!this.lookupArtifactFn) {
          throw new Error(
            `Cannot resolve asset_id "${input.id}" without an authenticated client. Run "whiz auth login" first.`
          );
        }
        const result = await this.lookupArtifactFn(input.id);
        return {
          url: result.url,
          originalInput: input,
        };
      }

      case 'artifact_id': {
        if (!this.lookupArtifactFn) {
          throw new Error(
            `Cannot resolve artifact_id "${input.id}" without an authenticated client. Run "whiz auth login" first.`
          );
        }
        const result = await this.lookupArtifactFn(input.id);
        return {
          url: result.url,
          originalInput: input,
        };
      }

      case 'base64': {
        return {
          url: `data:${input.mimeType};base64,${input.data}`,
          originalInput: input,
          mimeType: input.mimeType,
        };
      }

      case 'local': {
        const resolved = path.resolve(input.path);
        if (!fs.existsSync(resolved)) {
          throw new Error(`Local file not found: ${resolved}`);
        }

        const hash = await hashFile(resolved);

        if (this.uploadFn) {
          const { url } = await this.uploadFn(resolved);
          return {
            url,
            originalInput: input,
            mimeType: inferMimeType(resolved),
            contentHash: hash,
          };
        }

        // No upload function — caller must handle or provide a URL
        throw new Error(
          `Cannot upload "${resolved}" without an authenticated client. Run "whiz auth login" first.`
        );
      }
    }
  }

  /**
   * Resolve a string (any form) to a canonical URL string.
   * Convenience wrapper for common usage.
   */
  async resolveString(raw: string): Promise<string> {
    const input = this.parse(raw);
    const ref = await this.resolve(input);
    return ref.url;
  }

  /**
   * Walk an inputs object and resolve all values that look like asset
   * references (URL-like strings, local paths with known extensions, explicit
   * asset_id: / artifact_id: prefixes).
   *
   * Values that are not recognized as assets are passed through unchanged.
   * Arrays are mapped recursively.
   */
  async resolveInputs(
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      resolved[key] = await this.resolveValue(value);
    }

    return resolved;
  }

  private async resolveValue(value: unknown): Promise<unknown> {
    if (typeof value === 'string' && looksLikeAsset(value)) {
      try {
        return await this.resolveString(value);
      } catch {
        // If we can't resolve it (e.g., not authenticated), pass through and
        // let the server validate. This keeps dry-run and inspect working.
        return value;
      }
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map((v) => this.resolveValue(v)));
    }

    if (value !== null && typeof value === 'object') {
      return this.resolveInputs(value as Record<string, unknown>);
    }

    return value;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function looksLikeAsset(value: string): boolean {
  if (URL_RE.test(value)) return true;
  if (ASSET_ID_RE.test(value)) return true;
  if (ARTIFACT_ID_RE.test(value)) return true;
  if (DATA_URI_RE.test(value)) return true;
  if (KNOWN_EXTENSIONS.test(value)) return true;
  return false;
}

const KNOWN_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|mp4|mov|mkv|mp3|wav|pdf|svg)$/i;

function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
