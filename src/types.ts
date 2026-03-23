// ============================================================================
// PBS MCP Server — Type Definitions
// Models the Proxmox Backup Server REST API response shapes
// ============================================================================

/** Wrapper for all PBS API responses: { data: T } */
export interface PbsApiResponse<T> {
  data: T;
}

/** PBS authentication ticket response */
export interface PbsTicket {
  ticket: string;
  CSRFPreventionToken: string;
}

/** PBS version info */
export interface PbsVersion {
  version: string;
  release: string;
  repoid: string;
}

// ---------------------------------------------------------------------------
// Node / System
// ---------------------------------------------------------------------------

export interface PbsNodeStatus {
  cpu: number;
  cpuinfo: {
    cpus: number;
    model: string;
    sockets: number;
  };
  kversion: string;
  loadavg: [number, number, number];
  memory: { free: number; total: number; used: number };
  root: { avail: number; total: number; used: number };
  swap: { free: number; total: number; used: number };
  uptime: number;
  wait: number;
  info?: { fingerprint?: string };
}

export interface PbsTask {
  upid: string;
  node: string;
  pid: number;
  pstart: number;
  starttime: number;
  endtime?: number;
  type: string;
  id?: string;
  user: string;
  status?: string;
  worker_id?: string;
  worker_type?: string;
}

// ---------------------------------------------------------------------------
// Datastores
// ---------------------------------------------------------------------------

export interface PbsDatastoreConfig {
  name: string;
  path: string;
  comment?: string;
  "gc-schedule"?: string;
  "prune-schedule"?: string;
  "keep-last"?: number;
  "keep-hourly"?: number;
  "keep-daily"?: number;
  "keep-weekly"?: number;
  "keep-monthly"?: number;
  "keep-yearly"?: number;
  "verify-new"?: boolean;
  "notify-user"?: string;
  "notification-mode"?: string;
  "maintenance-mode"?: string;
  "maintenance-msg"?: string;
  tuning?: string;
}

export interface PbsDatastoreUsage {
  store: string;
  total: number;
  used: number;
  avail: number;
  "gc-status"?: PbsGcStatus;
  history?: Array<{ timestamp: number; used: number; total: number }>;
}

export interface PbsGcStatus {
  "last-run-upid"?: string;
  "last-run-endtime"?: number;
  "next-run"?: number;
  "removed-bytes"?: number;
  "removed-chunks"?: number;
  "pending-bytes"?: number;
  "pending-chunks"?: number;
  "disk-bytes"?: number;
  "disk-chunks"?: number;
  "deduplication-factor"?: number;
}

// ---------------------------------------------------------------------------
// Backup Groups & Snapshots
// ---------------------------------------------------------------------------

export interface PbsBackupGroup {
  "backup-type": string;  // "vm", "ct", "host"
  "backup-id": string;
  "last-backup": number;  // epoch timestamp
  "backup-count": number;
  files?: number;
  owner?: string;
  comment?: string;
}

export interface PbsSnapshot {
  "backup-type": string;
  "backup-id": string;
  "backup-time": number;
  files?: PbsSnapshotFile[];
  size?: number;
  owner?: string;
  protected?: boolean;
  comment?: string;
  verification?: PbsSnapshotVerification;
}

export interface PbsSnapshotFile {
  filename: string;
  size?: number;
  "crypt-mode"?: string;
}

export interface PbsSnapshotVerification {
  state: string;  // "ok", "failed"
  upid: string;
}

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

export interface PbsNamespace {
  ns: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Verification Jobs
// ---------------------------------------------------------------------------

export interface PbsVerificationJob {
  id: string;
  store: string;
  schedule?: string;
  "ignore-verified"?: boolean;
  "outdated-after"?: number;
  ns?: string;
  "max-depth"?: number;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Sync Jobs
// ---------------------------------------------------------------------------

export interface PbsSyncJob {
  id: string;
  store: string;
  remote: string;
  "remote-store": string;
  schedule?: string;
  "remove-vanished"?: boolean;
  ns?: string;
  "remote-ns"?: string;
  "max-depth"?: number;
  comment?: string;
  owner?: string;
  "group-filter"?: string;
}

// ---------------------------------------------------------------------------
// Prune Jobs
// ---------------------------------------------------------------------------

export interface PbsPruneJob {
  id: string;
  store: string;
  schedule?: string;
  "keep-last"?: number;
  "keep-hourly"?: number;
  "keep-daily"?: number;
  "keep-weekly"?: number;
  "keep-monthly"?: number;
  "keep-yearly"?: number;
  ns?: string;
  "max-depth"?: number;
  disable?: boolean;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Remotes
// ---------------------------------------------------------------------------

export interface PbsRemote {
  name: string;
  host: string;
  port?: number;
  "auth-id"?: string;
  fingerprint?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Traffic Control
// ---------------------------------------------------------------------------

export interface PbsTrafficControl {
  name: string;
  "rate-in"?: string;
  "rate-out"?: string;
  burst_in?: string;
  burst_out?: string;
  network?: string;
  timeframe?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Users & Tokens
// ---------------------------------------------------------------------------

export interface PbsUser {
  userid: string;
  comment?: string;
  email?: string;
  enable?: boolean;
  expire?: number;
  firstname?: string;
  lastname?: string;
}

export interface PbsApiToken {
  tokenid: string;
  comment?: string;
  enable?: boolean;
  expire?: number;
}

// ---------------------------------------------------------------------------
// Disks
// ---------------------------------------------------------------------------

export interface PbsDisk {
  devpath: string;
  name: string;
  size: number;
  model?: string;
  serial?: string;
  vendor?: string;
  used?: string;
  "gpt"?: boolean;
  rpm?: number;
  wearout?: number;
  health?: string;
}
