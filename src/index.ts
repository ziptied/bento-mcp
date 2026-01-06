#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Analytics } from "@bentonow/bento-node-sdk";
import { createRequire } from "node:module";

// Read version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const VERSION: string = packageJson.version;

// Initialize Bento client from environment variables
function getBentoClient(): Analytics {
  const publishableKey = process.env.BENTO_PUBLISHABLE_KEY;
  const secretKey = process.env.BENTO_SECRET_KEY;
  const siteUuid = process.env.BENTO_SITE_UUID;

  if (!publishableKey || !secretKey || !siteUuid) {
    throw new Error(
      "Missing required environment variables: BENTO_PUBLISHABLE_KEY, BENTO_SECRET_KEY, BENTO_SITE_UUID",
    );
  }

  return new Analytics({
    authentication: {
      publishableKey,
      secretKey,
    },
    siteUuid,
  });
}

// Create MCP server
const server = new McpServer({
  name: "bento",
  version: VERSION,
});

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

function successResponse(data: unknown, context?: string) {
  let text: string;

  if (data === null || data === undefined) {
    text = context ? `${context}: No data returned` : "No data returned";
  } else if (typeof data === "boolean") {
    text = data
      ? context
        ? `${context}: Success`
        : "Operation completed successfully"
      : context
        ? `${context}: Operation failed`
        : "Operation failed";
  } else if (typeof data === "number") {
    text = context ? `${context}: ${data}` : `Result: ${data}`;
  } else if (Array.isArray(data)) {
    if (data.length === 0) {
      text = context ? `${context}: No items found` : "No items found";
    } else {
      text = context
        ? `${context} (${data.length} items):\n${JSON.stringify(data, null, 2)}`
        : `Found ${data.length} items:\n${JSON.stringify(data, null, 2)}`;
    }
  } else if (typeof data === "object") {
    text = context
      ? `${context}:\n${JSON.stringify(data, null, 2)}`
      : JSON.stringify(data, null, 2);
  } else {
    text = String(data);
  }

  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResponse(error: unknown, operation?: string) {
  let message: string;

  if (error instanceof Error) {
    message = error.message;

    // Provide more helpful messages for common errors
    if (message.includes("Missing required environment variables")) {
      message = `Configuration error: ${message}. Please ensure BENTO_PUBLISHABLE_KEY, BENTO_SECRET_KEY, and BENTO_SITE_UUID are set.`;
    } else if (
      message.includes("401") ||
      message.toLowerCase().includes("unauthorized")
    ) {
      message =
        "Authentication failed: Invalid API credentials. Please check your BENTO_PUBLISHABLE_KEY and BENTO_SECRET_KEY.";
    } else if (
      message.includes("404") ||
      message.toLowerCase().includes("not found")
    ) {
      message = `Resource not found: ${message}`;
    } else if (message.includes("429")) {
      message =
        "Rate limit exceeded: Too many requests. Please wait before trying again.";
    } else if (message.includes("500") || message.includes("502")) {
      message =
        "Bento API error: The service is temporarily unavailable. Please try again later.";
    }
  } else {
    message = String(error);
  }

  const text = operation
    ? `Failed to ${operation}: ${message}`
    : `Error: ${message}`;

  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}

function validationError(message: string) {
  return {
    content: [{ type: "text" as const, text: `Validation error: ${message}` }],
    isError: true,
  };
}

// =============================================================================
// SUBSCRIBER TOOLS
// =============================================================================

server.tool(
  "bento_get_subscriber",
  "Look up a Bento subscriber by email or UUID. Returns subscriber details including tags, fields, and subscription status.",
  {
    email: z.string().email().optional().describe("Subscriber email address"),
    uuid: z.string().optional().describe("Subscriber UUID"),
  },
  async ({ email, uuid }) => {
    if (!email && !uuid) {
      return validationError(
        "Either email or uuid is required to look up a subscriber",
      );
    }

    try {
      const bento = getBentoClient();
      const subscriber = await bento.V1.Subscribers.getSubscribers(
        email ? { email } : { uuid: uuid as string },
      );

      if (!subscriber) {
        return successResponse(
          null,
          `Subscriber ${email || uuid} not found in Bento`,
        );
      }

      return successResponse(
        subscriber,
        `Subscriber details for ${email || uuid}`,
      );
    } catch (error) {
      return errorResponse(error, `get subscriber ${email || uuid}`);
    }
  },
);

server.tool(
  "bento_batch_import_subscribers",
  "Import or update multiple subscribers at once (up to 1000). Supports custom fields and tags. Does NOT trigger automations - use for bulk imports only.",
  {
    subscribers: z
      .array(
        z
          .object({
            email: z.string().email().describe("Subscriber email address"),
            firstName: z.string().optional().describe("First name"),
            lastName: z.string().optional().describe("Last name"),
            tags: z.string().optional().describe("Comma-separated tags to add"),
            removeTags: z
              .string()
              .optional()
              .describe("Comma-separated tags to remove"),
          })
          .passthrough(),
      )
      .describe("Array of subscribers to import (max 1000)"),
  },
  async ({ subscribers }) => {
    if (subscribers.length === 0) {
      return validationError("At least one subscriber is required");
    }

    if (subscribers.length > 1000) {
      return validationError(
        `Maximum 1000 subscribers per batch, received ${subscribers.length}`,
      );
    }

    try {
      const bento = getBentoClient();
      const count = await bento.V1.Batch.importSubscribers({
        subscribers: subscribers.map((s) => {
          const {
            firstName,
            lastName,
            removeTags,
            email,
            tags,
            ...customFields
          } = s;
          return {
            email,
            tags,
            first_name: firstName,
            last_name: lastName,
            remove_tags: removeTags,
            ...customFields,
          };
        }),
      });

      return successResponse(
        { imported: count, total: subscribers.length },
        `Successfully imported ${count} of ${subscribers.length} subscribers`,
      );
    } catch (error) {
      return errorResponse(error, "import subscribers");
    }
  },
);

// =============================================================================
// TAG TOOLS
// =============================================================================

server.tool(
  "bento_list_tags",
  "List all tags in your Bento account.",
  {},
  async () => {
    try {
      const bento = getBentoClient();
      const tags = await bento.V1.Tags.getTags();

      return successResponse(tags, "Tags in your Bento account");
    } catch (error) {
      return errorResponse(error, "list tags");
    }
  },
);

server.tool(
  "bento_create_tag",
  "Create a new tag in your Bento account.",
  {
    name: z.string().min(1).describe("Tag name to create"),
  },
  async ({ name }) => {
    try {
      const bento = getBentoClient();
      const tag = await bento.V1.Tags.createTag({ name });

      return successResponse(tag, `Created tag "${name}"`);
    } catch (error) {
      return errorResponse(error, `create tag "${name}"`);
    }
  },
);

// =============================================================================
// FIELD TOOLS
// =============================================================================

server.tool(
  "bento_list_fields",
  "List all custom fields defined in your Bento account.",
  {},
  async () => {
    try {
      const bento = getBentoClient();
      const fields = await bento.V1.Fields.getFields();

      return successResponse(fields, "Custom fields in your Bento account");
    } catch (error) {
      return errorResponse(error, "list custom fields");
    }
  },
);

server.tool(
  "bento_create_field",
  "Create a new custom field in your Bento account. The key is automatically converted to a display name (e.g., 'firstName' becomes 'First Name').",
  {
    key: z
      .string()
      .min(1)
      .describe(
        "Field key in camelCase or snake_case (e.g., 'firstName', 'company_name')",
      ),
  },
  async ({ key }) => {
    try {
      const bento = getBentoClient();
      const field = await bento.V1.Fields.createField({ key });

      return successResponse(field, `Created custom field "${key}"`);
    } catch (error) {
      return errorResponse(error, `create custom field "${key}"`);
    }
  },
);

// =============================================================================
// EVENT TOOLS
// =============================================================================

server.tool(
  "bento_track_event",
  "Track a custom event for a subscriber. Events can trigger automations. Common event types: $pageView, $signup, $login, or any custom event name.",
  {
    email: z.string().email().describe("Subscriber email address"),
    type: z
      .string()
      .min(1)
      .describe(
        "Event type/name (e.g., '$pageView', 'signup_completed', 'feature_used')",
      ),
    fields: z
      .record(z.unknown())
      .optional()
      .describe("Custom fields to update on the subscriber"),
    details: z
      .record(z.unknown())
      .optional()
      .describe(
        "Additional event details (e.g., { url: '/pricing', source: 'campaign' })",
      ),
  },
  async ({ email, type, fields, details }) => {
    try {
      const bento = getBentoClient();
      const result = await bento.V1.track({
        email,
        type,
        fields: fields as Record<string, unknown>,
        details,
      });

      return successResponse(
        result,
        `Tracked event "${type}" for subscriber ${email}`,
      );
    } catch (error) {
      return errorResponse(error, `track event "${type}" for ${email}`);
    }
  },
);

// =============================================================================
// STATISTICS TOOLS
// =============================================================================

server.tool(
  "bento_get_site_stats",
  "Get overall statistics for your Bento site including subscriber counts, broadcast counts, and engagement rates.",
  {},
  async () => {
    try {
      const bento = getBentoClient();
      const stats = await bento.V1.Stats.getSiteStats();

      return successResponse(stats, "Bento site statistics");
    } catch (error) {
      return errorResponse(error, "get site statistics");
    }
  },
);

// =============================================================================
// BROADCAST TOOLS
// =============================================================================

server.tool(
  "bento_list_broadcasts",
  "List all email broadcasts/campaigns in your Bento account.",
  {},
  async () => {
    try {
      const bento = getBentoClient();
      const broadcasts = await bento.V1.Broadcasts.getBroadcasts();

      return successResponse(broadcasts, "Broadcasts in your Bento account");
    } catch (error) {
      return errorResponse(error, "list broadcasts");
    }
  },
);

server.tool(
  "bento_create_broadcast",
  "Create a new email broadcast/campaign as a draft. The broadcast will need to be sent manually from the Bento dashboard.",
  {
    name: z.string().min(1).describe("Internal name for the broadcast"),
    subject: z.string().min(1).describe("Email subject line"),
    content: z
      .string()
      .min(1)
      .describe("Email content (HTML, plain text, or markdown)"),
    type: z
      .enum(["plain", "html", "markdown"])
      .default("html")
      .describe("Content type"),
    fromName: z.string().min(1).describe("Sender name"),
    fromEmail: z
      .string()
      .email()
      .describe("Sender email (must be an authorized Author in Bento)"),
    inclusiveTags: z
      .string()
      .optional()
      .describe("Comma-separated tags - subscribers must have at least one"),
    exclusiveTags: z
      .string()
      .optional()
      .describe("Comma-separated tags - subscribers with these are excluded"),
    segmentId: z.string().optional().describe("Target a specific segment ID"),
    batchSizePerHour: z
      .number()
      .positive()
      .optional()
      .describe("Sending rate limit (emails per hour, default: 1000)"),
  },
  async ({
    name,
    subject,
    content,
    type,
    fromName,
    fromEmail,
    inclusiveTags,
    exclusiveTags,
    segmentId,
    batchSizePerHour,
  }) => {
    try {
      const bento = getBentoClient();
      const broadcast = await bento.V1.Broadcasts.createBroadcast([
        {
          name,
          subject,
          content,
          type,
          from: { name: fromName, email: fromEmail },
          inclusive_tags: inclusiveTags,
          exclusive_tags: exclusiveTags,
          segment_id: segmentId,
          batch_size_per_hour: batchSizePerHour ?? 1000,
        },
      ]);

      return successResponse(
        broadcast,
        `Created draft broadcast "${name}" with subject "${subject}"`,
      );
    } catch (error) {
      return errorResponse(error, `create broadcast "${name}"`);
    }
  },
);

// =============================================================================
// AUTOMATION TOOLS
// =============================================================================

server.tool(
  "bento_list_automations",
  "List email sequences and/or workflows in your Bento account with their templates.",
  {
    type: z
      .enum(["sequences", "workflows", "all"])
      .default("all")
      .describe("Filter by automation type"),
  },
  async ({ type }) => {
    try {
      const bento = getBentoClient();
      const results: Record<string, unknown> = {};

      if (type === "sequences" || type === "all") {
        results.sequences = await bento.V1.Sequences.getSequences();
      }
      if (type === "workflows" || type === "all") {
        results.workflows = await bento.V1.Workflows.getWorkflows();
      }

      const context =
        type === "all"
          ? "Sequences and workflows"
          : type === "sequences"
            ? "Email sequences"
            : "Workflows";

      return successResponse(results, `${context} in your Bento account`);
    } catch (error) {
      return errorResponse(error, `list ${type}`);
    }
  },
);

// =============================================================================
// EMAIL TEMPLATE TOOLS
// =============================================================================

server.tool(
  "bento_get_email_template",
  "Get the full content of an email template by ID. Returns the template's name, subject, HTML content, and stats.",
  {
    id: z.number().positive().describe("Email template ID"),
  },
  async ({ id }) => {
    try {
      const bento = getBentoClient();
      const template = await bento.V1.EmailTemplates.getEmailTemplate({ id });

      if (!template) {
        return successResponse(null, `Email template with ID ${id} not found`);
      }

      return successResponse(template, `Email template (ID: ${id})`);
    } catch (error) {
      return errorResponse(error, `get email template ${id}`);
    }
  },
);

server.tool(
  "bento_update_email_template",
  "Update an email template's subject line and/or HTML content. Changes take effect immediately for future sends.",
  {
    id: z.number().positive().describe("Email template ID to update"),
    subject: z.string().optional().describe("New subject line"),
    html: z
      .string()
      .optional()
      .describe(
        "New HTML content (must include {{ visitor.unsubscribe_url }} for compliance)",
      ),
  },
  async ({ id, subject, html }) => {
    if (!subject && !html) {
      return validationError(
        "Either subject or html (or both) is required to update a template",
      );
    }

    try {
      const bento = getBentoClient();
      const template = await bento.V1.EmailTemplates.updateEmailTemplate({
        id,
        subject,
        html,
      });

      const updated = [subject && "subject", html && "content"]
        .filter(Boolean)
        .join(" and ");

      return successResponse(
        template,
        `Updated email template ${id} (${updated})`,
      );
    } catch (error) {
      return errorResponse(error, `update email template ${id}`);
    }
  },
);

// =============================================================================
// RUN SERVER
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Bento MCP Server v${VERSION} running on stdio`);
}

// Graceful shutdown handling
function shutdown(signal: string) {
  console.error(`\nReceived ${signal}, shutting down gracefully...`);
  server
    .close()
    .then(() => {
      console.error("Server closed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error during shutdown:", err);
      process.exit(1);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
