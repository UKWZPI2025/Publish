document.addEventListener("DOMContentLoaded", function () {
  const API_BASE = 'https://ortodonta123.onrender.com';
  const lista = document.getElementById("listaWizyt");
  const form = document.getElementById("formWizyta");

//  form?.addEventListener("submit", async (e) => {
//    e.preventDefault();
//  });

  const komunikat = document.getElementById("komunikat");

  let komunikatTimer = null;

  function pokazKomunikat(msg, type = 'sukces', ms = 5000) {
    if (!komunikat) return;

    if (komunikatTimer) clearTimeout(komunikatTimer);

    komunikat.textContent = msg;
    komunikat.className = `komunikat ${type}`;
    komunikat.style.display = 'block';

    // wymuszenie “reflow”, żeby transition zadziałał zawsze
    void komunikat.offsetWidth;
    komunikat.classList.add('show');

    komunikatTimer = setTimeout(() => {
      komunikat.classList.remove('show');
      setTimeout(() => {
        komunikat.textContent = '';
        komunikat.className = '';
        komunikat.style.display = 'none';
      }, 220);
    }, ms);
  }

  window.pokazKomunikat = pokazKomunikat;

komunikat?.addEventListener('click', () => pokazKomunikat('', 'sukces', 0));

  const uslugaSelect = document.getElementById("usluga");  
  // blokada wyboru dat wcześniejszych niż dziś
  const dataInput = document.getElementById('data');
  if (dataInput) {
    const today   = new Date();
    const year    = today.getFullYear();
    const month   = String(today.getMonth() + 1).padStart(2, '0');
    const day     = String(today.getDate()).padStart(2, '0');
    const minDate = `${year}-${month}-${day}`;
    dataInput.min = minDate;
}

let wizyty = [];
let freedBannerLocked = false;


// pobranie wizyt z serwera po załadowaniu strony

const userId = parseInt(sessionStorage.getItem('userId') || localStorage.getItem('userId'), 10);

if (userId) {
  fetch(`${API_BASE}/api/wizyty/${userId}`, {
  headers: {
    "Authorization": "Bearer " + localStorage.getItem("token")
  }
})
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        wizyty = data.wizyty.map(w => {
            return {
            id: w.id,
            lekarzId: w.lekarzId,
            lekarz: w.lekarz,   
            data: w.data,          
            godzina: w.godzina,             
            usluga: w.usluga,        
          };
        });

         pokazWizyty();
        sprawdzOczekujacyTermin();

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            sprawdzOczekujacyTermin();
          }
        });

      }
    })
    .catch(err => console.error('Błąd GET /api/wizyty:', err));
}



async function zaladujWizyty() {
  if (!userId) return;

  try {
    const res = await fetch(`${API_BASE}/api/wizyty/${userId}`, {
    headers: {"Authorization": "Bearer " + localStorage.getItem("token")}});
    const data = await res.json();

    if (!data.success) return;

    wizyty = data.wizyty.map(w => ({
      id: w.id,
      lekarzId: w.lekarzId,
      lekarz: w.lekarz,
      data: w.data,
      godzina: w.godzina,
      usluga: w.usluga
    }));

    pokazWizyty();
  } catch (err) {
    console.error('Błąd GET /api/wizyty:', err);
  }
}

window.zaladujWizyty = zaladujWizyty;


if (userId) {
  zaladujWizyty();
  sprawdzOczekujacyTermin();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sprawdzOczekujacyTermin();
    }
  });
}

// baner zwolnionego terminu
const freedBanner = document.getElementById('freedBanner');
const freedText   = document.getElementById('freedText');
const freedAccept = document.getElementById('freedAccept');
const freedDismiss= document.getElementById('freedDismiss');

let currentPending = null;

function showFreedBanner(p) {
  if (!freedBanner || !freedText) return;

  currentPending = p;
  freedText.textContent = `Termin: ${p.slotDate} ${p.slotTime}.`;
  freedBanner.style.display = 'block';

  freedBannerLocked = true; //zablokowanie auto-chowania
}


function hideFreedBanner(force = false) {
  if (!force && freedBannerLocked) return; // bez chowania z automatu

  currentPending = null;
  freedBannerLocked = false;
  if (freedBanner) freedBanner.style.display = 'none';
}


freedDismiss?.addEventListener('click', () => hideFreedBanner(true));

