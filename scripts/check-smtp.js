require('dotenv').config();
const nodemailer = require('nodemailer');

async function main(){
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter((key) => !process.env[key]);
    if(missing.length){
        console.error(`Missing SMTP config: ${missing.join(', ')}`);
        process.exit(1);
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const password = process.env.SMTP_PASS.replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: password
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000
    });

    await transporter.verify();
    console.log('SMTP connection verified.');
    console.log(`Host: ${process.env.SMTP_HOST}:${port} secure=${secure}`);
}

main().catch((err) => {
    console.error('SMTP verification failed.');
    console.error({
        code: err.code,
        responseCode: err.responseCode,
        response: err.response,
        message: err.message
    });
    if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(err.code)) {
        console.error('Connection failed before Gmail authentication. On Render Free, outbound SMTP ports 25, 465, and 587 are blocked.');
    }
    process.exit(1);
});
