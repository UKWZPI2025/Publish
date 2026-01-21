const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const webpush = require('web-push');

const rawContact = process.env.VAPID_CONTACT || 'mailto:jkszinteligencja@gmail.com';
const contact = (rawContact.startsWith('mailto:') || rawContact.startsWith('https://'))
  ? rawContact
  : `mailto:${rawContact}`;

try {
  webpush.setVapidDetails(contact, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  console.log('Web Push VAPID skonfigurowane:', contact);
} catch (e) {
  console.error('Web Push init error:', e.message);
}


const { infoMail, reminderMail, changeMail, cancelMail  } = require('./powiadomienia_email'); 

const EMAIL_DEMO = 'jkszinteligencja@gmail.com';

console.log('DB_HOST=', process.env.DB_HOST);
console.log('DB_USER=', process.env.DB_USER);
console.log('DB_PASS=', process.env.DB_PASS ? '***' : '<brak>');
console.log('DB_NAME=', process.env.DB_NAME);

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3006;


//SOCKET IO!!!!

const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);

const io = new Server(server);

// mapowanie userId na sockety
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('WS connected:', socket.id);

  socket.on('auth', (userId) => {
    userId = Number(userId);
    socket.data.userId = userId;

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);
    console.log('WS auth user:', userId, 'sockets:', userSockets.get(userId).size);
    
    // replay - jeśli user ma pending ''wolny termin'' = wyślij go od razu po auth
    const sql = `
      SELECT id, slotDate, slotTime, doctorId, candidateVisitId, expiresAt
      FROM FreedSlotQueue
      WHERE userId = ?
        AND status = 'NO_RESPONSE'
        AND expiresAt > NOW()
      ORDER BY createdAt DESC
      LIMIT 1`;

    db.query(sql, [userId], (err, rows) => {
      if (err) {
        console.error('WS replay pending err:', err);
        return;
      }
      if (!rows.length) return;

      const row = rows[0];
      const prettyDate = String(row.slotDate).slice(0, 10);
      const prettyTime = String(row.slotTime).slice(0, 5);

      socket.emit('freed-slot', {
        queueId: row.id,
        slotDate: prettyDate,
        slotTime: prettyTime,
        doctorId: row.doctorId,
        candidateVisitId: row.candidateVisitId,
        expiresAt: row.expiresAt
      });
    });
  });

  socket.on('disconnect', () => {
    const uid = socket.data.userId;
    if (uid && userSockets.has(uid)) {
      userSockets.get(uid).delete(socket.id);
      if (!userSockets.get(uid).size) userSockets.delete(uid);
    }
    console.log('WS disconnected:', socket.id);
  });
});

// helper: wyślij event tylko do jednego usera
function wsToUser(userId, event, payload) {
  const set = userSockets.get(Number(userId));
  if (!set) return 0;
  for (const sid of set) io.to(sid).emit(event, payload);
  return set.size;
}

// jeśli potrzebujesz gdzieś indziej w pliku:
global.io = io;
global.wsToUser = wsToUser;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/style', express.static(path.join(__dirname, '..', 'style')));
app.use('/js',    express.static(path.join(__dirname, '..', 'js'))); // opcjonalnie, ale czytelniej
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'sw.js'));
});
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index_gosc.html'));
});


const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'JakiesTamWymysloneHaslo',
    database: process.env.DB_NAME || 'Projekt'
});

//#region Uzytkownicy - ogolna tabela

db.connect((err) => {
    if (err) {
        console.error("Nie mozna polaczyc sie z baza", err);
    } else {
        console.log("Connected to database"); //miejsce zamieszkania, miasto, ulica, blok, nrMieszkania

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS Użytkownicy (
                idUzytkownika INT AUTO_INCREMENT PRIMARY KEY,
                imie VARCHAR(30),
                drugieImie VARCHAR(30),
                nazwisko VARCHAR(50),
                adresEmail VARCHAR(50) UNIQUE,
                haslo VARCHAR(255),
                dataUr DATE,
                nrTelefonu VARCHAR(9),
                PESEL VARCHAR(11) UNIQUE,
                rola ENUM('pacjent', 'dentysta', 'recepcjonistka') DEFAULT 'pacjent',
                aktywnyStatus BOOLEAN DEFAULT 1,
                dataUtworzenia TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CHECK (PESEL REGEXP '^[0-9]{11}$'),
                FOREIGN KEY (Role) REFERENCES role(IdRole)
            )`;

        db.query(createTableQuery, (err) => {
            if (err) {
                console.error("Blad tworzenia tabeli Użytkownicy", err);
            } else {
                console.log("Tabela Użytkownicy utworzona.");
            }
        });
    }
});

//#endregion 

//potem FK idDentysta do tabeli Uzytkownicy -> Dentysta: specjalizacja (no bo moga tez byc osoby, ktore pomgaja, sa na praktykach, itd.), gabinet, godziny pracy itp.
//FK idRecepcjonista do tabeli Uzytkownicy
//Wizyty -> idWizyty, dzienWizyty DATE, statusWizyty, pacjent, lekarz, usluga
//Uslugi -> idUslugi, nazwaUslugi, czasWizyty(min), cena FLOAT
//Pacjent -> alergie, choroby, historia zabiegow
//Recepcjonista

//trzeba bedzie jeszcze ustawic, zeby [[[rola ENUM('pacjent', 'dentysta', 'recepcjonistka') DEFAULT 'pacjent']]] byly poustawiane dla odpowiednich osob, bo na razie kazdy uzytkownik jest jako 'pacjent' = ma wszystkie podstawowe informacje dla kazdego (klient/pracownik), a pozniej dzieki widokowim admina/superuzytkownika bedzie mozna zmienic i role dla poszczegolnych osob + dodatkowo wypelnic pola przypisane tylko dla nich

//#region API Rejestracja uzytkownika

app.post('/rejestracja', async (req, res) => {
    const { imie, drugieImie, nazwisko, adresEmail, haslo, dataUr, nrTelefonu, pesel, rola } = req.body;

    if (!imie || !nazwisko || !adresEmail || !haslo || !dataUr || !nrTelefonu || !pesel) {
        return res.status(400).json({ status: 400, message: "Wypelnij wszystkie pola" });
    }

    const rolaNazwa = rola || 'pacjent'; 

        db.query('SELECT IdRole FROM Role WHERE Nazwa = ?', [rolaNazwa], async (err, results) => {
        if (err || results.length === 0) {
            console.error("Nie znaleziono roli:", err);
            return res.status(500).json({ status: 500, message: "Błąd przy pobieraniu roli" });
        }

        const hashHasla = await bcrypt.hash(haslo, 10);
        const idRola = results[0].IdRole;

        const query = `
            INSERT INTO Użytkownicy (imie, drugieImie, nazwisko, adresEmail, haslo, dataUr, nrTelefonu, PESEL, Rola) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(query, [
            imie,
            drugieImie || null,
            nazwisko,
            adresEmail,
            hashHasla,
            dataUr,
            nrTelefonu,
            pesel,
            idRola
        ], (err, results) => {
            if (err) {
                console.error("Blad przy rejestracji:", err.message);
                return res.status(500).json({ status: 500, message: "Blad serwera" });
            }

            console.log(`Dodano uzytkownika ${imie} ${nazwisko} (rola ID: ${idRola})`);
            //res.status(200).json({status: 200, message: "Rejestracja udana", user: {imie, nazwisko}});
            return res.status(200).json({status: 200, message: "Rejestracja udana", idUzytkownika: results.insertId, imie, nazwisko, adresEmail, nrTelefonu});
        });
    });
});

