import nodemailer from "nodemailer";
import { buildIcsInvite } from "@/lib/ics";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendBookingEmails(params: {
  uid: string;
  eventTitle: string;
  eventDescription: string | null;
  start: Date;
  end: Date;
  locationLabel: string;
  videoLink: string | null;
  attendeeName: string;
  attendeeEmail: string;
  organizerName: string;
  organizerEmail: string;
  cancelUrl: string;
}) {
  const transport = getTransport();
  if (!transport) {
    console.warn(
      "[email] SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASSWORD). E-mails de confirmação não foram enviados.",
    );
    return;
  }

  const from = process.env.SMTP_FROM ?? params.organizerEmail;

  const ics = buildIcsInvite({
    uid: params.uid,
    title: params.eventTitle,
    description: params.eventDescription ?? "",
    start: params.start,
    end: params.end,
    organizerName: params.organizerName,
    organizerEmail: params.organizerEmail,
    attendeeName: params.attendeeName,
    attendeeEmail: params.attendeeEmail,
    location: params.videoLink ?? params.locationLabel,
  });

  const dateLabel = params.start.toLocaleString("pt-BR", {
    timeZone: process.env.RI_DEFAULT_TIMEZONE ?? "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  });

  const html = `
    <p>Olá ${params.attendeeName},</p>
    <p>Sua call <strong>${params.eventTitle}</strong> foi confirmada para <strong>${dateLabel}</strong>.</p>
    <p><strong>Local:</strong> ${params.locationLabel}</p>
    ${params.videoLink ? `<p><strong>Link da videochamada:</strong> <a href="${params.videoLink}">${params.videoLink}</a></p>` : ""}
    <p>Se precisar cancelar, use este link: <a href="${params.cancelUrl}">${params.cancelUrl}</a></p>
    <p>Um convite de calendário (.ics) foi anexado a este e-mail.</p>
    <p>Atenciosamente,<br/>${params.organizerName}</p>
  `;

  const attachments = [
    {
      filename: "convite.ics",
      content: ics,
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
    },
  ];

  await transport.sendMail({
    from,
    to: params.attendeeEmail,
    subject: `Confirmação: ${params.eventTitle} — ${dateLabel}`,
    html,
    attachments,
  });

  await transport.sendMail({
    from,
    to: params.organizerEmail,
    subject: `Nova call agendada: ${params.eventTitle} com ${params.attendeeName}`,
    html: `
      <p>Nova call agendada por <strong>${params.attendeeName}</strong> (${params.attendeeEmail}).</p>
      <p><strong>${params.eventTitle}</strong> em <strong>${dateLabel}</strong>.</p>
      ${params.videoLink ? `<p>Link: <a href="${params.videoLink}">${params.videoLink}</a></p>` : ""}
    `,
    attachments,
  });
}

export async function sendCancellationEmails(params: {
  eventTitle: string;
  start: Date;
  attendeeName: string;
  attendeeEmail: string;
  organizerName: string;
  organizerEmail: string;
  reason?: string | null;
}) {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] SMTP não configurado. E-mail de cancelamento não foi enviado.");
    return;
  }

  const from = process.env.SMTP_FROM ?? params.organizerEmail;
  const dateLabel = params.start.toLocaleString("pt-BR", {
    timeZone: process.env.RI_DEFAULT_TIMEZONE ?? "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  });

  const reasonHtml = params.reason ? `<p><strong>Motivo:</strong> ${params.reason}</p>` : "";

  await Promise.all([
    transport.sendMail({
      from,
      to: params.attendeeEmail,
      subject: `Cancelada: ${params.eventTitle} — ${dateLabel}`,
      html: `<p>Sua call <strong>${params.eventTitle}</strong> de ${dateLabel} foi cancelada.</p>${reasonHtml}`,
    }),
    transport.sendMail({
      from,
      to: params.organizerEmail,
      subject: `Cancelada: ${params.eventTitle} com ${params.attendeeName}`,
      html: `<p>A call com <strong>${params.attendeeName}</strong> em ${dateLabel} foi cancelada.</p>${reasonHtml}`,
    }),
  ]);
}
