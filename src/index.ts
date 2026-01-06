#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Analytics } from "@bentonow/bento-node-sdk";

// Initialize Bento client from environment variables
function getBentoClient(): Analytics {
  const publishableKey = process.env.BENTO_PUBLISHABLE_KEY;
  const secretKey = process.env.BENTO_SECRET_KEY;
  const siteUuid = process.env.BENTO_SITE_UUID;

  if (!publishableKey || !secretKey || !siteUuid) {
    throw new Error(
      "Missing required environment variables: BENTO_PUBLISHABLE_KEY, BENTO_SECRET_KEY, BENTO_SITE_UUID"
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
  version: "1.0.0",
});

// Helper to format responses
function formatResponse(data: unknown): string {
  if (data === null || data === undefined) {
    return "No data returned";
  }
  if (typeof data === "boolean") {
    return data ? "Success" : "Operation failed";
  }
  if (typeof data === "number") {
    return `Count: ${data}`;
  }
  return JSON.stringify(data, null, 2);
}

// Helper for error handling
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

// =============================================================================
// SUBSCRIBER TOOLS
// =============================================================================

server.tool(
  "bento_get_subscriber",
  "Get subscriber details by email or UUID.",
  {
    email: z.string().email().optional().describe("Subscriber email address"),
    uuid: z.string().optional().describe("Subscriber UUID"),
  },
  async ({ email, uuid }) => {
    try {
      if (!email && !uuid) {
        return {
          content: [{ type: "text", text: "Either email or uuid is required" }],
        };
      }

      const bento = getBentoClient();
      const subscriber = await bento.V1.Subscribers.getSubscribers(
        email ? { email } : { uuid: uuid! }
      );

      return {
        content: [{ type: "text", text: formatResponse(subscriber) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

server.tool(
  "bento_batch_import_subscribers",
  "Import or update subscribers with fields and tags. Does not trigger automations.",
  {
    subscribers: z
      .array(
        z
          .object({
            email: z.string().email(),
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            tags: z.string().optional().describe("Comma-separated tags to add"),
            removeTags: z
              .string()
              .optional()
              .describe("Comma-separated tags to remove"),
          })
          .passthrough()
      )
      .describe("Subscribers to import (max 1000)"),
  },
  async ({ subscribers }) => {
    try {
      if (subscribers.length > 1000) {
        return {
          content: [
            { type: "text", text: "Error: Maximum 1000 subscribers per batch" },
          ],
        };
      }

      const bento = getBentoClient();
      const count = await bento.V1.Batch.importSubscribers({
        subscribers: subscribers.map((s) => {
          const { firstName, lastName, removeTags, ...rest } = s;
          return {
            ...rest,
            first_name: firstName,
            last_name: lastName,
            remove_tags: removeTags,
          };
        }),
      });

      return {
        content: [
          { type: "text", text: `Successfully imported ${count} subscribers` },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// TAG TOOLS
// =============================================================================

server.tool("bento_list_tags", "List all tags.", {}, async () => {
  try {
    const bento = getBentoClient();
    const tags = await bento.V1.Tags.getTags();

    return {
      content: [{ type: "text", text: formatResponse(tags) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: handleError(error) }],
    };
  }
});

server.tool(
  "bento_create_tag",
  "Create a new tag.",
  {
    name: z.string().describe("Tag name"),
  },
  async ({ name }) => {
    try {
      const bento = getBentoClient();
      const tags = await bento.V1.Tags.createTag({ name });

      return {
        content: [{ type: "text", text: formatResponse(tags) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// FIELD TOOLS
// =============================================================================

server.tool("bento_list_fields", "List all custom fields.", {}, async () => {
  try {
    const bento = getBentoClient();
    const fields = await bento.V1.Fields.getFields();

    return {
      content: [{ type: "text", text: formatResponse(fields) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: handleError(error) }],
    };
  }
});

server.tool(
  "bento_create_field",
  "Create a new custom field.",
  {
    key: z.string().describe("Field key (e.g., 'firstName', 'company_name')"),
  },
  async ({ key }) => {
    try {
      const bento = getBentoClient();
      const fields = await bento.V1.Fields.createField({ key });

      return {
        content: [{ type: "text", text: formatResponse(fields) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
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
      .describe(
        "Event type/name (e.g., '$pageView', 'signup_completed', 'feature_used')"
      ),
    fields: z
      .record(z.unknown())
      .optional()
      .describe("Custom fields to update on the subscriber"),
    details: z
      .record(z.unknown())
      .optional()
      .describe(
        "Additional event details (e.g., { url: '/pricing', source: 'campaign' })"
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

      return {
        content: [{ type: "text", text: formatResponse(result) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// STATISTICS TOOLS
// =============================================================================

server.tool(
  "bento_get_site_stats",
  "Get site statistics including subscriber and broadcast counts.",
  {},
  async () => {
    try {
      const bento = getBentoClient();
      const stats = await bento.V1.Stats.getSiteStats();

      return {
        content: [{ type: "text", text: formatResponse(stats) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// BROADCAST TOOLS
// =============================================================================

server.tool("bento_list_broadcasts", "List all broadcasts.", {}, async () => {
  try {
    const bento = getBentoClient();
    const broadcasts = await bento.V1.Broadcasts.getBroadcasts();

    return {
      content: [{ type: "text", text: formatResponse(broadcasts) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: handleError(error) }],
    };
  }
});

server.tool(
  "bento_create_broadcast",
  "Create a draft broadcast.",
  {
    name: z.string().describe("Internal name for the broadcast"),
    subject: z.string().describe("Email subject line"),
    content: z.string().describe("Email content (HTML, plain text, or markdown)"),
    type: z
      .enum(["plain", "html", "markdown"])
      .default("html")
      .describe("Content type"),
    fromName: z.string().describe("Sender name"),
    fromEmail: z
      .string()
      .email()
      .describe("Sender email (must be an authorized Author)"),
    inclusiveTags: z
      .string()
      .optional()
      .describe("Comma-separated tags - subscribers must have at least one"),
    exclusiveTags: z
      .string()
      .optional()
      .describe("Comma-separated tags - subscribers with these are excluded"),
    segmentId: z.string().optional().describe("Target a specific segment"),
    batchSizePerHour: z
      .number()
      .optional()
      .describe("Sending rate limit (emails per hour)"),
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
      const broadcasts = await bento.V1.Broadcasts.createBroadcast([
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

      return {
        content: [{ type: "text", text: formatResponse(broadcasts) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// AUTOMATION TOOLS
// =============================================================================

server.tool(
  "bento_list_automations",
  "List email sequences and/or workflows with their templates.",
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

      return {
        content: [{ type: "text", text: formatResponse(results) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// EMAIL TEMPLATE TOOLS
// =============================================================================

server.tool(
  "bento_get_email_template",
  "Get email template content by ID.",
  {
    id: z.number().describe("Email template ID"),
  },
  async ({ id }) => {
    try {
      const bento = getBentoClient();
      const template = await bento.V1.EmailTemplates.getEmailTemplate({ id });

      return {
        content: [{ type: "text", text: formatResponse(template) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

server.tool(
  "bento_update_email_template",
  "Update email template subject and/or content.",
  {
    id: z.number().describe("Email template ID"),
    subject: z.string().optional().describe("New subject line"),
    html: z
      .string()
      .optional()
      .describe("New HTML content (must include {{ visitor.unsubscribe_url }})"),
  },
  async ({ id, subject, html }) => {
    try {
      if (!subject && !html) {
        return {
          content: [
            {
              type: "text",
              text: "Either subject or html (or both) is required to update",
            },
          ],
        };
      }

      const bento = getBentoClient();
      const template = await bento.V1.EmailTemplates.updateEmailTemplate({
        id,
        subject,
        html,
      });

      return {
        content: [{ type: "text", text: formatResponse(template) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleError(error) }],
      };
    }
  }
);

// =============================================================================
// RUN SERVER
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bento MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
