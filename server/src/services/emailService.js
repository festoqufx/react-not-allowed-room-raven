import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
    const gmailUser = process.env.APP_GMAIL;
    const gmailPassword = process.env.APP_PASSWORD?.replace(/\s/g, '');

    if (gmailUser && gmailPassword) {
        if (!transporter) {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: gmailUser,
                    pass: gmailPassword
                }
            });
        }

        return transporter;
    }

    const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing email configuration: ${missing.join(', ')}`);
    }

    if (!transporter) {
        const port = Number(process.env.SMTP_PORT || 587);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure: port === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    return transporter;
};

const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const sendVerificationEmail = async ({ email, name, token }) => {
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
    if (!frontendUrl) {
        throw new Error('Missing email configuration: FRONTEND_URL');
    }

    const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const safeName = escapeHtml(name);
    const safeVerificationUrl = escapeHtml(verificationUrl);

    await getTransporter().sendMail({
        from: process.env.MAIL_FROM || `NotAllowedRoom <${process.env.APP_GMAIL}>`,
        to: email,
        subject: 'Verify your email | NotAllowedRoom',
        text: [
            `Hi ${name},`,
            '',
            'Welcome to NotAllowedRoom. Verify your email address to finish creating your account.',
            '',
            verificationUrl,
            '',
            'This link expires in one hour. If you did not create this account, you can ignore this email.',
            '',
            'NotAllowedRoom'
        ].join('\n'),
        html: `
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Verify your email</title>
            </head>
            <body style="margin:0; padding:0; background-color:#f6f4ef; color:#22201c; font-family:Arial,Helvetica,sans-serif;">
                <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
                    Verify your email to finish creating your NotAllowedRoom account.
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f4ef;">
                    <tr>
                        <td align="center" style="padding:40px 16px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
                                <tr>
                                    <td style="padding:0 0 20px; text-align:center;">
                                        <span style="display:inline-block; width:44px; height:44px; line-height:44px; border-radius:10px; background-color:#256f5a; color:#ffffff; font-size:18px; font-weight:700; text-align:center;">NR</span>
                                        <div style="margin-top:10px; color:#17483b; font-size:18px; font-weight:700; letter-spacing:-0.2px;">NotAllowedRoom</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background-color:#ffffff; border:1px solid #ded8cc; border-radius:12px; padding:40px 36px; box-shadow:0 12px 24px rgba(38,34,28,0.08);">
                                        <h1 style="margin:0 0 16px; color:#22201c; font-size:28px; line-height:36px; text-align:center;">Verify your email</h1>
                                        <p style="margin:0 0 12px; color:#615d55; font-size:16px; line-height:25px;">Hi ${safeName},</p>
                                        <p style="margin:0 0 28px; color:#615d55; font-size:16px; line-height:25px;">Welcome to NotAllowedRoom. Confirm your email address to finish creating your account and start joining rooms.</p>
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td align="center" style="padding-bottom:28px;">
                                                    <a href="${safeVerificationUrl}" style="display:inline-block; padding:14px 28px; border-radius:8px; background-color:#256f5a; color:#ffffff; font-size:16px; font-weight:700; line-height:20px; text-decoration:none;">Verify email address</a>
                                                </td>
                                            </tr>
                                        </table>
                                        <div style="padding:14px 16px; border-radius:8px; background-color:#e5f0ec; color:#17483b; font-size:14px; line-height:21px; text-align:center;">
                                            This verification link expires in <strong>1 hour</strong>.
                                        </div>
                                        <p style="margin:28px 0 8px; color:#8b8578; font-size:13px; line-height:20px;">If the button does not work, copy and paste this link into your browser:</p>
                                        <p style="margin:0; font-size:13px; line-height:20px; word-break:break-all;"><a href="${safeVerificationUrl}" style="color:#256f5a; text-decoration:underline;">${safeVerificationUrl}</a></p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:22px 20px 0; color:#8b8578; font-size:12px; line-height:19px; text-align:center;">
                                        You received this email because an account was created with this address.<br>
                                        If that was not you, no action is required.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `
    });
};
