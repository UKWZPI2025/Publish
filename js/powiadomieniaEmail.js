require ("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   
    pass: process.env.EMAIL_PASSWORD
  }
});

async function infoMail(to, date, time) {
  const mailOptions = {
    from: `"Ortodonta123" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Przypomnienie o rezerwacji wizyty w klinice ortodontycznej Ortodonta123",
    text: `Przypominamy o wizycie w dniu ${date} o godzinie ${time}. Do zobaczenia! :)`,
  };

  await transporter.sendMail(mailOptions);
  console.log("Mail wysłany do użytkownika " + to);
}

module.exports = {
    infoMail
};