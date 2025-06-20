document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formularzDanych');
  const usunBtn = document.getElementById('usunKonto');

  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const telefon = document.getElementById('telefon').value;

    // Tu powinno iść wysłanie danych na backend (np. przez fetch)
    alert(`Zapisano zmiany:\nEmail: ${email}\nTelefon: ${telefon}`);
  });

  usunBtn.addEventListener('click', () => {
    if (confirm("Czy na pewno chcesz usunąć swoje konto? Tej operacji nie można cofnąć.")) {
      // W prawdziwej aplikacji tu powinien być request do serwera
      alert("Konto zostało usunięte.");
      window.location.href = "index_gosc.html";
    }
  });
});
