require ("dotenv").config();

const nodemailer = require("nodemailer");
const cron = require("node-cron");


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   
    pass: process.env.EMAIL_PASSWORD      
  }
});

//potwierdzenie rezerwacji wizyty
async function infoMail(to, date, time) {
  const mailOptions = {
    from: `"Ortodonta123" <${process.env.EMAIL_USER}>`,
//    to,  <- normalnie nie trzeba wpisywac konkretnie maila, no bo by pobieralo, ale w serwer.js i tutaj chce przetestowac czy w ogole wysyla cokolwiek :P
    to: 'jkszinteligencja@gmail.com',
    subject: "Potwierdzenie rezerwacji wizyty w klinice ortodontycznej Ortodonta123",
    text: `Informujemy o rezerwacji wizyty w dniu ${date} o godzinie ${time}. Do zobaczenia! :)
    
    W celu zmiany terminu lub sprawdzenia szczegółów rezerwacji proszę o odwiedzenie strony http://localhost:3006/wizyty_uzytkownik.html`,

    //text: `Przypominamy o rezerwacji wizyty w dniu ${date} o godzinie ${time}. Do zobaczenia! :)`,
  };

  await transporter.sendMail(mailOptions);
  console.log("Mail z informacją o rezerwacji został wysłany do użytkownika " + to);
}

//przypomnienie o wizycie 24 h lub mniej przed
function reminderMail(to, dateTime) {
  const dateOfVisit = new Date(dateTime);
  const reminderTime = new Date(dateOfVisit.getTime() - 24 * 60 * 60 * 1000 ); //24 h = 24 h * 60 minut(1h) * 60 sekund (1 min) * 1000 ms (1 sekunda)
  const now = new Date();

  if (reminderTime <= now){ //jezeli wizyta zostala zarezerwowana pozniej niz po uplywie 24h, np wizyta o 13 a rezerwacja byla o 9 no to mail wysylany jest od razu
    return infoReminderMail(to, dateOfVisit);
  }

  //zaplanowanie wysylki maila 24 h przed 
  cron.schedule(`${reminderTime.getMinutes()} ${reminderTime.getHours()} ${reminderTime.getDate()} ${reminderTime.getMonth() + 1} *`, () => {infoReminderMail(to, dateOfVisit);},
{timezone: "Europe/Warsaw"} //getMonth liczy z tabliczy od [0] gdzie 0 - styczen, Cron od [1], gdzie 1 - styczen, wiec trzeba + 1 dodac do listy getMonth 
// cron - minuta / godzina / dzien miesiaca / miesiac / dzien tygodnia, wiec ustawiam * jako wszystko dla dnia tygodnia, bo powiadomienia maja dzialac po prostu 24 h (lub mniej) przed
  );
}

async function infoReminderMail(to, dateOfVisit) {

  const date = dateOfVisit.toISOString().split('T')[0];
  const time = dateOfVisit.toTimeString().slice(0, 5); //w Time obcina do 5 znakow, czyli godzina-godzina : minuta-minuta , 0-g 1-g 2-: 3-m 4-m , zeby nie prosilo o sekundy 
  const mailOptions = {
    from: `"Ortodonta123" <${process.env.EMAIL_USER}>`,
//    to,  <- normalnie nie trzeba wpisywac konkretnie maila, no bo by pobieralo, ale w serwer.js i tutaj chce przetestowac czy w ogole wysyla cokolwiek :P
    to: 'jkszinteligencja@gmail.com',
    subject: "Potwierdzenie rezerwacji wizyty w klinice ortodontycznej Ortodonta123",
    text: `Przypominamy o rezerwacji wizyty w dniu ${date} o godzinie ${time}. Do zobaczenia! :)
    
    W celu zmiany terminu lub sprawdzenia szczegółów rezerwacji proszę o odwiedzenie strony http://localhost:3006/wizyty_uzytkownik.html`,
  };

  await transporter.sendMail(mailOptions);
  console.log("Mail z przypomnieniem został wysłany do użytkownika " + to);
}


//mail o zmianie terminu
async function changeMail(to, oldDate, oldTime, newDate, newTime) {
  const mailOptions = {
    from: `"Ortodonta123" <${process.env.EMAIL_USER}>`,
    to: 'jkszinteligencja@gmail.com',
    subject: "Zmiana terminu wizyty – Ortodonta123",
    text: `Twoja wizyta została przeniesiona z ${oldDate} o ${String(oldTime).slice(0,5)} na ${newDate} o ${String(newTime).slice(0,5)}.
    
    Szczegóły/zmiana: http://localhost:3006/wizyty_uzytkownik.html`,
  };
  await transporter.sendMail(mailOptions);
  console.log("Mail o zmianie terminu wysłany do " + to);
}

//mail o anulowaniu wizyty
async function cancelMail(to, date, time) {
  const mailOptions = {
    from: `"Ortodonta123" <${process.env.EMAIL_USER}>`,
    to: 'jkszinteligencja@gmail.com',
    subject: "Anulowanie wizyty – Ortodonta123",
    text: `Twoja wizyta w dniu ${date} o ${String(time).slice(0,5)} została ANULOWANA.
    
    Umów nowy termin: http://localhost:3006/wizyty_uzytkownik.html`,
  };
  await transporter.sendMail(mailOptions);
  console.log("Mail o anulowaniu wizyty wysłany do " + to);
}



module.exports = {
    infoMail, reminderMail, changeMail, cancelMail
};