freedAccept?.addEventListener('click', async () => {
  if (!currentPending) return;

  const token = localStorage.getItem('token');
  if (!token) {
    alert('Brak tokenu. Zaloguj się ponownie.');
    return;
  }

  try {
    const r = await fetch(`${API_BASE}/api/freed-slot/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ userId, queueId: currentPending.queueId })
    });
    const j = await r.json();

    if (!j.success) {
      alert(j.message || 'Nie udało się przejąć terminu.');
      return;
    }

    hideFreedBanner(true);
    await zaladujWizyty();
    pokazKomunikat("Przeniesiono wizytę na wcześniejszy termin.", "sukces", 6000);
  } catch (e) {
    console.error('claim freed-slot err:', e);
  }
});



// tutaj powiadomienia w formie websocketa o zwolnionym terminie
let socket = null;

let lastFreedKey = null;
let lastFreedShownAt = 0;

function makeFreedKey(p) {
  // preferuj queueId, a jakby kiedyś go nie było, fallback na date+time
  return p?.queueId ? `q:${p.queueId}` : `t:${p?.slotDate || ''}|${p?.slotTime || ''}`;
}

function recentlyShown(key) {
  const now = Date.now();
  return lastFreedKey === key && (now - lastFreedShownAt) < 15000; // 15s
}

function markShown(key) {
  lastFreedKey = key;
  lastFreedShownAt = Date.now();
}

if (typeof io !== 'undefined' && userId) {
  socket = io(API_BASE);
  socket.emit('auth', userId);

socket.on('freed-slot', (payload) => {
  const key = makeFreedKey(payload);
  if (recentlyShown(key)) return;
  markShown(key);

  console.log('freed-slot event:', payload);

  const { queueId, slotDate, slotTime, expiresAt } = payload;

  if (!queueId) {
    console.warn('freed-slot bez queueId, sprawdzam pending');
    sprawdzOczekujacyTermin();
    return;
  }

  showFreedBanner({ queueId, slotDate, slotTime, expiresAt });
});


 
  socket.on('freed-slot-result', (payload) => {
    if (!payload.ok && payload.reason === 'taken') {
      console.log('Wybrany termin został już przejęty przez inną osobę.');
    }
  });
}


  // pobieranie usług z bazy
  fetch(`${API_BASE}/api/uslugi`, {
  headers: {
    "Authorization": "Bearer " + localStorage.getItem("token")
  }
})


    .then(r => r.json())
    .then(data => {
      console.log('uslugi API response:', data);
      if (data.success) {
        data.uslugi.forEach(u => {
          const o = document.createElement("option");
          o.value = u.idUsługi;
          o.textContent = u.nazwaUsługi;
          uslugaSelect.appendChild(o);
        });
      }
    })
    .catch(err => console.error("Błąd pobierania usług:", err));


    
async function sprawdzOczekujacyTermin() {
    if (!userId) {
      console.warn('Brak userId – nie sprawdzam pending');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Brak tokenu – użytkownik nie zalogowany');
      return;
    }

  try {
    const res = await fetch(`${API_BASE}/api/freed-slot/pending?userId=${userId}&_=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    });

    const data = await res.json();
    if (!data.success) return;

    if (!data.pending) {
     // hideFreedBanner();
      return;
    }

    const pending = data.pending;
    const key = makeFreedKey(pending);
    if (recentlyShown(key)) return;
    markShown(key);

    showFreedBanner(pending);

      } catch (e) {
        console.error('sprawdzOczekujacyTermin err:', e);
      }
    }

  async function getAvailableTimesForDoctor(idLekarza, dateISO) {
    // nieobecność
    const nieob = await fetch(`${API_BASE}/api/nieobecnosci?lekarzId=${idLekarza}&data=${dateISO}`,{
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token")
    }
  }).then(r => r.json());


    if (!nieob.success || nieob.nieobecny) return [];

    // grafik
    const gr = await fetch(`${API_BASE}/api/grafiki/${idLekarza}`,{
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token")
    }
  }).then(r=>r.json());
  

    if (!gr.success) return [];
    const jsDay = new Date(dateISO).getDay();           // 0..6
    const idDnia = jsDay === 0 ? 7 : jsDay;
    const row = gr.grafik.find(r => r.IdDnia === idDnia);
    if (!row || !row.godzinyPracyOd || !row.godzinyPracyDo) return [];

    const [sh, sm] = row.godzinyPracyOd.split(':').map(Number);
    const [eh, em] = row.godzinyPracyDo.split(':').map(Number);
    const start = sh*60 + sm, end = eh*60 + em;

 // zajęte
    let zajete = [];
    try {
      zajete = await fetch(
        `${API_BASE}/api/zajete?lekarzId=${idLekarza}&data=${dateISO}&_=${Date.now()}`,
        {
          cache: 'no-store',
          headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        }
      ).then(r => r.json());

      if (!Array.isArray(zajete)) zajete = [];
    } catch {
      zajete = [];
    }


    // generowane godziny co 30 min między 08:00 a 18:00, z filtrem na grafik i zajętością godzin
    const out = [];
    for (let m = 8*60; m <= 18*60; m += 30) {
      if (m < start || m > end) continue;
      const hh = String(Math.floor(m/60)).padStart(2,'0');
      const mm = String(m%60).padStart(2,'0');
      const t = `${hh}:${mm}`;
      if (!zajete.includes(t)) out.push(t);
    }
    return out;
  }


  function pokazWizyty() {
    lista.innerHTML = "";

    if (wizyty.length === 0) {
      lista.innerHTML = "<div class='brak'>Brak zaplanowanych wizyt.</div>";
      return;
    }


    wizyty.forEach((w, index) => {
      const el = document.createElement("div");
      el.innerHTML = `
        <strong>Lekarz:</strong> ${w.lekarz}<br />
        <strong>Data:</strong> ${w.data}<br />
        <strong>Godzina:</strong> ${w.godzina}<br />
        <strong>Usługa:</strong> ${w.usluga}<br>
        <button onclick="odwolajWizyte(${index})">Odwołaj</button>
        <button onclick="pokazEdycje(${index})">Zmień termin</button>
        <div id="edycja-${index}"></div>
      `;
      lista.appendChild(el);
    });
  }

  window.odwolajWizyte = function(index) {
    const w = wizyty[index];
    if (!confirm("Czy na pewno chcesz odwołać wizytę?")) return;

    fetch(`${API_BASE}/api/wizyty/${w.id}`, {
      method: 'DELETE',
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("token")
      }
    })


      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.message);
         wizyty.splice(index, 1);
        pokazWizyty();


       if (typeof sprawdzNieobecnoscIWywolajRender === 'function') {
          sprawdzNieobecnoscIWywolajRender();
      }


      pokazKomunikat("Wizyta została odwołana.", "sukces", 5000);

      })
      .catch(err => {
        console.error('Błąd odwoływania:', err);
      pokazKomunikat("Nie udało się odwołać wizyty.", "blad", 7000);

      });
  };

