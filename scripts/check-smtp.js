require('dotenv').config();
const nodemailer = require('nodemailer');

async function main(){
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missing = required.filter((key) => !process.env[key]);
    if(missing.length){
        console.error(`Missing SMTP config: ${missing.join(', ')}`);
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

    await transporter.verify();
    console.log('SMTP connection verified.');
}

main().catch((err) => {
    console.error('SMTP verification failed.');
    console.error({
        code: err.code,
        responseCode: err.responseCode,
        response: err.response,
        message: err.message
    });
    process.exit(1);
});
