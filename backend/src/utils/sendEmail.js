const nodemailer = require("nodemailer");
const dns = require("dns");

// Force NodeJS to use IPv4 first (fixes Render IPv6 issue)
dns.setDefaultResultOrder("ipv4first");

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      family: 4, // force IPv4
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const mailOptions = {
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.message,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("EMAIL ERROR:", error);
    throw error;
  }
};

module.exports = sendEmail;