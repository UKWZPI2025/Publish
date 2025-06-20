document.addEventListener("DOMContentLoaded", function () {
  const lista = document.getElementById("listaWizyt");
  const form = document.getElementById("formWizyta");
  const komunikat = document.getElementById("komunikat");

  let wizyty = [];

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
        <strong>Opis:</strong> ${w.opis}<br />
        <button onclick="odwolajWizyte(${index})">Odwołaj</button>
        <button onclick="pokazEdycje(${index})">Zmień termin</button>
        <div id="edycja-${index}"></div>
      `;
      lista.appendChild(el);
    });
  }

  window.odwolajWizyte = function (index) {
    if (confirm("Czy na pewno chcesz odwołać wizytę?")) {
      wizyty.splice(index, 1);
      pokazWizyty();
      komunikat.textContent = "Wizyta została odwołana.";
      komunikat.className = "komunikat sukces";
    }
  };

  window.pokazEdycje = function (index) {
    const miejsce = document.getElementById(`edycja-${index}`);
    const w = wizyty[index];
    miejsce.innerHTML = `
      <div class="edytuj-form">
        <label>Nowa data:</label>
        <input type="date" id="newData-${index}" value="${w.data}">
        <label>Nowa godzina:</label>
        <input type="time" id="newGodzina-${index}" value="${w.godzina}">
        <button onclick="zapiszEdycje(${index})">Zapisz</button>
      </div>
    `;
  };

  window.zapiszEdycje = function (index) {
    const newData = document.getElementById(`newData-${index}`).value;
    const newGodzina = document.getElementById(`newGodzina-${index}`).value;

    if (!newData || !newGodzina) {
      komunikat.textContent = "Uzupełnij datę i godzinę.";
      komunikat.className = "komunikat blad";
      return;
    }

    wizyty[index].data = newData;
    wizyty[index].godzina = newGodzina;
    pokazWizyty();

    komunikat.textContent = "Termin wizyty został zmieniony.";
    komunikat.className = "komunikat sukces";
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const lekarz = form.lekarz.value.trim();
    const data = form.data.value;
    const godzina = form.godzina.value;
    const opis = form.opis.value.trim();

    if (!lekarz || !data || !godzina || !opis) {
      komunikat.textContent = "Uzupełnij wszystkie pola.";
      komunikat.className = "komunikat blad";
      return;
    }

    wizyty.push({ lekarz, data, godzina, opis });
    pokazWizyty();

    komunikat.textContent = "Wizyta została zapisana.";
    komunikat.className = "komunikat sukces";
    form.reset();
  });

  pokazWizyty();
});
