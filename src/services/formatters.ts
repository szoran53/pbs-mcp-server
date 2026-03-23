// ============================================================================
// PBS MCP Server — Formatting Helpers
// ============================================================================

import { BACKUP_TYPE_LABELS } from "../constants.js";

/** Format bytes into human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

/** Format epoch seconds to ISO-ish human-readable string */
export function formatTimestamp(epoch: number): string {
  return new Date(epoch * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

/** Format seconds to human-readable uptime */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}

/** Format percentage with 1 decimal */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Get friendly label for backup type */
export function backupTypeLabel(type: string): string {
  return BACKUP_TYPE_LABELS[type] ?? type;
}

/** Format a backup group ID like "vm/100" */
export function formatGroupId(type: string, id: string): string {
  return `${type}/${id}`;
}

/** Format a snapshot ID like "vm/100/2025-03-22T04:00:00Z" */
export function formatSnapshotId(
  type: string,
  id: string,
  time: number
): string {
  const ts = new Date(time * 1000).toISOString();
  return `${type}/${id}/${ts}`;
}