//#endregion

//#region API Logowanie 

app.post('/login', (req, res) => {
  console.log('--- /login request ---');
  console.log('BODY /login ->', req.body);

  const { pesel, haslo } = req.body;
  const query = `SELECT * FROM \`Użytkownicy\` WHERE \`PESEL\` = ?`;

  db.query(query, [pesel], async (err, results) => {
    if (err) {
      console.error("Błąd przy logowaniu:", err);
      return res.status(500).json({ success: false, message: "Błąd serwera" });
    }
    if (results.length === 0) {
      console.log('Brak użytkownika o peselu:', pesel);
      return res.status(404).json({ success: false, message: "Nie znaleziono użytkownika" });
    }

    const u = results[0];

    console.log('DB haslo   ->', JSON.stringify(u.Haslo));
    
    if (!u.Haslo) {
      return res.status(500).json({ success:false, message:'Brak hasła w bazie' });
    }
    console.log('Sent haslo ->', JSON.stringify(haslo));

    console.log("DB keys:", Object.keys(u));
    console.log("DB row:", u);
    // if (u.Haslo !== haslo) {
    //   console.log('Porównanie haseł nie przeszło');
    //   return res.status(401).json({ success: false, message: "Nieprawidłowe hasło" });
    // }

    // console.log('Logowanie OK dla pesel:', pesel);
    // return res.status(200).json({success: true,message: "Zalogowano pomyślnie",idUzytkownika: u.IdUżytkownicy, imie: u.Imie,nazwisko: u.Nazwisko,email: u.AdresEmail,telefon: u.NrTelefonu, rola: u.Rola});


      let poprawneHaslo = false;

      try {
        poprawneHaslo = await bcrypt.compare(haslo, u.Haslo);
      } catch (e) {
        console.error("bcrypt error:", e.message);
        return res.status(401).json({ success:false, message:"Nieprawidłowe hasło" });
      }

      if (!poprawneHaslo) {
        return res.status(401).json({ success:false, message:"Nieprawidłowe hasło" });
      }

    const jwtToken = jwt.sign(
      {userId: u.IdUżytkownicy, role: u.Rola},
      "kluczJWT",
      {expiresIn: "1h"}
    );

    console.log('Logowanie OK dla pesel:', pesel);
    return res.status(200).json({success: true,message: "Zalogowano pomyślnie", token: jwtToken, idUzytkownika: u.IdUżytkownicy, imie: u.Imie,nazwisko: u.Nazwisko,email: u.AdresEmail,telefon: u.NrTelefonu, rola: u.Rola});


  });
});

//#region funkcja autoryzacji JWT + przypisanie endpointow

function autoryzacjaJWT(req, res, next){
  console.log("REQ HEADERS:", req.headers);

  const token = req.headers.authorization?.split(" ")[1]; //http naglowek jest jako ["Bearer", "kod JWT"] split rozroznia te 2 rzeczy od siebie, [1] tylko bierze informacje tego kodu JWT
  if (!token) return res.status(401).json({ message: "Brak tokenu jwt" });

  try {
    const decoded = jwt.verify(token, "kluczJWT"); 
    req.user = decoded; //czyli wczesniej ustawione {id i rola}, bo w jwt tworzonym wyzej przy api do logowania jest {userId: u.IdUżytkownicy, role: u.Rola}
    next();
  } catch (err) {
    return res.status(403).json({ message: "Błąd tokenu JWT" });
  }
}


//#endregion

//#region API WEB PUSH subskrypcja


//endpointy - public key, subscribe, unsubscribe
app.get('/push/public-key', (req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY || '' }));

app.post('/push/subscribe', (req, res) => {
  const { userId, subscription } = req.body || {};
  if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    console.warn('subscribe: brak danych', req.body);
    return res.status(400).json({ success:false, message:'Brak danych subskrypcji' });
  }
  const sql = `
    INSERT INTO PushSubscriptions (userId, endpoint, p256dh, auth, enabled)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE p256dh=VALUES(p256dh), auth=VALUES(auth), enabled=1`;
  db.query(sql, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth], (err) => {
    if (err) { console.error('subscribe DB err:', err); return res.status(500).json({ success:false }); }
    db.query('UPDATE \`Użytkownicy\` SET WebPushConsent=1 WHERE IdUżytkownicy=?', [userId], () => {});
    console.log('SUB zapisana:', userId, subscription.endpoint.slice(0, 42) + '...');
    res.json({ success:true });
  });
});

