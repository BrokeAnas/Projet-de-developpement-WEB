# 02 — BASE DE DONNEES MySQL — EXPLICATION COMPLETE

## Table des matieres
1. Le schema complet (chaque table, chaque colonne)
2. Les cles primaires et pourquoi BIGINT pour id_nat
3. Les cles etrangeres et strategies ON DELETE
4. Les tables de jonction N:M
5. Les triggers d'audit
6. Les index d'optimisation
7. Les ENUM MySQL

---

## 1. LE SCHEMA COMPLET — TABLE PAR TABLE

### 1.1 SpecialisationMedecin — Table de reference

```sql
CREATE TABLE SpecialisationMedecin (
  id_specialisation INT PRIMARY KEY AUTO_INCREMENT,
  libelle VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;
```

EXPLICATION LIGNE PAR LIGNE :
- `id_specialisation INT PRIMARY KEY AUTO_INCREMENT`
  → Cle primaire entiere, auto-incrementee (1, 2, 3...)
  → MySQL gere l'attribution automatique de l'id
- `libelle VARCHAR(100) NOT NULL UNIQUE`
  → Le nom de la specialisation (ex: "Cardiologie", "Dermatologie")
  → NOT NULL = obligatoire
  → UNIQUE = deux specialisations ne peuvent pas avoir le meme nom
- `ENGINE=InnoDB`
  → Moteur de stockage qui supporte les transactions ACID et les FK

DONNEES EXEMPLE :
| id_specialisation | libelle |
|-------------------|---------|
| 1 | Cardiologie |
| 2 | Dermatologie |
| 3 | Medecine generale |


### 1.2 Sucursale — Les cabinets physiques

```sql
CREATE TABLE Sucursale (
  id_sucursale INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(150) NOT NULL,
  adresse VARCHAR(255) NOT NULL,
  telephone VARCHAR(20),
  email VARCHAR(150)
) ENGINE=InnoDB;
```

- `telephone` et `email` sont NULLABLE (pas de NOT NULL) car optionnels
- VARCHAR(20) pour le telephone car les numeros belges font max ~15 caracteres

DONNEES EXEMPLE :
| id_sucursale | nom | adresse | telephone | email |
|---|---|---|---|---|
| 1 | Cabinet Centre | Rue de la Loi 42, Bruxelles | +32 2 123 45 67 | centre@medicare.be |
| 2 | Cabinet Sud | Avenue Louise 100, Bruxelles | NULL | NULL |


### 1.3 Medecin — Les praticiens

```sql
CREATE TABLE Medecin (
  id_nat BIGINT(11) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  id_specialisation INT NOT NULL,
  id_sucursale INT,
  FOREIGN KEY (id_specialisation) REFERENCES SpecialisationMedecin(id_specialisation),
  FOREIGN KEY (id_sucursale) REFERENCES Sucursale(id_sucursale) ON DELETE SET NULL
) ENGINE=InnoDB;
```

POINTS IMPORTANTS :
- `id_nat BIGINT(11) PRIMARY KEY` : PAS d'AUTO_INCREMENT !
  → Le numero national belge EST la cle primaire
  → C'est un BIGINT car 11 chiffres peut depasser INT (max ~2.1 milliards)
  → Exemple : 99061534897 (9.9 milliards > INT max)

