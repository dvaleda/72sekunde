import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? '72 sekunde <kviz@72h.hr>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface QuizResultEmailParams {
  to: string;
  nickname: string;
  score: number;
  answeredCount: number;
  officialProjectUrl: string;
  officialRegistrationUrl: string | null;
}

/**
 * Sends the short "thanks for playing" email. Only ever call this for
 * players who ticked the separate marketing_consent checkbox — callers
 * are responsible for that check, this function does not re-verify it.
 */
export async function sendQuizResultEmail(params: QuizResultEmailParams): Promise<void> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping sendQuizResultEmail');
    return;
  }

  const registrationLine = params.officialRegistrationUrl
    ? `<p><a href="${params.officialRegistrationUrl}">Prijavi se na 72H</a></p>`
    : '';

  await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: 'Hvala što si za 72 sekunde testirao/la svoje znanje!',
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto;">
        <h2>Bok, ${escapeHtml(params.nickname)}!</h2>
        <p>Hvala ti što si sudjelovao/la u kvizu <strong>72 sekunde</strong>.</p>
        <p>Tvoj rezultat: <strong>${params.score} točnih odgovora</strong> (odgovorio/la si na ${params.answeredCount} pitanja).</p>
        <p>Saznao/la si nešto novo o projektu 72 sata bez kompromisa? Napravi sljedeći korak.</p>
        ${registrationLine}
        <p><a href="${params.officialProjectUrl}">Saznaj više o 72H</a></p>
        <p style="color:#888;font-size:12px;">Ovu poruku primaš jer si prilikom igranja kviza dao/la privolu za primanje obavijesti o projektu 72 sata bez kompromisa.</p>
      </div>
    `,
  });
}

interface RegistrationReminderParams {
  to: string;
  nickname: string;
  officialRegistrationUrl: string;
}

export async function send72HRegistrationReminder(params: RegistrationReminderParams): Promise<void> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping send72HRegistrationReminder');
    return;
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: 'Prijave na 72 sata bez kompromisa su otvorene!',
    html: `
      <div style="font-family: sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto;">
        <h2>Bok, ${escapeHtml(params.nickname)}!</h2>
        <p>Prijave na projekt <strong>72 sata bez kompromisa</strong> su sada otvorene.</p>
        <p><a href="${params.officialRegistrationUrl}">Prijavi se ovdje</a></p>
      </div>
    `,
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
