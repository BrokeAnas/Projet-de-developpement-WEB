# 04 — MediCareManager.Infrastructure — DAPPER, REPOSITORIES, SECURITE

## Table des matieres
1. Dapper — c'est quoi et comment ca marche
2. DatabaseConfiguration — la configuration globale
3. BaseRepository — le pattern transactionnel
4. PatientRepository — chaque methode, chaque requete SQL
5. RendezVousRepository — detection de conflits
6. PaiementRepository — avec triggers
7. MedecinRepository — gestion des doublons
8. Autres repositories
9. BCryptPasswordHasher — le hachage des mots de passe

---

## 1. DAPPER — C'EST QUOI ?

### Dapper vs Entity Framework (EF)

| | Dapper | Entity Framework |
|---|---|---|
| Type | Micro-ORM | ORM complet |
| SQL | Tu l'ecris TOI-MEME | EF le GENERE pour toi |
| Performance | Plus rapide | Plus lent (tracking, lazy loading) |
| Controle | Total (tu vois le SQL) | Moins (SQL cache) |
| Apprentissage | Tu dois connaitre SQL | Tu peux eviter le SQL |
| Mapping | Automatique (colonnes → proprietes) | Automatique |

### Comment Dapper fonctionne :

```csharp
// 1. On ecrit le SQL avec des @parametres
const string sql = "SELECT id_nat, nom, prenom FROM Patient WHERE id_nat = @IdNat";

// 2. On ouvre une connexion MySQL
using var connection = new MySqlConnection(connectionString);

// 3. Dapper execute le SQL et mappe le resultat sur un objet Patient
var patient = await connection.QueryFirstOrDefaultAsync<Patient>(sql, new { IdNat = 99061534897 });
```

CE QUE DAPPER FAIT :
1. Envoie la requete SQL a MySQL avec le parametre @IdNat = 99061534897
2. Recoit les colonnes : id_nat, nom, prenom
3. Cree un objet Patient
4. Mappe id_nat → IdNat, nom → Nom, prenom → Prenom (grace a MatchNamesWithUnderscores)
5. Retourne l'objet

### Les methodes Dapper principales :

```csharp
// Retourne une liste d'objets
IEnumerable<Patient> patients = await connection.QueryAsync<Patient>(sql, params);

// Retourne UN objet ou null
Patient? patient = await connection.QueryFirstOrDefaultAsync<Patient>(sql, params);

// Execute une requete sans retour (INSERT, UPDATE, DELETE)
int rowsAffected = await connection.ExecuteAsync(sql, params);

// Execute et retourne une valeur scalaire (COUNT, LAST_INSERT_ID)
int count = await connection.ExecuteScalarAsync<int>(sql, params);
```

### Requetes parametrees (ANTI SQL INJECTION) :

```csharp
// BON : parametre prepare (@IdNat)
const string sql = "SELECT * FROM Patient WHERE id_nat = @IdNat";
await connection.QueryAsync<Patient>(sql, new { IdNat = idNat });
```

Dapper transforme `@IdNat` en parametre prepare MySQL.
MySQL recoit la VALEUR separement de la REQUETE.
Meme si idNat contient `'; DROP TABLE Patient; --`, ca sera traite
comme une VALEUR, pas comme du SQL.

```csharp
// MAUVAIS : concatenation de chaines (VULNERABLE a l'injection SQL !!!)
var sql = $"SELECT * FROM Patient WHERE id_nat = {idNat}";
// Si idNat = "0 OR 1=1" → SELECT * FROM Patient WHERE id_nat = 0 OR 1=1
// → Retourne TOUS les patients !
```

---

## 2. DATABASE CONFIGURATION

```csharp
public static class DatabaseConfiguration
{
    static DatabaseConfiguration()
    {
        // MAPPING AUTOMATIQUE snake_case → PascalCase
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // TYPE HANDLERS pour DateOnly et TimeOnly
        SqlMapper.AddTypeHandler(new DateOnlyTypeHandler());
        SqlMapper.AddTypeHandler(new TimeOnlyTypeHandler());
    }

    public static MySqlConnection CreateConnection(string connectionString)
        => new MySqlConnection(connectionString);
}
```

