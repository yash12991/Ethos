const { Resend } = require('resend');
const { ApiError } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');

const resendApiKey = process.env.RESEND_API_KEY;
let resendClient = null;

if (resendApiKey) {
  resendClient = new Resend(resendApiKey);
} else {
  logger.warn('RESEND_API_KEY is not configured; HR OTP emails are disabled.');
}

function getExpiryMinutes(expiresAt) {
  const deltaMs = expiresAt - Date.now();
  const minutes = Math.ceil(deltaMs / 60000);
  return minutes > 0 ? minutes : 1;
}

function buildOtpEmailBodies({ name, otp, expiresAt }) {
  const friendlyName = name || 'there';
  const expiresInMinutes = getExpiryMinutes(expiresAt);
  const minutesLabel = `${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}`;
  const validityText = expiresAt ? minutesLabel : '10 minutes';

  const textBody = [
    `Hi ${friendlyName},`,
    '',
    'To complete your sign-in, please use the One-Time Password (OTP) below:',
    '',
    otp,
    '',
    `This code is valid for ${validityText}.`,
    '',
    'For security reasons, please do not share this code with anyone.',
    'If you did not request this verification, you can safely ignore this email.',
    '',
    'If you need assistance, feel free to contact our support team.',
    '',
    'Best regards,',
    'Team ETHOS',
    'ethos@mimosa.chat',
  ].join('\n');

  const htmlBody = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ebeef5; padding:32px 0; font-family:'Segoe UI', Arial, sans-serif; color:#0f172a;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 20px 40px rgba(15,23,42,0.15);">
            <tr>
              <td style="background:linear-gradient(135deg,#0ea5e9,#2563eb,#1e1b4b); padding:28px 36px; text-align:left;">
                <p style="margin:0; font-size:13px; letter-spacing:0.2em; color:#bae6fd; text-transform:uppercase;">Secure sign-in</p>
                <h1 style="margin:8px 0 0; font-size:26px; color:#f8fafc;">ETHOS Verification</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <p style="margin:0 0 16px; font-size:15px; color:#475569;">Hi ${friendlyName},</p>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.6;">To complete your sign-in, please use the One-Time Password (OTP) below:</p>
                <div style="margin:0 0 28px; padding:22px 0; border-radius:14px; background:#0f172a; color:#f8fafc; font-size:34px; letter-spacing:0.65em; font-weight:600; text-align:center;">${otp}</div>
                <p style="margin:0 0 16px; font-size:16px;">This code is valid for <strong>${validityText}</strong>.</p>
                <p style="margin:0 0 12px; font-size:15px; color:#475569;">For security reasons, please do not share this code with anyone. If you did not request this verification, you can safely ignore this email.</p>
                <p style="margin:0 0 28px; font-size:15px; color:#475569;">If you need assistance, feel free to contact our support team.</p>
                <p style="margin:0; font-size:15px; color:#475569;">Best regards,<br/><strong>Team ETHOS</strong><br/><a href="mailto:ethos@mimosa.chat" style="color:#2563eb; text-decoration:none;">ethos@mimosa.chat</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return { textBody, htmlBody };
}

async function sendHrOtpEmail({ to, otp, expiresAt, name }) {
  if (!resendClient) {
    throw new ApiError(500, 'OTP email service is not configured.');
  }

  const from = process.env.HR_OTP_FROM_EMAIL;
  if (!from) {
    logger.error('HR_OTP_FROM_EMAIL is not configured; cannot send OTP emails.');
    throw new ApiError(500, 'OTP email sender is not configured.');
  }

  if (!to) {
    throw new ApiError(400, 'Recipient email address is required.');
  }

  const subject = process.env.HR_OTP_EMAIL_SUBJECT || 'Your ETHOS login verification code';
  const { textBody, htmlBody } = buildOtpEmailBodies({ name, otp, expiresAt });

  try {
    await resendClient.emails.send({
      from,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch (error) {
    logger.error('Failed to send HR OTP email via Resend.', {
      error: error.message,
      name: error.name,
      statusCode: error.statusCode,
    });
    throw new ApiError(502, 'Failed to deliver OTP email. Please try again.');
  }
}

module.exports = {
  sendHrOtpEmail,
};
