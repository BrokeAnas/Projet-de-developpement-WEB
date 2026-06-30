# 03 — MediCareManager.Core — LA LOGIQUE METIER

## Table des matieres
1. Les Entities — chaque classe, chaque propriete
2. Les DTOs — ce que le frontend envoie/recoit
3. Les Services — chaque methode expliquee
4. Les Exceptions — le systeme d'erreurs
5. Les utilitaires (NISS belge, JSON converters)
6. Les Interfaces — les contrats

---

## 1. LES ENTITIES

### 1.1 Patient.cs

```csharp
public class Patient
{
    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNat { get; set; }

    public string Nom { get; set; } = string.Empty;
    public string Prenom { get; set; } = string.Empty;
    public DateOnly DateNaissance { get; set; }
    public string? Adresse { get; set; }
    public string? Telephone { get; set; }
    public string? Email { get; set; }
}
```

LIGNE PAR LIGNE :

`[JsonConverter(typeof(LongToStringJsonConverter))]`
→ Attribut qui dit au serialiseur JSON : "Quand tu convertis IdNat en JSON,
  utilise mon convertisseur personnalise qui transforme le long en string"
→ POURQUOI ? JavaScript (et donc Angular) perd la precision des nombres
  au-dela de 2^53 (9 007 199 254 740 992). Un NISS belge comme 99061534897
  rentre dans cette limite, mais par securite on serialise en string.
→ En JSON, ca donne : `"id_nat": "99061534897"` au lieu de `"id_nat": 99061534897`

`public long IdNat { get; set; }`
→ Propriete auto-implementee (get et set automatiques)
→ Correspond a la colonne `id_nat` en MySQL (Dapper mappe grace a MatchNamesWithUnderscores)

`public string Nom { get; set; } = string.Empty;`
→ Initialise a string vide pour eviter les null
→ Le `= string.Empty` evite les warnings "non-nullable non initialise" du compilateur

`public string? Adresse { get; set; }`
→ Le `?` signifie NULLABLE en C# — cette propriete peut etre null
→ Correspond aux colonnes NULLABLE en MySQL

`public DateOnly DateNaissance { get; set; }`
→ Type C# moderne (pas DateTime) qui ne contient que la date, pas l'heure
→ Correspond au type DATE de MySQL
→ Dapper convertit automatiquement grace au DateOnlyTypeHandler


### 1.2 Medecin.cs

```csharp
public class Medecin
{
    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNat { get; set; }

    public string Nom { get; set; } = string.Empty;
    public string Prenom { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    [JsonIgnore]
    public string MotDePasse { get; set; } = string.Empty;

    public int IdSpecialisation { get; set; }
    public int? IdSucursale { get; set; }

    // Champs d'affichage (peuples par jointures cote Infrastructure)
    public string? Specialisation { get; set; }
    public string? Sucursale { get; set; }
}
```

POINTS IMPORTANTS :

`[JsonIgnore]`
→ Cet attribut EMPECHE le champ MotDePasse d'apparaitre dans le JSON
→ CRUCIAL pour la securite : le hash du mot de passe ne doit JAMAIS
  etre envoye au frontend, meme en version hashee
→ Sans ca, chaque GET /api/medecins renverrait le hash BCrypt

`public int? IdSucursale { get; set; }`
→ Nullable (int?) car un medecin peut ne pas etre affecte a une succursale
→ Correspond a `id_sucursale INT` (sans NOT NULL) en MySQL

`public string? Specialisation { get; set; }`
→ Ce champ N'EXISTE PAS dans la table Medecin en MySQL !
→ Il est peuple par une JOINTURE SQL dans le repository :
  `JOIN SpecialisationMedecin sp ON sp.id_specialisation = m.id_specialisation`
  avec `sp.libelle AS Specialisation`
→ Dapper mappe automatiquement l'alias SQL "Specialisation" sur cette propriete
→ C'est un "champ d'affichage" : pratique pour le frontend qui peut afficher
  "Cardiologie" directement sans faire une deuxieme requete


### 1.3 RendezVous.cs

