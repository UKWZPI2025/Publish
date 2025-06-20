const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

console.log('DB_HOST=', process.env.DB_HOST);
console.log('DB_USER=', process.env.DB_USER);
console.log('DB_PASS=', process.env.DB_PASS ? '***' : '<brak>');
console.log('DB_NAME=', process.env.DB_NAME);


const app = express();
const port = process.env.PORT || 3006;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/style', express.static(path.join(__dirname, 'style')));
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

app.post('/rejestracja', (req, res) => {
    const { imie, drugieImie, nazwisko, adresEmail, haslo, dataUr, nrTelefonu, pesel, rola } = req.body;

    if (!imie || !nazwisko || !adresEmail || !haslo || !dataUr || !nrTelefonu || !pesel) {
        return res.status(400).json({ status: 400, message: "Wypelnij wszystkie pola" });
    }

    const rolaNazwa = rola || 'pacjent'; 

        db.query('SELECT IdRole FROM Role WHERE Nazwa = ?', [rolaNazwa], (err, results) => {
        if (err || results.length === 0) {
            console.error("Nie znaleziono roli:", err);
            return res.status(500).json({ status: 500, message: "Błąd przy pobieraniu roli" });
        }

        const idRola = results[0].IdRole;

        const query = `
            INSERT INTO Użytkownicy (imie, drugieImie, nazwisko, adresEmail, haslo,dataUr, nrTelefonu, PESEL, Rola) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(query, [
            imie,
            drugieImie || null,
            nazwisko,
            adresEmail,
            haslo,
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

// app.post('/login', (req, res) => {const { pesel, haslo } = req.body;


// if (!pesel || !haslo) {
//     return res.status(400).json({ success: false, message: "Wpisz PESEL i hasło" });
// }

// const query = `SELECT * FROM Użytkownicy WHERE PESEL = ?`;

//     db.query(query, [pesel], (err, results) => {
//         if (err) {
//             console.error("Błąd przy logowaniu:", err.message);
//             return res.status(500).json({ success: false, message: "Błąd serwera" });
//         }

//         if (results.length === 0) {
//             return res.status(404).json({ success: false, message: "Nie znaleziono użytkownika" });
//         }

//         const uzytkownik = results[0];

//         console.log('DB haslo   ->', JSON.stringify(u.haslo));
//         console.log('Sent haslo ->', JSON.stringify(haslo));

//         if (uzytkownik.haslo !== haslo) {
//             return res.status(401).json({ success: false, message: "Nieprawidłowe hasło" });
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Zalogowano pomyślnie",
//             id: uzytkownik.idUzytkownika,
//             rola: uzytkownik.rola
//         });
//     });
// });

app.post('/login', (req, res) => {
  console.log('--- /login request ---');
  console.log('BODY /login ->', req.body);

  const { pesel, haslo } = req.body;
  const query = `SELECT * FROM \`Użytkownicy\` WHERE \`PESEL\` = ?`;

  db.query(query, [pesel], (err, results) => {
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
    console.log('Sent haslo ->', JSON.stringify(haslo));

    if (u.Haslo !== haslo) {
      console.log('Porównanie haseł nie przeszło');
      return res.status(401).json({ success: false, message: "Nieprawidłowe hasło" });
    }

    console.log('Logowanie OK dla pesel:', pesel);
    return res.status(200).json({success: true,message: "Zalogowano pomyślnie",idUzytkownika: u.IdUżytkownicy, imie: u.Imie,nazwisko: u.Nazwisko,email: u.AdresEmail,telefon: u.NrTelefonu, rola: u.Rola});

  });
});



//#endregion

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
app.post('/pacjenci', (req, res) => {
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

app.post('/uslugi', (req, res) => {
    const { nazwaUslugi, czasWizyty, cena } = req.body;

    if (!nazwaUslugi || !czasWizyty || !cena) {
        return res.status(400).json({ message: "Wypelnij wszystkie pola" });
    }

    const query = `INSERT INTO Uslugi (nazwaUslugi, czasWizyty, cena)VALUES (?, ?, ?)`;

    db.query(query, [nazwaUslugi, czasWizyty, cena], (err, result) => {
        if (err) {
            console.error("Blad przy dodawaniu uslugi:", err.message);
            return res.status(500).json({ message: "Blad serwera" });
        }
        res.status(200).json({ message: "Dodano usługe" });
    });
});

//#endregion

//#region API wizyty i zabiegi

app.post('/api/zabiegi', (req, res) => {
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

app.post('/api/wizyty', (req, res) => {
  const { idPacjent, idDentysta, idUsługa, DzieńWizyty } = req.body;
  if (!idPacjent || !idDentysta || !idUsługa || !DzieńWizyty) {
    return res.status(400).json({ success:false, message:'Wypelnij wszystkie pola' });
  }
  const q = `INSERT INTO \`Zapisy\` (\`Pacjent\`, \`Lekarz\`, \`Usługa\`, \`DzieńWizyty\`) VALUES (?, ?, ?, ?)`;

  db.query(q, [idPacjent, idDentysta, idUsługa, DzieńWizyty], (err, result) => {
    if (err) {
      console.error('Błąd przy umawianiu wizyty:', err);
      return res.status(500).json({ success:false, message:'Błąd serwera' });
    }
    res.json({ success:true, message:'Wizyta umowiona' });
  });
});

//#endregion

//#region API GET zmiany dla panelu administracji

app.get('/api/uzytkownicyDoPanelu', (req, res) => {
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
app.get('/api/grafiki/:idLekarza', (req, res) => {
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
app.put('/api/grafiki/:idLekarza/:idDnia', (req, res) => {
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

//mapowanie tabeli Użytkowników na Lekarze
const userToDoctorIdMap = {
  15: 1,
  16: 2,
  17: 3,
};

app.get('/api/lekarzPoUzytkowniku/:id', (req, res) => {
  const idUzytkownika = parseInt(req.params.id, 10);
  const idLekarza = userToDoctorIdMap[idUzytkownika];
  if (!idLekarza) return res.status(404).json({ success:false, message:'Lekarz nie znaleziony' });
  res.json({ success:true, idLekarze: idLekarza });
});



//#endregion

app.listen(port, () => {
    console.log(`Serwer działa na http://localhost:${port}`);
});
