import { createResendClient } from './resend-client.js';

const senderEmail = process.env.RESEND_FROM_EMAIL;
const senderName = process.env.RESEND_FROM_NAME || 'AzTech Africa';
const siteUrl = (process.env.SITE_URL || 'https://aztech-africa-production.up.railway.app').replace(/\/$/, '');
const resendClient = createResendClient();

export const siteBaseUrl = siteUrl;
export const emailDeliveryConfigured = Boolean(resendClient.configured && senderEmail);

export async function sendVerificationEmail({ email, verificationToken, manageToken }) {
  if (!emailDeliveryConfigured) return false;
  const verifyUrl = `${siteUrl}/api/subscriptions/verify?token=${encodeURIComponent(verificationToken)}`;
  const manageUrl = `${siteUrl}/?manage=${encodeURIComponent(manageToken)}#newsletter-section`;
  const message = {
    from: `${senderName} <${senderEmail}>`,
    to: [email],
    subject: 'Confirm your AzTech Africa newsletter subscription',
    text: `Confirm your subscription: ${verifyUrl}\n\nManage preferences or unsubscribe: ${manageUrl}`,
    html: `<p>Confirm your AzTech Africa newsletter subscription:</p><p><a href="${verifyUrl}">Confirm subscription</a></p><p><a href="${manageUrl}">Manage preferences or unsubscribe</a></p>`,
  };
  await resendClient.send(message);
  return true;
}

export async function sendWelcomeEmail({ email, subject, body }) {
  if (!emailDeliveryConfigured) return false;
  const safeSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : 'Welcome to AzTech Africa';
  const safeBody = typeof body === 'string' ? body.trim() : '';
  const escapedBody = safeBody.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]).replace(/\r?\n/g, '<br>');
  await resendClient.send({
    from: `${senderName} <${senderEmail}>`,
    to: [email],
    subject: safeSubject,
    text: safeBody,
    html: `<div style="margin:0;background:#f2f6f9;padding:32px 16px;font-family:Arial,sans-serif;color:#17324b"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #d6e2ec"><div style="padding:22px;background:#0b1f38;color:#fff"><strong style="color:#f06424">AZTECH AFRICA</strong></div><div style="padding:24px;font-size:15px;line-height:1.7">${escapedBody}<p style="margin:22px 0 0"><a href="${siteUrl}/#featured-articles" style="color:#0b6899">Explore the latest stories</a></p></div></div></div>`,
  });
  return true;
}

export async function sendEditorialInvitation({ email, setupUrl }) {
  if (!emailDeliveryConfigured) return false;
  await resendClient.send({
    from: `${senderName} <${senderEmail}>`,
    to: [email],
    subject: 'Set up your AzTech Africa editorial account',
    text: `You have been invited to the AzTech Africa Editorial Studio. Set your password within 24 hours: ${setupUrl}`,
    html: `<div style="margin:0;background:#f2f6f9;padding:32px 16px;font-family:Arial,sans-serif;color:#17324b"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #d6e2ec"><div style="padding:24px;background:#0b1f38;color:#fff"><strong style="color:#f06424">AZTECH AFRICA</strong><h1 style="margin:16px 0 0;font-size:24px">Editorial Studio invitation</h1></div><div style="padding:24px"><p>You have been invited to join the AzTech Africa editorial team.</p><p><a href="${setupUrl}" style="display:inline-block;padding:12px 18px;background:#f06424;color:#fff;text-decoration:none;font-weight:bold">Set your password</a></p><p style="font-size:13px;color:#526b82">This one-time link expires in 24 hours. If you were not expecting this invitation, you can ignore this email.</p></div></div></div>`,
  });
  return true;
}