### MatchNamesWithUnderscores = true

C'EST LA LIGNE LA PLUS IMPORTANTE DE TOUTE L'INFRASTRUCTURE.

Sans elle, Dapper ne saurait pas que :
- `id_nat` en MySQL correspond a `IdNat` en C#
- `date_naissance` correspond a `DateNaissance`
- `id_nat_patient` correspond a `IdNatPatient`

Avec cette ligne, Dapper enlève les underscores et compare en ignorant la casse :
- `id_nat` → `idnat` → match avec `IdNat` (apres lowercase)

### DateOnlyTypeHandler

```csharp
public class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
{
    public override DateOnly Parse(object value)
        => DateOnly.FromDateTime(Convert.ToDateTime(value));

    public override void SetValue(IDbDataParameter parameter, DateOnly value)
    {
        parameter.DbType = DbType.Date;
        parameter.Value = value.ToDateTime(TimeOnly.MinValue);
    }
}
```

POURQUOI ?
- MySQL renvoie les colonnes DATE comme des DateTime C#
- Mais notre code utilise DateOnly (type moderne, plus precis)
- `Parse` : convertit le DateTime recu de MySQL en DateOnly
- `SetValue` : convertit le DateOnly en DateTime pour l'envoyer a MySQL
  (TimeOnly.MinValue = 00:00:00 — on met minuit car on n'a pas d'heure)

### TimeOnlyTypeHandler

```csharp
public class TimeOnlyTypeHandler : SqlMapper.TypeHandler<TimeOnly>
{
    public override TimeOnly Parse(object value) => value switch
    {
        TimeSpan ts => TimeOnly.FromTimeSpan(ts),
        DateTime dt => TimeOnly.FromDateTime(dt),
        string s    => TimeOnly.Parse(s),
        _           => TimeOnly.FromTimeSpan((TimeSpan)value)
    };

    public override void SetValue(IDbDataParameter parameter, TimeOnly value)
    {
        parameter.DbType = DbType.Time;
        parameter.Value = value.ToTimeSpan();
    }
}
```

Le `switch expression` gere tous les formats possibles que MySQL peut renvoyer.

---

