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

// Send order confirmation + shipping label to the customer
// Fired after Shippo label is generated (status = label_created)
async function sendOrderConfirmation({ customerEmail, customerName, orderId, items, totalCents, labelUrl, trackingNumber }) {
  if (!resend) return;

  const totalDisplay = `$${(totalCents / 100).toFixed(2)}`;
  const itemCount = items.length;

  const itemRows = items.map(i => {
    const price = `$${((i.offered_price_cents || i.offerCents || 0) / 100).toFixed(2)}`;
    return `<tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">${i.title || 'Untitled'}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: right; font-weight: 600;">${price}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="text-align: center; padding: 24px 0 16px;">
        <h1 style="color: #0d9488; font-size: 24px; margin: 0;">CleanSlate</h1>
        <p style="color: #999; font-size: 12px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 1px;">Media Buyback</p>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <p style="font-size: 20px; margin: 0 0 4px;">&#10003;</p>
        <h2 style="color: #166534; font-size: 18px; margin: 0 0 4px;">Order Confirmed!</h2>
        <p style="color: #666; font-size: 13px; margin: 0;">Order <strong>${orderId}</strong></p>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${labelUrl}" style="display: inline-block; background: #0d9488; color: white; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">Download Shipping Label</a>
        <p style="color: #999; font-size: 12px; margin: 8px 0 0;">Print this label and attach it to your package.</p>
      </div>

      ${trackingNumber ? `<p style="font-size: 13px; color: #666; text-align: center; margin-bottom: 24px;">
        Tracking: <a href="https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}" style="color: #0d9488; font-weight: 600;">${trackingNumber}</a>
      </p>` : ''}

      <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h3 style="font-size: 14px; color: #333; margin: 0 0 12px;">Your Items (${itemCount})</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemRows}
          <tr>
            <td style="padding: 12px 0 0; font-size: 15px; font-weight: 700; color: #333;">Total Payout</td>
            <td style="padding: 12px 0 0; font-size: 15px; font-weight: 700; color: #0d9488; text-align: right;">${totalDisplay}</td>
          </tr>
        </table>
      </div>

      <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <h3 style="font-size: 14px; color: #333; margin: 0 0 12px;">What to do next</h3>
        <ol style="margin: 0; padding-left: 20px; color: #555; font-size: 13px; line-height: 1.8;">
          <li><strong>Print</strong> your shipping label</li>
          <li><strong>Pack</strong> items securely in a box or padded envelope</li>
          <li><strong>Drop off</strong> at any USPS location</li>
          <li>We'll <strong>inspect & pay you</strong> within 5-7 business days of receiving</li>
        </ol>
      </div>

      <div style="text-align: center; padding: 16px 0; border-top: 1px solid #f0f0f0;">
        <p style="color: #999; font-size: 12px; margin: 0;">Questions? Reply to this email or visit <a href="https://cleanslatebuys.com" style="color: #0d9488;">cleanslatebuys.com</a></p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'CleanSlate <onboarding@resend.dev>',
      to: customerEmail,
      replyTo: NOTIFY_EMAIL,
      subject: `Your CleanSlate order is confirmed — ${itemCount} item${itemCount !== 1 ? 's' : ''}, ${totalDisplay}`,
      html,
    });
  } catch (err) {
    console.error('[email] Failed to send order confirmation:', err.message);
  }
}

module.exports = { notifyQuoteSubmitted, sendOrderConfirmation };
