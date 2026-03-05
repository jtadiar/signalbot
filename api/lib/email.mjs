import { Resend } from 'resend';

let resendClient;

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendLicenseKeyEmail(email, licenseKey, plan) {
  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || 'HL Signalbot <noreply@hlsignalbot.com>',
    to: email,
    subject: 'Your HL Signalbot License Key',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #10b981; margin: 0; font-size: 28px;">HL Signalbot</h1>
          <p style="color: #6b7280; margin-top: 8px;">Your license key is ready</p>
        </div>

        <div style="background: #111827; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
          <p style="color: #9ca3af; font-size: 14px; margin: 0 0 12px 0;">Your License Key</p>
          <p style="color: #10b981; font-size: 24px; font-family: monospace; font-weight: bold; margin: 0; letter-spacing: 2px;">
            ${licenseKey}
          </p>
          <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">Plan: <strong style="color: #d1d5db;">${plan}</strong></p>
        </div>

        <div style="background: #1f2937; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h3 style="color: #e5e7eb; margin: 0 0 12px 0; font-size: 16px;">Getting Started</h3>
          <ol style="color: #9ca3af; font-size: 14px; padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 8px;">Download the app from <a href="https://c13studios.com/success" style="color: #10b981;">your download page</a></li>
            <li style="margin-bottom: 8px;">Open the app and enter your license key above</li>
            <li style="margin-bottom: 8px;">Follow the setup wizard to connect your Hyperliquid account</li>
            <li>Start the bot and monitor your trades from the dashboard</li>
          </ol>
        </div>

        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          This key can be activated on up to 2 devices. Keep it safe — do not share it.
        </p>
      </div>
    `,
  });

  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
