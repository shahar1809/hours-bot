# hours-bot

Telegram bot for logging work hours in Hebrew free text and getting a monthly report in the chat.

**Logging**
- `לבצלר 4 שעות`
- `לאורו נלך 14:00 עד 16:00`
- Optional day: `אתמול`, `שלשום`, or `3/11` (e.g. `אתמול לבצלר 4 שעות`)

**Commands:** `דוח` (this month so far), `דוח קודם` (last month), `מחק` (delete last entry), `עזרה`.
Also `/start`, `/help`, `/report`, `/prev`, `/undo`.

**Month-end:** on the last day of each month (about 19:00-20:00 Israel time) the report is sent automatically.

Places are grouped exactly as typed, so `לבצלר` and `בצלר` count as different places.

## Setup

1. **Create the bot.** In Telegram open @BotFather, send `/newbot`, pick a name and username. Copy the token.
2. **Netlify environment variables** (Project configuration > Environment variables, scope: Functions):

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | any random string (letters/digits), e.g. from `openssl rand -hex 16` |
| `ALLOWED_USER_IDS` | Telegram user IDs allowed to use the bot, comma-separated, no spaces |

3. **Deploy**, then open `https://<site>/api/telegram?setup=<TELEGRAM_WEBHOOK_SECRET>` once in a browser. It should answer `{"ok":true,...}`. That registers the webhook.
4. **Find the user IDs.** Message the bot. Anyone not yet allowed gets back "אין הרשאה. המזהה שלך: <id>". Put those IDs in `ALLOWED_USER_IDS` and redeploy.
5. Send `לבצלר 4 שעות`, then `דוח`.

Each person's hours are stored separately under their own Telegram ID.
