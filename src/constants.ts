// ============================================================================
// PBS MCP Server — Constants
// ============================================================================

/** Default PBS API port */
export const PBS_DEFAULT_PORT = 8007;

/** Base path for management API calls */
export const API_BASE = "/api2/json";

/** Max characters in a single tool response before truncation */
export const CHARACTER_LIMIT = 50_000;

/** Default pagination limit */
export const DEFAULT_LIMIT = 50;

/** Human-readable backup type map */
export const BACKUP_TYPE_LABELS: Record<string, string> = {
  vm: "Virtual Machine",
  ct: "Container",
  host: "Host/Physical",
};
