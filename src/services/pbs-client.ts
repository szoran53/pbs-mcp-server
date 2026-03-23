// ============================================================================
// PBS MCP Server — API Client
// Handles authentication (API token or ticket) and HTTP requests to PBS
// ============================================================================

import { PBS_DEFAULT_PORT, API_BASE } from "../constants.js";
import type { PbsApiResponse, PbsTicket } from "../types.js";

// ---------------------------------------------------------------------------
// Configuration — read from environment
// ---------------------------------------------------------------------------

export interface PbsConfig {
  host: string;
  port: number;
  tokenId?: string;    // e.g. "user@pbs!token-name"
  tokenSecret?: string;
  username?: string;    // fallback: ticket auth
  password?: string;
  verifySsl: boolean;
}

export function loadConfig(): PbsConfig {
  const host = process.env.PBS_HOST;
  if (!host) {
    throw new Error(
      "PBS_HOST is required. Set it to your Proxmox Backup Server address (IP or hostname)."
    );
  }

  return {
    host,
    port: parseInt(process.env.PBS_PORT || String(PBS_DEFAULT_PORT), 10),
    tokenId: process.env.PBS_TOKEN_ID,
    tokenSecret: process.env.PBS_TOKEN_SECRET,
    username: process.env.PBS_USERNAME,
    password: process.env.PBS_PASSWORD,
    verifySsl: process.env.PBS_VERIFY_SSL !== "false",
  };
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------

export class PbsClient {
  private config: PbsConfig;
  private ticket?: string;
  private csrfToken?: string;
  private ticketExpires = 0;

  constructor(config: PbsConfig) {
    this.config = config;
  }

  /** Base URL for API requests */
  private get baseUrl(): string {
    return `https://${this.config.host}:${this.config.port}${API_BASE}`;
  }

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  private get authHeader(): string {
    if (this.config.tokenId && this.config.tokenSecret) {
      return `PBSAPIToken=${this.config.tokenId}:${this.config.tokenSecret}`;
    }
    if (this.ticket) {
      return `PBSAuthCookie=${this.ticket}`;
    }
    throw new Error(
      "No authentication configured. Set PBS_TOKEN_ID + PBS_TOKEN_SECRET, or PBS_USERNAME + PBS_PASSWORD."
    );
  }

  private async ensureAuth(): Promise<void> {
    // API token auth — no ticket needed
    if (this.config.tokenId && this.config.tokenSecret) return;

    // Ticket auth — refresh if expired (tickets last 2 hours)
    const now = Date.now() / 1000;
    if (this.ticket && this.ticketExpires > now) return;

    if (!this.config.username || !this.config.password) {
      throw new Error(
        "PBS_USERNAME and PBS_PASSWORD are required when not using API token auth."
      );
    }

    const url = `${this.baseUrl}/access/ticket`;
    const body = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
    });

    const resp = await this.rawFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`PBS authentication failed (${resp.status}): ${text}`);
    }

    const json = (await resp.json()) as PbsApiResponse<PbsTicket>;
    this.ticket = json.data.ticket;
    this.csrfToken = json.data.CSRFPreventionToken;
    this.ticketExpires = now + 7000; // refresh before 2h expiry
  }

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private async rawFetch(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    // Node 18+ has native fetch; for self-signed certs we set NODE_TLS_REJECT_UNAUTHORIZED
    if (!this.config.verifySsl) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    return fetch(url, init);
  }

  /** Generic GET request */
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.ensureAuth();

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    const resp = await this.rawFetch(url, {
      method: "GET",
      headers: { Authorization: this.authHeader },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`PBS API GET ${path} failed (${resp.status}): ${text}`);
    }

    const json = (await resp.json()) as PbsApiResponse<T>;
    return json.data;
  }

  /** Generic POST request */
  async post<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    await this.ensureAuth();

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
    };
    if (this.csrfToken) {
      headers["CSRFPreventionToken"] = this.csrfToken;
    }

    const resp = await this.rawFetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`PBS API POST ${path} failed (${resp.status}): ${text}`);
    }

    const json = (await resp.json()) as PbsApiResponse<T>;
    return json.data;
  }

  /** Generic PUT request */
  async put<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    await this.ensureAuth();

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
    };
    if (this.csrfToken) {
      headers["CSRFPreventionToken"] = this.csrfToken;
    }

    const resp = await this.rawFetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`PBS API PUT ${path} failed (${resp.status}): ${text}`);
    }

    const json = (await resp.json()) as PbsApiResponse<T>;
    return json.data;
  }

  /** Generic DELETE request */
  async delete<T>(path: string): Promise<T> {
    await this.ensureAuth();

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };
    if (this.csrfToken) {
      headers["CSRFPreventionToken"] = this.csrfToken;
    }

    const resp = await this.rawFetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `PBS API DELETE ${path} failed (${resp.status}): ${text}`
      );
    }

    const json = (await resp.json()) as PbsApiResponse<T>;
    return json.data;
  }
}
