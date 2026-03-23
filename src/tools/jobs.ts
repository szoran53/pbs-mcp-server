// ============================================================================
// PBS MCP Server — Job Management Tools
// Covers: verification jobs, sync jobs, prune jobs, remotes
// ============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PbsClient } from "../services/pbs-client.js";
import type {
  PbsVerificationJob,
  PbsSyncJob,
  PbsPruneJob,
  PbsRemote,
} from "../types.js";

export function registerJobTools(
  server: McpServer,
  client: PbsClient
): void {
  // -----------------------------------------------------------------------
  // pbs_list_verification_jobs
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_verification_jobs",
    {
      title: "List Verification Jobs",
      description: `List all scheduled verification jobs configured on the PBS server.

Returns:
  Array of verification jobs with ID, store, schedule, ignore-verified flag, outdated-after, namespace, and comment.`,
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
        const jobs = await client.get<PbsVerificationJob[]>(
          "/config/verify"
        );
        if (!jobs.length) {
          return { content: [{ type: "text", text: "No verification jobs configured." }] };
        }
        const lines = [`## Verification Jobs (${jobs.length})`, ""];
        for (const j of jobs) {
          lines.push(`### ${j.id}`);
          lines.push(`- **Store**: ${j.store}`);
          if (j.schedule) lines.push(`- **Schedule**: ${j.schedule}`);
          if (j["ignore-verified"] !== undefined) lines.push(`- **Ignore Verified**: ${j["ignore-verified"]}`);
          if (j["outdated-after"] !== undefined) lines.push(`- **Outdated After**: ${j["outdated-after"]} days`);
          if (j.ns) lines.push(`- **Namespace**: ${j.ns}`);
          if (j.comment) lines.push(`- **Comment**: ${j.comment}`);
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
  // pbs_run_verification_job
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_run_verification_job",
    {
      title: "Run Verification Job",
      description: `Manually trigger a configured verification job by ID.

Args:
  - id (string): Verification job ID

Returns:
  Task UPID for the started job.`,
      inputSchema: {
        id: z.string().min(1).describe("Verification job ID"),
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
          `/config/verify/${encodeURIComponent(params.id)}/run`
        );
        return {
          content: [{ type: "text", text: `Verification job "${params.id}" started. UPID: ${upid}` }],
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
  // pbs_list_sync_jobs
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_sync_jobs",
    {
      title: "List Sync Jobs",
      description: `List all configured sync jobs that replicate data between PBS servers.

Returns:
  Array of sync jobs with ID, local store, remote name, remote store, schedule, remove-vanished flag, namespace settings, and comments.`,
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
        const jobs = await client.get<PbsSyncJob[]>("/config/sync");
        if (!jobs.length) {
          return { content: [{ type: "text", text: "No sync jobs configured." }] };
        }
        const lines = [`## Sync Jobs (${jobs.length})`, ""];
        for (const j of jobs) {
          lines.push(`### ${j.id}`);
          lines.push(`- **Local Store**: ${j.store}`);
          lines.push(`- **Remote**: ${j.remote} → ${j["remote-store"]}`);
          if (j.schedule) lines.push(`- **Schedule**: ${j.schedule}`);
          if (j["remove-vanished"] !== undefined) lines.push(`- **Remove Vanished**: ${j["remove-vanished"]}`);
          if (j.ns) lines.push(`- **Local Namespace**: ${j.ns}`);
          if (j["remote-ns"]) lines.push(`- **Remote Namespace**: ${j["remote-ns"]}`);
          if (j.owner) lines.push(`- **Owner**: ${j.owner}`);
          if (j.comment) lines.push(`- **Comment**: ${j.comment}`);
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
  // pbs_run_sync_job
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_run_sync_job",
    {
      title: "Run Sync Job",
      description: `Manually trigger a configured sync job by ID.

Args:
  - id (string): Sync job ID

Returns:
  Task UPID for the started job.`,
      inputSchema: {
        id: z.string().min(1).describe("Sync job ID"),
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
          `/config/sync/${encodeURIComponent(params.id)}/run`
        );
        return {
          content: [{ type: "text", text: `Sync job "${params.id}" started. UPID: ${upid}` }],
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
  // pbs_list_prune_jobs
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_prune_jobs",
    {
      title: "List Prune Jobs",
      description: `List all configured scheduled prune jobs.

Returns:
  Array of prune jobs with ID, store, schedule, retention settings, namespace, and disabled status.`,
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
        const jobs = await client.get<PbsPruneJob[]>("/config/prune");
        if (!jobs.length) {
          return { content: [{ type: "text", text: "No prune jobs configured." }] };
        }
        const lines = [`## Prune Jobs (${jobs.length})`, ""];
        for (const j of jobs) {
          const disabled = j.disable ? " (DISABLED)" : "";
          lines.push(`### ${j.id}${disabled}`);
          lines.push(`- **Store**: ${j.store}`);
          if (j.schedule) lines.push(`- **Schedule**: ${j.schedule}`);
          const keeps: string[] = [];
          if (j["keep-last"] !== undefined) keeps.push(`last=${j["keep-last"]}`);
          if (j["keep-hourly"] !== undefined) keeps.push(`hourly=${j["keep-hourly"]}`);
          if (j["keep-daily"] !== undefined) keeps.push(`daily=${j["keep-daily"]}`);
          if (j["keep-weekly"] !== undefined) keeps.push(`weekly=${j["keep-weekly"]}`);
          if (j["keep-monthly"] !== undefined) keeps.push(`monthly=${j["keep-monthly"]}`);
          if (j["keep-yearly"] !== undefined) keeps.push(`yearly=${j["keep-yearly"]}`);
          if (keeps.length) lines.push(`- **Retention**: ${keeps.join(", ")}`);
          if (j.ns) lines.push(`- **Namespace**: ${j.ns}`);
          if (j.comment) lines.push(`- **Comment**: ${j.comment}`);
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
  // pbs_list_remotes
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_remotes",
    {
      title: "List Remotes",
      description: `List all configured remote PBS servers used for sync jobs.

Returns:
  Array of remotes with name, host, port, auth-id, fingerprint, and comment.`,
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
        const remotes = await client.get<PbsRemote[]>("/config/remote");
        if (!remotes.length) {
          return { content: [{ type: "text", text: "No remotes configured." }] };
        }
        const lines = [`## Remotes (${remotes.length})`, ""];
        for (const r of remotes) {
          lines.push(`### ${r.name}`);
          lines.push(`- **Host**: ${r.host}${r.port ? `:${r.port}` : ""}`);
          if (r["auth-id"]) lines.push(`- **Auth ID**: ${r["auth-id"]}`);
          if (r.fingerprint) lines.push(`- **Fingerprint**: ${r.fingerprint}`);
          if (r.comment) lines.push(`- **Comment**: ${r.comment}`);
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
}
