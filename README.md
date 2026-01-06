# Bento MCP Server

A Model Context Protocol (MCP) server for [Bento](https://bentonow.com) - the email marketing and analytics platform. This server enables AI assistants like Claude, Cursor, and others to interact with your Bento account.

## Features

- **Subscriber Management** - Import, update, and lookup subscribers
- **Tagging** - Create and manage tags
- **Event Tracking** - Track custom events
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

## Usage with OpenCode

Add to your `opencode.json`:

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

## Usage with Cursor

Add to your Cursor MCP settings:

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

## Available Tools

### Subscribers

| Tool | Description |
|------|-------------|
| `bento_get_subscriber` | Get subscriber details by email or UUID |
| `bento_batch_import_subscribers` | Import or update subscribers with fields and tags |

### Tags

| Tool | Description |
|------|-------------|
| `bento_list_tags` | List all tags |
| `bento_create_tag` | Create a new tag |

### Fields

| Tool | Description |
|------|-------------|
| `bento_list_fields` | List all custom fields |
| `bento_create_field` | Create a new custom field |

### Events

| Tool | Description |
|------|-------------|
| `bento_track_event` | Track a custom event for a subscriber |

### Statistics

| Tool | Description |
|------|-------------|
| `bento_get_site_stats` | Get site statistics |

### Broadcasts

| Tool | Description |
|------|-------------|
| `bento_list_broadcasts` | List all broadcasts |
| `bento_create_broadcast` | Create a draft broadcast |

### Automations

| Tool | Description |
|------|-------------|
| `bento_list_automations` | List sequences and/or workflows |

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

## Development

```bash
# Clone the repository
git clone https://github.com/bentonow/bento-mcp.git
cd bento-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally
BENTO_PUBLISHABLE_KEY=xxx BENTO_SECRET_KEY=xxx BENTO_SITE_UUID=xxx npm start
```

## License

MIT - see [LICENSE](LICENSE)

## Links

- [Bento](https://bentonow.com) - Email marketing platform
- [Bento Node SDK](https://github.com/bentonow/bento-node-sdk) - The underlying SDK
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
