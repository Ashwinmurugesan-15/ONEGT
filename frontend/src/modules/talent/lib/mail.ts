import nodemailer from 'nodemailer';

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

export const transporter = nodemailer.createTransport({
    service: 'gmail', // You can customize this or use 'host', 'port' etc.
    auth: {
        user: emailUser,
        pass: emailPass,
    },
});

export const sendMail = async (to: string, subject: string, html: string) => {
    if (!emailUser || !emailPass) {
        console.warn('EMAIL_USER or EMAIL_PASS not set. Email not sent.');
        // For development without creds, we can just log it
        console.log('--- MOCK EMAIL SEND ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${html}`);
        console.log('-----------------------');
        return { success: true, mock: true };
    }

    try {
        const info = await transporter.sendMail({
            from: `"HireFlow Portal" <${emailUser}>`,
            to,
            subject,
            html,
        });
        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};