app.post('/push/unsubscribe', (req, res) => {
  const { userId, endpoint } = req.body || {};
  if (!userId || !endpoint) return res.status(400).json({ success:false });
  db.query('UPDATE PushSubscriptions SET enabled=0 WHERE userId=? AND endpoint=?', [userId, endpoint], (err) => {
    if (err) { console.error('unsubscribe DB err:', err); return res.status(500).json({ success:false }); }
    console.log('SUB wyłączona:', userId, String(endpoint).slice(0,42)+'...');
    res.json({ success:true });
  });
});

//helpery
function sendPush(sub, payloadObj) {
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payloadObj)
  );
}

async function pushToUser(userId, payloadObj) {
  db.query('SELECT endpoint,p256dh,auth FROM PushSubscriptions WHERE userId=? AND enabled=1', [userId], async (e, rows) => {
    if (e) { console.error('pushToUser DB err:', e); return; }
    console.log(`pushToUser(${userId}) -> ${rows.length} sub(s)`);
    for (const sub of rows) {
      try {
        await sendPush(sub, payloadObj);
        console.log('push OK ->', sub.endpoint.slice(0, 42) + '...');
      } catch (err) {
        console.error('push ERR ->', err.statusCode, err.body || err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          db.query('UPDATE PushSubscriptions SET enabled=0 WHERE endpoint=?', [sub.endpoint], () => {});
          console.warn('  (disabled martwą subkę)');
        }
      }
    }
  });
}

//endpoint testowy 
app.post('/push/test', (req, res) => {
  const { userId = 1, title='Test push', body='Hello', url='/' } = req.body || {};
  pushToUser(userId, { type:'test', title, body, url });
  res.json({ ok:true });
});

//endregion

//#region API dentysta

app.post('/dentysci', (req, res) => {
    const { idUzytkownika, specjalizacja, gabinet, godzinyPracy } = req.body;

    if (!idUzytkownika || !specjalizacja) {
        return res.status(400).json({ message: "Wypelnij wszystkie pola" });
    }

    const query = `INSERT INTO Dentysci (idDentysta, specjalizacja, gabinet, godzinyPracy)VALUES (?, ?, ?, ?)`;

    db.query(query, [idUzytkownika, specjalizacja, gabinet || null, godzinyPracy || null], (err, result) => {
        if (err) {
            console.error("Blad przy dodawaniu konta dentysty:", err.message);
            return res.status(500).json({ message: "Blad serwera" });
        }
        res.status(200).json({ message: "Dodano dentyste" });
    });
});

//#endregion

//#region API pacjenci
app.post('/pacjenci', autoryzacjaJWT, (req, res) => {
    const { idUzytkownika, alergie, choroby, historiaZabiegow } = req.body;  // <--- na razie choroby, historiaZabiegow bedzie wpisana tutaj, pozniej jednak beda oddzielne tabelki w bazie do tego

    if (!idUzytkownika) {
        return res.status(400).json({ message: "Wypelnij wszystkie pola" });
    }

    const query = `INSERT INTO Pacjenci (idPacjent, alergie, choroby, historiaZabiegow)VALUES (?, ?, ?, ?)`;

    db.query(query, [idUzytkownika, alergie || null, choroby || null, historiaZabiegow || null], (err, result) => {
        if (err) {
            console.error("Blad przy dodawaniu pacjenta:", err.message);
            return res.status(500).json({ message: "Blad serwera" });
        }
        res.status(200).json({ message: "Dodano pacjenta" });
    });
});

//#endregion

//#region API uslugi

app.post('/uslugi', autoryzacjaJWT, (req, res) => {
    const { nazwaUslugi, czasWizyty, cena } = req.body;

    if (!nazwaUslugi || !czasWizyty || !cena) {
        return res.status(400).json({ message: "Wypelnij wszystkie pola" });
    }

      const query = "INSERT INTO `Usługi` (NazwaUsługi, CzasWizyty, Cena) VALUES (?, ?, ?)";


    db.query(query, [nazwaUslugi, czasWizyty, cena], (err, result) => {
        if (err) {
            console.error("Blad przy dodawaniu uslugi:", err.message);
            return res.status(500).json({ message: "Blad serwera" });
        }
        res.status(200).json({ message: "Dodano usługe" });
    });
});


//get dla usług, by się pobierały z bazy danych

