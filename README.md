# Bento MCP Server

A Model Context Protocol (MCP) server for [Bento](https://bentonow.com) - the email marketing and analytics platform. This server enables AI assistants like Claude, Cursor, and others to interact with your Bento account.

## Features

- **Subscriber Management** - Import, update, and lookup subscribers with full custom field support
- **Tagging** - Create and manage tags
- **Event Tracking** - Track custom events that can trigger automations
- **Field Management** - Create and list custom fields
- **Broadcasts** - Create and list email campaigns
- **Automations** - View sequences and workflows
- **Email Templates** - Read and update email template content
- **Statistics** - Get site-level stats

## Installation

```bash
npm install -g @bentonow/bento-mcp
```

Or run directly with npx:

```bash
npx @bentonow/bento-mcp
```

## Configuration

The server requires three environment variables:

| Variable | Description |
|----------|-------------|
| `BENTO_PUBLISHABLE_KEY` | Your Bento publishable API key |
| `BENTO_SECRET_KEY` | Your Bento secret API key |
| `BENTO_SITE_UUID` | Your Bento site UUID |

You can find these in your [Bento account settings](https://app.bentonow.com).

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bento": {
      "command": "npx",
      "args": ["-y", "@bentonow/bento-mcp"],
      "env": {
        "BENTO_PUBLISHABLE_KEY": "your-publishable-key",
        "BENTO_SECRET_KEY": "your-secret-key",
        "BENTO_SITE_UUID": "your-site-uuid"
      }
    }
  }
}
```

### Installing the `.mcpb` bundle in Claude Desktop

Claude Desktop can also load the packaged bundle directly, so you don’t need to edit JSON by hand:

1. Run `npm run build` (or `npm run bundle`, which aliases `build`). This compiles the server, syncs `manifest.json`, and creates `bento-mcp.mcpb` in the repo root.
2. In Finder/Explorer, double-click `bento-mcp.mcpb` (or open Claude Desktop → Tools (hammer icon) → **Install Bundle** → **Choose File…** and select `bento-mcp.mcpb`).
3. Claude will show the Bento MCP install dialog and prompt for the manifest’s user config fields:
   - **Bento Publishable Key** → your `BENTO_PUBLISHABLE_KEY`
   - **Bento Secret Key** → your `BENTO_SECRET_KEY`
   - **Bento Site UUID** → your `BENTO_SITE_UUID`
4. Click **Install**. Claude Desktop copies the bundle and remembers the credentials. The server now appears in the Tools list and can be toggled on/off like any other MCP integration.

To ship an update, re-run `npm run build` (or `npm run bundle`) and repeat steps 2–4 (Claude Desktop will replace the previous bundle version automatically).

## Usage with Claude Code

Run this command to add the Bento MCP server to Claude Code:

```bash
claude mcp add bento --env BENTO_PUBLISHABLE_KEY=your-publishable-key --env BENTO_SECRET_KEY=your-secret-key --env BENTO_SITE_UUID=your-site-uuid -- npx -y @bentonow/bento-mcp
```

## Usage with OpenCode

Add to your OpenCode config file (`~/.config/opencode/config.json`):

```json
{
  "mcp": {
    "bento": {
      "type": "local",
      "command": ["npx", "-y", "@bentonow/bento-mcp"],
      "environment": {
        "BENTO_PUBLISHABLE_KEY": "your-publishable-key",
        "BENTO_SECRET_KEY": "your-secret-key",
        "BENTO_SITE_UUID": "your-site-uuid"
      }
    }
  }
}
```

**Note:** OpenCode does not support referencing environment variables from a `.env` file. You must enter your actual credential values directly in the configuration file.

## Usage with Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bento": {
      "command": "npx",
      "args": ["-y", "@bentonow/bento-mcp"],
      "env": {
        "BENTO_PUBLISHABLE_KEY": "your-publishable-key",
        "BENTO_SECRET_KEY": "your-secret-key",
        "BENTO_SITE_UUID": "your-site-uuid"
      }
    }
  }
}
```

