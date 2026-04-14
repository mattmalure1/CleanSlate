// Email notification service using Resend
// Sends quote notifications to Matt when customers scan items.
// Requires RESEND_API_KEY in .env — get one at https://resend.com/api-keys

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'mattmalure@gmail.com';

// Fire-and-forget — never blocks the quote response
async function notifyQuoteSubmitted({ code, title, asin, category, status, offerCents, offerDisplay, tier, genre, bundleLabel }) {
  if (!resend) return; // silently skip if no API key configured

  const isAccepted = status === 'accepted' || status === 'low' || status === 'penny';
  const statusEmoji = isAccepted ? (status === 'penny' ? '🟡' : '🟢') : '🔴';
  const statusLabel = isAccepted
    ? (status === 'penny' ? `Penny Tier ${offerDisplay}` : `Accepted ${offerDisplay}`)
    : 'Rejected';

  const subject = `${statusEmoji} CleanSlate Quote: ${title || code} — ${statusLabel}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px;">
      <h2 style="color: ${isAccepted ? '#16a34a' : '#dc2626'}; margin-bottom: 4px;">${statusLabel}</h2>
      <p style="color: #666; margin-top: 0;">New quote on CleanSlate</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 6px 0; color: #999; width: 100px;">Title</td><td style="padding: 6px 0; font-weight: 600;">${title || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">Barcode</td><td style="padding: 6px 0; font-family: monospace;">${code}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">ASIN</td><td style="padding: 6px 0; font-family: monospace;">${asin || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">Category</td><td style="padding: 6px 0; text-transform: capitalize;">${category || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">Tier</td><td style="padding: 6px 0;">${tier || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #999;">Offer</td><td style="padding: 6px 0; font-weight: 700; font-size: 18px;">${offerDisplay || '$0.00'}</td></tr>
        ${genre ? `<tr><td style="padding: 6px 0; color: #999;">Genre</td><td style="padding: 6px 0;">${genre}</td></tr>` : ''}
        ${bundleLabel ? `<tr><td style="padding: 6px 0; color: #999;">Bundle</td><td style="padding: 6px 0;">${bundleLabel}</td></tr>` : ''}
      </table>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'CleanSlate <onboarding@resend.dev>',
      to: NOTIFY_EMAIL,
      subject,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send quote notification:', err.message);
  }
}

module.exports = { notifyQuoteSubmitted };