window.pokazEdycje = async function (index) {
  const w = wizyty[index];
  const miejsce = document.getElementById(`edycja-${index}`);

  miejsce.innerHTML = `
    <div class="edytuj-form">
      <label>Nowa data:</label>
      <input type="date" id="newData-${index}" value="${w.data}">
      <label>Nowa godzina:</label>
      <input type="time" id="newGodzina-${index}" list="hhmm-${index}" step="1800" value="${w.godzina}">
      <datalist id="hhmm-${index}"></datalist>
      <button id="saveBtn-${index}">Zapisz</button>
      <span id="info-${index}" style="margin-left:8px;font-size:12px;"></span>
    </div>
  `;

  const dateEl = document.getElementById(`newData-${index}`);
  const timeEl = document.getElementById(`newGodzina-${index}`);
  const listEl = document.getElementById(`hhmm-${index}`);
  const infoEl = document.getElementById(`info-${index}`);

  async function refill() {
    listEl.innerHTML = '';
    const slots = await getAvailableTimesForDoctor(w.lekarzId, dateEl.value);
    slots.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      listEl.appendChild(opt);
    });
    // jeśli aktualna godzina jest dostępna, zostaw ją w polu
    if (slots.includes(w.godzina)) timeEl.value = w.godzina;
    else timeEl.value = '';
    infoEl.textContent = slots.length ? '' : 'Brak wolnych godzin tego dnia';
  }

  dateEl.addEventListener('change', refill);
  await refill();

  document.getElementById(`saveBtn-${index}`).onclick = () => window.zapiszEdycje(index);
};

window.zapiszEdycje = async function (index) {
  const w = wizyty[index];
  const newData    = document.getElementById(`newData-${index}`).value;
  let   newGodzina = document.getElementById(`newGodzina-${index}`).value;

  if (!newData || !newGodzina) {
    komunikat.textContent = "Uzupełnij datę i godzinę.";
    komunikat.className = "komunikat blad";
    return;
  }
  if (/^\d{2}:\d{2}$/.test(newGodzina)) newGodzina += ':00';

  try {
    const r = await fetch(`${API_BASE}/api/wizyty/${w.id}`, {
      method: 'PUT',
      headers: {"Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("token")},
        body: JSON.stringify({
        DzieńWizyty: newData,
        GodzinaWizyty: newGodzina
      })
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.message || 'Błąd');


    w.data = newData;
    w.godzina = newGodzina.slice(0,5);
    pokazWizyty();

    if (typeof sprawdzNieobecnoscIWywolajRender === 'function') {
    sprawdzNieobecnoscIWywolajRender();
    }
   pokazKomunikat("Termin wizyty został zmieniony.", "sukces", 5000);
  } catch (e) {
   pokazKomunikat(e.message || "Nie udało się zmienić terminu.", "blad", 7000);
  }
};


  pokazWizyty();
});