app.get('/api/uslugi', autoryzacjaJWT, (req, res) => {
  const sql = `
    SELECT
      idUsługi AS idUsługi,
      CONCAT(NazwaUsługi, ' (', CzasWizyty, ' min) – ', FORMAT(Cena,2,'pl_PL'), ' zł') AS nazwaUsługi
    FROM \`Usługi\`
    ORDER BY NazwaUsługi, Cena
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Błąd pobierania usług:", err);
      return res.status(500).json({ success: false, message: "Błąd serwera" });
    }
    res.json({ success: true, uslugi: results });
  });
});

//#endregion

//#region API wizyty i zabiegi

app.post('/api/zabiegi', autoryzacjaJWT, (req, res) => {
  const { DataZabiegu, Opis } = req.body;
  if (!DataZabiegu || !Opis) {
    return res.status(400).json({ success:false, message:'Wypelnij pola zabiegu' });
  }
  const q = 'INSERT INTO Zabiegi (DataZabiegu, Opis) VALUES (?, ?)';
  db.query(q, [DataZabiegu, Opis], (err, result) => {
    if (err) {
      console.error('Błąd dodawania zabiegu:', err);
      return res.status(500).json({ success:false, message:'Błąd serwera' });
    }
    res.json({ success:true, idZabiegu: result.insertId });
  });
});

//log pomocniczy zebym wiedziala o co konkretnie ma problem z godzina

function logMysqlError(where, err) {
  if (!err) return;
  console.error(`[SQL:${where}] code=${err.code} errno=${err.errno}`);
  console.error(`[SQL:${where}] sqlMessage=${err.sqlMessage}`);
  console.error(`[SQL:${where}] sql=${err.sql}`);
}



app.post('/api/wizyty', autoryzacjaJWT, (req, res) => {
  console.log('REQ /api/wizyty ->', req.body);

  const { idPacjent, idDentysta, idUsługa } = req.body;
  let dzien = req.body.DzieńWizyty ?? req.body.dzienWizyty ?? req.body.data;
  let rawTime = req.body.GodzinaWizyty ?? req.body.godzinaWizyty ?? req.body.godzina ?? null;

  if (!idPacjent || !idDentysta || !idUsługa || !dzien) {
    return res.status(400).json({ success:false, message:'Wypełnij wszystkie pola' });
  }

  // obsluga formatu "YYYY-MM-DD HH:MM[:SS]" lub ISO "YYYY-MM-DDTHH:MM[:SS]"
  if (!rawTime && /T|\s/.test(String(dzien))) {
    const spl = String(dzien).replace('T', ' ').split(' ');
    dzien = spl[0];
    rawTime = spl[1] || rawTime;
  }

  // normalizacja czasu -> HH:MM:SS
  let timeSQL;
  try {
    timeSQL = toSqlTime(rawTime ?? '00:00');
  } catch (e) {
    return res.status(400).json({ success:false, message:e.message || 'Zły format godziny' });
  }

  const idLekarze = userToDoctorIdMap[idDentysta];
  if (!idLekarze) {
    return res.status(400).json({ success:false, message:'Nieznany lekarz' });
  }

  const checkExact = `
    SELECT 1
    FROM \`Zapisy\`
    WHERE \`Pacjent\` = ?
      AND \`DzieńWizyty\` = STR_TO_DATE(?, '%Y-%m-%d')
      AND \`GodzinaWizyty\` = STR_TO_DATE(?, '%H:%i:%s')
    LIMIT 1`;
  db.query(checkExact, [idPacjent, dzien, timeSQL], (eExact, rExact) => {
    if (eExact) {
      logMysqlError('check exact dup', eExact);
      return res.status(500).json({ success:false, message:'Błąd serwera' });
    }
    if (rExact.length) {
      return res.status(409).json({ success:false, message:'Masz już wizytę na ten termin.' });
    }

    const checkDay = `
      SELECT 1
      FROM \`Zapisy\`
      WHERE \`Pacjent\` = ?
        AND \`DzieńWizyty\` = STR_TO_DATE(?, '%Y-%m-%d')
      LIMIT 1`;
    db.query(checkDay, [idPacjent, dzien], (eDay, rDay) => {
      if (eDay) {
        logMysqlError('check day dup', eDay);
        return res.status(500).json({ success:false, message:'Błąd serwera' });
      }
      if (rDay.length) {
        return res.status(409).json({ success:false, message:'Masz już zaplanowaną wizytę na ten termin.' });
      }

      const insertQuery = `
        INSERT INTO \`Zapisy\` (\`Pacjent\`, \`Lekarz\`, \`Usługa\`, \`DzieńWizyty\`, \`GodzinaWizyty\`)
        VALUES (?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d'), STR_TO_DATE(?, '%H:%i:%s'))`;
      db.query(insertQuery, [idPacjent, idLekarze, idUsługa, dzien, timeSQL], async (insErr) => {
        if (insErr) {
          logMysqlError('insert visit', insErr);
          return res.status(500).json({ success:false, message:'Błąd serwera przy dodawaniu wizyty' });
        }

     //   try {
      //    await infoMail(EMAIL_DEMO, dzien, timeSQL);
      //    if (typeof reminderMail === 'function') {
      //      await reminderMail(EMAIL_DEMO, `${dzien} ${timeSQL}`);
      //    }
      //    console.log('Wysłano e-maile do:', EMAIL_DEMO);
     //   } catch (mailErr) {
      //    console.error('Mail err (jkszinteligencja@gmail.com):', mailErr);
      //  }

          //WEB PUSH
        try {

          pushToUser(idPacjent, {
            type: 'visit-booked',
            title: 'Wizyta zarezerwowana',
            body: `Termin: ${dzien} ${timeSQL.slice(0,5)}`,
            url: '/wizyty_uzytkownik.html'
          });

          //web-pushowe przypomnienie 24h przed
          const cron = require('node-cron');
          const visitTs = new Date(`${dzien}T${timeSQL}`);
          const remindTs = new Date(visitTs.getTime() - 24 * 60 * 60 * 1000);

          if (Number.isFinite(visitTs.getTime()) && remindTs > new Date()) {
            const expr = `${remindTs.getMinutes()} ${remindTs.getHours()} ${remindTs.getDate()} ${remindTs.getMonth() + 1} *`;
            const job = cron.schedule(
              expr,
              () => {
                pushToUser(idPacjent, {
                  type: 'visit-reminder',
                  title: 'Przypomnienie o wizycie',
                  body: `Jutro o ${timeSQL.slice(0,5)}`,
                  url: '/wizyty_uzytkownik.html'
                });
                job.stop();
              },
              { timezone: 'Europe/Warsaw' }
            );
          }
        } catch (e) {
          console.error('push err:', e);
        }

        return res.json({ success:true, message:'Wizyta umówiona' });
      });
    });
  });
});


//#endregion

//#region API GET zmiany dla panelu administracji