```csharp
public class RendezVous
{
    public int IdRdv { get; set; }

    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNatPatient { get; set; }

    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNatMedecin { get; set; }

    [JsonConverter(typeof(NullableLongToStringJsonConverter))]
    public long? IdNatSecretaire { get; set; }

    public int IdSucursale { get; set; }
    public DateOnly DateRdv { get; set; }
    public TimeOnly HeureDebut { get; set; }
    public TimeOnly HeureFin { get; set; }
    public string? Motif { get; set; }
    public string Statut { get; set; } = "Planifie";

    // Champs d'affichage (jointures)
    public string? PatientNom { get; set; }
    public string? MedecinNom { get; set; }
    public string? SucursaleNom { get; set; }
}
```

`[JsonConverter(typeof(NullableLongToStringJsonConverter))]`
→ Variante du converter pour les long NULLABLE (long?)
→ IdNatSecretaire peut etre null (RDV sans secretaire)

`public TimeOnly HeureDebut { get; set; }`
→ Type C# moderne qui ne contient que l'heure (pas de date)
→ Correspond au type TIME de MySQL
→ Dapper convertit grace au TimeOnlyTypeHandler

`public string Statut { get; set; } = "Planifie";`
→ Valeur par defaut en C#
→ Les 4 valeurs possibles : "Planifie", "En cours", "Termine", "Annule"
→ La validation se fait dans le Service (pas ici)


### 1.4 Paiement.cs et PaiementHistorique.cs

```csharp
public class Paiement
{
    public int IdPaiement { get; set; }

    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNatPatient { get; set; }

    public int? IdRdv { get; set; }
    public decimal Montant { get; set; }
    public DateOnly DatePaiement { get; set; }
    public string? ModePaiement { get; set; }

    public string? PatientNom { get; set; }
}
```

`public decimal Montant { get; set; }`
→ decimal en C# = DECIMAL en MySQL
→ Precision exacte pour les montants financiers
→ JAMAIS float ou double pour de l'argent (erreurs d'arrondi)

```csharp
public class PaiementHistorique
{
    public int IdHistorique { get; set; }
    public int IdPaiement { get; set; }
    public long IdNatPatient { get; set; }
    public int? IdRdv { get; set; }
    public decimal Montant { get; set; }
    public DateOnly DatePaiement { get; set; }
    public string Operation { get; set; } = string.Empty;  // "UPDATE" ou "DELETE"
    public DateTime DateOperation { get; set; }             // quand le trigger s'est declenche
    public string? PatientNom { get; set; }
}
```

`public DateTime DateOperation { get; set; }`
→ Ici on utilise DateTime (pas DateOnly) car TIMESTAMP MySQL inclut l'heure
→ C'est la date et l'heure exacte du trigger


### 1.5 Entities simples (Sucursale, Assurance, etc.)

```csharp
public class Sucursale
{
    public int IdSucursale { get; set; }
    public string Nom { get; set; } = string.Empty;
    public string Adresse { get; set; } = string.Empty;
    public string? Telephone { get; set; }
    public string? Email { get; set; }
}
```

Pas de particularite — mapping direct colonnes MySQL → proprietes C#.

---

## 2. LES DTOs (Data Transfer Objects)

### 2.1 C'est quoi un DTO et pourquoi ?

Un DTO est un objet qui sert UNIQUEMENT au transfert de donnees entre le
frontend et le backend. Il est different de l'Entity :

| | Entity | DTO |
|---|---|---|
| But | Representer la donnee en BDD | Transferer la donnee via HTTP |
| Contient | Tous les champs (y compris mot de passe) | Uniquement ce qui est necessaire |
| Validation | Non | Oui (DataAnnotations) |
| Utilise par | Repository + Service | Controller (entree) |