**Note:** Cursor does not support referencing environment variables from a `.env` file. You must enter your actual credential values directly in the configuration file.

## Available Tools

### Subscribers

| Tool | Description |
|------|-------------|
| `bento_get_subscriber` | Look up subscriber details by email or UUID |
| `bento_batch_import_subscribers` | Import or update up to 1000 subscribers with custom fields and tags |

### Tags

| Tool | Description |
|------|-------------|
| `bento_list_tags` | List all tags in your account |
| `bento_create_tag` | Create a new tag |

### Fields

| Tool | Description |
|------|-------------|
| `bento_list_fields` | List all custom fields |
| `bento_create_field` | Create a new custom field |

### Events

| Tool | Description |
|------|-------------|
| `bento_track_event` | Track a custom event for a subscriber (can trigger automations) |

### Statistics

| Tool | Description |
|------|-------------|
| `bento_get_site_stats` | Get site statistics including subscriber and broadcast counts |

### Broadcasts

| Tool | Description |
|------|-------------|
| `bento_list_broadcasts` | List all broadcasts/campaigns |
| `bento_create_broadcast` | Create a draft broadcast |

### Automations

| Tool | Description |
|------|-------------|
| `bento_list_automations` | List sequences and/or workflows with their templates (supports separate pagination for each type) |
| `bento_list_workflows` | List workflows with their embedded email templates and stats |

### Sequences

| Tool | Description |
|------|-------------|
| `bento_list_sequences` | List all email sequences with their email templates (supports pagination) |
| `bento_create_sequence_email` | Create a new email template in a sequence (accepts sequence ID or exact name) with optional delay settings |

### Email Templates

| Tool | Description |
|------|-------------|
| `bento_get_email_template` | Get email template content by ID |
| `bento_update_email_template` | Update email template subject and/or content |

## Example Prompts

Once configured, you can ask your AI assistant things like:

- "Look up the subscriber john@example.com in Bento"
- "Import these 5 subscribers with the 'newsletter' tag"
- "Show me the site statistics from Bento"
- "What are all the tags in my Bento account?"
- "Create a new broadcast for the spring sale"
- "List all my email sequences"
- "Show me my workflows and highlight the email templates"
- "Create a welcome email in sequence abc123 that sends after 2 days"
- "Add a follow-up email to my onboarding sequence with a 1 week delay"
- "Track a 'feature_used' event for user@example.com"

## Response Format

All tool responses are formatted to be informative for both humans and LLMs:

- **Success responses** include context about the operation performed and structured data
- **Error responses** include the `isError` flag and helpful error messages with suggested fixes
- **Empty results** are clearly indicated (e.g., "No items found")
- **Batch operations** report both successful and total counts

## Error Handling

The server provides helpful error messages for common issues:

- **Missing credentials**: Clear message about which environment variables are missing
- **Authentication failures**: Guidance to check API keys
- **Rate limiting**: Information about waiting before retrying
- **Not found errors**: Clear indication when resources don't exist
- **API errors**: Helpful messages for temporary service issues

## Development

```bash
# Clone the repository
git clone https://github.com/bentonow/bento-mcp.git
cd bento-mcp

# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint

# Format
npm run format

# Run locally
BENTO_PUBLISHABLE_KEY=xxx BENTO_SECRET_KEY=xxx BENTO_SITE_UUID=xxx npm start
```

## MCP manifest & bundle

- `manifest.json` declares the server name, entry point, tool roster, and required runtime per the MCP manifest specification so launchers can discover the server automatically.
- Run `npm run sync:manifest` whenever the package version changes; it keeps `manifest.json`'s `version` field in sync with `package.json` so there's only one authoritative version number.
- `npm run build` (and `npm run bundle`, which aliases it) validates bundle contents after packing and fails if blocked paths are present or required runtime files are missing.
- `.mcpbignore` provides a strict allowlist so local docs/config files are excluded from release bundles.

## License

MIT - see [LICENSE](LICENSE)

## Links

- [Bento](https://bentonow.com) - Email marketing platform
- [Bento Node SDK](https://github.com/bentonow/bento-node-sdk) - The underlying SDK
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
