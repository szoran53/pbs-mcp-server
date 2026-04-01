// ============================================================================
// PBS MCP Server — Datastore Tools
// Covers: list/config datastores, usage, GC, groups, snapshots, namespaces
// ============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PbsClient } from "../services/pbs-client.js";
import {
  formatBytes,
  formatTimestamp,
  formatPercent,
  backupTypeLabel,
  formatGroupId,
  formatSnapshotId,
} from "../services/formatters.js";
import type {
  PbsDatastoreConfig,
  PbsDatastoreUsage,
  PbsBackupGroup,
  PbsSnapshot,
  PbsNamespace,
} from "../types.js";

export function registerDatastoreTools(
  server: McpServer,
  client: PbsClient
): void {
  // -----------------------------------------------------------------------
  // pbs_list_datastores
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_datastores",
    {
      title: "List PBS Datastores",
      description: `List all configured datastores on the PBS server with their paths, comments, and retention settings.

Returns:
  Array of datastores with name, path, comment, GC schedule, prune schedule, and keep-* retention counts.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const stores = await client.get<PbsDatastoreConfig[]>(
          "/config/datastore"
        );
        if (!stores.length) {
          return { content: [{ type: "text", text: "No datastores found. If datastores exist, the token may lack Sys.Audit privilege (required to list all datastores)." }] };
        }
        const lines = [`## PBS Datastores (${stores.length})`, ""];
        for (const s of stores) {
          lines.push(`### ${s.name}`);
          lines.push(`- **Path**: ${s.path}`);
          if (s.comment) lines.push(`- **Comment**: ${s.comment}`);
          if (s["gc-schedule"]) lines.push(`- **GC Schedule**: ${s["gc-schedule"]}`);
          if (s["prune-schedule"]) lines.push(`- **Prune Schedule**: ${s["prune-schedule"]}`);
          const keeps: string[] = [];
          if (s["keep-last"] !== undefined) keeps.push(`last=${s["keep-last"]}`);
          if (s["keep-hourly"] !== undefined) keeps.push(`hourly=${s["keep-hourly"]}`);
          if (s["keep-daily"] !== undefined) keeps.push(`daily=${s["keep-daily"]}`);
          if (s["keep-weekly"] !== undefined) keeps.push(`weekly=${s["keep-weekly"]}`);
          if (s["keep-monthly"] !== undefined) keeps.push(`monthly=${s["keep-monthly"]}`);
          if (s["keep-yearly"] !== undefined) keeps.push(`yearly=${s["keep-yearly"]}`);
          if (keeps.length) lines.push(`- **Retention**: ${keeps.join(", ")}`);
          if (s["verify-new"]) lines.push(`- **Verify New**: yes`);
          if (s["maintenance-mode"]) lines.push(`- **Maintenance**: ${s["maintenance-mode"]} — ${s["maintenance-msg"] ?? ""}`);
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_get_datastore_usage
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_get_datastore_usage",
    {
      title: "Get Datastore Usage",
      description: `Get usage statistics for all datastores: total/used/available space, GC status, and deduplication factor.

Returns:
  For each datastore: name, total, used, available, percent used, GC last-run time, dedup factor, removed/pending bytes/chunks.`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const usage = await client.get<PbsDatastoreUsage[]>(
          "/status/datastore-usage"
        );
        if (!usage.length) {
          return { content: [{ type: "text", text: "No datastore usage data available." }] };
        }
        const lines = [`## Datastore Usage`, ""];
        for (const u of usage) {
          const pct = u.total > 0 ? formatPercent(u.used / u.total) : "n/a";
          lines.push(`### ${u.store}`);
          lines.push(`- **Total**: ${formatBytes(u.total)}`);
          lines.push(`- **Used**: ${formatBytes(u.used)} (${pct})`);
          lines.push(`- **Available**: ${formatBytes(u.avail)}`);
          if (u["gc-status"]) {
            const gc = u["gc-status"];
            if (gc["deduplication-factor"] !== undefined) {
              lines.push(`- **Dedup Factor**: ${gc["deduplication-factor"].toFixed(2)}x`);
            }
            if (gc["disk-chunks"] !== undefined) {
              lines.push(`- **Chunks on Disk**: ${gc["disk-chunks"].toLocaleString()} (${formatBytes(gc["disk-bytes"] ?? 0)})`);
            }
            if (gc["pending-chunks"] !== undefined) {
              lines.push(`- **Pending GC**: ${gc["pending-chunks"].toLocaleString()} chunks (${formatBytes(gc["pending-bytes"] ?? 0)})`);
            }
            if (gc["last-run-endtime"]) {
              lines.push(`- **Last GC**: ${formatTimestamp(gc["last-run-endtime"])}`);
            }
            if (gc["removed-bytes"] !== undefined) {
              lines.push(`- **Last GC Removed**: ${gc["removed-chunks"]?.toLocaleString() ?? 0} chunks (${formatBytes(gc["removed-bytes"])})`);
            }
          }
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_list_groups
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_groups",
    {
      title: "List Backup Groups",
      description: `List all backup groups in a datastore. Groups are organized by backup type (vm, ct, host) and ID.

Args:
  - store (string): Datastore name
  - ns (string, optional): Namespace path (e.g. "ns1/ns2")

Returns:
  Array of backup groups with type, ID, last backup time, backup count, and owner.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
        ns: z.string().optional().describe("Namespace path (e.g. 'ns1/ns2')"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const qp: Record<string, string> = {};
        if (params.ns) qp.ns = params.ns;

        const groups = await client.get<PbsBackupGroup[]>(
          `/admin/datastore/${encodeURIComponent(params.store)}/groups`,
          qp
        );

        if (!groups.length) {
          return {
            content: [
              {
                type: "text",
                text: `No backup groups found in datastore "${params.store}"${params.ns ? ` namespace "${params.ns}"` : ""}.`,
              },
            ],
          };
        }

        const lines = [
          `## Backup Groups in "${params.store}"${params.ns ? ` (ns: ${params.ns})` : ""} — ${groups.length} groups`,
          "",
        ];
        for (const g of groups) {
          const gid = formatGroupId(g["backup-type"], g["backup-id"]);
          lines.push(
            `- **${gid}** — ${backupTypeLabel(g["backup-type"])} — ${g["backup-count"]} snapshots — last: ${formatTimestamp(g["last-backup"])}${g.owner ? ` — owner: ${g.owner}` : ""}`
          );
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_list_snapshots
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_snapshots",
    {
      title: "List Snapshots",
      description: `List snapshots in a datastore, optionally filtered by backup type and ID.

Args:
  - store (string): Datastore name
  - backup_type (string, optional): Filter by type — "vm", "ct", or "host"
  - backup_id (string, optional): Filter by backup ID (e.g. "100")
  - ns (string, optional): Namespace path

Returns:
  Array of snapshots with type, ID, timestamp, size, protection status, verification state, and file list.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
        backup_type: z
          .enum(["vm", "ct", "host"])
          .optional()
          .describe("Filter by backup type"),
        backup_id: z
          .string()
          .optional()
          .describe("Filter by backup ID (e.g. '100')"),
        ns: z.string().optional().describe("Namespace path"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const qp: Record<string, string> = {};
        if (params.backup_type) qp["backup-type"] = params.backup_type;
        if (params.backup_id) qp["backup-id"] = params.backup_id;
        if (params.ns) qp.ns = params.ns;

        const snaps = await client.get<PbsSnapshot[]>(
          `/admin/datastore/${encodeURIComponent(params.store)}/snapshots`,
          qp
        );

        if (!snaps.length) {
          return { content: [{ type: "text", text: "No snapshots found matching filters." }] };
        }

        const lines = [`## Snapshots (${snaps.length})`, ""];
        for (const s of snaps) {
          const sid = formatSnapshotId(
            s["backup-type"],
            s["backup-id"],
            s["backup-time"]
          );
          const prot = s.protected ? " 🔒" : "";
          const ver = s.verification
            ? ` — verified: ${s.verification.state}`
            : "";
          const sz = s.size !== undefined ? ` — ${formatBytes(s.size)}` : "";
          lines.push(`- **${sid}**${prot}${sz}${ver}`);
          if (s.files && s.files.length > 0) {
            for (const f of s.files) {
              const fsz = f.size !== undefined ? ` (${formatBytes(f.size)})` : "";
              const crypt = f["crypt-mode"] ? ` [${f["crypt-mode"]}]` : "";
              lines.push(`  - ${f.filename}${fsz}${crypt}`);
            }
          }
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_run_garbage_collection
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_run_garbage_collection",
    {
      title: "Run Garbage Collection",
      description: `Start a garbage collection job on a datastore. Returns the task UPID which can be tracked with pbs_get_task_status.

Args:
  - store (string): Datastore name

Returns:
  Task UPID for the started GC job.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const upid = await client.post<string>(
          `/admin/datastore/${encodeURIComponent(params.store)}/gc`
        );
        return {
          content: [
            {
              type: "text",
              text: `Garbage collection started on "${params.store}". Track with UPID: ${upid}`,
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_run_verify
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_run_verify",
    {
      title: "Run Verification",
      description: `Start a verification job on a datastore to check backup integrity. Returns a task UPID.

Args:
  - store (string): Datastore name
  - backup_type (string, optional): Only verify this backup type
  - backup_id (string, optional): Only verify this backup ID
  - ignore_verified (boolean, optional): Skip already-verified snapshots (default true)
  - outdated_after (number, optional): Re-verify if last verification is older than this many days
  - ns (string, optional): Namespace path

Returns:
  Task UPID for the started verification job.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
        backup_type: z.enum(["vm", "ct", "host"]).optional().describe("Filter by backup type"),
        backup_id: z.string().optional().describe("Filter by backup ID"),
        ignore_verified: z.boolean().optional().describe("Skip already-verified snapshots"),
        outdated_after: z.number().int().optional().describe("Re-verify if older than N days"),
        ns: z.string().optional().describe("Namespace path"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        if (params.backup_type) body["backup-type"] = params.backup_type;
        if (params.backup_id) body["backup-id"] = params.backup_id;
        if (params.ignore_verified !== undefined) body["ignore-verified"] = params.ignore_verified;
        if (params.outdated_after !== undefined) body["outdated-after"] = params.outdated_after;
        if (params.ns) body.ns = params.ns;

        const upid = await client.post<string>(
          `/admin/datastore/${encodeURIComponent(params.store)}/verify`,
          body
        );
        return {
          content: [
            {
              type: "text",
              text: `Verification started on "${params.store}". Track with UPID: ${upid}`,
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_prune_datastore
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_prune_datastore",
    {
      title: "Prune Datastore",
      description: `Run a prune operation on a backup group to remove old snapshots per retention policy. Supports dry-run mode.

Args:
  - store (string): Datastore name
  - backup_type (string): Backup type — "vm", "ct", or "host"
  - backup_id (string): Backup ID (e.g. "100")
  - dry_run (boolean, optional): If true, only show what would be pruned (default false)
  - keep_last (number, optional): Keep the last N snapshots
  - keep_hourly (number, optional): Keep N hourly snapshots
  - keep_daily (number, optional): Keep N daily snapshots
  - keep_weekly (number, optional): Keep N weekly snapshots
  - keep_monthly (number, optional): Keep N monthly snapshots
  - keep_yearly (number, optional): Keep N yearly snapshots
  - ns (string, optional): Namespace path

Returns:
  Task UPID or dry-run results showing which snapshots would be removed/kept.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
        backup_type: z.enum(["vm", "ct", "host"]).describe("Backup type"),
        backup_id: z.string().min(1).describe("Backup ID (e.g. '100')"),
        dry_run: z.boolean().default(false).describe("Only show what would be pruned"),
        keep_last: z.number().int().min(0).optional().describe("Keep last N snapshots"),
        keep_hourly: z.number().int().min(0).optional().describe("Keep N hourly"),
        keep_daily: z.number().int().min(0).optional().describe("Keep N daily"),
        keep_weekly: z.number().int().min(0).optional().describe("Keep N weekly"),
        keep_monthly: z.number().int().min(0).optional().describe("Keep N monthly"),
        keep_yearly: z.number().int().min(0).optional().describe("Keep N yearly"),
        ns: z.string().optional().describe("Namespace path"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          "backup-type": params.backup_type,
          "backup-id": params.backup_id,
        };
        if (params.dry_run) body["dry-run"] = true;
        if (params.keep_last !== undefined) body["keep-last"] = params.keep_last;
        if (params.keep_hourly !== undefined) body["keep-hourly"] = params.keep_hourly;
        if (params.keep_daily !== undefined) body["keep-daily"] = params.keep_daily;
        if (params.keep_weekly !== undefined) body["keep-weekly"] = params.keep_weekly;
        if (params.keep_monthly !== undefined) body["keep-monthly"] = params.keep_monthly;
        if (params.keep_yearly !== undefined) body["keep-yearly"] = params.keep_yearly;
        if (params.ns) body.ns = params.ns;

        const result = await client.post<unknown>(
          `/admin/datastore/${encodeURIComponent(params.store)}/prune`,
          body
        );

        const prefix = params.dry_run ? "Prune dry-run" : "Prune started";
        return {
          content: [
            {
              type: "text",
              text: `${prefix} on "${params.store}" for ${params.backup_type}/${params.backup_id}:\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_list_namespaces
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_namespaces",
    {
      title: "List Namespaces",
      description: `List backup namespaces in a datastore.

Args:
  - store (string): Datastore name
  - parent (string, optional): Parent namespace to list children of

Returns:
  Array of namespace paths and their comments.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
        parent: z.string().optional().describe("Parent namespace path"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const qp: Record<string, string> = {};
        if (params.parent) qp.parent = params.parent;

        const nss = await client.get<PbsNamespace[]>(
          `/admin/datastore/${encodeURIComponent(params.store)}/namespace`,
          qp
        );

        if (!nss.length) {
          return { content: [{ type: "text", text: "No namespaces found." }] };
        }

        const lines = [`## Namespaces in "${params.store}" (${nss.length})`, ""];
        for (const ns of nss) {
          lines.push(`- **${ns.ns}**${ns.comment ? ` — ${ns.comment}` : ""}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_protect_snapshot
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_protect_snapshot",
    {
      title: "Protect/Unprotect Snapshot",
      description: `Set or remove protection on a backup snapshot. Protected snapshots cannot be pruned or deleted.

Args:
  - store (string): Datastore name
  - backup_type (string): "vm", "ct", or "host"
  - backup_id (string): Backup ID
  - backup_time (string): Backup timestamp in ISO format (e.g. "2025-03-22T04:00:00Z")
  - protected (boolean): true to protect, false to unprotect
  - ns (string, optional): Namespace path

Returns:
  Confirmation of the protection change.`,
      inputSchema: {
        store: z.string().min(1).describe("Datastore name"),
        backup_type: z.enum(["vm", "ct", "host"]).describe("Backup type"),
        backup_id: z.string().min(1).describe("Backup ID"),
        backup_time: z.string().min(1).describe("Backup timestamp in ISO format"),
        protected: z.boolean().describe("true to protect, false to unprotect"),
        ns: z.string().optional().describe("Namespace path"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          "backup-type": params.backup_type,
          "backup-id": params.backup_id,
          "backup-time": params.backup_time,
          protected: params.protected,
        };
        if (params.ns) body.ns = params.ns;

        await client.put<unknown>(
          `/admin/datastore/${encodeURIComponent(params.store)}/protected`,
          body
        );

        const action = params.protected ? "protected" : "unprotected";
        const sid = `${params.backup_type}/${params.backup_id}/${params.backup_time}`;
        return {
          content: [
            { type: "text", text: `Snapshot ${sid} is now ${action}.` },
          ],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );
}
