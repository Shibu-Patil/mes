import transporter from "../config/mail.js";

const sendMail = async (to, subject, html) => {
  await transporter.sendMail({
    from: `"Auth App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
};

export default sendMail;