## 3. BASE REPOSITORY — LE PATTERN TRANSACTIONNEL

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

    protected async Task<T> ExecuteInTransactionAsync<T>(
        Func<MySqlConnection, IDbTransaction, Task<T>> action)
    {
        using var connection = CreateConnection();
        await connection.OpenAsync();
        using var transaction = await connection.BeginTransactionAsync();
        try
        {
            var result = await action(connection, transaction);
            await transaction.CommitAsync();
            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    protected const int DuplicateEntry = 1062;
    protected const int ForeignKeyViolation = 1452;
    protected const int RowReferenced = 1451;
}
```

### LIGNE PAR LIGNE :

`public abstract class BaseRepository`
→ Classe ABSTRAITE : on ne peut pas l'instancier directement
→ Elle sert de BASE pour tous les repositories concrets
→ Fournit les outils communs (connexion, transaction)

`protected readonly string ConnectionString;`
→ Protected = accessible par les classes filles (PatientRepository, etc.)
→ Readonly = ne peut etre assigne que dans le constructeur

`protected BaseRepository(string connectionString)`
→ Le constructeur recoit la connection string via injection de dependances
→ Rappel : la connection string est enregistree comme Singleton dans Program.cs

### ExecuteInTransactionAsync — LE COEUR

```
1. using var connection = CreateConnection();
   → Cree une connexion MySQL
   → `using` = la connexion sera fermee automatiquement a la fin du bloc
     (meme si une exception est levee)

2. await connection.OpenAsync();
   → Ouvre physiquement la connexion TCP vers MySQL

3. using var transaction = await connection.BeginTransactionAsync();
   → Demarre une transaction (BEGIN TRANSACTION en SQL)
   → Tout ce qui suit sera atomique (tout ou rien)

4. var result = await action(connection, transaction);
   → Execute la lambda passee en parametre
   → La lambda recoit la connexion ET la transaction
   → La transaction est passee a Dapper pour que les requetes
     soient executees DANS la transaction

5. await transaction.CommitAsync();
   → Si tout a reussi → COMMIT → les changements sont persistes
   → La transaction est terminee avec succes

6. catch { await transaction.RollbackAsync(); throw; }
   → Si N'IMPORTE QUELLE erreur survient → ROLLBACK
   → Tous les changements de cette transaction sont annules
   → `throw` relance l'exception vers le Service → le Middleware
```

### EXEMPLE CONCRET D'UTILISATION :

```csharp
// Dans PatientRepository.CreateAsync :
return await ExecuteInTransactionAsync(async (conn, tx) =>
{
    await conn.ExecuteAsync(sql, patient, tx);  // INSERT
    return patient.IdNat;
});
```

`conn.ExecuteAsync(sql, patient, tx)` :
- `sql` = la requete INSERT
- `patient` = l'objet dont Dapper extrait les parametres (@Nom, @Prenom...)
- `tx` = la transaction (Dapper envoie l'INSERT DANS cette transaction)

### Les codes d'erreur MySQL :

```csharp
protected const int DuplicateEntry = 1062;
// "Duplicate entry '99061534897' for key 'PRIMARY'"
// → Quelqu'un essaie d'inserer un NISS qui existe deja

protected const int ForeignKeyViolation = 1452;
// "Cannot add or update a child row: a foreign key constraint fails"
// → La FK pointe vers un enregistrement qui n'existe pas

protected const int RowReferenced = 1451;
// "Cannot delete or update a parent row: a foreign key constraint fails"
// → On essaie de supprimer un enregistrement reference par une FK
```

---

## 4. PATIENT REPOSITORY — REQUETE PAR REQUETE

### GetAllAsync — Liste paginee avec recherche

```csharp
public async Task<IEnumerable<Patient>> GetAllAsync(
    string? search = null, int page = 1, int pageSize = 20)
{
    const string sql = @"
        SELECT id_nat, nom, prenom, date_naissance, adresse, telephone, email
        FROM Patient
        WHERE (@Search IS NULL
               OR nom LIKE @SearchPattern
               OR prenom LIKE @SearchPattern
               OR CAST(id_nat AS CHAR) LIKE @SearchPattern)
        ORDER BY nom, prenom
        LIMIT @PageSize OFFSET @Offset;";

    using var connection = CreateConnection();
    return await connection.QueryAsync<Patient>(sql, new
    {
        Search = search,
        SearchPattern = $"%{search}%",
        PageSize = pageSize,
        Offset = (page - 1) * pageSize
    });
}
```

EXPLICATION DU SQL :

`@Search IS NULL` :
→ Si aucune recherche n'est demandee, cette condition est TRUE
→ Le OR fait que toute la clause WHERE est TRUE → on retourne tout

`OR nom LIKE @SearchPattern` :
→ Si search = "Dupont", SearchPattern = "%Dupont%"
→ LIKE '%Dupont%' = contient "Dupont" n'importe ou dans le nom
→ Le % est un joker qui matche 0 ou N caracteres

`OR CAST(id_nat AS CHAR) LIKE @SearchPattern` :
→ Permet de chercher par numero national (qui est un BIGINT, pas un string)
→ CAST convertit le nombre en string pour pouvoir faire un LIKE

`LIMIT @PageSize OFFSET @Offset` :
→ PAGINATION !
→ Page 1 : LIMIT 20 OFFSET 0 → lignes 1 a 20
→ Page 2 : LIMIT 20 OFFSET 20 → lignes 21 a 40
→ Page 3 : LIMIT 20 OFFSET 40 → lignes 41 a 60
→ Formule : OFFSET = (page - 1) * pageSize

`using var connection = CreateConnection();`
→ Pour les LECTURES, on ne fait PAS de transaction
→ On cree juste une connexion (qui se ferme automatiquement grace a `using`)


### GetByIdAsync — Un seul patient

```csharp
public async Task<Patient?> GetByIdAsync(long idNat)
{
    const string sql = @"
        SELECT id_nat, nom, prenom, date_naissance, adresse, telephone, email
        FROM Patient WHERE id_nat = @IdNat;";

    using var connection = CreateConnection();
    return await connection.QueryFirstOrDefaultAsync<Patient>(sql, new { IdNat = idNat });
}
```

`QueryFirstOrDefaultAsync<Patient>` :
→ Retourne le PREMIER resultat, ou NULL si aucun resultat
→ Le `?` dans le type de retour `Patient?` indique que null est possible


### CreateAsync — Insertion avec transaction

```csharp
public async Task<long> CreateAsync(Patient patient)
{
    const string sql = @"
        INSERT INTO Patient (id_nat, nom, prenom, date_naissance, adresse, telephone, email)
        VALUES (@IdNat, @Nom, @Prenom, @DateNaissance, @Adresse, @Telephone, @Email);";

    try
    {
        return await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            await conn.ExecuteAsync(sql, patient, tx);
            return patient.IdNat;
        });
    }
    catch (MySqlException ex) when (ex.Number == DuplicateEntry)
    {
        throw new IdNatAlreadyExistsException(patient.IdNat);
    }
}
```

`VALUES (@IdNat, @Nom, @Prenom, ...)`
→ Dapper prend les valeurs depuis l'objet `patient`
→ patient.IdNat → @IdNat, patient.Nom → @Nom, etc.
→ Les parametres sont envoyes separement de la requete = anti-injection SQL

`catch (MySqlException ex) when (ex.Number == DuplicateEntry)`
→ "Exception filter" C# : on catch UNIQUEMENT les MySqlException
  dont le numero d'erreur est 1062 (doublon de cle primaire/unique)
→ Si c'est une autre erreur MySQL, elle n'est PAS catchee ici
→ On transforme l'erreur technique en erreur metier lisible


### GetMaladiesAsync — Requete avec JOINTURES

```csharp
public async Task<IEnumerable<PatientMaladie>> GetMaladiesAsync(long idNat)
{
    const string sql = @"
        SELECT pm.id_nat_patient, pm.id_maladie, pm.id_nat_medecin,
               pm.date_diagnostic, pm.observations,
               tm.libelle, tm.code_CIM,
               CONCAT(m.nom, ' ', m.prenom) AS MedecinNom
        FROM PatientMaladie pm
        JOIN TypeMaladie tm ON tm.id_maladie = pm.id_maladie
        LEFT JOIN Medecin m ON m.id_nat = pm.id_nat_medecin
        WHERE pm.id_nat_patient = @IdNat
        ORDER BY pm.date_diagnostic DESC;";

    using var connection = CreateConnection();
    return await connection.QueryAsync<PatientMaladie>(sql, new { IdNat = idNat });
}
```

`JOIN TypeMaladie tm ON tm.id_maladie = pm.id_maladie`
→ INNER JOIN : chaque PatientMaladie DOIT avoir un TypeMaladie
→ On recupere le libelle et le code CIM de la maladie

`LEFT JOIN Medecin m ON m.id_nat = pm.id_nat_medecin`
→ LEFT JOIN car id_nat_medecin peut etre NULL
→ Si le medecin a ete supprime (SET NULL), on a quand meme le diagnostic

`CONCAT(m.nom, ' ', m.prenom) AS MedecinNom`
→ Concatene nom et prenom en un seul champ
→ L'alias "MedecinNom" est mappe automatiquement sur PatientMaladie.MedecinNom

---

## 5. RENDEZVOUS REPOSITORY — DETECTION DE CONFLITS

### HasConflitAsync — La requete la plus complexe

```csharp
public async Task<bool> HasConflitAsync(
    long medecinId, DateOnly date, TimeOnly heureDebut, TimeOnly heureFin,
    int? excludeId = null)
{
    const string sql = @"
        SELECT COUNT(*) FROM RendezVous
        WHERE id_nat_medecin = @MedecinId
          AND date_rdv = @Date
          AND heure_debut < @HeureFin
          AND heure_fin   > @HeureDebut
          AND statut NOT IN ('Annule')
          AND (@ExcludeId IS NULL OR id_rdv != @ExcludeId);";

    using var connection = CreateConnection();
    var count = await connection.ExecuteScalarAsync<int>(sql, new
    {
        MedecinId = medecinId,
        Date = date,
        HeureDebut = heureDebut,
        HeureFin = heureFin,
        ExcludeId = excludeId
    });
    return count > 0;
}
```

EXPLICATION DU SQL :

`WHERE id_nat_medecin = @MedecinId` :
→ On ne cherche que les RDV du MEME medecin

`AND date_rdv = @Date` :
→ Le meme jour

`AND heure_debut < @HeureFin AND heure_fin > @HeureDebut` :
→ C'est la formule mathematique d'intersection d'intervalles
→ Si un RDV existant [10:00, 11:00] et un demande [10:30, 11:30] :
  - 10:00 < 11:30 ? OUI
  - 11:00 > 10:30 ? OUI
  - → CONFLIT !

`AND statut NOT IN ('Annule')` :
→ On ignore les RDV annules (ils ne comptent plus)

`AND (@ExcludeId IS NULL OR id_rdv != @ExcludeId)` :
→ Quand on MODIFIE un RDV, il ne doit pas se detecter lui-meme comme conflit
→ excludeId = l'id du RDV qu'on est en train de modifier
→ Si excludeId est null (creation), on ne filtre rien

---

## 6. PAIEMENT REPOSITORY — AVEC TRIGGERS

### UpdateAsync

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

→ C'est un UPDATE classique, RIEN de special dans le code C#
→ MAIS : apres cet UPDATE, MySQL execute automatiquement le trigger
  `Paiement_Update_Log` qui copie l'ANCIENNE valeur dans Paiement_Historique

### GetAuditLogAsync

```csharp
public async Task<IEnumerable<PaiementHistorique>> GetAuditLogAsync()
{
    const string sql = @"
        SELECT h.id_historique, h.id_paiement, h.id_nat_patient, h.id_rdv,
               h.montant, h.date_paiement, h.operation, h.date_operation,
               CONCAT(p.nom, ' ', p.prenom) AS PatientNom
        FROM Paiement_Historique h
        LEFT JOIN Patient p ON p.id_nat = h.id_nat_patient
        ORDER BY h.date_operation DESC, h.id_historique DESC;";

    using var connection = CreateConnection();
    return await connection.QueryAsync<PaiementHistorique>(sql);
}
```

`LEFT JOIN Patient p` car le patient pourrait avoir ete supprime
entre-temps (l'historique d'audit n'a pas de FK).

`ORDER BY h.date_operation DESC` : les plus recents en premier.

---

## 7. MEDECIN REPOSITORY — GESTION DES DOUBLONS

### CreateAsync — Double catch pour email et NISS

```csharp
public async Task<long> CreateAsync(Medecin medecin)
{
    const string sql = @"
        INSERT INTO Medecin (id_nat, nom, prenom, email, mot_de_passe,
                             id_specialisation, id_sucursale)
        VALUES (@IdNat, @Nom, @Prenom, @Email, @MotDePasse,
                @IdSpecialisation, @IdSucursale);";

    try
    {
        return await ExecuteInTransactionAsync(async (conn, tx) =>
        {
            await conn.ExecuteAsync(sql, medecin, tx);
            return medecin.IdNat;
        });
    }
    catch (MySqlException ex) when (ex.Number == DuplicateEntry)
    {
        // MySQL dit "Duplicate entry" mais lequel ? id_nat ou email ?
        if (ex.Message.Contains("email", StringComparison.OrdinalIgnoreCase))
            throw new EmailAlreadyExistsException(medecin.Email);
        throw new IdNatAlreadyExistsException(medecin.IdNat);
    }
}
```

SUBTILITE : Le message d'erreur MySQL 1062 contient le nom de la contrainte violee.
On regarde si le message contient "email" pour savoir SI c'est le doublon d'email
ou le doublon de cle primaire (NISS).

### HasRendezVousFutursAsync — Regle metier

```csharp
public async Task<bool> HasRendezVousFutursAsync(long idNat)
{
    const string sql = @"
        SELECT COUNT(1) FROM RendezVous
        WHERE id_nat_medecin = @IdNat
          AND date_rdv >= CURDATE()
          AND statut IN ('Planifie', 'En cours');";

    using var connection = CreateConnection();
    return await connection.ExecuteScalarAsync<int>(sql, new { IdNat = idNat }) > 0;
}
```

`CURDATE()` : fonction MySQL qui retourne la date du jour
`date_rdv >= CURDATE()` : que les RDV futurs ou d'aujourd'hui
`statut IN ('Planifie', 'En cours')` : on ignore les RDV termines ou annules

---

## 8. STATS REPOSITORY — UNE SEULE REQUETE POUR LE DASHBOARD

```csharp
public async Task<AdminStatsDto> GetStatsAsync()
{
    const string sql = @"
        SELECT
            (SELECT COUNT(*) FROM Patient)     AS TotalPatients,
            (SELECT COUNT(*) FROM Medecin)     AS TotalMedecins,
            (SELECT COUNT(*) FROM Secretaire)  AS TotalSecretaires,
            (SELECT COUNT(*) FROM Sucursale)   AS TotalSucursales,
            (SELECT COUNT(*) FROM RendezVous
                WHERE date_rdv = CURDATE())    AS RdvAujourdHui,
            (SELECT COUNT(*) FROM RendezVous
                WHERE YEARWEEK(date_rdv, 1) = YEARWEEK(CURDATE(), 1))
                                               AS RdvCetteSemaine,
            (SELECT COALESCE(SUM(montant), 0) FROM Paiement
                WHERE YEAR(date_paiement)  = YEAR(CURDATE())
                  AND MONTH(date_paiement) = MONTH(CURDATE()))
                                               AS RevenuDuMois,
            (SELECT COUNT(*) FROM Paiement)    AS TotalPaiements;";

    using var connection = CreateConnection();
    return await connection.QueryFirstAsync<AdminStatsDto>(sql);
}
```

UNE SEULE requete SQL retourne 8 statistiques grace aux sous-requetes SELECT.

`YEARWEEK(date_rdv, 1)` : retourne l'annee+semaine (mode ISO, lundi = debut de semaine)
`COALESCE(SUM(montant), 0)` : si aucun paiement ce mois, retourne 0 (pas NULL)

Dapper mappe automatiquement chaque alias (TotalPatients, RdvAujourdHui...)
sur les proprietes du record AdminStatsDto.

---

## 9. BCRYPT PASSWORD HASHER

```csharp
public class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 11;

    public string Hash(string password)
        => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public bool Verify(string password, string hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }
}
```

### Comment BCrypt fonctionne :

1. HASHAGE : "MonMotDePasse" → "$2a$11$KIX7B3jF4vR2xY8qN1m..."
   - "$2a$" = version de l'algorithme
   - "11" = work factor (2^11 = 2048 iterations)
   - Le reste = salt (aleatoire) + hash

2. VERIFICATION : on recalcule le hash avec le meme salt et on compare
   - BCrypt extrait le salt du hash stocke
   - Il rehash le mot de passe fourni avec ce salt
   - Si les deux hash correspondent → mot de passe correct

### WorkFactor = 11 :
→ Signifie 2^11 = 2048 iterations de l'algorithme
→ Prend environ 100-200ms pour hasher un mot de passe
→ C'est VOLONTAIREMENT lent pour empecher le brute-force
→ Un attaquant ne peut tester que ~5-10 mots de passe par seconde
→ Plus c'est eleve, plus c'est securise mais plus c'est lent

### Pourquoi le try/catch dans Verify ?
→ Si le hash en base est corrompu ou mal forme, BCrypt.Verify throw
→ On catch silencieusement et on retourne false (verification echouee)
→ Ca evite de crasher l'application si la base contient un mauvais hash