app.get('/api/uzytkownicyDoPanelu', autoryzacjaJWT, (req, res) => {
  const roles = [2, 4]; //lekarze maja role 2, a admin 4 (w bazie)
  const sql = `SELECT u.IdUżytkownicy AS id, u.Imie AS firstName, u.DrugieImie AS middleName, u.Nazwisko AS lastName, u.AdresEmail AS email, u.PESEL AS pesel, r.Nazwa AS roleName
    FROM \`Użytkownicy\` u
    JOIN \`Role\` r ON u.\`Rola\` = r.\`IdRole\`
    WHERE u.\`Rola\` IN (?, ?)
    ORDER BY r.\`IdRole\`, u.\`Nazwisko\`, u.\`Imie\`
  `;
  db.query(sql, roles, (err, results) => {
    if (err) {
      console.error('Błąd przy pobieraniu użytkowników:', err);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    res.json({ success: true, users: results });
  });
});

//pobieranie grafiku lekarza po jego numerze w bazie, get do zmiany grafiku godzin w szczegółach na Panel użytkowników – Administrator
app.get('/api/grafiki/:idLekarza', autoryzacjaJWT, (req, res) => {
  const id = parseInt(req.params.idLekarza,10);
  const sql = `
    SELECT g.IdDnia, d.Nazwa, g.godzinyPracyOd, g.godzinyPracyDo
    FROM Grafiki g
    JOIN DniTygodnia d ON g.IdDnia = d.IdDnia
    WHERE g.IdLekarze = ?
    ORDER BY g.IdDnia`;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ success:false, message:'Błąd serwera' });
    res.json({ success:true, grafik: results });
  });
});


//aktualizacja tego grafiku:
app.put('/api/grafiki/:idLekarza/:idDnia', autoryzacjaJWT, (req, res) => {
   console.log('GOT PUT /api/grafiki', {
    params: req.params,
    body: req.body
  });
  const idL = parseInt(req.params.idLekarza,10);
  const idD = parseInt(req.params.idDnia,10);
  const odVal = req.body.od === '-' ? null : req.body.od;
  const doVal = req.body.to  === '-' ? null : req.body.to;
  if ((odVal===null) !== (doVal===null)) {
    return res.status(400).json({ success:false, message:'Obie godziny muszą być albo puste, albo uzupełnione' });
  }
  const sql = `
    UPDATE Grafiki
    SET godzinyPracyOd = ?, godzinyPracyDo = ?
    WHERE IdLekarze = ? AND IdDnia = ?`;
  db.query(sql, [odVal, doVal, idL, idD], (err, result) => {
    if (err) return res.status(500).json({ success:false, message:'Błąd serwera' });
    console.log('  SQL result:', err||result);
    if (result.affectedRows===0) {
      return res.status(404).json({ success:false, message:'Nie znaleziono wpisu grafiku' });
    }
    res.json({ success:true, message:'Zaktualizowano' });
  });
});

// tutaj endpoint, żeby pobrało wszystkie wizyty zalogowanego usera, by nie znikały po odświeżeniu :/
//dodaje lekarzid
  app.get('/api/wizyty/:idPacjenta', autoryzacjaJWT, (req, res) => {
    const idPacjenta = parseInt(req.params.idPacjenta, 10);
    const sql = `
      SELECT
        z.idZapisy AS id,
        z.Lekarz   AS lekarzId,              
        CONCAT(l.imie, ' ', l.nazwisko) AS lekarz,
        DATE_FORMAT(z.\`DzieńWizyty\`, '%Y-%m-%d') AS data,
        DATE_FORMAT(z.\`GodzinaWizyty\`, '%H:%i')   AS godzina,
        u.NazwaUsługi AS usluga
      FROM \`Zapisy\` z
        JOIN \`Usługi\`   u ON z.Usługa = u.idUsługi
        JOIN \`Lekarze\`  d ON z.Lekarz = d.idLekarze
        JOIN \`Użytkownicy\` l ON d.NrUżytkownika = l.IdUżytkownicy
      WHERE z.Pacjent = ?
      ORDER BY z.\`DzieńWizyty\` DESC, z.\`GodzinaWizyty\` DESC
    `;
    
    db.query(sql, [idPacjenta], (err, rows) => {
      if (err) {
        console.error('Błąd pobierania wizyt:', err);
        return res.status(500).json({ success:false, message:'Błąd serwera' });
      }
      res.json({ success:true, wizyty: rows });
    });
  });


function createFreedSlotQueue(when) {
  const doctorId = when.Lekarz;
  const slotDate = when.d; // 'YYYY-MM-DD'
  const slotTime = when.t; // 'HH:MM:SS'

  if (!doctorId || !slotDate || !slotTime) return;

  // wyszukiwanie 3 pacjentów tego samego lekarza, tego samego dnia, z późniejszą godziną
  const sqlCandidates = `
    SELECT
      z.idZapisy AS visitId,
      z.Pacjent  AS userId,
      DATE_FORMAT(z.\`GodzinaWizyty\`, '%H:%i:%s') AS visitTime
    FROM \`Zapisy\` z
    WHERE z.Lekarz = ?
      AND z.\`DzieńWizyty\` = STR_TO_DATE(?, '%Y-%m-%d')
      AND z.\`GodzinaWizyty\` > STR_TO_DATE(?, '%H:%i:%s')
    ORDER BY z.\`GodzinaWizyty\` ASC
    LIMIT 3`;

  db.query(sqlCandidates, [doctorId, slotDate, slotTime], (err, rows) => {
    if (err) {
      console.error('Błąd wyboru kandydatów do wolnego slota:', err);
      return;
    }
    if (!rows.length) {
      console.log('Brak kandydatów do wolnego terminu', slotDate, slotTime);
      return;
    }

    const now = new Date();
    const expiresAtJs = new Date(now.getTime() + 15 * 60 * 1000); 
    const pad = (n) => String(n).padStart(2, '0');
    const expiresAtSql = `${expiresAtJs.getFullYear()}-${pad(expiresAtJs.getMonth()+1)}-${pad(expiresAtJs.getDate())} ${pad(expiresAtJs.getHours())}:${pad(expiresAtJs.getMinutes())}:${pad(expiresAtJs.getSeconds())}`;

    rows.forEach((row) => {
      const ins = `
        INSERT INTO FreedSlotQueue
          (slotDate, slotTime, doctorId, candidateVisitId, userId, status, expiresAt)
        VALUES (?, ?, ?, ?, ?, 'NO_RESPONSE', ?)
        ON DUPLICATE KEY UPDATE
          candidateVisitId = VALUES(candidateVisitId),
          status           = VALUES(status),
          expiresAt        = VALUES(expiresAt)`;


      db.query(
        ins,
        [slotDate, slotTime, doctorId, row.visitId, row.userId, expiresAtSql],
        (e2, result) => {
          if (e2) {
            console.error('Błąd INSERT FreedSlotQueue:', e2);
            return;
          }

          const queueId = result.insertId || null;

          // websocket
          if (typeof wsToUser === 'function') {
            wsToUser(row.userId, 'freed-slot', {
              queueId,
              slotDate,
              slotTime: slotTime.slice(0, 5),
              doctorId,
              candidateVisitId: row.visitId,
              expiresAt: expiresAtJs.toISOString()
            });
          }

          // web push
          if (typeof pushToUser === 'function') {
            pushToUser(row.userId, {
              type: 'freed-slot',
              title: 'Zwolnił się wcześniejszy termin wizyty',
              body: `Dzień ${slotDate}, godzina ${slotTime.slice(0, 5)}. Wejdź w swoje wizyty, aby go przejąć.`,
              url: '/wizyty_uzytkownik.html'
            });
          }
        }
      );
    });
  });
}



