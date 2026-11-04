# hours-bot

WhatsApp bot for logging work hours in Hebrew free text and getting a monthly report in the chat.

**Logging**
- `לבצלר 4 שעות`
- `לאורו נלך 14:00 עד 16:00`
- Optional day: `אתמול`, `שלשום`, or `3/11` (e.g. `אתמול לבצלר 4 שעות`)

**Commands:** `דוח` (this month so far), `דוח קודם` (last month), `מחק` (delete last entry), `עזרה`.

**Month-end:** on the last day of each month (about 19:00-20:00 Israel time) the report is sent automatically.

Places are grouped exactly as typed, so `לבצלר` and `בצלר` count as different places.

---

## Setup

### 1. Deploy to Netlify
1. Push this folder to a GitHub repo and create a Netlify site from it (build command: none, publish dir: `public`).
2. Note the site URL, e.g. `https://hours-bot.netlify.app`. The webhook will be `https://<site>/api/whatsapp`.

### 2. Create the Meta app
1. Go to developers.facebook.com, log in, and create an app of type **Business** (add a Business portfolio if asked).
2. In the app, add the **WhatsApp** product.
3. Under **WhatsApp > API Setup** you get a free **test phone number**. Copy the **Phone number ID**.
4. In the same page, under "To", add your wife's number as a recipient and verify it with the code WhatsApp sends her. The test number can message up to 5 verified numbers, which is enough here.
5. Copy the **App secret** from **App settings > Basic**.

### 3. Permanent access token
The token on the API Setup page expires in 24 hours. For a permanent one:
1. business.facebook.com > Settings > Users > **System users** > add a system user (Admin).
2. Add your app to it, then **Generate token** with permissions `whatsapp_business_messaging` and `whatsapp_business_management`, expiry "Never".
3. Also assign the WhatsApp account to the system user (Add assets > WhatsApp accounts).

### 4. Netlify environment variables
| Variable | Value |
|---|---|
| `WA_TOKEN` | the permanent system-user token |
| `WA_PHONE_NUMBER_ID` | phone number ID from step 2.3 |
| `WA_APP_SECRET` | app secret from step 2.5 |
| `WA_VERIFY_TOKEN` | any random string you choose, reuse it in step 5 |
| `ALLOWED_NUMBERS` | her number with country code, digits only, e.g. `972501234567` (comma-separate more) |
| `WA_TEMPLATE_NAME` | optional, defaults to `monthly_report_ready` |

Redeploy after adding them.

### 5. Connect the webhook
WhatsApp > **Configuration** > Webhook: Callback URL `https://<site>/api/whatsapp`, Verify token = your `WA_VERIFY_TOKEN`. Click verify, then subscribe to the **messages** field.

### 6. Month-end template (one-time)
WhatsApp only allows free-form messages within 24 hours of her last message. If she hasn't written that day, the month-end job falls back to a template. In **WhatsApp > Message templates** create one:
- Name: `monthly_report_ready`, Category: **Utility**, Language: **Hebrew**
- Body: `סוף החודש! כדי לקבל את דוח השעות, השיבי כאן "דוח".`

Her reply reopens the window, and she then sends `דוח`.

### 7. Test
From her phone, message the test number: `לבצלר 4 שעות`, then `דוח`.
