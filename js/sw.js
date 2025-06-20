// sw.js — Service Worker (po prostu pusty, aby showNotification() zadzia³a³o)
self.addEventListener('push', e => {
  // tutaj mo¿na odebraæ push z serwera i wyœwietliæ odpowiednie powiadomienie
});

// Skrypt do obs³ugi formularza szablonów powiadomieñ
document.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Pobieranie wartoœci z formularza
  const templateName = document.getElementById('templateName').value;
  const templateContent = document.getElementById('templateContent').value;

  // Tutaj dodaj kod do zapisywania szablonów powiadomieñ (np. wysy³anie do bazy danych)

  alert('Szablon powiadomienia zapisany!');
});