// odwołanie wizyty i wysłanie informacji na maila
app.delete('/api/wizyty/:idZapisy', autoryzacjaJWT, (req, res) => {
  const id = parseInt(req.params.idZapisy, 10);

  const qSel = `
    SELECT
      Pacjent,
      Lekarz, 
      DATE_FORMAT(\`DzieńWizyty\`, '%Y-%m-%d')  AS d,
      DATE_FORMAT(\`GodzinaWizyty\`, '%H:%i:%s') AS t
    FROM \`Zapisy\`
    WHERE idZapisy = ?`;
  db.query(qSel, [id], (e0, rows) => {
    if (e0) {
      console.error('Błąd pobierania terminu przed kasowaniem:', e0);
      return res.status(500).json({ success:false, message:'Błąd serwera' });
    }
    if (!rows.length) {
      return res.status(404).json({ success:false, message:'Nie znaleziono wizyty' });
    }

    const when = rows[0]; // { d: 'YYYY-MM-DD', t: 'HH:MM:SS' }

    const qDel = 'DELETE FROM `Zapisy` WHERE idZapisy = ?';
    db.query(qDel, [id], (err, result) => {
      if (err) {
        console.error('Błąd usuwania wizyty:', err);
        return res.status(500).json({ success:false, message:'Błąd serwera' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ success:false, message:'Nie znaleziono wizyty' });
      }

      try {
        if (typeof cancelMail === 'function') {
          cancelMail('jkszinteligencja@gmail.com', when.d, when.t).catch(e => console.error('Mail cancel err:', e));
        }
      } catch (e) {
        console.error('cancelMail err:', e);
      }

      if (when && when.Pacjent) {
        Promise.resolve(
          pushToUser(when.Pacjent, {
            type: 'visit-cancelled',
            title: 'Wizyta anulowana',
            body: `Termin: ${when.d} ${String(when.t).slice(0,5)}`,
            url: '/wizyty_uzytkownik.html'
          })
        ).catch(err => console.error('push cancel err:', err));
      }

      //tworzenie kolejki składającej się z 3 osób na zwolniony termin
      try {
        createFreedSlotQueue(when);
      } catch (e) {
        console.error('createFreedSlotQueue err:', e);
      }

      res.json({ success:true, message:'Wizyta odwołana' });
    });
  });
});


  function toSqlTime(input) {
  if (input == null) throw new Error('Brak godziny');
  let s = String(input).trim().replace(/[–\-\.]/g, ':');
  if (s.includes(' ')) s = s.split(' ')[0];
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error('Zły format godziny (HH:MM lub HH:MM:SS)');
  let [_, hh, mm, ss] = m;
  if (+hh > 23 || +mm > 59 || (ss && +ss > 59)) throw new Error('Nieprawidłowa godzina');
  if (hh.length === 1) hh = '0' + hh;
  return `${hh}:${mm}:${ss ?? '00'}`;
}

