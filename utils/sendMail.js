// import transporter from "../config/mail.js";

// const sendMail = async (to, subject, html) => {
//   await transporter.sendMail({
//     from: `"Auth App" <${process.env.EMAIL_USER}>`,
//     to,
//     subject,
//     html
//   });
// };

// export default sendMail;




import axios from "axios";

const sendMail = async (to, subject, html) => {
  try {

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Auth App",
          email: process.env.BREVO_USER,
        },

        to: [
          {
            email: to,
          },
        ],

        subject: subject,

        htmlContent: html,
      },

      {
        headers: {
          "api-key": process.env.BREVO_PASS,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Email sent:", response.data);

  } catch (error) {

    console.error(
      "❌ Brevo error:",
      error.response?.data || error.message
    );

    throw new Error("Email failed");
  }
};

export default sendMail;