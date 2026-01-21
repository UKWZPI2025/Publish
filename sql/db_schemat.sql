-- =====================================================================
--  BAZA: Projekt  
-- =====================================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE;
SET SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ---------------------------------------------------------------------
-- 1. BAZA
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `Projekt`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_polish_ci;

USE `Projekt`;

-- ---------------------------------------------------------------------
-- 2. Tabele słownikowe / główne
-- ---------------------------------------------------------------------

-- ROLE
CREATE TABLE IF NOT EXISTS `Role` (
  `IdRole` INT NOT NULL AUTO_INCREMENT,
  `Nazwa`  VARCHAR(45) NOT NULL,
  PRIMARY KEY (`IdRole`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- UŻYTKOWNICY
CREATE TABLE IF NOT EXISTS `Użytkownicy` (
  `IdUżytkownicy` INT NOT NULL AUTO_INCREMENT,
  `Imie`          VARCHAR(30) NOT NULL,
  `DrugieImie`    VARCHAR(30)     NULL,
  `Nazwisko`      VARCHAR(50) NOT NULL,
  `AdresEmail`    VARCHAR(50) NOT NULL,
  `aktywnyStatus` TINYINT    NOT NULL DEFAULT 1,
  `dataUtworzenia` TIMESTAMP(2) NOT NULL DEFAULT CURRENT_TIMESTAMP(2),
  `dataUr`        DATE       NOT NULL,
  `NrTelefonu`    INT(9)     NOT NULL,
  `Haslo`         VARCHAR(255) NOT NULL,
  `PESEL`         VARCHAR(11)  NOT NULL,
  `Rola`          INT         NOT NULL DEFAULT 1,
  `WebPushConsent` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`IdUżytkownicy`),
  UNIQUE KEY `AdresEmail_UNIQUE` (`AdresEmail`),
  UNIQUE KEY `PESEL_UNIQUE`      (`PESEL`),
  KEY `fk_Użytkownicy_Role_idx`  (`Rola`),
  CONSTRAINT `fk_Użytkownicy_Role`
    FOREIGN KEY (`Rola`) REFERENCES `Role`(`IdRole`)
    ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ZABIEGI 
CREATE TABLE IF NOT EXISTS `Zabiegi` (
  `IdZabiegu`   INT NOT NULL AUTO_INCREMENT,
  `DataZabiegu` DATE NOT NULL,
  `Opis`        VARCHAR(5000) NULL,
  PRIMARY KEY (`IdZabiegu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- KLIENCI 
CREATE TABLE IF NOT EXISTS `Klienci` (
  `idKlienci`       INT NOT NULL AUTO_INCREMENT,
  `Alergie`         VARCHAR(255) NULL,
  `Choroby`         VARCHAR(500) NULL,
  `HistoriaZabiegów` INT(10)     NULL,
  `NrUżytkownika`   INT NOT NULL,
  PRIMARY KEY (`idKlienci`),
  UNIQUE KEY `NrUżytkownika_UNIQUE` (`NrUżytkownika`),
  KEY `fk_Klienci_Zabiegi_idx` (`HistoriaZabiegów`),
  CONSTRAINT `fk_Klienci_Zabiegi`
    FOREIGN KEY (`HistoriaZabiegów`)
      REFERENCES `Zabiegi`(`IdZabiegu`)
      ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_Klienci_Użytkownicy`
    FOREIGN KEY (`NrUżytkownika`)
      REFERENCES `Użytkownicy`(`IdUżytkownicy`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- LEKARZE
CREATE TABLE IF NOT EXISTS `Lekarze` (
  `idLekarze`      INT NOT NULL AUTO_INCREMENT,
  `Specjalizacja`  VARCHAR(100) NULL,
  `Gabinet`        VARCHAR(10)  NULL,
  `NrUżytkownika`  INT NOT NULL,
  PRIMARY KEY (`idLekarze`),
  UNIQUE KEY `NrUżytkownika_UNIQUE` (`NrUżytkownika`),
  CONSTRAINT `fk_Lekarze_Użytkownicy`
    FOREIGN KEY (`NrUżytkownika`)
      REFERENCES `Użytkownicy`(`IdUżytkownicy`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- USŁUGI
CREATE TABLE IF NOT EXISTS `Usługi` (
  `idUsługi`    INT NOT NULL AUTO_INCREMENT,
  `NazwaUsługi` VARCHAR(100) NOT NULL,
  `CzasWizyty`  INT NOT NULL,
  `Cena`        FLOAT NULL,
  PRIMARY KEY (`idUsługi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- WIZYTY (Zapisy)
CREATE TABLE IF NOT EXISTS `Zapisy` (
  `idZapisy`      INT NOT NULL AUTO_INCREMENT,
  `DzieńWizyty`   DATE NOT NULL,
  `GodzinaWizyty` TIME NOT NULL,
  `Pacjent`       INT NOT NULL,
  `Lekarz`        INT NOT NULL,
  `Usługa`        INT NOT NULL,
  PRIMARY KEY (`idZapisy`),
  KEY `fk_Zapisy_Pacjent_idx` (`Pacjent`),
  KEY `fk_Zapisy_Lekarz_idx`  (`Lekarz`),
  KEY `fk_Zapisy_Usługa_idx`  (`Usługa`),
  CONSTRAINT `fk_Zapisy_Użytkownicy`
    FOREIGN KEY (`Pacjent`) REFERENCES `Użytkownicy`(`IdUżytkownicy`)
      ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_Zapisy_Lekarze`
    FOREIGN KEY (`Lekarz`) REFERENCES `Lekarze`(`idLekarze`)
      ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_Zapisy_Usługi`
    FOREIGN KEY (`Usługa`) REFERENCES `Usługi`(`idUsługi`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Kalendarz: dni tygodnia, grafiki, nieobecności
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `DniTygodnia` (
  `IdDnia` INT NOT NULL AUTO_INCREMENT,
  `Nazwa`  VARCHAR(20) NOT NULL,
  PRIMARY KEY (`IdDnia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Grafiki` (
  `IdGrafiku`      INT NOT NULL AUTO_INCREMENT,
  `IdDnia`         INT NOT NULL,
  `IdLekarze`      INT NOT NULL,
  `godzinyPracyOd` TIME NOT NULL,
  `godzinyPracyDo` TIME NOT NULL,
  PRIMARY KEY (`IdGrafiku`),
  KEY `fk_Grafiki_Dzien_idx`   (`IdDnia`),
  KEY `fk_Grafiki_Lekarz_idx`  (`IdLekarze`),
  CONSTRAINT `fk_Grafiki_DniTygodnia`
    FOREIGN KEY (`IdDnia`) REFERENCES `DniTygodnia`(`IdDnia`)
      ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_Grafiki_Lekarze`
    FOREIGN KEY (`IdLekarze`) REFERENCES `Lekarze`(`idLekarze`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Nieobecności` (
  `IdNieobecności` INT NOT NULL AUTO_INCREMENT,
  `IdLekarze`      INT NOT NULL,
  `DataOd`         DATE NOT NULL,
  `DataDo`         DATE NOT NULL,
  PRIMARY KEY (`IdNieobecności`),
  KEY `fk_Nieobecnosci_Lekarz_idx` (`IdLekarze`),
  CONSTRAINT `fk_Nieobecnosci_Lekarze`
    FOREIGN KEY (`IdLekarze`) REFERENCES `Lekarze`(`idLekarze`)
      ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. Web push: zgody i subskrypcje
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `PushSubscriptions` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `userId`    INT NOT NULL,
  `endpoint`  TEXT NOT NULL,
  `p256dh`    VARCHAR(255) NOT NULL,
  `auth`      VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `enabled`   TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_endpoint` (`endpoint`(255)),
  KEY `fk_PushSubs_User_idx` (`userId`),
  CONSTRAINT `fk_PushSubs_User`
    FOREIGN KEY (`userId`) REFERENCES `Użytkownicy`(`IdUżytkownicy`)
      ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. Kolejka zwolnionych terminów
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `FreedSlotQueue` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `slotDate`        DATE NOT NULL,
  `slotTime`        TIME NOT NULL,
  `doctorId`        INT NOT NULL,
  `candidateVisitId` INT NOT NULL,
  `userId`          INT NOT NULL,
  `status` ENUM('NO_RESPONSE','ACCEPTED','REJECTED')
            DEFAULT 'NO_RESPONSE',
  `expiresAt`       DATETIME NOT NULL,
  `createdAt`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_slot_user` (`slotDate`,`slotTime`,`doctorId`,`userId`),
  KEY `idx_fsq_slot` (`slotDate`,`slotTime`,`doctorId`),
  KEY `idx_fsq_user` (`userId`),
  CONSTRAINT `fk_FreedSlotQueue_Lekarz`
    FOREIGN KEY (`doctorId`) REFERENCES `Lekarze`(`idLekarze`)
      ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_FreedSlotQueue_Visit`
    FOREIGN KEY (`candidateVisitId`) REFERENCES `Zapisy`(`idZapisy`)
      ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_FreedSlotQueue_User`
    FOREIGN KEY (`userId`) REFERENCES `Użytkownicy`(`IdUżytkownicy`)
      ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- ---------------------------------------------------------------------
-- 6. Przywrócenie ustawień
-- ---------------------------------------------------------------------
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