app.put('/api/wizyty/:idZapisy', autoryzacjaJWT, (req, res) => {
  const idZapisy = parseInt(req.params.idZapisy, 10);
  const dzien = req.body['DzieńWizyty'] ?? req.body.dzienWizyty ?? req.body.data;
  const rawTime = req.body['GodzinaWizyty'] ?? req.body.godzinaWizyty ?? req.body.godzina;

  if (!idZapisy || !dzien || !rawTime) {
    return res.status(400).json({ success:false, message:'Podaj datę i godzinę' });
  }

  let timeSQL;
  try { timeSQL = toSqlTime(rawTime); }
  catch (e) { return res.status(400).json({ success:false, message:e.message }); }

  // pobierz stary termin przed zmianą
  const qGet = `
    SELECT Pacjent, Lekarz,
           DATE_FORMAT(\`DzieńWizyty\`, '%Y-%m-%d') AS oldDate,
           DATE_FORMAT(\`GodzinaWizyty\`, '%H:%i:%s') AS oldTime
    FROM \`Zapisy\`
    WHERE idZapisy = ?`;
  db.query(qGet, [idZapisy], (e1, rows) => {
    if (e1) return res.status(500).json({ success:false, message:'Błąd serwera' });
    if (!rows.length) return res.status(404).json({ success:false, message:'Wizyta nie istnieje' });

    const { Pacjent, Lekarz, oldDate, oldTime } = rows[0];

    const qGrafik = `
      SELECT godzinyPracyOd, godzinyPracyDo
      FROM Grafiki
      WHERE IdLekarze = ? AND IdDnia = WEEKDAY(?) + 1`;
    db.query(qGrafik, [Lekarz, dzien], (e2, gRows) => {
      if (e2) return res.status(500).json({ success:false, message:'Błąd serwera' });
      if (!gRows.length || !gRows[0].godzinyPracyOd || !gRows[0].godzinyPracyDo) {
        return res.status(400).json({ success:false, message:'Lekarz nie przyjmuje tego dnia' });
      }

      const [sh, sm] = String(gRows[0].godzinyPracyOd).split(':').map(Number);
      const [eh, em] = String(gRows[0].godzinyPracyDo).split(':').map(Number);
      const [th, tm] = timeSQL.split(':').map(Number);
      const inMin = th*60+tm, fromMin = sh*60+sm, toMin = eh*60+em;
      if (inMin < fromMin || inMin > toMin) {
        return res.status(400).json({ success:false, message:'Godzina poza grafikiem lekarza' });
      }

      const qDup = `
        SELECT 1 FROM Zapisy
        WHERE Lekarz = ?
          AND \`DzieńWizyty\` = STR_TO_DATE(?, '%Y-%m-%d')
          AND \`GodzinaWizyty\` = STR_TO_DATE(?, '%H:%i:%s')
          AND idZapisy <> ?
        LIMIT 1`;
      db.query(qDup, [Lekarz, dzien, timeSQL, idZapisy], (e3, dRows) => {
        if (e3) return res.status(500).json({ success:false, message:'Błąd serwera' });
        if (dRows.length) {
          return res.status(409).json({ success:false, message:'Termin zajęty' });
        }

        const qUpd = `
          UPDATE Zapisy
          SET \`DzieńWizyty\` = STR_TO_DATE(?, '%Y-%m-%d'),
              \`GodzinaWizyty\` = STR_TO_DATE(?, '%H:%i:%s')
          WHERE idZapisy = ?`;
        db.query(qUpd, [dzien, timeSQL, idZapisy], (e4) => {
          if (e4) return res.status(500).json({ success:false, message:'Błąd serwera' });

          try {
            changeMail('jkszinteligencja@gmail.com', oldDate, oldTime, dzien, timeSQL)
              .catch(err => console.error('Mail change err:', err));
            if (typeof reminderMail === 'function') {
              reminderMail('jkszinteligencja@gmail.com', `${dzien} ${timeSQL}`);
            }
          } catch (err) {
            console.error('changeMail/reminderMail err:', err);
          }

          Promise.resolve(
            pushToUser(Pacjent, {
              type: 'visit-changed',
              title: 'Zmieniono termin wizyty',
              body: `Nowy termin: ${dzien} ${timeSQL.slice(0,5)}`,
              url: '/wizyty_uzytkownik.html'
            })
          ).catch(err => console.error('push change err:', err));


          res.json({ success:true, message:'Termin zmieniony', data:dzien, godzina:timeSQL });
        });
      });
    });
  });
});


//mapowanie tabeli Użytkowników na Lekarze
const userToDoctorIdMap = {
  15: 1,
  16: 2,
  17: 3,
};

app.get('/api/lekarzPoUzytkowniku/:id', autoryzacjaJWT, (req, res) => {
  const idUzytkownika = parseInt(req.params.id, 10);
  const idLekarza = userToDoctorIdMap[idUzytkownika];
  if (!idLekarza) return res.status(404).json({ success:false, message:'Lekarz nie znaleziony' });
  res.json({ success:true, idLekarze: idLekarza });
});


app.get('/api/nieobecnosci', autoryzacjaJWT, (req, res) => { //sprawdza tablice grafiki dla lekarzy, zeby ustalac i przypisac ich nieobecnosci przy wyborze w wizyty_uzytkownik
  const idLekarza = parseInt(req.query.lekarzId, 10);
  const data = req.query.data;

  if (!idLekarza || !data) {
    return res.status(400).json({ success: false, message: 'Brakuje danych wejściowych' });
  }

  const dzienTygodnia = new Date(data).getDay();   //0-niedziela, 1-pon, 2-wt [...]
  const mapowanie = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5}; 
  if (!mapowanie[dzienTygodnia]) {
    return res.status(200).json({ success: true, nieobecny: true }); 
  }

  const idDnia = mapowanie[dzienTygodnia];

  const sql = `
    SELECT godzinyPracyOd, godzinyPracyDo 
    FROM Grafiki 
    WHERE IdLekarze = ? AND IdDnia = ?`;

  db.query(sql, [idLekarza, idDnia], (err, results) => {
    if (err) {
      console.error("Błąd pobierania grafiku:", err);
      return res.status(500).json({ success: false, message: "Błąd serwera" });
    }

    if (results.length === 0 || results[0].godzinyPracyOd === null || results[0].godzinyPracyDo === null) {
      return res.json({ success: true, nieobecny: true });
    }

    res.json({ 
      success: true, 
      nieobecny: false,
      godzinyOd: results[0].godzinyPracyOd,
      godzinyDo: results[0].godzinyPracyDo
    });
  });
});


app.get('/api/uzytkownicy', autoryzacjaJWT, (req, res) => {
  const rola = parseInt(req.query.rola, 10);
  if (rola !== 2) return res.json([]);
  const sql = `
    SELECT IdUżytkownicy AS id,
           Imie           AS imie,
           Nazwisko       AS nazwisko
    FROM   Użytkownicy
    WHERE  Rola = ?`;
  db.query(sql, [rola], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    res.json(rows);  
  });
});


app.get('/api/zajete', autoryzacjaJWT, (req, res) => {
  res.set('Cache-Control', 'no-store'); 
  const idLekarza = parseInt(req.query.lekarzId, 10);
  const dataISO   = req.query.data;
  if (!idLekarza || !dataISO) return res.status(400).json([]);
  const sql = `
    SELECT TIME_FORMAT(GodzinaWizyty,'%H:%i') AS hhmm
    FROM   Zapisy
    WHERE  Lekarz = ? AND DzieńWizyty = ?`;
  db.query(sql, [idLekarza, dataISO], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows.map(r => r.hhmm));
  });
});




//#endregion

//#region LOGIKA KOLEJKI