- `email VARCHAR(150) NOT NULL UNIQUE` : chaque medecin a un email unique
  → Sert pour le LOGIN (on cherche par email pour l'authentification)

- `mot_de_passe VARCHAR(255)` : stocke le hash BCrypt
  → JAMAIS le mot de passe en clair !
  → Un hash BCrypt fait ~60 caracteres, mais on prend 255 par securite

- `id_specialisation INT NOT NULL` : FK vers SpecialisationMedecin
  → NOT NULL = un medecin DOIT avoir une specialisation
  → Pas de ON DELETE specifie = comportement par defaut RESTRICT
  → On ne peut PAS supprimer une specialisation si un medecin l'utilise

- `id_sucursale INT` : FK vers Sucursale (NULLABLE)
  → Un medecin peut ne pas etre affecte a une succursale
  → `ON DELETE SET NULL` : si on supprime la succursale,
    le medecin reste mais son id_sucursale passe a NULL


### 1.4 Secretaire

```sql
CREATE TABLE Secretaire (
  id_nat BIGINT(11) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL,
  id_sucursale INT NOT NULL,
  FOREIGN KEY (id_sucursale) REFERENCES Sucursale(id_sucursale)
) ENGINE=InnoDB;
```

DIFFERENCE avec Medecin :
- `id_sucursale INT NOT NULL` : une secretaire DOIT etre rattachee a une succursale
  → Pas de ON DELETE specifie = RESTRICT par defaut
  → On ne peut PAS supprimer une succursale si une secretaire y travaille


### 1.5 Administrateur

```sql
CREATE TABLE Administrateur (
  id_admin INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe VARCHAR(255) NOT NULL
) ENGINE=InnoDB;
```

DIFFERENCE : l'admin a un `id_admin` AUTO_INCREMENT (pas de numero national)
car l'admin n'est pas forcement un professionnel de sante.
Pas de FK vers Sucursale car l'admin gere TOUTES les succursales.


### 1.6 Patient

```sql
CREATE TABLE Patient (
  id_nat BIGINT(11) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  date_naissance DATE NOT NULL,
  adresse VARCHAR(255),
  telephone VARCHAR(20),
  email VARCHAR(150) UNIQUE
) ENGINE=InnoDB;
```

- `date_naissance DATE NOT NULL` : obligatoire pour un patient
- `email UNIQUE` mais NULLABLE : un patient peut ne pas avoir d'email,
  mais s'il en a un, il doit etre unique
- Pas de mot_de_passe : les patients ne se connectent pas a l'application


### 1.7 Assurance et TypeMaladie — Tables de reference

```sql
CREATE TABLE Assurance (
  id_assurance INT PRIMARY KEY AUTO_INCREMENT,
  nom VARCHAR(150) NOT NULL,
  type VARCHAR(50)             -- ex: "Mutuelle", "Privee"
) ENGINE=InnoDB;

CREATE TABLE TypeMaladie (
  id_maladie INT PRIMARY KEY AUTO_INCREMENT,
  libelle VARCHAR(150) NOT NULL UNIQUE,
  code_CIM VARCHAR(10)         -- Code CIM-10 (classification internationale)
) ENGINE=InnoDB;
```

- `code_CIM` : la Classification Internationale des Maladies de l'OMS
  → Ex: "J06" = infection des voies respiratoires, "E11" = diabete type 2


### 1.8 PatientAssurance — Table de jonction N:M

```sql
CREATE TABLE PatientAssurance (
  id_nat_patient BIGINT(11) NOT NULL,
  id_assurance INT NOT NULL,
  numero_affiliation VARCHAR(50),
  date_debut DATE,
  date_fin DATE,
  PRIMARY KEY (id_nat_patient, id_assurance),
  FOREIGN KEY (id_nat_patient) REFERENCES Patient(id_nat) ON DELETE CASCADE,
  FOREIGN KEY (id_assurance) REFERENCES Assurance(id_assurance) ON DELETE CASCADE
) ENGINE=InnoDB;
```

POURQUOI UNE TABLE DE JONCTION ?
- Un patient peut avoir PLUSIEURS assurances (mutuelle + assurance privee)
- Une assurance couvre PLUSIEURS patients
- C'est une relation N:M (many-to-many)
- On ne peut pas mettre ca dans Patient ni dans Assurance

CLE PRIMAIRE COMPOSITE :
- `PRIMARY KEY (id_nat_patient, id_assurance)` : le couple (patient, assurance) est unique
- Un patient ne peut pas etre inscrit DEUX FOIS a la meme assurance
- Mais il peut avoir l'assurance 1 ET l'assurance 3

CHAMPS SUPPLEMENTAIRES SUR LA RELATION :
- `numero_affiliation` : le numero de dossier chez l'assurance
- `date_debut` / `date_fin` : la periode de couverture
- C'est pour ca qu'on a une table explicite (pas une simple relation implicite)

ON DELETE CASCADE :
- Si on supprime un patient → ses liens PatientAssurance disparaissent
- Si on supprime une assurance → les liens PatientAssurance disparaissent
- Les donnees orphelines sont automatiquement nettoyees

DONNEES EXEMPLE :
| id_nat_patient | id_assurance | numero_affiliation | date_debut | date_fin |
|---|---|---|---|---|
| 99061534897 | 1 | MUT-2024-1234 | 2024-01-01 | 2024-12-31 |
| 99061534897 | 3 | PRIV-567 | 2024-06-01 | NULL |
| 85032012345 | 1 | MUT-2024-5678 | 2024-01-01 | 2024-12-31 |


### 1.9 PatientMaladie — Dossier medical (N:M)

```sql
CREATE TABLE PatientMaladie (
  id_nat_patient BIGINT(11) NOT NULL,
  id_maladie INT NOT NULL,
  id_nat_medecin BIGINT(11),
  date_diagnostic DATE NOT NULL,
  observations TEXT,
  PRIMARY KEY (id_nat_patient, id_maladie),
  FOREIGN KEY (id_nat_patient) REFERENCES Patient(id_nat) ON DELETE CASCADE,
  FOREIGN KEY (id_maladie) REFERENCES TypeMaladie(id_maladie),
  FOREIGN KEY (id_nat_medecin) REFERENCES Medecin(id_nat) ON DELETE SET NULL
) ENGINE=InnoDB;
```

- `id_nat_medecin` NULLABLE + ON DELETE SET NULL :
  → Le medecin qui a diagnostique la maladie
  → Si ce medecin quitte le cabinet, on garde le diagnostic mais on perd le lien
  → C'est le choix metier : le diagnostic est plus important que le medecin

- `observations TEXT` : peut contenir un texte long (notes medicales)
- `date_diagnostic DATE NOT NULL` : la date du diagnostic est obligatoire

DONNEES EXEMPLE :
| id_nat_patient | id_maladie | id_nat_medecin | date_diagnostic | observations |
|---|---|---|---|---|
| 99061534897 | 5 | 75012345678 | 2024-03-15 | Diabete type 2 diagnostique, metformine prescrite |
| 99061534897 | 12 | NULL | 2023-11-01 | Medecin parti, diagnostic conserve |


### 1.10 RendezVous

```sql
CREATE TABLE RendezVous (
  id_rdv INT PRIMARY KEY AUTO_INCREMENT,
  id_nat_patient BIGINT(11) NOT NULL,
  id_nat_medecin BIGINT(11) NOT NULL,
  id_nat_secretaire BIGINT(11),
  id_sucursale INT NOT NULL,
  date_rdv DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  motif VARCHAR(255),
  statut ENUM('Planifie','En cours','Termine','Annule') NOT NULL DEFAULT 'Planifie',
  FOREIGN KEY (id_nat_patient) REFERENCES Patient(id_nat),
  FOREIGN KEY (id_nat_medecin) REFERENCES Medecin(id_nat),
  FOREIGN KEY (id_nat_secretaire) REFERENCES Secretaire(id_nat) ON DELETE SET NULL,
  FOREIGN KEY (id_sucursale) REFERENCES Sucursale(id_sucursale)
) ENGINE=InnoDB;
```

LA TABLE LA PLUS COMPLEXE :
- 4 cles etrangeres vers 4 tables differentes
- `id_nat_patient` et `id_nat_medecin` : NOT NULL (un RDV a toujours un patient et un medecin)
- `id_nat_secretaire` : NULLABLE + ON DELETE SET NULL
  → Pas de secretaire si le medecin a cree le RDV lui-meme
  → Si la secretaire part, le RDV reste
- `ENUM` : les seules valeurs possibles sont 'Planifie', 'En cours', 'Termine', 'Annule'
  → MySQL refuse toute autre valeur
  → DEFAULT 'Planifie' : un nouveau RDV est automatiquement "Planifie"

POUR L'ORAL — LE CONFLIT D'AGENDA :
Le code C# verifie qu'il n'y a pas de chevauchement AVANT d'inserer.
La requete SQL de detection :
```sql
SELECT COUNT(*) FROM RendezVous
WHERE id_nat_medecin = @MedecinId
  AND date_rdv = @Date
  AND heure_debut < @HeureFin      -- le debut existant est avant la fin demandee
  AND heure_fin > @HeureDebut      -- ET la fin existante est apres le debut demande
  AND statut NOT IN ('Annule')     -- on ignore les RDV annules
```
→ Si COUNT > 0, il y a un conflit → on refuse la creation


### 1.11 Paiement et Paiement_Historique

```sql
CREATE TABLE Paiement (
  id_paiement INT PRIMARY KEY AUTO_INCREMENT,
  id_nat_patient BIGINT(11) NOT NULL,
  id_rdv INT,
  montant DECIMAL(10,2) NOT NULL,
  date_paiement DATE NOT NULL,
  mode_paiement VARCHAR(50),
  FOREIGN KEY (id_nat_patient) REFERENCES Patient(id_nat),
  FOREIGN KEY (id_rdv) REFERENCES RendezVous(id_rdv) ON DELETE SET NULL
) ENGINE=InnoDB;
```

- `DECIMAL(10,2)` : nombre a 10 chiffres dont 2 decimales
  → Max : 99 999 999,99 €
  → DECIMAL et pas FLOAT car FLOAT a des erreurs d'arrondi (0.1 + 0.2 != 0.3)
  → Pour de l'argent, on utilise TOUJOURS DECIMAL

- `id_rdv INT` NULLABLE + ON DELETE SET NULL :
  → Un paiement peut etre independant d'un RDV (acompte, etc.)
  → Si on supprime le RDV, le paiement reste (l'argent a ete encaisse !)

```sql
CREATE TABLE Paiement_Historique (
  id_historique INT PRIMARY KEY AUTO_INCREMENT,
  id_paiement INT NOT NULL,
  id_nat_patient BIGINT(11) NOT NULL,
  id_rdv INT,
  montant DECIMAL(10,2) NOT NULL,
  date_paiement DATE NOT NULL,
  operation ENUM('UPDATE','DELETE') NOT NULL,
  date_operation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

- PAS de FK ici ! C'est volontaire :
  → C'est une table d'AUDIT, elle garde les anciennes valeurs
  → Si on supprime le patient, on garde quand meme l'historique des paiements
  → Pas de CASCADE, pas de SET NULL — les donnees d'audit sont immuables

---

## 2. LES TRIGGERS D'AUDIT

```sql
DELIMITER $
CREATE TRIGGER Paiement_Update_Log
AFTER UPDATE ON Paiement FOR EACH ROW
BEGIN
  INSERT INTO Paiement_Historique
    (id_paiement, id_nat_patient, id_rdv, montant, date_paiement, operation)
  VALUES
    (OLD.id_paiement, OLD.id_nat_patient, OLD.id_rdv, OLD.montant, OLD.date_paiement, 'UPDATE');
END$
```

EXPLICATION :
- `AFTER UPDATE ON Paiement` : se declenche APRES chaque UPDATE sur la table Paiement
- `FOR EACH ROW` : s'execute pour chaque ligne modifiee
- `OLD.montant` : la valeur AVANT la modification
  (il existe aussi NEW.montant pour la valeur APRES, mais on ne l'utilise pas ici)
- Le trigger sauvegarde l'ANCIENNE valeur dans Paiement_Historique
- `DELIMITER $` : necessaire car le trigger contient des `;` internes
  et MySQL doit savoir ou finit la definition du trigger

EXEMPLE CONCRET :
```
1. Le paiement #42 a montant = 50.00
2. La secretaire modifie le montant a 75.00
3. MySQL execute automatiquement le trigger APRES le UPDATE
4. Le trigger insere dans Paiement_Historique :
   id_paiement=42, montant=50.00 (l'ancienne valeur), operation='UPDATE'
5. L'admin peut consulter GET /api/paiements/audit pour voir le changement
```

Meme chose pour la suppression :
```sql
CREATE TRIGGER Paiement_Delete_Log
AFTER DELETE ON Paiement FOR EACH ROW
BEGIN
  INSERT INTO Paiement_Historique
    (id_paiement, id_nat_patient, id_rdv, montant, date_paiement, operation)
  VALUES
    (OLD.id_paiement, OLD.id_nat_patient, OLD.id_rdv, OLD.montant, OLD.date_paiement, 'DELETE');
END$
```

IMPORTANT POUR L'ORAL :
- Les triggers s'executent COTE MYSQL, pas cote C#
- Le code C# ne fait RIEN de special — il fait juste UPDATE ou DELETE normalement
- C'est MySQL qui gere l'audit automatiquement
- Avantage : impossible de "oublier" de logger, meme si on accede directement a la BDD

---

## 3. LES INDEX D'OPTIMISATION

```sql
CREATE INDEX idx_patient_nom_prenom ON Patient(nom, prenom);
CREATE INDEX idx_rdv_medecin_date ON RendezVous(id_nat_medecin, date_rdv);
CREATE INDEX idx_rdv_patient ON RendezVous(id_nat_patient);
CREATE INDEX idx_paiement_patient ON Paiement(id_nat_patient);
CREATE INDEX idx_historique_paiement ON Paiement_Historique(id_paiement);
```

### C'est quoi un INDEX ?

C'est comme l'index d'un livre : au lieu de lire toutes les pages pour trouver
"Cardiologie", tu regardes l'index qui te dit "page 42".

Sans index : MySQL parcourt TOUTES les lignes (full table scan) = LENT
Avec index : MySQL va directement aux bonnes lignes = RAPIDE

### Pourquoi ces index specifiques ?

1. `idx_patient_nom_prenom` :
   → La recherche de patients se fait par nom/prenom (barre de recherche)
   → `WHERE nom LIKE '%Dupont%'` utilise cet index

2. `idx_rdv_medecin_date` (INDEX COMPOSITE) :
   → L'agenda d'un medecin a une date donnee
   → `WHERE id_nat_medecin = ? AND date_rdv = ?`
   → Aussi utilise pour la detection de conflits

3. `idx_rdv_patient` :
   → L'historique des RDV d'un patient
   → `WHERE id_nat_patient = ?`

4. `idx_paiement_patient` :
   → Les paiements d'un patient
   → `WHERE id_nat_patient = ?`

5. `idx_historique_paiement` :
   → L'audit d'un paiement specifique
   → `WHERE id_paiement = ?`

### Pourquoi on ne met pas des index PARTOUT ?

- Un index ACCELERE les lectures mais RALENTIT les ecritures
- Chaque INSERT/UPDATE/DELETE doit aussi mettre a jour l'index
- On indexe uniquement les colonnes utilisees dans les WHERE et les JOIN
- Les cles primaires et UNIQUE ont deja un index automatique

---

## 4. RESUME DES STRATEGIES ON DELETE

| FK | Strategie | Raison metier |
|----|-----------|---------------|
| Medecin.id_specialisation → SpecialisationMedecin | RESTRICT (defaut) | Proteger les specialisations utilisees |
| Medecin.id_sucursale → Sucursale | SET NULL | Le medecin reste, perd son affectation |
| Secretaire.id_sucursale → Sucursale | RESTRICT (defaut) | Refuser la suppression si personnel affecte |
| RendezVous.id_nat_patient → Patient | RESTRICT (defaut) | Refuser si le patient a des RDV |
| RendezVous.id_nat_medecin → Medecin | RESTRICT (defaut) | Refuser si le medecin a des RDV |
| RendezVous.id_nat_secretaire → Secretaire | SET NULL | Le RDV reste, perd le lien secretaire |
| RendezVous.id_sucursale → Sucursale | RESTRICT (defaut) | Proteger les succursales avec des RDV |
| Paiement.id_nat_patient → Patient | RESTRICT (defaut) | Refuser si le patient a des paiements |
| Paiement.id_rdv → RendezVous | SET NULL | Le paiement reste, perd le lien RDV |
| PatientAssurance → Patient | CASCADE | Supprimer les assurances avec le patient |
| PatientAssurance → Assurance | CASCADE | Supprimer les liens avec l'assurance |
| PatientMaladie → Patient | CASCADE | Supprimer le dossier medical avec le patient |
| PatientMaladie → TypeMaladie | RESTRICT (defaut) | Proteger les maladies referencees |
| PatientMaladie → Medecin | SET NULL | Le diagnostic reste, perd le lien medecin |

LOGIQUE GENERALE :
- CASCADE quand les donnees filles n'ont pas de sens sans le parent
  (les assurances d'un patient supprime sont inutiles)
- SET NULL quand les donnees filles ont une valeur independante
  (un paiement encaisse existe meme sans le RDV)
- RESTRICT quand on veut EMPECHER la suppression
  (on ne supprime pas un medecin qui a des RDV futurs)
