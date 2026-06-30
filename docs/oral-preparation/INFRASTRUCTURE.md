# INFRASTRUCTURE.md — L'acces aux donnees, la securite, la configuration

> **Projet concerne** : MediCareManager — C# + Angular + Dapper + MySQL (projet WEB)
> Ce fichier couvre le projet `MediCareManager.Infrastructure`, la base MySQL,
> la configuration, et comment tout est connecte.

---

## TABLE DES MATIERES

1. [Schema d'ensemble : quels composants, comment ils communiquent](#1-schema-densemble)
2. [La base de donnees MySQL — chaque table expliquee](#2-mysql)
3. [Dapper — le micro-ORM explique pour un debutant](#3-dapper)
4. [DatabaseConfiguration — le fichier qui connecte C# a MySQL](#4-databaseconfiguration)
5. [BaseRepository — le socle commun a tous les repositories](#5-baserepository)
6. [Les Repositories — chaque fichier, chaque requete SQL](#6-les-repositories)
7. [BCrypt — le hachage des mots de passe](#7-bcrypt)
8. [Les Triggers MySQL — l'audit automatique](#8-les-triggers)
9. [La configuration et les secrets (appsettings.json)](#9-configuration)
10. [Comment le projet est lance et deploye](#10-deploiement)
11. [Les points de confusion frequents](#11-points-de-confusion)
12. [En resume](#12-en-resume)

---

## 1. SCHEMA D'ENSEMBLE

Voici TOUS les composants de l'application et comment ils communiquent :

```
┌──────────────────────────────────────────────────────────────┐
│                    MACHINE DE L'UTILISATEUR                  │
│                                                              │
│   Navigateur (Chrome, Firefox...)                            │
│   └── Angular (localhost:4200)                               │
│       - Affiche les pages                                    │
│       - Envoie des requetes HTTP vers le backend             │
│       - Stocke le token JWT en memoire                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                    HTTP (port 5000)
                    GET, POST, PUT, DELETE
                    JSON + Header Authorization
                            │
                            v
┌──────────────────────────────────────────────────────────────┐
│                    MACHINE DU SERVEUR                        │
│     (en developpement, c'est la MEME machine = localhost)    │
│                                                              │
│   ASP.NET Core (localhost:5000)                              │
│   └── MediCareManager.API                                   │
│       ├── Middlewares (exceptions, CORS, auth JWT)           │
│       ├── Controllers (recoivent les requetes)               │
│       │                                                      │
│       └── MediCareManager.Core (logique metier)              │
│           ├── Services (regles, validation)                  │
│           └── Interfaces (contrats)                          │
│               │                                              │
│               v                                              │
│           MediCareManager.Infrastructure                     │
│           ├── Repositories (requetes SQL via Dapper)         │
│           ├── BCryptPasswordHasher                           │
│           └── DatabaseConfiguration                          │
│                   │                                          │
│                   v                                          │
│           MySQL 8 (localhost:3306)                            │
│           └── Base "medconnect"                              │
│               ├── 11 tables                                  │
│               ├── 2 triggers d'audit                         │
│               └── 5 index d'optimisation                     │
└──────────────────────────────────────────────────────────────┘
```

### En developpement, tout est sur LA MEME machine :
- Angular tourne sur le port 4200 (lance avec `ng serve`)
- ASP.NET tourne sur le port 5000 (lance avec `dotnet run`)
- MySQL tourne sur le port 3306 (installe localement)

### Pas de Docker, pas de Kubernetes, pas de cloud
Ce projet est une application locale. Pas de conteneurisation, pas de CI/CD
automatise, pas d'environnement staging/prod. C'est un projet universitaire
qui tourne en local.

### Pas de service externe
Pas de service d'email, pas de service de paiement en ligne, pas d'API tierce.
Tout est auto-contenu.

---

## 2. MYSQL — CHAQUE TABLE EXPLIQUEE

### 2.1 Vue d'ensemble des 11 tables

```
┌──────────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│ SpecialisationMedecin │  │     Sucursale          │     │   Assurance      │
│ id_specialisation│     │ id_sucursale            │     │ id_assurance     │
│ libelle          │     │ nom, adresse, tel, email│     │ nom, type        │
└────────┬─────────┘     └──────┬────────┬─────────┘     └────────┬─────────┘
         │                      │        │                        │
         │ FK                   │ FK     │ FK                     │ FK
         v                      v        v                        v
┌────────────────────┐  ┌──────────────────┐          ┌────────────────────────┐
│     Medecin        │  │   Secretaire     │          │   PatientAssurance     │
│ id_nat (PK)        │  │ id_nat (PK)      │          │ (id_nat_patient,       │
│ nom, prenom, email │  │ nom, prenom      │          │  id_assurance)    PK   │
│ mot_de_passe       │  │ email, mdp       │          │ numero_affiliation     │
│ id_specialisation  │  │ id_sucursale     │          │ date_debut, date_fin   │
└────────┬───────────┘  └──────────────────┘          └──────────┬─────────────┘
         │                                                       │
         │ FK                                                    │ FK
         v                                                       v
┌────────────────────────────────────────────────────────────────────────────┐
│                              Patient                                      │
│ id_nat (PK, BIGINT) | nom | prenom | date_naissance | adresse | tel | email │
└──────┬──────────────────────────────────────────────────────────┬──────────┘
       │ FK                                                      │ FK
       v                                                         v
┌──────────────────────────────┐                    ┌──────────────────────────┐
│        RendezVous            │                    │     PatientMaladie       │
│ id_rdv (PK, AUTO_INCREMENT)  │                    │ (id_nat_patient,         │
│ id_nat_patient (FK)          │                    │  id_maladie)     PK     │
│ id_nat_medecin (FK)          │                    │ id_nat_medecin (FK)     │
│ id_nat_secretaire (FK, NULL) │                    │ date_diagnostic         │
│ id_sucursale (FK)            │                    │ observations            │
│ date_rdv, heure_debut/fin    │                    └──────────┬──────────────┘
│ motif, statut (ENUM)         │                               │ FK
└──────────┬───────────────────┘                               v
           │ FK                                     ┌──────────────────────┐
           v                                        │    TypeMaladie       │
┌──────────────────────────────┐                    │ id_maladie (PK)      │
│        Paiement              │                    │ libelle, code_CIM    │
│ id_paiement (PK)             │                    └──────────────────────┘
│ id_nat_patient (FK)          │
│ id_rdv (FK, NULL)            │
│ montant (DECIMAL)            │       ┌──────────────────────────────┐
│ date_paiement, mode          │       │   Paiement_Historique        │
└──────────────────────────────┘       │ (remplie par les TRIGGERS)   │
                 │ TRIGGERS            │ id_historique, id_paiement   │
                 └────────────────────>│ montant, operation, date_op  │
                                       └──────────────────────────────┘

                ┌──────────────────────┐
                │   Administrateur     │  (table isolee, pas de FK)
                │ id_admin (PK, AUTO)  │
                │ nom, prenom, email   │
                │ mot_de_passe         │
                └──────────────────────┘
```

### 2.2 Les cles primaires : pourquoi BIGINT pour id_nat ?

Les tables `Patient`, `Medecin` et `Secretaire` utilisent le numero national
belge (NISS) comme cle primaire. Ce numero a 11 chiffres (ex: 99061534897).

Le type `INT` de MySQL peut stocker au maximum ~2,1 milliards (2 147 483 647).
Or 99 061 534 897 > 2 147 483 647 → ca ne rentre PAS dans un INT.
Donc on utilise `BIGINT` qui peut aller jusqu'a ~9,2 * 10^18.

Note : PAS de `AUTO_INCREMENT` sur ces tables car c'est l'utilisateur qui
fournit le numero national, pas MySQL.

### 2.3 Les strategies ON DELETE des cles etrangeres

Quand on supprime un enregistrement parent, que fait-on des enfants ?

**CASCADE** = "supprime les enfants aussi"
```
PatientAssurance → Patient     : CASCADE  (si on supprime le patient, ses assurances partent)
PatientAssurance → Assurance   : CASCADE  (si on supprime l'assurance, les liens partent)
PatientMaladie → Patient       : CASCADE  (si on supprime le patient, son dossier medical part)
```
Logique : ces donnees n'ont pas de sens sans le parent.

**SET NULL** = "garde l'enfant mais vide la reference"
```
Medecin → Sucursale            : SET NULL (si on supprime la succursale, le medecin reste mais perd son affectation)
RendezVous → Secretaire        : SET NULL (si la secretaire part, le RDV reste)
Paiement → RendezVous          : SET NULL (si on annule le RDV, le paiement reste car l'argent est encaisse)
PatientMaladie → Medecin       : SET NULL (si le medecin part, le diagnostic reste)
```
Logique : l'enfant a une valeur independante du parent.

**RESTRICT** (par defaut) = "refuse la suppression"
```
Medecin → SpecialisationMedecin : RESTRICT (refuse de supprimer une specialisation utilisee)
Secretaire → Sucursale          : RESTRICT (refuse de supprimer une succursale ou travaille une secretaire)
RendezVous → Patient            : RESTRICT (refuse de supprimer un patient qui a des RDV)
RendezVous → Medecin            : RESTRICT (refuse de supprimer un medecin qui a des RDV)
```
Logique : on PROTEGE les donnees referencees.

### 2.4 Les tables de jonction N:M (many-to-many)

**PatientAssurance** : un patient peut avoir PLUSIEURS assurances, et une assurance
couvre PLUSIEURS patients.
```sql
PRIMARY KEY (id_nat_patient, id_assurance)  -- cle composite = le couple est unique
```
Un patient ne peut PAS etre inscrit DEUX FOIS a la meme assurance.
Mais il peut avoir l'assurance 1 ET l'assurance 3.

**PatientMaladie** : meme principe pour les diagnostics.
Champs supplementaires : `date_diagnostic`, `observations` — c'est pour ca
qu'on a une table explicite et pas juste une relation implicite.

### 2.5 Les Index d'optimisation

```sql
CREATE INDEX idx_patient_nom_prenom ON Patient(nom, prenom);
CREATE INDEX idx_rdv_medecin_date ON RendezVous(id_nat_medecin, date_rdv);
CREATE INDEX idx_rdv_patient ON RendezVous(id_nat_patient);
CREATE INDEX idx_paiement_patient ON Paiement(id_nat_patient);
CREATE INDEX idx_historique_paiement ON Paiement_Historique(id_paiement);
```

**C'est quoi un index ?** C'est comme l'index d'un livre. Sans index, pour
trouver "Dupont" dans la table Patient, MySQL doit lire TOUTES les lignes
(full table scan). Avec un index sur nom/prenom, MySQL va directement aux
bonnes lignes. C'est beaucoup plus rapide.

**Pourquoi pas des index partout ?** Chaque index RALENTIT les ecritures
(INSERT/UPDATE doivent aussi mettre a jour l'index). On indexe uniquement
les colonnes utilisees dans les WHERE et les JOIN frequents.

---

## 3. DAPPER — LE MICRO-ORM EXPLIQUE

### C'est quoi un ORM ?

ORM = Object-Relational Mapping. Ca transforme les LIGNES d'une table SQL
en OBJETS C# (et inversement).

Sans ORM, tu devrais ecrire :
```csharp
var reader = command.ExecuteReader();
while (reader.Read()) {
    var patient = new Patient();
    patient.IdNat = reader.GetInt64(0);
    patient.Nom = reader.GetString(1);
    patient.Prenom = reader.GetString(2);
    // ... colonne par colonne, manuellement
}
```

Avec Dapper :
```csharp
var patients = await connection.QueryAsync<Patient>(sql);
// C'est tout. Dapper fait le mapping automatiquement.
```

### Dapper vs Entity Framework

| | Dapper | Entity Framework (EF) |
|---|---|---|
| Tu ecris le SQL toi-meme ? | OUI | NON (EF le genere) |
| Performance | Plus rapide | Plus lent |
| Controle | Total | Moins |
| Courbe d'apprentissage | Tu dois connaitre SQL | Tu peux eviter le SQL |
| Poids | Tres leger (~15 Ko) | Lourd (~20 Mo) |

Ce projet utilise Dapper = tu VOIS le vrai SQL dans chaque repository.

### Les 4 methodes Dapper que tu dois connaitre

```csharp
// 1. QueryAsync<T> — retourne une LISTE d'objets
IEnumerable<Patient> patients = await conn.QueryAsync<Patient>(sql, parametres);
// Utilise pour les SELECT qui retournent plusieurs lignes (ex: liste des patients)

// 2. QueryFirstOrDefaultAsync<T> — retourne UN objet ou null
Patient? patient = await conn.QueryFirstOrDefaultAsync<Patient>(sql, parametres);
// Utilise pour les SELECT par id (WHERE id_nat = @IdNat)
// Retourne null si aucun resultat

// 3. ExecuteAsync — execute sans retour (INSERT, UPDATE, DELETE)
int lignesAffectees = await conn.ExecuteAsync(sql, parametres);
// Retourne le nombre de lignes affectees (1 si succes, 0 si rien n'a change)

// 4. ExecuteScalarAsync<T> — retourne une valeur unique (COUNT, LAST_INSERT_ID)
int count = await conn.ExecuteScalarAsync<int>(sql, parametres);
// Utilise pour COUNT(*) ou LAST_INSERT_ID()
```

### Les parametres — la protection anti-injection SQL

```csharp
// BON : parametre prepare
const string sql = "SELECT * FROM Patient WHERE id_nat = @IdNat";
await conn.QueryAsync<Patient>(sql, new { IdNat = 99061534897 });
```

Dapper envoie le @IdNat SEPAREMENT de la requete SQL a MySQL.
MySQL recoit : "voici la requete" + "voici les valeurs a inserer".
Meme si la valeur contient du SQL malicieux, elle sera traitee comme
une VALEUR, pas comme du code SQL.

```csharp
// MAUVAIS : concatenation (VULNERABLE !)
var sql = $"SELECT * FROM Patient WHERE id_nat = {userInput}";
// Si userInput = "0 OR 1=1" → retourne TOUS les patients !
// Si userInput = "0; DROP TABLE Patient;" → SUPPRIME la table !
```

---

## 4. DATABASE CONFIGURATION

**Fichier :** `MediCareManager.Infrastructure/Configuration/DatabaseConfiguration.cs`

```csharp
public static class DatabaseConfiguration
{
    static DatabaseConfiguration()
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;
        SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
        SqlMapper.AddTypeHandler(new TimeOnlyTypeHandler());
    }

    public static MySqlConnection CreateConnection(string connectionString)
        => new MySqlConnection(connectionString);
}
```

### Ligne 1 : MatchNamesWithUnderscores = true

C'EST LA LIGNE LA PLUS IMPORTANTE DE TOUTE L'INFRASTRUCTURE.

MySQL utilise snake_case : `id_nat_patient`, `date_naissance`
C# utilise PascalCase : `IdNatPatient`, `DateNaissance`

Sans cette ligne, Dapper ne saurait pas que `id_nat_patient` correspond a `IdNatPatient`.
Avec cette ligne, Dapper enleve les underscores et compare en ignorant la casse :
`id_nat_patient` → `idnatpatient` → match avec `IdNatPatient`

### Lignes 2-3 : les Type Handlers

MySQL renvoie les colonnes DATE comme des `DateTime` C# (date + heure).
Mais notre code utilise `DateOnly` (juste la date, sans l'heure).
Le `DateOnlyTypeHandler` fait la conversion automatiquement.

Pareil pour TIME → `TimeOnly` (juste l'heure, sans la date).

```csharp
public class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
{
    public override DateOnly Parse(object value)
        => DateOnly.FromDateTime(Convert.ToDateTime(value));
    // MySQL envoie un DateTime, on extrait juste la partie date

    public override void SetValue(IDbDataParameter parameter, DateOnly value)
    {
        parameter.DbType = DbType.Date;
        parameter.Value = value.ToDateTime(TimeOnly.MinValue);
    }
    // C# envoie un DateOnly, on le convertit en DateTime avec heure = 00:00
}
```

---

## 5. BASE REPOSITORY — LE SOCLE COMMUN

**Fichier :** `MediCareManager.Infrastructure/Repositories/BaseRepository.cs`

Tous les repositories (PatientRepository, MedecinRepository, etc.) heritent
de cette classe. Elle fournit les outils communs.

```csharp
public abstract class BaseRepository
{
    protected readonly string ConnectionString;

    protected BaseRepository(string connectionString)
    {
        ConnectionString = connectionString;
    }

    protected MySqlConnection CreateConnection()
        => DatabaseConfiguration.CreateConnection(ConnectionString);
```

`abstract` = on ne peut pas creer un `new BaseRepository()` directement.
C'est une classe de base qu'on herite.

`protected` = accessible par les classes filles (PatientRepository, etc.)
mais pas par les classes exterieures.

Le `connectionString` arrive par le constructeur grace a la DI.
Dans Program.cs : `builder.Services.AddSingleton(connectionString)`.
Quand ASP.NET cree un `PatientRepository`, il lui passe automatiquement
cette chaine.

### La methode ExecuteInTransactionAsync — les transactions

```csharp
protected async Task<T> ExecuteInTransactionAsync<T>(
    Func<MySqlConnection, IDbTransaction, Task<T>> action)
{
    using var connection = CreateConnection();  // 1. Cree une connexion MySQL
    await connection.OpenAsync();                // 2. Ouvre la connexion TCP
    using var transaction = await connection.BeginTransactionAsync(); // 3. BEGIN TRANSACTION
    try
    {
        var result = await action(connection, transaction);  // 4. Execute l'action
        await transaction.CommitAsync();                      // 5. COMMIT (sauvegarde)
        return result;
    }
    catch
    {
        await transaction.RollbackAsync();  // 6. ROLLBACK si erreur (annule tout)
        throw;                              // 7. Relance l'exception
    }
}
```

**C'est quoi une transaction ?**
Imagine que tu fais un virement bancaire : tu retires 100 euros du compte A
et tu ajoutes 100 euros au compte B. Si l'etape 2 echoue (panne de courant),
tu ne veux PAS que l'etape 1 reste appliquee (sinon les 100 euros disparaissent).

Une transaction garantit : soit TOUT reussit (COMMIT), soit RIEN ne s'applique (ROLLBACK).

**`using var connection`** — le `using` signifie : "a la fin du bloc, ferme
automatiquement la connexion, meme si une exception est levee". Ca evite
les fuites de connexion (connexions MySQL qui restent ouvertes indefiniment).

### Les codes d'erreur MySQL

```csharp
protected const int DuplicateEntry = 1062;     // Doublon de cle primaire ou UNIQUE
protected const int ForeignKeyViolation = 1452; // FK pointe vers un id inexistant
protected const int RowReferenced = 1451;       // On essaie de supprimer un parent reference
```

Les repositories utilisent ces codes pour transformer les erreurs MySQL
en exceptions metier lisibles :
```csharp
catch (MySqlException ex) when (ex.Number == DuplicateEntry)
{
    throw new IdNatAlreadyExistsException(patient.IdNat);
}
// Au lieu de : "Duplicate entry '99061534897' for key 'PRIMARY'" (incomprehensible pour l'utilisateur)
// On renvoie : "Le numero national 99061534897 existe deja." (clair)
```

---

## 6. LES REPOSITORIES — CHAQUE FICHIER, CHAQUE REQUETE SQL

### 6.1 PatientRepository.cs — le plus complet

**GetAllAsync** — liste paginee avec recherche :
```sql
SELECT id_nat, nom, prenom, date_naissance, adresse, telephone, email
FROM Patient
WHERE (@Search IS NULL                         -- Si pas de recherche → tout
       OR nom LIKE @SearchPattern              -- Ou cherche dans le nom
       OR prenom LIKE @SearchPattern           -- Ou dans le prenom
       OR CAST(id_nat AS CHAR) LIKE @SearchPattern)  -- Ou dans le NISS
ORDER BY nom, prenom                           -- Tri alphabetique
LIMIT @PageSize OFFSET @Offset;                -- Pagination
```

LIMIT/OFFSET = pagination.
Page 1 : LIMIT 20 OFFSET 0 → lignes 1-20
Page 2 : LIMIT 20 OFFSET 20 → lignes 21-40

**CreateAsync** — insertion avec gestion des doublons :
```csharp
try {
    return await ExecuteInTransactionAsync(async (conn, tx) => {
        await conn.ExecuteAsync(sql, patient, tx);  // INSERT
        return patient.IdNat;
    });
}
catch (MySqlException ex) when (ex.Number == DuplicateEntry) {
    throw new IdNatAlreadyExistsException(patient.IdNat);
}
```

`conn.ExecuteAsync(sql, patient, tx)` — Dapper remplace les @parametres
par les proprietes de l'objet patient : @IdNat ← patient.IdNat, @Nom ← patient.Nom, etc.
Le 3eme argument `tx` dit a Dapper : "execute cette requete DANS la transaction".

**GetMaladiesAsync** — requete avec JOINTURES :
```sql
SELECT pm.id_nat_patient, pm.id_maladie, pm.date_diagnostic, pm.observations,
       tm.libelle, tm.code_CIM,                              -- JOIN TypeMaladie
       CONCAT(m.nom, ' ', m.prenom) AS MedecinNom            -- JOIN Medecin
FROM PatientMaladie pm
JOIN TypeMaladie tm ON tm.id_maladie = pm.id_maladie          -- Obligatoire
LEFT JOIN Medecin m ON m.id_nat = pm.id_nat_medecin           -- Optionnel (peut etre NULL)
WHERE pm.id_nat_patient = @IdNat
ORDER BY pm.date_diagnostic DESC;
```

`JOIN` (inner) = les deux tables DOIVENT avoir une correspondance.
`LEFT JOIN` = on garde la ligne meme si le medecin n'existe plus (NULL).

L'alias `AS MedecinNom` est mappe automatiquement sur la propriete
`PatientMaladie.MedecinNom` par Dapper (grace a MatchNamesWithUnderscores).

### 6.2 RendezVousRepository.cs — detection de conflits

**HasConflitAsync** — la requete la plus interessante :
```sql
SELECT COUNT(*) FROM RendezVous
WHERE id_nat_medecin = @MedecinId        -- Meme medecin
  AND date_rdv = @Date                   -- Meme jour
  AND heure_debut < @HeureFin            -- Debut existant AVANT fin demandee
  AND heure_fin > @HeureDebut            -- Fin existante APRES debut demande
  AND statut NOT IN ('Annule')           -- Ignore les annules
  AND (@ExcludeId IS NULL OR id_rdv != @ExcludeId);  -- En cas de modif, exclut le RDV lui-meme
```

La formule d'intersection d'intervalles :
Deux intervalles [A,B] et [C,D] se chevauchent si A < D ET B > C.

Exemple concret :
```
RDV existant :  |---10:00 ===== 11:00---|
RDV demande  :       |---10:30 ===== 11:30---|

10:00 < 11:30 ? OUI (debut existant avant fin demandee)
11:00 > 10:30 ? OUI (fin existante apres debut demande)
→ Les deux conditions sont vraies → CONFLIT !
```

Contre-exemple (pas de conflit) :
```
RDV existant :  |---10:00 ===== 11:00---|
RDV demande  :                           |---11:00 ===== 12:00---|

10:00 < 12:00 ? OUI
11:00 > 11:00 ? NON (pas strictement superieur)
→ Pas de conflit, ils sont bout a bout
```

**CreateAsync** — avec SELECT LAST_INSERT_ID() :
```sql
INSERT INTO RendezVous
    (id_nat_patient, id_nat_medecin, id_nat_secretaire, id_sucursale,
     date_rdv, heure_debut, heure_fin, motif, statut)
VALUES (...);
SELECT LAST_INSERT_ID();
```

`LAST_INSERT_ID()` retourne l'id auto-genere par MySQL.
On en a besoin pour retourner le RDV complet au frontend apres creation.

### 6.3 PaiementRepository.cs — avec triggers

```csharp
public async Task UpdateAsync(Paiement paiement)
{
    const string sql = @"
        UPDATE Paiement
        SET montant = @Montant, date_paiement = @DatePaiement,
            mode_paiement = @ModePaiement
        WHERE id_paiement = @IdPaiement;";

    await ExecuteInTransactionAsync(async (conn, tx) =>
        await conn.ExecuteAsync(sql, paiement, tx));
}
```

C'est un UPDATE classique. MAIS : apres cet UPDATE, MySQL execute
automatiquement le trigger `Paiement_Update_Log` qui copie l'ANCIENNE
valeur dans `Paiement_Historique`. Le code C# ne fait RIEN de special.

**GetAuditLogAsync** — lire l'historique des triggers :
```sql
SELECT h.id_historique, h.id_paiement, h.id_nat_patient, h.montant,
       h.date_paiement, h.operation, h.date_operation,
       CONCAT(p.nom, ' ', p.prenom) AS PatientNom
FROM Paiement_Historique h
LEFT JOIN Patient p ON p.id_nat = h.id_nat_patient
ORDER BY h.date_operation DESC;
```

### 6.4 MedecinRepository.cs — double gestion des doublons

```csharp
catch (MySqlException ex) when (ex.Number == DuplicateEntry)
{
    if (ex.Message.Contains("email", StringComparison.OrdinalIgnoreCase))
        throw new EmailAlreadyExistsException(medecin.Email);
    throw new IdNatAlreadyExistsException(medecin.IdNat);
}
```

L'erreur 1062 peut venir de DEUX contraintes UNIQUE :
- La cle primaire id_nat
- La contrainte UNIQUE sur email

On regarde le MESSAGE d'erreur MySQL pour savoir laquelle.
Si le message contient "email" → c'est le doublon d'email.
Sinon → c'est le doublon de NISS.

**HasRendezVousFutursAsync** — verifier avant suppression :
```sql
SELECT COUNT(1) FROM RendezVous
WHERE id_nat_medecin = @IdNat
  AND date_rdv >= CURDATE()                    -- Aujourd'hui ou plus tard
  AND statut IN ('Planifie', 'En cours');      -- Pas les termines/annules
```

### 6.5 StatsRepository.cs — dashboard en UNE seule requete

```sql
SELECT
    (SELECT COUNT(*) FROM Patient)     AS TotalPatients,
    (SELECT COUNT(*) FROM Medecin)     AS TotalMedecins,
    (SELECT COUNT(*) FROM Secretaire)  AS TotalSecretaires,
    (SELECT COUNT(*) FROM Sucursale)   AS TotalSucursales,
    (SELECT COUNT(*) FROM RendezVous WHERE date_rdv = CURDATE()) AS RdvAujourdHui,
    (SELECT COUNT(*) FROM RendezVous
        WHERE YEARWEEK(date_rdv, 1) = YEARWEEK(CURDATE(), 1)) AS RdvCetteSemaine,
    (SELECT COALESCE(SUM(montant), 0) FROM Paiement
        WHERE YEAR(date_paiement) = YEAR(CURDATE())
          AND MONTH(date_paiement) = MONTH(CURDATE())) AS RevenuDuMois,
    (SELECT COUNT(*) FROM Paiement)    AS TotalPaiements;
```

UNE SEULE requete, 8 sous-requetes SELECT, chaque alias est mappe
sur une propriete du record `AdminStatsDto`.

`COALESCE(SUM(montant), 0)` : si aucun paiement ce mois → retourne 0 (pas NULL).
`YEARWEEK(date_rdv, 1)` : retourne l'annee+semaine en mode ISO (lundi = debut).

### 6.6 Les autres repositories (SecretaireRepository, SucursaleRepository, referentiels)

Ils suivent tous le meme pattern :
- GetAllAsync → SELECT avec JOIN si necessaire
- GetByIdAsync → SELECT WHERE id = @Id
- CreateAsync → INSERT dans une transaction, catch DuplicateEntry
- UpdateAsync → UPDATE dans une transaction
- DeleteAsync → DELETE dans une transaction, catch RowReferenced

SucursaleRepository a une particularite : `HasPersonnelAsync` qui compte
les medecins et secretaires affectes avant de permettre la suppression.

---

## 7. BCRYPT — LE HACHAGE DES MOTS DE PASSE

**Fichier :** `MediCareManager.Infrastructure/Security/BCryptPasswordHasher.cs`

```csharp
public class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 11;

    public string Hash(string password)
        => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public bool Verify(string password, string hash)
    {
        try { return BCrypt.Net.BCrypt.Verify(password, hash); }
        catch { return false; }
    }
}
```

### Comment BCrypt fonctionne (pour un debutant)

1. **Hachage** : "MonMotDePasse" → "$2a$11$KIX7B3jF4vR2xY8qN1m..."
   - `$2a$` = version de l'algorithme
   - `11` = work factor
   - Le reste = sel aleatoire + hash

2. **Le sel** (salt) : un nombre aleatoire ajoute au mot de passe AVANT le hachage.
   Meme mot de passe, sels differents → hash differents.
   Donc si deux utilisateurs ont le meme mot de passe, leurs hash sont DIFFERENTS.
   Un attaquant ne peut pas comparer les hash pour trouver des doublons.

3. **Le work factor** (11) : le hash est calcule 2^11 = 2048 fois.
   C'est VOLONTAIREMENT lent (~100-200ms) pour empecher le brute-force.
   Un attaquant ne peut tester que ~5-10 mots de passe par seconde.

4. **Verification** : BCrypt extrait le sel du hash stocke, rehash le mot
   de passe fourni avec ce sel, et compare. Si les hash correspondent → correct.

5. **Irreversible** : on ne peut PAS retrouver le mot de passe depuis le hash.
   Meme l'administrateur de la base ne peut pas connaitre les mots de passe.

### Pourquoi le try/catch dans Verify ?

Si le hash en base est corrompu (donnees corrompues, migration ratee),
`BCrypt.Verify` leve une exception. Le catch retourne `false` silencieusement
(= verification echouee) au lieu de crasher le serveur.

### Pourquoi c'est dans Infrastructure et pas dans Core ?

BCrypt est une librairie externe (NuGet `BCrypt.Net-Next`). Le Core ne doit
avoir AUCUNE dependance externe. Donc :
- Core definit l'INTERFACE : `IPasswordHasher` (Hash + Verify)
- Infrastructure fournit l'IMPLEMENTATION : `BCryptPasswordHasher`
- Le branchement se fait dans Program.cs : `AddScoped<IPasswordHasher, BCryptPasswordHasher>()`

---

## 8. LES TRIGGERS MYSQL — L'AUDIT AUTOMATIQUE

### C'est quoi un trigger ?

Un trigger est un bout de code SQL qui s'execute AUTOMATIQUEMENT
quand un evenement se produit sur une table (INSERT, UPDATE, DELETE).

### Les 2 triggers du projet

```sql
-- Quand on MODIFIE un paiement
CREATE TRIGGER Paiement_Update_Log
AFTER UPDATE ON Paiement FOR EACH ROW
BEGIN
  INSERT INTO Paiement_Historique
    (id_paiement, id_nat_patient, id_rdv, montant, date_paiement, operation)
  VALUES
    (OLD.id_paiement, OLD.id_nat_patient, OLD.id_rdv,
     OLD.montant, OLD.date_paiement, 'UPDATE');
END
```

- `AFTER UPDATE` : se declenche APRES un UPDATE reussi
- `FOR EACH ROW` : pour chaque ligne modifiee
- `OLD.montant` : la valeur AVANT la modification
  (il existe aussi `NEW.montant` pour la valeur apres, mais on sauvegarde l'ancienne)
- `'UPDATE'` : marque l'operation dans l'historique

Meme principe pour le trigger DELETE :
```sql
CREATE TRIGGER Paiement_Delete_Log
AFTER DELETE ON Paiement FOR EACH ROW
BEGIN
  INSERT INTO Paiement_Historique
    (id_paiement, id_nat_patient, id_rdv, montant, date_paiement, operation)
  VALUES
    (OLD.id_paiement, OLD.id_nat_patient, OLD.id_rdv,
     OLD.montant, OLD.date_paiement, 'DELETE');
END
```

### Exemple concret

```
AVANT : Paiement #42 → montant = 50.00
ACTION : UPDATE Paiement SET montant = 75.00 WHERE id_paiement = 42
TRIGGER : INSERT INTO Paiement_Historique VALUES (42, ..., 50.00, ..., 'UPDATE')
APRES : Paiement #42 → montant = 75.00
        Paiement_Historique → { id_paiement=42, montant=50.00, operation='UPDATE' }
```

L'admin peut ensuite consulter GET /api/paiements/audit pour voir
TOUTES les modifications et suppressions, avec les anciennes valeurs.

### Pourquoi des triggers et pas du code C# ?

- Le trigger s'execute COTE MYSQL, pas cote C#
- Meme si quelqu'un accede directement a la base (sans passer par l'API),
  l'audit est quand meme fait
- Le code C# n'a RIEN de special a ecrire — c'est transparent

---

## 9. CONFIGURATION ET SECRETS

### appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=medconnect;User=root;Password=root;"
  },
  "Jwt": {
    "Key": "MediCareManagerSuperSecretJwtKey2024AtLeast32Chars!",
    "Issuer": "MediCareManagerAPI",
    "Audience": "MediCareManagerClient",
    "ExpiryHours": 8
  }
}
```

**ConnectionStrings.DefaultConnection** : l'adresse de MySQL.
- `Server=localhost` : MySQL est sur la meme machine
- `Database=medconnect` : le nom de la base
- `User=root;Password=root` : les identifiants MySQL

**Jwt.Key** : la cle secrete utilisee pour SIGNER les tokens JWT.
Si quelqu'un connait cette cle, il peut fabriquer de FAUX tokens.
En production, cette cle serait dans une variable d'environnement
ou un coffre-fort de secrets (Azure Key Vault, AWS Secrets Manager).

**Jwt.ExpiryHours = 8** : un token expire apres 8 heures.
L'utilisateur doit se reconnecter apres ce delai.

### launchSettings.json

```json
{
  "profiles": {
    "http": {
      "applicationUrl": "http://localhost:5000",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

- Le serveur ecoute sur le port 5000
- L'environnement est "Development" (messages d'erreur detailles, pas de HTTPS force)

### environment.ts (Angular)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api'
};
```

Angular sait ou envoyer ses requetes HTTP grace a cette URL.

---

## 10. COMMENT LE PROJET EST LANCE

### Lancer la base de donnees

```bash
# MySQL doit etre demarre (via XAMPP, WAMP, ou directement)
# Puis creer la base et les tables :
mysql -u root -p < database/medconnect_schema.sql
# Et inserer les donnees de test :
mysql -u root -p < database/medconnect_data.sql
```

### Lancer le backend C#

```bash
cd MediCareManager.API
dotnet run
# Le serveur demarre sur http://localhost:5000
# Swagger est accessible sur http://localhost:5000/swagger
```

### Lancer le frontend Angular

```bash
cd medicare-frontend
npm install    # Installe les dependances (une seule fois)
ng serve       # Demarre sur http://localhost:4200
```

### Pas de Docker, pas de CI/CD

Ce projet n'utilise pas Docker, pas de conteneurs, pas de pipeline CI/CD.
Tout est lance manuellement sur la machine de developpement.

---

## 11. POINTS DE CONFUSION FREQUENTS

### "Pourquoi on n'utilise pas Entity Framework ?"

Dapper est un MICRO-ORM : on ecrit le SQL soi-meme. C'est un choix
pedagogique — on voit exactement ce qui est envoye a MySQL. Entity Framework
genererait le SQL automatiquement mais on perdrait le controle et la
comprehension de ce qui se passe.

### "Pourquoi la connection string est dans appsettings.json en clair ?"

En developpement, c'est acceptable. En production, on utiliserait :
- Des variables d'environnement
- Un gestionnaire de secrets (dotnet user-secrets, Azure Key Vault...)
- JAMAIS de mots de passe en dur dans le code source

### "Pourquoi BaseRepository est abstract ?"

Parce qu'on ne veut pas qu'on puisse faire `new BaseRepository(...)`.
Ca n'a pas de sens d'avoir un repository generique qui ne sait pas
quelle table il gere. On OBLIGE a creer des classes specialisees
(PatientRepository, MedecinRepository...) qui heritent de BaseRepository.

### "C'est quoi la difference entre using et await using ?"

`using var connection = CreateConnection();`
→ A la fin du bloc, la connexion est fermee et liberee automatiquement.
→ Pas besoin d'ecrire `connection.Close()` manuellement.
→ Fonctionne meme si une exception est levee (equivalent d'un finally).

### "Pourquoi les lectures n'ont pas de transaction ?"

```csharp
// LECTURE : pas de transaction (on lit juste, on ne modifie rien)
using var connection = CreateConnection();
return await connection.QueryAsync<Patient>(sql, params);

// ECRITURE : transaction (on veut tout-ou-rien)
return await ExecuteInTransactionAsync(async (conn, tx) =>
    await conn.ExecuteAsync(sql, params, tx));
```

Les transactions servent a garantir l'atomicite des ECRITURES.
Pour une simple lecture (SELECT), il n'y a rien a annuler en cas d'erreur.

---

## 12. EN RESUME

L'infrastructure de MediCareManager est composee de :

**MySQL 8** : 11 tables, 2 triggers d'audit, 5 index. Les cles etrangeres
utilisent CASCADE (supprimer en cascade), SET NULL (garder l'enfant),
ou RESTRICT (refuser la suppression) selon le cas metier.

**Dapper** : micro-ORM qui execute du SQL ecrit a la main et mappe
automatiquement les resultats sur des objets C#. Les requetes utilisent
des @parametres pour empecher l'injection SQL.

**BaseRepository** : classe abstraite qui fournit la connexion MySQL
et le pattern transactionnel (BEGIN/COMMIT/ROLLBACK). Tous les repositories
en heritent.

**10 repositories** : chacun gere une table (ou un groupe de tables liees).
Ils contiennent le SQL, gerent les erreurs MySQL (1062, 1451, 1452),
et les transforment en exceptions metier lisibles.

**BCrypt** : hachage unidirectionnel des mots de passe avec salt et work factor.
Implemente dans Infrastructure car c'est une dependance externe,
mais defini par une interface dans Core.

**Configuration** : `appsettings.json` contient la connection string MySQL
et les parametres JWT. `launchSettings.json` definit le port (5000)
et l'environnement (Development).

**Pas de Docker, pas de cloud** : tout tourne en local sur la meme machine.
Angular sur le port 4200, ASP.NET sur le port 5000, MySQL sur le port 3306.