app.post('/api/freed-slot/claim', (req, res) => {
  const { userId, queueId } = req.body || {};
  if (!userId || !queueId) {
    return res.status(400).json({ success:false, message:'Brak danych' });
  }

  const qGet = `
    SELECT *
    FROM FreedSlotQueue
    WHERE id = ? AND userId = ?`;
  db.query(qGet, [queueId, userId], (e1, rows) => {
    if (e1) {
      console.error('claim:get err', e1);
      return res.status(500).json({ success:false, message:'Błąd serwera' });
    }
    if (!rows.length) {
      return res.status(404).json({ success:false, message:'Nie znaleziono wpisu kolejki' });
    }

    const row = rows[0];
    if (row.status !== 'NO_RESPONSE') {
      return res.status(409).json({ success:false, message:'Termin już został przydzielony lub odrzucony' });
    }

    const now = new Date();
    const expiresAt = new Date(row.expiresAt);
    if (now > expiresAt) {
      db.query('UPDATE FreedSlotQueue SET status="REJECTED" WHERE id=?', [queueId]);
      return res.status(400).json({ success:false, message:'Czas na decyzję minął' });
    }


    const qCheck = `
      SELECT 1 FROM Zapisy
      WHERE Lekarz = ?
        AND \`DzieńWizyty\` = ?
        AND \`GodzinaWizyty\` = ?
      LIMIT 1`;
    db.query(qCheck, [row.doctorId, row.slotDate, row.slotTime], (e2, r2) => {
      if (e2) {
        console.error('claim:check err', e2);
        return res.status(500).json({ success:false, message:'Błąd serwera' });
      }
      if (r2.length) {
        db.query('UPDATE FreedSlotQueue SET status="REJECTED" WHERE id=?', [queueId]);
        return res.status(409).json({ success:false, message:'Termin już zajęty' });
      }

        const qUpdateVisit = `
          UPDATE Zapisy
          SET \`DzieńWizyty\` = ?, \`GodzinaWizyty\` = ?
          WHERE idZapisy = ?`;
        db.query(qUpdateVisit, [row.slotDate, row.slotTime, row.candidateVisitId], (e3, r3) => {
          if (e3) {
            console.error('claim:updateVisit err', e3);
            return res.status(500).json({
              success: false,
              message: 'Błąd serwera przy zmianie wizyty'
            });
          }

          if (r3.affectedRows === 0) {
            console.warn('claim: visit not changed (brak rekordu)', row.candidateVisitId);
            return res.status(404).json({
              success: false,
              message: 'Nie znaleziono wizyty do przeniesienia'
            });
          }

          const qMarkTaken = `
            UPDATE FreedSlotQueue
            SET status = CASE WHEN id = ? THEN 'ACCEPTED' ELSE 'REJECTED' END
            WHERE slotDate = ? AND slotTime = ? AND doctorId = ?`;

          db.query(qMarkTaken, [queueId, row.slotDate, row.slotTime, row.doctorId], (e4) => {
            if (e4) {
              console.error('claim:markTaken err', e4);
          }


          if (typeof wsToUser === 'function') {
            wsToUser(row.userId, 'freed-slot-result', {
              ok: true,
              slotDate: row.slotDate,
              slotTime: row.slotTime.slice(0,5)
            });
          }
          if (typeof pushToUser === 'function') {
            pushToUser(row.userId, {
              type: 'freed-slot-taken',
              title: 'Przeniesiono wizytę',
              body: `Nowy termin: ${row.slotDate} ${row.slotTime.slice(0,5)}`,
              url: '/wizyty_uzytkownik.html'
            });
          }

          const qOthers = `
            SELECT userId FROM FreedSlotQueue
            WHERE slotDate=? AND slotTime=? AND doctorId=? AND id<>?`;
          db.query(qOthers, [row.slotDate, row.slotTime, row.doctorId, queueId], (e5, others) => {
            if (!e5 && others.length && typeof wsToUser === 'function') {
              others.forEach(o => {
                wsToUser(o.userId, 'freed-slot-result', {
                  ok: false,
                  reason: 'taken'
                });
              });
            }
          });

          return res.json({ success:true, message:'Termin przejęty' });
        });
      });
    });
  });
});

//tu zeby okienko z powiadomieniem dalej bylo na stronie 
app.get('/api/freed-slot/pending', (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Brak userId' });
  }

  const sql = `
    SELECT id, slotDate, slotTime, doctorId, candidateVisitId, expiresAt
    FROM FreedSlotQueue
    WHERE userId = ?
      AND status = 'NO_RESPONSE'
      AND expiresAt > NOW()
    ORDER BY createdAt DESC
    LIMIT 1`;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error('pending freed-slot err:', err);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    if (!rows.length) {
      return res.json({ success: true, pending: null });
    }

    const row = rows[0];


    let prettyDate;
    if (row.slotDate instanceof Date) {
      const yyyy = row.slotDate.getFullYear();
      const mm   = String(row.slotDate.getMonth() + 1).padStart(2, '0');
      const dd   = String(row.slotDate.getDate()).padStart(2, '0');
      prettyDate = `${yyyy}-${mm}-${dd}`;
    } else {
 
      prettyDate = String(row.slotDate).slice(0, 10);
    }
    const prettyTime = String(row.slotTime).slice(0, 5); // HH:MM

    res.json({
      success: true,
      pending: {
        queueId: row.id,
        slotDate: prettyDate,
        slotTime: prettyTime,
        doctorId: row.doctorId,
        candidateVisitId: row.candidateVisitId,
        expiresAt: row.expiresAt
      }
    });
  });
});


//czyszczenie przeterminowanych kolejek wolnych terminów 
setInterval(() => {
  const q = `
    DELETE FROM FreedSlotQueue
    WHERE status = 'NO_RESPONSE'
      AND expiresAt < NOW()
  `;
  db.query(q, (err) => {
    if (err) {
      console.error('cleanup FreedSlotQueue err:', err);
    }
  });
}, 1000 * 60 * 2); // co 2 minuty


//#endregion

server.listen(port, () => {
    console.log(`Serwer działa na http://localhost:${port}`);
});
