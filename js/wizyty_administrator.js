document.addEventListener('DOMContentLoaded', () => {
  const tabela = document.querySelector('#tabelaWizyt tbody');

  // Przykładowe dane — w prawdziwej wersji dane będą pobierane z serwera
  const wizyty = [
    { id: 1, pacjent: "Jan Kowalski", lekarz: "dr Anna Kowalska", data: "2025-05-12", godzina: "10:00", opis: "Kontrola" },
    { id: 2, pacjent: "Maria Nowak", lekarz: "dr Jan Nowak", data: "2025-05-13", godzina: "12:30", opis: "Ból gardła" }
  ];

  wizyty.forEach(wizyta => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${wizyta.id}</td>
      <td>${wizyta.pacjent}</td>
      <td>${wizyta.lekarz}</td>
      <td>${wizyta.data}</td>
      <td>${wizyta.godzina}</td>
      <td>${wizyta.opis}</td>
      <td>
        <button class="edytuj">Edytuj</button>
        <button class="usun">Usuń</button>
      </td>
    `;

    tabela.appendChild(tr);
  });

  tabela.addEventListener('click', (e) => {
    if (e.target.classList.contains('usun')) {
      const row = e.target.closest('tr');
      const pacjent = row.children[1].textContent;
      if (confirm(`Czy na pewno chcesz usunąć wizytę pacjenta ${pacjent}?`)) {
        row.remove();
      }
    } else if (e.target.classList.contains('edytuj')) {
      alert("Funkcja edycji nie została jeszcze zaimplementowana.");
    }
  });
});
