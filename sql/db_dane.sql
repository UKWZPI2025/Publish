USE `Projekt`;

-- =====================================================
--  ROLE
-- =====================================================
INSERT INTO `Role` (`Nazwa`) VALUES
  ('pacjent'),
  ('dentysta'),
  ('recepcjonistka'),
  ('admin');

-- =====================================================
--  USŁUGI
-- =====================================================
INSERT INTO `Usługi` (`NazwaUsługi`, `CzasWizyty`, `Cena`) VALUES
('Konsultacja ortodontyczna', 30, 150.00);

INSERT INTO `Usługi` (`NazwaUsługi`, `CzasWizyty`, `Cena`) VALUES
('Aparat stały metalowy (1 łuk)', 60, 2000.00),
('Aparat estetyczny', 60, 3000.00);

INSERT INTO `Usługi` (`NazwaUsługi`, `CzasWizyty`, `Cena`) VALUES
('Plan leczenia', 30, 200.00),
('Plan leczenia', 30, 250.00),
('Plan leczenia', 30, 300.00);

INSERT INTO `Usługi` (`NazwaUsługi`, `CzasWizyty`, `Cena`) VALUES
('Invisalign Express (7) - 1 łuk', 60, 6299.00),
('Invisalign Express (7) - 2 łuki', 60, 7999.00),
('Invisalign Lite - 2 łuki', 60, 13699.00),
('Invisalign Comprehensive', 60, 20099.00);

INSERT INTO `Usługi` (`NazwaUsługi`, `CzasWizyty`, `Cena`) VALUES
('Retainer ruchomy nakładkowy', 30, 500.00),
('Retainer ruchomy płytowy', 30, 500.00),
('Retainer stały', 30, 500.00),
('Retainer stały z włókna szklanego', 30, 800.00),
('Retainer stały z włókna szklanego', 30, 900.00),
('Retainer stały z włókna szklanego', 30, 1000.00),
('Retainer „pozycjoner”', 30, 800.00);

-- =====================================================
--  UŻYTKOWNICY 
-- =====================================================
INSERT INTO `Użytkownicy` (
  `IdUżytkownicy`, `Imie`, `DrugieImie`, `Nazwisko`, `AdresEmail`,
  `aktywnyStatus`, `dataUtworzenia`, `dataUr`, `NrTelefonu`,
  `Haslo`, `PESEL`, `Rola`
)
VALUES
(
  15, 'Anna', NULL, 'Kowalska', 'AnnaKowalska@gabinetOrt.dr',
  1, '2025-05-15 15:59:52.03', '1994-06-11', 888999000,
  'AnnaKow', '88899900000', 2
),
(
  16, 'Jan', 'Jerzy', 'Nowak', 'JanNowak@gabinetOrt.dr',
  1, '2025-05-15 16:02:37.78', '1997-08-29', 999888,
  'JanNow', '00099988888', 2
),
(
  17, 'Ewa', NULL, 'Zielińska', 'EwaZielinska@gabinetOrt.dr',
  1, '2025-05-15 16:06:23.33', '1988-01-12', 999888000,
  'EwaZiel', '99988800000', 2
);

-- =====================================================
--  DNI TYGODNIA 
-- =====================================================
INSERT INTO `DniTygodnia` (`Nazwa`) VALUES
  ('Poniedziałek'),
  ('Wtorek'),
  ('Środa'),
  ('Czwartek'),
  ('Piątek');
