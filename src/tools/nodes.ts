// ============================================================================
// PBS MCP Server — Node & System Tools
// ============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PbsClient } from "../services/pbs-client.js";
import {
  formatBytes,
  formatUptime,
  formatPercent,
} from "../services/formatters.js";
import type { PbsNodeStatus, PbsVersion, PbsTask } from "../types.js";

export function registerNodeTools(server: McpServer, client: PbsClient): void {
  // -----------------------------------------------------------------------
  // pbs_get_version
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_get_version",
    {
      title: "Get PBS Version",
      description:
        "Returns the Proxmox Backup Server version, release, and repository ID. Use this to confirm connectivity and check which PBS version is running.",
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
        const v = await client.get<PbsVersion>("/version");
        const text = `PBS ${v.version}-${v.release} (repo: ${v.repoid})`;
        return { content: [{ type: "text", text }] };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // pbs_get_node_status
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_get_node_status",
    {
      title: "Get PBS Node Status",
      description: `Returns detailed status of the PBS node: CPU usage, memory, disk, swap, load averages, uptime, and kernel version.

Returns:
  - CPU model, core count, and current usage percentage
  - Memory: free / total / used
  - Root filesystem: available / total / used
  - Swap: free / total / used
  - Uptime and load averages
  - Kernel version`,
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
        const s = await client.get<PbsNodeStatus>("/nodes/localhost/status");
        const lines = [
          `## PBS Node Status`,
          ``,
          `**CPU**: ${s.cpuinfo.model} (${s.cpuinfo.cpus} cores, ${s.cpuinfo.sockets} socket)`,
          `**CPU Usage**: ${formatPercent(s.cpu)}`,
          `**Load**: ${s.loadavg.map((l) => l.toFixed(2)).join(", ")}`,
          `**Memory**: ${formatBytes(s.memory.used)} / ${formatBytes(s.memory.total)} (${formatPercent(s.memory.used / s.memory.total)})`,
          `**Root FS**: ${formatBytes(s.root.total - s.root.avail)} used / ${formatBytes(s.root.total)} (${formatBytes(s.root.avail)} free)`,
          `**Swap**: ${formatBytes(s.swap.used)} / ${formatBytes(s.swap.total)}`,
          `**Uptime**: ${formatUptime(s.uptime)}`,
          `**Kernel**: ${s.kversion}`,
          `**IO Wait**: ${formatPercent(s.wait)}`,
        ];
        if (s.info?.fingerprint) {
          lines.push(`**Fingerprint**: ${s.info.fingerprint}`);
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
  // pbs_list_tasks
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_list_tasks",
    {
      title: "List PBS Tasks",
      description: `List recent tasks on the PBS node. Returns task UPID, type, user, start/end times, and status.

Args:
  - limit (number): Max tasks to return (default 30, max 200)
  - running (boolean): If true, only show currently running tasks
  - typefilter (string): Filter by task type, e.g. "garbage_collection", "verify", "prune", "sync"
  - statusfilter (string): Filter by status, e.g. "ok", "error"

Returns:
  List of tasks with UPID, type, user, timestamps, and completion status.`,
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(30)
          .describe("Max tasks to return"),
        running: z
          .boolean()
          .optional()
          .describe("Only show running tasks"),
        typefilter: z
          .string()
          .optional()
          .describe("Filter by task type (e.g. garbage_collection, verify, prune, sync)"),
        statusfilter: z
          .string()
          .optional()
          .describe("Filter by status (ok, error, etc.)"),
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
        const qp: Record<string, string> = {
          limit: String(params.limit ?? 30),
        };
        if (params.running) qp.running = "1";
        if (params.typefilter) qp.typefilter = params.typefilter;
        if (params.statusfilter) qp.statusfilter = params.statusfilter;

        const tasks = await client.get<PbsTask[]>(
          "/nodes/localhost/tasks",
          qp
        );

        if (!tasks.length) {
          return { content: [{ type: "text", text: "No tasks found matching filters." }] };
        }

        const lines = [`## PBS Tasks (${tasks.length} results)`, ""];
        for (const t of tasks) {
          const start = new Date(t.starttime * 1000).toISOString();
          const end = t.endtime
            ? new Date(t.endtime * 1000).toISOString()
            : "running";
          const status = t.status ?? "running";
          lines.push(
            `- **${t.worker_type ?? t.type}** (${t.id ?? ""}) — ${status} — started ${start}, ended ${end} — user: ${t.user}`
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
  // pbs_get_task_status
  // -----------------------------------------------------------------------
  server.registerTool(
    "pbs_get_task_status",
    {
      title: "Get PBS Task Status",
      description: `Get the status and log output of a specific task by its UPID.

Args:
  - upid (string): The task UPID

Returns:
  Task status and log lines.`,
      inputSchema: {
        upid: z.string().min(1).describe("Task UPID string"),
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
        const encoded = encodeURIComponent(params.upid);
        const status = await client.get<Record<string, unknown>>(
          `/nodes/localhost/tasks/${encoded}/status`
        );
        const log = await client.get<Array<{ n: number; t: string }>>(
          `/nodes/localhost/tasks/${encoded}/log`
        );

        const lines = [
          `## Task Status`,
          `**UPID**: ${params.upid}`,
          `**Status**: ${String(status.status ?? "unknown")}`,
          `**Exit Status**: ${String(status.exitstatus ?? "n/a")}`,
          "",
          "### Log",
          ...log.map((l) => l.t),
        ];
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