EXEMPLE : quand le frontend cree un patient, il envoie un `CreatePatientDto`.
Il ne doit pas envoyer un objet Patient complet (qui pourrait contenir des
champs internes qu'il ne devrait pas pouvoir modifier).

### 2.2 CreatePatientDto

```csharp
public record CreatePatientDto(
    [Required, RegularExpression(@"^\d{11}$",
        ErrorMessage = "Le numero national doit contenir 11 chiffres.")]
    string IdNat,

    [Required, MaxLength(100)]
    string Nom,

    [Required, MaxLength(100)]
    string Prenom,

    [Required]
    DateOnly DateNaissance,

    string? Adresse,
    string? Telephone,

    [EmailAddress]
    string? Email);
```

LIGNE PAR LIGNE :

`public record` (pas class) :
→ Un record est IMMUTABLE : une fois cree, on ne peut pas changer ses valeurs
→ Ideal pour un DTO car on ne veut pas qu'il soit modifie en transit
→ Genere automatiquement Equals(), GetHashCode(), ToString()

`[Required]` :
→ DataAnnotation : ASP.NET verifie automatiquement que le champ est present
→ Si absent dans le JSON, le controller renvoie 400 Bad Request avant meme
  d'appeler le service

`[RegularExpression(@"^\d{11}$")]` :
→ Expression reguliere : exactement 11 chiffres
→ `^` = debut de chaine, `\d` = un chiffre, `{11}` = exactement 11, `$` = fin
→ Premiere couche de validation (la deuxieme est le modulo 97 dans le service)

`[MaxLength(100)]` :
→ Limite a 100 caracteres (correspond au VARCHAR(100) en MySQL)

`[EmailAddress]` :
→ Verifie le format email (contient un @, un domaine, etc.)

`string? Adresse` (sans [Required]) :
→ Champ optionnel — peut etre null ou absent du JSON

### 2.3 UpdatePatientDto

```csharp
public record UpdatePatientDto(
    [MaxLength(100)] string? Nom,
    [MaxLength(100)] string? Prenom,
    DateOnly? DateNaissance,
    string? Adresse,
    string? Telephone,
    [EmailAddress] string? Email);
```

DIFFERENCE avec Create :
- TOUT est nullable/optionnel
- Pas de [Required] nulle part
- Pas d'IdNat (on ne change pas la cle primaire !)
- Le service ne met a jour QUE les champs non-null :
  `patient.Nom = dto.Nom ?? patient.Nom;`  (si dto.Nom est null, on garde l'ancien)

### 2.4 LoginDto et AuthResponseDto

```csharp
public record LoginDto(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record AuthResponseDto(
    string Token,
    string Role,
    string Nom,
    string Prenom);
```

Le frontend envoie LoginDto, recoit AuthResponseDto.
Le Token est le JWT a stocker en localStorage.

### 2.5 CreateRendezVousDto

```csharp
public record CreateRendezVousDto(
    [Required] long IdNatPatient,
    [Required] long IdNatMedecin,
    long? IdNatSecretaire,
    [Required] int IdSucursale,
    [Required] DateOnly DateRdv,
    [Required] TimeOnly HeureDebut,
    [Required] TimeOnly HeureFin,
    string? Motif);
```

- `long? IdNatSecretaire` : optionnel (le medecin peut creer un RDV sans secretaire)
- `string? Motif` : optionnel (le motif n'est pas toujours connu a la reservation)

### 2.6 AdminStatsDto (Dashboard)

```csharp
public record AdminStatsDto(
    int TotalPatients,
    int TotalMedecins,
    int TotalSecretaires,
    int TotalSucursales,
    int RdvAujourdHui,
    int RdvCetteSemaine,
    decimal RevenuDuMois,
    int TotalPaiements);
```

Rempli par une seule requete SQL avec des sous-requetes (voir StatsRepository).

---

## 3. LES SERVICES — CHAQUE METHODE EXPLIQUEE

### 3.1 AuthService — L'authentification

```csharp
public async Task<string?> LoginAsync(string email, string password)
{
    // ETAPE 1 : chercher dans les Medecins
    var medecin = await _medecinRepository.GetByEmailAsync(email);
    if (medecin is not null)
    {
        return _passwordHasher.Verify(password, medecin.MotDePasse)
            ? GenerateToken(medecin.IdNat.ToString(), "medecin",
                            medecin.Prenom, medecin.Nom, medecin.IdSucursale)
            : null;
    }

    // ETAPE 2 : si pas trouve, chercher dans les Secretaires
    var secretaire = await _secretaireRepository.GetByEmailAsync(email);
    if (secretaire is not null)
    {
        return _passwordHasher.Verify(password, secretaire.MotDePasse)
            ? GenerateToken(secretaire.IdNat.ToString(), "secretaire",
                            secretaire.Prenom, secretaire.Nom, secretaire.IdSucursale)
            : null;
    }

    // ETAPE 3 : si toujours pas trouve, chercher dans les Administrateurs
    var admin = await _administrateurRepository.GetByEmailAsync(email);
    if (admin is not null)
    {
        return _passwordHasher.Verify(password, admin.MotDePasse)
            ? GenerateToken(admin.IdAdmin.ToString(), "admin",
                            admin.Prenom, admin.Nom, null)
            : null;
    }

    // ETAPE 4 : aucun match
    return null;
}
```

POURQUOI RETOURNER null ET PAS UNE EXCEPTION ?
→ Par securite : on ne revele pas si c'est l'email ou le mot de passe qui est faux
→ Le controller traduit null en 401 Unauthorized avec un message generique

LA GENERATION DU JWT :
```csharp
private string GenerateToken(string sub, string role, string prenom, string nom, int? sucursale)
{
    var now = DateTimeOffset.UtcNow;
    var exp = now.AddHours(_jwt.ExpiryHours);

    // HEADER : algorithme + type
    var header = new Dictionary<string, object>
    {
        ["alg"] = "HS256",   // Algorithme de signature
        ["typ"] = "JWT"       // Type de token
    };

    // PAYLOAD : les donnees (claims)
    var payload = new Dictionary<string, object>
    {
        ["sub"] = sub,             // Subject = identifiant (id_nat ou id_admin)
        ["role"] = role,           // "medecin", "secretaire", ou "admin"
        ["given_name"] = prenom,
        ["family_name"] = nom,
        ["iss"] = _jwt.Issuer,     // Qui a emis le token
        ["aud"] = _jwt.Audience,   // A qui est destine le token
        ["iat"] = now.ToUnixTimeSeconds(),   // Issued At
        ["nbf"] = now.ToUnixTimeSeconds(),   // Not Before
        ["exp"] = exp.ToUnixTimeSeconds()    // Expiration
    };
    if (sucursale.HasValue) payload["sucursale"] = sucursale.Value;

    // ENCODAGE : Header.Payload en Base64Url
    var headerSegment = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(header));
    var payloadSegment = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));
    var unsignedToken = $"{headerSegment}.{payloadSegment}";

    // SIGNATURE : HMAC-SHA256(unsignedToken, cleSecrete)
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_jwt.Key));
    var signature = hmac.ComputeHash(Encoding.UTF8.GetBytes(unsignedToken));

    // FORMAT FINAL : Header.Payload.Signature
    return $"{unsignedToken}.{Base64UrlEncode(signature)}";
}
```

LE JWT A 3 PARTIES :
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.   ← HEADER (Base64)
eyJzdWIiOiI5OTA2MTUzNDg5NyIsInJvbGUi... ← PAYLOAD (Base64)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV...   ← SIGNATURE (HMAC-SHA256)
```

Le HEADER et le PAYLOAD sont LISIBLES (pas chiffres, juste encodes).
La SIGNATURE garantit qu'ils n'ont pas ete modifies.
Si quelqu'un change le payload, la signature ne correspond plus
→ le serveur refuse le token.


### 3.2 PatientService — CRUD + dossier medical

```csharp
public async Task<long> CreateAsync(CreatePatientDto dto)
{
    // 1. Valide le NISS belge (algorithme modulo 97)
    if (!BelgianNationalNumber.IsValid(dto.IdNat))
        throw new DomainValidationException(
            "Numero de Registre National invalide (controle modulo 97).");

    // 2. Convertit la string "99061534897" en long 99061534897
    var idNat = BelgianNationalNumber.ToLong(dto.IdNat);

    // 3. Verifie que ce NISS n'existe pas deja en base
    if (await _repository.ExistsAsync(idNat))
        throw new IdNatAlreadyExistsException(idNat);

    // 4. Cree l'objet Patient depuis le DTO
    var patient = new Patient
    {
        IdNat = idNat,
        Nom = dto.Nom,
        Prenom = dto.Prenom,
        DateNaissance = dto.DateNaissance,
        Adresse = dto.Adresse,
        Telephone = dto.Telephone,
        Email = dto.Email
    };

    // 5. Delègue l'insertion au repository
    return await _repository.CreateAsync(patient);
}
```

POURQUOI CETTE SEPARATION ?
- La validation du NISS (regla metier) est dans le SERVICE
- L'insertion SQL est dans le REPOSITORY
- Le controller ne fait que recevoir la requete et appeler le service
- Chaque couche a UN seul job

```csharp
public async Task UpdateAsync(long idNat, UpdatePatientDto dto)
{
    // 1. Recuperer le patient existant (ou 404)
    var patient = await _repository.GetByIdAsync(idNat)
        ?? throw new PatientNotFoundException(idNat);

    // 2. Mettre a jour UNIQUEMENT les champs non-null
    patient.Nom = dto.Nom ?? patient.Nom;
    patient.Prenom = dto.Prenom ?? patient.Prenom;
    patient.DateNaissance = dto.DateNaissance ?? patient.DateNaissance;
    patient.Adresse = dto.Adresse ?? patient.Adresse;
    patient.Telephone = dto.Telephone ?? patient.Telephone;
    patient.Email = dto.Email ?? patient.Email;

    // 3. Sauvegarder
    await _repository.UpdateAsync(patient);
}
```

`patient.Nom = dto.Nom ?? patient.Nom;`
→ Operateur "null-coalescing" : si dto.Nom est null, on garde patient.Nom
→ Ca permet de faire un UPDATE PARTIEL : le frontend peut n'envoyer
  que les champs qu'il veut modifier


### 3.3 MedecinService — avec regles metier supplementaires

```csharp
public async Task<long> CreateAsync(CreateMedecinDto dto)
{
    // 1. Validation du NISS
    if (!BelgianNationalNumber.IsValid(dto.IdNat))
        throw new DomainValidationException("NISS invalide.");

    var idNat = BelgianNationalNumber.ToLong(dto.IdNat);

    // 2. Unicite du NISS
    if (await _repository.GetByIdAsync(idNat) is not null)
        throw new IdNatAlreadyExistsException(idNat);

    // 3. Unicite de l'email
    if (await _repository.GetByEmailAsync(dto.Email) is not null)
        throw new EmailAlreadyExistsException(dto.Email);

    // 4. Hashage du mot de passe AVANT stockage
    var medecin = new Medecin
    {
        IdNat = idNat,
        Nom = dto.Nom,
        Prenom = dto.Prenom,
        Email = dto.Email,
        MotDePasse = _passwordHasher.Hash(dto.MotDePasse),  // ← BCrypt !
        IdSpecialisation = dto.IdSpecialisation,
        IdSucursale = dto.IdSucursale
    };

    return await _repository.CreateAsync(medecin);
}
```

`_passwordHasher.Hash(dto.MotDePasse)` :
→ Transforme "monMotDePasse123" en "$2a$11$KIX7B3jF4vR..."
→ Le mot de passe en clair N'EST JAMAIS stocke en base
→ On ne peut pas retrouver le mot de passe original depuis le hash

```csharp
public async Task DeleteAsync(long idNat)
{
    // 1. Le medecin existe ?
    if (await _repository.GetByIdAsync(idNat) is null)
        throw new MedecinNotFoundException(idNat);

    // 2. REGLE METIER : impossible si RDV futurs planifies
    if (await _repository.HasRendezVousFutursAsync(idNat))
        throw new MedecinHasRendezVousException(idNat);

    // 3. OK, on peut supprimer
    await _repository.DeleteAsync(idNat);
}
```

La verification des RDV futurs est une REGLE METIER :
→ On ne supprime pas un medecin si des patients ont des RDV prevus avec lui
→ L'admin doit d'abord annuler ou reassigner les RDV


### 3.4 RendezVousService — detection de conflits

```csharp
public async Task<int> CreateAsync(CreateRendezVousDto dto)
{
    // 1. Validation : heure fin > heure debut
    if (dto.HeureFin <= dto.HeureDebut)
        throw new DomainValidationException(
            "L'heure de fin doit etre posterieure a l'heure de debut.");

    // 2. DETECTION DE CONFLIT : un medecin ne peut pas avoir 2 RDV en meme temps
    if (await _repository.HasConflitAsync(
            dto.IdNatMedecin, dto.DateRdv, dto.HeureDebut, dto.HeureFin))
        throw new RendezVousConflitException(
            dto.IdNatMedecin, dto.DateRdv, dto.HeureDebut, dto.HeureFin);

    // 3. Creation avec statut "Planifie" par defaut
    var rdv = new RendezVous { /* ... */ Statut = "Planifie" };
    return await _repository.CreateAsync(rdv);
}
```

L'ALGORITHME DE DETECTION DE CONFLIT :
Deux intervalles [A, B] et [C, D] se chevauchent si et seulement si :
  A < D ET B > C

Exemple :
- RDV existant : 10:00 → 11:00
- RDV demande  : 10:30 → 11:30
- 10:00 < 11:30 ? OUI ← le debut existant est avant la fin demandee
- 11:00 > 10:30 ? OUI ← la fin existante est apres le debut demande
- → CONFLIT !

Autre exemple :
- RDV existant : 10:00 → 11:00
- RDV demande  : 11:00 → 12:00
- 10:00 < 12:00 ? OUI
- 11:00 > 11:00 ? NON ← pas strictement superieur
- → PAS DE CONFLIT (ils sont bout a bout)


### 3.5 PaiementService — avec triggers

```csharp
public async Task UpdateAsync(int id, UpdatePaiementDto dto)
{
    var paiement = await _repository.GetByIdAsync(id)
        ?? throw new PaiementNotFoundException(id);

    paiement.Montant = dto.Montant ?? paiement.Montant;
    paiement.DatePaiement = dto.DatePaiement ?? paiement.DatePaiement;
    paiement.ModePaiement = dto.ModePaiement ?? paiement.ModePaiement;

    // Le trigger Paiement_Update_Log s'active automatiquement en BDD.
    await _repository.UpdateAsync(paiement);
}
```

Le commentaire est IMPORTANT pour l'oral :
→ Le code C# ne fait RIEN de special pour l'audit
→ C'est le TRIGGER MySQL qui detecte le UPDATE et insere dans Paiement_Historique
→ C'est completement transparent pour l'application

---

## 4. LES EXCEPTIONS METIER

### Hierarchie :

```
Exception (C# standard)
├── DomainValidationException     → 400 Bad Request
├── NotFoundException             → 404 Not Found
│   ├── PatientNotFoundException
│   ├── MedecinNotFoundException
│   ├── PaiementNotFoundException
│   └── RendezVousNotFoundException
├── RendezVousConflitException    → 409 Conflict
├── MedecinHasRendezVousException → 409 Conflict
├── SucursaleHasPersonnelException→ 409 Conflict
├── IdNatAlreadyExistsException   → 409 Conflict
└── EmailAlreadyExistsException   → 409 Conflict
```

### Comment ca marche ?

1. Le Service detecte un probleme et THROW une exception :
   ```csharp
   throw new PatientNotFoundException(idNat);
   ```

2. L'exception remonte la pile d'appels :
   Repository → Service → Controller → Middleware

3. Le ExceptionHandlingMiddleware l'intercepte :
   ```csharp
   PatientNotFoundException => (404, ex.Message)
   ```

4. Le middleware renvoie une reponse HTTP 404 avec le message en JSON :
   ```json
   { "error": "Patient introuvable (numero national 99061534897)." }
   ```

5. Angular recoit le 404, affiche le message d'erreur a l'utilisateur

AVANTAGE : les controllers n'ont PAS de try/catch !
Tout est centralise dans le middleware.

---

## 5. LES UTILITAIRES

### 5.1 BelgianNationalNumber — Validation du NISS

```csharp
public static bool IsValid(string? idNat)
{
    if (string.IsNullOrWhiteSpace(idNat)) return false;

    // Extraire uniquement les chiffres (ignorer espaces, tirets...)
    var digits = new string(idNat.Where(char.IsDigit).ToArray());
    if (digits.Length != 11) return false;

    // Les 9 premiers chiffres et les 2 derniers (checksum)
    var nine = digits.Substring(0, 9);
    if (!int.TryParse(digits.Substring(9, 2), out var cc)) return false;

    // Test 1 : personne nee AVANT 2000
    var n = long.Parse(nine);
    if (97 - (int)(n % 97) == cc) return true;

    // Test 2 : personne nee APRES 2000 (on prefixe par "2")
    var n2 = long.Parse("2" + nine);
    return 97 - (int)(n2 % 97) == cc;
}
```

L'ALGORITHME MODULO 97 :
Le NISS belge = 11 chiffres : AAMMJJNNNCC
- AA = annee de naissance
- MM = mois
- JJ = jour
- NNN = numero d'ordre (impair = homme, pair = femme)
- CC = checksum

Verification :
- Ne avant 2000 : CC = 97 - (AAMMJJNNN % 97)
- Ne apres 2000 : CC = 97 - (2AAMMJJNNN % 97)

Exemple : 99061534897
- 9 premiers : 990615348
- Checksum : 97
- 990615348 % 97 = 0 → 97 - 0 = 97 → CC = 97 ✓


### 5.2 LongToStringJsonConverter

```csharp
public sealed class LongToStringJsonConverter : JsonConverter<long>
{
    public override long Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        // Le frontend peut envoyer un nombre OU une string
        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            return long.TryParse(s, out var value) ? value : 0L;
        }
        return reader.GetInt64();
    }

    public override void Write(Utf8JsonWriter writer, long value, JsonSerializerOptions options)
        // Toujours ecrire en STRING dans le JSON
        => writer.WriteStringValue(value.ToString());
}
```

POURQUOI ?
- JavaScript Number.MAX_SAFE_INTEGER = 9 007 199 254 740 991
- Un NISS comme 99 061 534 897 < MAX_SAFE mais par securite on serialise en string
- Read() accepte les deux formats (string ou number) = robustesse
- Write() ecrit toujours en string = coherence

---

## 6. LES INTERFACES

### Principe de l'inversion de dependances

```csharp
// Dans Core/Interfaces/Repositories/IPatientRepository.cs
public interface IPatientRepository
{
    Task<IEnumerable<Patient>> GetAllAsync(string? search, int page, int pageSize);
    Task<Patient?> GetByIdAsync(long idNat);
    Task<long> CreateAsync(Patient patient);
    Task UpdateAsync(Patient patient);
    Task DeleteAsync(long idNat);
    Task<bool> ExistsAsync(long idNat);
    Task<IEnumerable<PatientMaladie>> GetMaladiesAsync(long idNat);
    Task AddMaladieAsync(PatientMaladie pm);
    Task<IEnumerable<PatientAssurance>> GetAssurancesAsync(long idNat);
    Task AddAssuranceAsync(PatientAssurance pa);
    Task RemoveAssuranceAsync(long idNat, int idAssurance);
}
```

- L'interface est dans CORE (le cerveau)
- L'implementation (PatientRepository) est dans INFRASTRUCTURE
- Le service utilise l'INTERFACE, pas l'implementation
- Le branchement se fait dans Program.cs :
  `builder.Services.AddScoped<IPatientRepository, PatientRepository>();`

AVANTAGE POUR L'ORAL :
"Si demain on veut passer de MySQL a PostgreSQL, on cree un nouveau
PatientRepositoryPostgres qui implemente IPatientRepository, on change
UNE LIGNE dans Program.cs, et le reste de l'application ne change pas."
