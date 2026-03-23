# pbs-mcp-server

MCP server for [Proxmox Backup Server](https://www.proxmox.com/en/proxmox-backup-server) — manage datastores, snapshots, verification, prune jobs, sync jobs, garbage collection, and more via any MCP-compatible AI client.

## Tools

### Node & System
| Tool | Description |
|------|-------------|
| `pbs_get_version` | Get PBS version and repo ID |
| `pbs_get_node_status` | CPU, memory, disk, swap, uptime, load averages |
| `pbs_list_tasks` | List recent tasks (filterable by type, status, running) |
| `pbs_get_task_status` | Get status and log output for a task UPID |

### Datastores
| Tool | Description |
|------|-------------|
| `pbs_list_datastores` | List all datastores with retention config |
| `pbs_get_datastore_usage` | Storage usage, dedup factor, GC status |
| `pbs_list_groups` | List backup groups (vm/ct/host) in a datastore |
| `pbs_list_snapshots` | List snapshots, filterable by type/ID/namespace |
| `pbs_list_namespaces` | List namespaces in a datastore |
| `pbs_run_garbage_collection` | Start GC on a datastore |
| `pbs_run_verify` | Start verification on a datastore or group |
| `pbs_prune_datastore` | Prune a backup group (supports dry-run) |
| `pbs_protect_snapshot` | Protect or unprotect a snapshot from pruning |

### Jobs & Remotes
| Tool | Description |
|------|-------------|
| `pbs_list_verification_jobs` | List scheduled verification jobs |
| `pbs_run_verification_job` | Manually trigger a verification job |
| `pbs_list_sync_jobs` | List configured sync jobs |
| `pbs_run_sync_job` | Manually trigger a sync job |
| `pbs_list_prune_jobs` | List scheduled prune jobs |
| `pbs_list_remotes` | List configured remote PBS servers |

## Setup

### 1. Install

```bash
npm install -g pbs-mcp-server
```

Or run directly without installing:

```bash
npx pbs-mcp-server
```

### 2. Create a PBS API Token

In the PBS web UI: **Configuration → Access Control → API Tokens → Add**

Give it the `DatastoreAdmin` or `Admin` role depending on what you need.

### 3. Configure environment variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PBS_HOST` | Yes | PBS IP or hostname (no port, no trailing slash) |
| `PBS_PORT` | No | API port, default `8007` |
| `PBS_TOKEN_ID` | Yes* | API token ID, e.g. `user@pbs!mytoken` |
| `PBS_TOKEN_SECRET` | Yes* | API token secret |
| `PBS_USERNAME` | Yes* | Username for ticket auth (alternative to token) |
| `PBS_PASSWORD` | Yes* | Password for ticket auth |
| `PBS_VERIFY_SSL` | No | Set to `false` for self-signed certs (default: `true`) |
| `TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP mode port, default `3100` |

*Either `PBS_TOKEN_ID`+`PBS_TOKEN_SECRET` **or** `PBS_USERNAME`+`PBS_PASSWORD` is required.

## Claude Code (stdio)

```bash
claude mcp add --transport stdio pbs-mcp-server \
  -e PBS_HOST=192.168.1.10 \
  -e PBS_TOKEN_ID=user@pbs!mytoken \
  -e PBS_TOKEN_SECRET=your-secret \
  -e PBS_VERIFY_SSL=false \
  -- pbs-mcp-server
```

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pbs": {
      "command": "pbs-mcp-server",
      "env": {
        "PBS_HOST": "192.168.1.10",
        "PBS_TOKEN_ID": "user@pbs!mytoken",
        "PBS_TOKEN_SECRET": "your-secret",
        "PBS_VERIFY_SSL": "false"
      }
    }
  }
}
```

## HTTP Mode

Start the server in HTTP mode for use with SSE-capable clients:

```bash
TRANSPORT=http PBS_HOST=192.168.1.10 PBS_TOKEN_ID=user@pbs!mytoken \
  PBS_TOKEN_SECRET=your-secret PBS_VERIFY_SSL=false pbs-mcp-server
```

Health check: `GET http://localhost:3100/health`
MCP endpoint: `POST http://localhost:3100/mcp`

## Development

```bash
npm install
npm run build      # compile TypeScript
npm run dev        # watch mode
```

## License

MIT
