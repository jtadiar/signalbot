import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM || "Signalbot <noreply@c13studios.com>";

export async function sendLicenseEmail(email: string, key: string): Promise<void> {
  const r = getResend();
  if (!r) {
    console.warn("RESEND_API_KEY not set — skipping email delivery");
    return;
  }

  await r.emails.send({
    from: FROM,
    to: email,
    subject: "Your Signalbot License Key",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:40px 40px 24px;text-align:center;">
          <h1 style="margin:0 0 4px;font-size:28px;font-weight:800;color:#ff6b00;">Signalbot</h1>
          <p style="margin:0;font-size:13px;color:#666;">by C13 Studios</p>
        </td></tr>
        <tr><td style="padding:0 40px 24px;text-align:center;">
          <p style="margin:0;font-size:16px;color:#ccc;">Your license key is ready.</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center;">
            <code style="font-size:22px;letter-spacing:3px;color:#ff6b00;font-weight:700;">${key}</code>
          </div>
          <p style="margin:12px 0 0;font-size:12px;color:#555;text-align:center;">Copy this key and paste it into the Signalbot app to activate.</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <a href="https://c13studios.com/downloads/HL.Signalbot_1.0.4_universal.dmg" style="display:inline-block;background:#ff6b00;color:#000;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none;margin:0 6px 8px;">Download for Mac</a>
          <a href="https://c13studios.com/downloads/HL.Signalbot_1.0.4_x64-setup.exe" style="display:inline-block;background:#333;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none;margin:0 6px 8px;">Download for Windows</a>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #222;text-align:center;">
          <p style="margin:0 0 16px;font-size:14px;color:#ccc;">Join our private Telegram for updates &amp; support:</p>
          <a href="https://t.me/+Y9MLcLOMAdxiYzQ0" style="display:inline-block;background:#2AABEE;color:#fff;font-weight:700;font-size:14px;padding:10px 28px;border-radius:999px;text-decoration:none;">Join Telegram</a>
          <p style="margin:16px 0 0;font-size:11px;color:#444;">Save this email — you&rsquo;ll need this key if you reinstall.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
