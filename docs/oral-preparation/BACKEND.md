# BACKEND.md — Tout le backend C# explique pour un debutant absolu

> **Projet concerne** : MediCareManager — application web Angular + C# + Dapper + MySQL


---

## TABLE DES MATIERES

1. [Le grand schema : une requete de A a Z](#1-le-grand-schema)
2. [Les 3 projets C# et le role de chaque dossier](#2-les-3-projets-c)
3. [Les concepts C# expliques simplement](#3-les-concepts-c-expliques)
4. [Program.cs — le fichier qui demarre tout](#4-programcs)
5. [Les Controllers — les receptionnistes](#5-les-controllers)
6. [Les DTOs — les formulaires d'entree/sortie](#6-les-dtos)
7. [Les Entities — les fiches de la base de donnees](#7-les-entities)
8. [Les Services — le cerveau](#8-les-services)
9. [Les Interfaces — les contrats](#9-les-interfaces)
10. [Les Exceptions — le systeme d'erreurs](#10-les-exceptions)
11. [Le Middleware d'exceptions — le filet de securite](#11-le-middleware)
12. [L'authentification JWT — qui es-tu ?](#12-lauthentification-jwt)
13. [L'autorisation par roles — as-tu le droit ?](#13-lautorisation-par-roles)
14. [Le parcours complet d'une requete reelle](#14-parcours-complet)
15. [Les points qui pretent a confusion](#15-points-de-confusion)
16. [En resume](#16-en-resume)

---

## 1. LE GRAND SCHEMA

Avant de rentrer dans les details, voici ce qui se passe quand un
utilisateur clique sur un bouton dans l'application :

```
L'UTILISATEUR clique sur "Creer un patient"
        |
        v
┌──────────────────────────────────────────────────────┐
│  ANGULAR (le frontend, dans le navigateur)           │
│                                                      │
│  1. Le composant recupere les champs du formulaire   │
│  2. Le service Angular envoie une requete HTTP POST  │
│  3. L'interceptor ajoute le token JWT au header      │
└──────────────────────┬───────────────────────────────┘
                       │
          La requete HTTP traverse le reseau
          POST http://localhost:5000/api/patients
          Header: Authorization: Bearer eyJhbG...
          Body: { "id_nat": "99061534897", "nom": "Lemaire", ... }
                       │
                       v
┌──────────────────────────────────────────────────────┐
│  ASP.NET CORE (le backend, sur le serveur)           │
│                                                      │
│  4. Le MIDDLEWARE D'EXCEPTIONS englobe tout           │
│     (try/catch geant)                                │
│                                                      │
│  5. Le CORS verifie que la requete vient             │
│     d'Angular (localhost:4200)                       │
│                                                      │
│  6. L'AUTHENTICATION lit le token JWT,               │
│     verifie la signature, extrait le role            │
│                                                      │
│  7. L'AUTHORIZATION verifie que le role              │
│     a le droit d'acceder a cette route               │
│                                                      │
│  8. Le CONTROLLER recoit la requete et la            │
│     passe au service                                 │
│                                                      │
│  9. Le SERVICE applique les regles metier            │
│     (valider le NISS, verifier l'unicite...)         │
│                                                      │
│  10. Le REPOSITORY ecrit la requete SQL              │
│      et l'envoie a MySQL via Dapper                  │
└──────────────────────┬───────────────────────────────┘
                       │
                       v
┌──────────────────────────────────────────────────────┐
│  MySQL (la base de donnees)                          │
│                                                      │
│  11. Execute le INSERT INTO Patient ...              │
│  12. Retourne le resultat                            │
└──────────────────────┬───────────────────────────────┘
                       │
              Le chemin retour :
              MySQL → Repository → Service → Controller
              → Serialisation JSON → Reseau → Angular
              → Affichage "Patient cree !"
```

**Analogie du restaurant** :
- Le CLIENT (Angular) passe commande
- Le SERVEUR/RECEPTIONNISTE (Controller) prend la commande
- Le CHEF (Service) verifie la recette et les ingredients
- Le MAGASINIER (Repository) va chercher/stocker dans le frigo (MySQL)
- Si un probleme survient, le MANAGER (Middleware) gere la situation

---

## 2. LES 3 PROJETS C#

Le backend est divise en 3 projets C# distincts. C'est la "Clean Architecture".
Pense a 3 boites empilees :

```
┌─────────────────────────────────────────────────┐
│         MediCareManager.API                     │  ← Couche du DESSUS
│                                                 │     Recoit les requetes HTTP
│  Contient :                                     │     Renvoie les reponses HTTP
│  - Controllers/     (les receptionnistes)        │     NE fait PAS de logique metier
│  - Middleware/       (le filet de securite)       │     NE fait PAS de SQL
│  - Program.cs        (la configuration)          │
│  - appsettings.json  (les mots de passe, cles)   │
└────────────────────────┬────────────────────────┘
                         │ appelle des INTERFACES (pas les classes directement)
                         v
┌─────────────────────────────────────────────────┐
│         MediCareManager.Core                    │  ← Couche du MILIEU
│                                                 │     LE CERVEAU
│  Contient :                                     │     Toute la logique metier
│  - Entities/         (Patient, Medecin...)       │     NE connait PAS MySQL
│  - DTOs/             (les formulaires)           │     NE connait PAS ASP.NET
│  - Services/         (la logique)                │     ZERO dependance externe
│  - Interfaces/       (les contrats)              │
│  - Exceptions/       (les erreurs metier)        │
│  - Common/           (utilitaires NISS, JSON)    │
│  - Settings/         (JwtSettings)               │
└────────────────────────┬────────────────────────┘
                         │ appelle des INTERFACES de repository
                         v
┌─────────────────────────────────────────────────┐
│         MediCareManager.Infrastructure          │  ← Couche du DESSOUS
│                                                 │     L'acces aux donnees
│  Contient :                                     │     Le SEUL endroit ou il y a du SQL
│  - Repositories/     (le SQL via Dapper)         │     Le SEUL endroit avec MySQL
│  - Configuration/    (config Dapper)             │
│  - Security/         (BCrypt hashing)            │
└─────────────────────────────────────────────────┘
```

### Pourquoi 3 projets et pas un seul ?

Imagine que tu aies TOUT dans un seul projet. Si un jour tu veux
changer MySQL pour PostgreSQL, tu devrais fouiller dans TOUT le code
pour trouver les requetes SQL. Avec la Clean Architecture :
- Le SQL est UNIQUEMENT dans Infrastructure
- Tu changes Infrastructure, et le reste ne bouge pas

C'est le principe de **separation des responsabilites** :
chaque boite a UN SEUL job.

### La regle d'or : qui peut appeler qui ?

```
API          → peut utiliser Core et Infrastructure
Core         → ne peut utiliser PERSONNE (zero dependance)
Infrastructure → peut utiliser Core (pour implementer ses interfaces)
```

Core est au centre. Il ne sait meme pas que MySQL existe.
Il ne sait pas qu'il y a un serveur web.
Il connait juste ses regles metier.

---

## 3. LES CONCEPTS C# EXPLIQUES

Avant d'aller plus loin, voici chaque terme technique que tu vas
rencontrer, explique comme si tu ne connaissais rien.

### Controller (Controleur)
**C'est quoi ?** Une classe C# qui recoit les requetes HTTP et renvoie les reponses.
**Analogie :** Le receptionniste d'un hotel. Tu lui dis "je veux la chambre 42",
il ne construit pas la chambre — il transmet ta demande au bon service.
**Dans le projet :** `PatientsController.cs`, `AuthController.cs`, etc.

### Service
**C'est quoi ?** Une classe C# qui contient la logique metier (les regles).
**Analogie :** Le chef cuisinier. Il sait la recette, il verifie les ingredients,
il decide si on peut servir le plat ou pas.
**Dans le projet :** `PatientService.cs`, `AuthService.cs`, etc.
**Exemple de regle :** "On ne peut pas supprimer un medecin qui a des RDV futurs."

### Repository
**C'est quoi ?** Une classe C# qui parle a la base de donnees.
**Analogie :** Le magasinier qui va au frigo. Il sait OU sont les choses et
COMMENT les prendre/ranger. Il ne decide pas QUOI ranger — c'est le chef qui decide.
**Dans le projet :** `PatientRepository.cs`, `MedecinRepository.cs`, etc.

### Middleware
**C'est quoi ?** Un morceau de code qui intercepte CHAQUE requete HTTP
avant qu'elle arrive au controller.
**Analogie :** Le vigile a l'entree d'une boite de nuit. Il regarde ta carte
d'identite AVANT de te laisser entrer. Si tu n'es pas autorise, il te refuse.
**Dans le projet :** `ExceptionHandlingMiddleware.cs` (gestion des erreurs),
plus les middlewares integres d'ASP.NET (CORS, Authentication, Authorization).

### DTO (Data Transfer Object)
**C'est quoi ?** Un objet qui sert UNIQUEMENT a transporter des donnees
entre le frontend et le backend.
**Analogie :** Un formulaire papier. Quand tu vas chez le medecin, tu remplis
un formulaire avec ton nom, prenom, date de naissance. Ce formulaire n'EST PAS
ton dossier medical — c'est juste le formulaire d'entree.
**Dans le projet :** `CreatePatientDto`, `LoginDto`, etc.
**Pourquoi pas utiliser l'Entity directement ?** Parce que l'Entity contient
des champs internes (comme le hash du mot de passe) qu'on ne veut JAMAIS
envoyer au frontend.

### Entity (Entite)
**C'est quoi ?** Une classe C# qui represente une table de la base de donnees.
**Analogie :** La fiche complete d'un patient dans le classeur de l'hopital.
Elle contient TOUT : y compris les choses confidentielles.
**Dans le projet :** `Patient.cs`, `Medecin.cs`, `RendezVous.cs`, etc.

### Interface
**C'est quoi ?** Un "contrat" qui dit QUELLES methodes une classe doit avoir,
mais pas COMMENT les implementer.
**Analogie :** Un menu de restaurant. Le menu dit "Steak-frites : 15 euros" mais
il ne dit pas la recette. Plusieurs chefs pourraient faire le steak differemment,
tant que le resultat est un steak-frites.
**Dans le projet :** `IPatientRepository`, `IPatientService`, etc.
**Le I au debut :** Convention C# — tous les noms d'interfaces commencent par I.

### Dependency Injection (Injection de dependances = DI)
**C'est quoi ?** Au lieu qu'une classe cree elle-meme ses dependances,
on les lui DONNE (on les "injecte") de l'exterieur.
**Analogie :** Au lieu que le cuisinier aille lui-meme acheter ses ingredients
au marche, quelqu'un les lui livre. Le cuisinier ne sait meme pas QUEL
fournisseur les livre — il a juste ses ingredients.
**Dans le projet :** Configure dans `Program.cs` avec `builder.Services.AddScoped<...>()`.

### Dapper (micro-ORM)
**C'est quoi ?** Une bibliotheque C# qui execute des requetes SQL et transforme
automatiquement les resultats en objets C#.
**Analogie :** Un traducteur. Tu lui donnes une phrase en SQL, il te la retourne
en C# (et vice-versa). Contrairement a Entity Framework (qui ecrit le SQL pour toi),
avec Dapper TU ecris le SQL toi-meme.
**Pourquoi Dapper et pas Entity Framework ?** Plus rapide, plus de controle sur
le SQL, et pedagogiquement tu vois EXACTEMENT ce qui est envoye a la base.

### JWT (JSON Web Token)
**C'est quoi ?** Un "badge d'acces" que le serveur donne a l'utilisateur
apres un login reussi. L'utilisateur le presente a chaque requete pour
prouver son identite.
**Analogie :** Un badge d'entreprise. Ton nom, ton departement et ta photo
sont ecrits dessus. Le vigile le scanne pour verifier que c'est vrai et
que tu as le droit d'entrer dans le batiment.
**Structure :** 3 parties separees par des points :
`HEADER.PAYLOAD.SIGNATURE`
- HEADER : dit quel algorithme est utilise
- PAYLOAD : contient tes infos (nom, role, date d'expiration)
- SIGNATURE : preuve que personne n'a modifie le contenu

### async / await
**C'est quoi ?** Des mots-cles C# qui permettent d'executer du code
sans bloquer le serveur pendant qu'il attend une reponse (de MySQL par exemple).
**Analogie :** Quand tu commandes un cafe, tu ne restes pas plante devant
le comptoir a attendre. Tu vas t'asseoir et le serveur t'appelle quand c'est pret.
Pendant ce temps, le comptoir peut servir d'autres clients.
**Dans le projet :** Quasi TOUTES les methodes sont `async Task<...>` car
elles font des appels a la base de donnees (qui prennent du temps).

---

## 4. PROGRAM.CS — LE FICHIER QUI DEMARRE TOUT

**Fichier :** `MediCareManager.API/Program.cs`

C'est le TOUT PREMIER fichier qui s'execute quand tu lances le serveur.
Il fait 4 choses :
1. Configure les services (DI)
2. Configure la securite (JWT, CORS)
3. Configure le pipeline de middlewares
4. Demarre le serveur

### 4.1 La connection string (lignes 18-19)

```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddSingleton(connectionString);
```

Ca va lire dans `appsettings.json` :
```json
"ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=medconnect;User=root;Password=root;"
}
```

C'est l'adresse de ta base MySQL. `AddSingleton` signifie : "garde UNE SEULE
instance de cette chaine pour toute la duree de vie du serveur". Quand un
repository aura besoin de se connecter a MySQL, il recevra automatiquement
cette chaine dans son constructeur (grace a la DI).

### 4.2 L'injection de dependances (lignes 32-56)

```csharp
// Les repositories (qui parlent a MySQL)
builder.Services.AddScoped<IPatientRepository, PatientRepository>();
builder.Services.AddScoped<IMedecinRepository, MedecinRepository>();
// ...

// Les services (qui contiennent la logique)
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<IMedecinService, MedecinService>();
// ...
```

**Que veut dire cette ligne ?**
`AddScoped<IPatientRepository, PatientRepository>()` signifie :
"Quand quelqu'un demande un `IPatientRepository`, donne-lui un `PatientRepository`."

**Que veut dire `Scoped` ?**
Une NOUVELLE instance est creee pour chaque requete HTTP.
Si 3 utilisateurs font 3 requetes en meme temps, il y a 3 `PatientRepository` distincts.
A la fin de la requete, l'instance est detruite.

Les 3 modes possibles :
- `Singleton` : UNE instance pour toute la vie du serveur (la connection string)
- `Scoped` : UNE instance par requete HTTP (les repos et services)
- `Transient` : une NOUVELLE instance A CHAQUE fois qu'on la demande (pas utilise ici)

### 4.3 La configuration JWT (lignes 59-78)

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,            // Verifier qui a emis le token
            ValidateAudience = true,          // Verifier a qui il est destine
            ValidateLifetime = true,          // Verifier qu'il n'est pas expire
            ValidateIssuerSigningKey = true,   // Verifier la signature
            ValidIssuer = "MediCareManagerAPI",
            ValidAudience = "MediCareManagerClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cle)),
            RoleClaimType = "role",           // Ou trouver le role dans le token
        };
    });
```

Ca dit a ASP.NET : "A chaque requete, regarde s'il y a un header
`Authorization: Bearer <token>`. Si oui, verifie-le avec ces parametres."

### 4.4 Le pipeline de middlewares (lignes 118-131)

```csharp
app.UseMiddleware<ExceptionHandlingMiddleware>();  // 1. Attrape les erreurs
app.UseCors("Angular");                           // 2. Autorise Angular
app.UseAuthentication();                          // 3. Lit le token JWT
app.UseAuthorization();                           // 4. Verifie les droits
app.MapControllers();                             // 5. Route vers le bon controller
```

L'ORDRE COMPTE. Chaque requete traverse ces middlewares comme un tunnel,
de haut en bas. La reponse remonte de bas en haut.

---

## 5. LES CONTROLLERS — LES RECEPTIONNISTES

**Dossier :** `MediCareManager.API/Controllers/`

Un controller est une classe C# decoree avec des "attributs" (les trucs entre crochets [])
qui disent a ASP.NET comment gerer les requetes HTTP.

### 5.1 Anatomie d'un controller (PatientsController.cs)

```csharp
[ApiController]                     // Active la validation automatique
[Route("api/[controller]")]         // URL = /api/patients
[Authorize]                         // Requiert un JWT valide
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patientService;

    // Le constructeur recoit le service par DI
    public PatientsController(IPatientService patientService)
    {
        _patientService = patientService;
    }
```

Mot par mot :
- `[ApiController]` → Quand le DTO est invalide ([Required] manquant etc.),
  ASP.NET renvoie automatiquement 400 Bad Request SANS qu'on ecrive de code.
- `[Route("api/[controller]")]` → L'URL de base. `[controller]` est remplace
  par le nom de la classe sans "Controller" → `api/patients`.
- `[Authorize]` → TOUTES les methodes de ce controller necessitent un JWT valide.
  Sans token → 401 Unauthorized.
- `IPatientService _patientService` → Le controller recoit l'INTERFACE, pas la classe.
  Il ne sait pas quelle implementation est derriere. C'est la DI qui branche.

### 5.2 Les methodes du controller

Chaque methode = un endpoint (une URL + une methode HTTP) :

```csharp
// LIRE tous les patients — GET /api/patients?search=Dupont&page=1
[HttpGet]
public async Task<IActionResult> GetAll(
    [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    => Ok(await _patientService.GetAllAsync(search, page, pageSize));
```

- `[HttpGet]` → Repond aux requetes GET
- `[FromQuery]` → Les parametres viennent de l'URL apres le "?"
- `Ok(...)` → Retourne HTTP 200 avec le resultat en JSON

```csharp
// CREER un patient — POST /api/patients (secretaire ou admin)
[HttpPost]
[Authorize(Roles = "secretaire,admin")]
public async Task<IActionResult> Create([FromBody] CreatePatientDto dto)
{
    var idNat = await _patientService.CreateAsync(dto);
    var patient = await _patientService.GetByIdAsync(idNat);
    return CreatedAtAction(nameof(GetById), new { id = idNat }, patient);
}
```

- `[Authorize(Roles = "secretaire,admin")]` → Seuls ces roles peuvent acceder.
  Un medecin recevra 403 Forbidden.
- `[FromBody] CreatePatientDto dto` → Le JSON du body est transforme en objet C#.
- `CreatedAtAction(...)` → Retourne 201 Created + le patient en JSON + un header
  `Location: /api/patients/99061534897` (convention REST).

```csharp
// SUPPRIMER — DELETE /api/patients/{id} (admin uniquement)
[HttpDelete("{id:long}")]
[Authorize(Roles = "admin")]
public async Task<IActionResult> Delete(long id)
{
    await _patientService.DeleteAsync(id);
    return NoContent();    // HTTP 204 — succes, pas de corps
}
```

### 5.3 Liste de TOUS les controllers du projet

| Controller | Route de base | Qui peut y acceder | Ce qu'il gere |
|---|---|---|---|
| `AuthController` | /api/auth | Tout le monde ([AllowAnonymous]) | Login → JWT |
| `PatientsController` | /api/patients | Tout connecte (CRUD: sec/admin) | Patients + maladies + assurances |
| `MedecinsController` | /api/medecins | Tout connecte (CRUD: admin) | Medecins |
| `SecretairesController` | /api/secretaires | Admin uniquement | Secretaires |
| `RendezVousController` | /api/rendezvous | Tout connecte (CRUD: sec/admin) | Agenda, conflits d'horaire |
| `PaiementsController` | /api/paiements | Sec/admin (audit: admin) | Paiements + audit des triggers |
| `SucursalesController` | /api/sucursales | Tout connecte (CRUD: admin) | Cabinets medicaux |
| `SpecialisationsController` | /api/specialisations | Tout connecte (CRUD: admin) | Specialisations medicales |
| `AssurancesController` | /api/assurances | Tout connecte (CRUD: admin) | Mutuelles |
| `TypesMaladiesController` | /api/typesmaladies | Tout connecte (CRUD: admin) | Catalogue de maladies |
| `AdminController` | /api/admin | Admin uniquement | Dashboard statistiques |

Le POINT COMMUN de tous les controllers :
- Ils ne contiennent AUCUNE logique metier
- Ils ne contiennent AUCUN SQL
- Ils se contentent de : recevoir → deleguer au service → renvoyer la reponse

---

## 6. LES DTOs — LES FORMULAIRES D'ENTREE/SORTIE

**Dossier :** `MediCareManager.Core/DTOs/`

### Pourquoi des DTOs ?

Quand le frontend envoie "creer un patient", il ne doit PAS envoyer un
objet Patient complet (qui contient des champs internes). Il envoie un
CreatePatientDto qui ne contient QUE ce qu'il faut.

```
Frontend envoie :  CreatePatientDto  { id_nat, nom, prenom, date_naissance, email }
Backend stocke :   Patient           { IdNat, Nom, Prenom, DateNaissance, Email }
Backend repond :   Patient (en JSON)  (SANS les champs [JsonIgnore])
```

### 6.1 CreatePatientDto (PatientDtos.cs)

```csharp
public record CreatePatientDto(
    [Required, RegularExpression(@"^\d{11}$",
        ErrorMessage = "Le numero national doit contenir 11 chiffres.")]
    string IdNat,

    [Required, MaxLength(100)] string Nom,
    [Required, MaxLength(100)] string Prenom,
    [Required] DateOnly DateNaissance,
    string? Adresse,
    string? Telephone,
    [EmailAddress] string? Email);
```

Mot par mot :
- `record` (pas `class`) → immutable, ne peut pas etre modifie apres creation.
  Ideal pour un DTO car on ne veut pas qu'il change en transit.
- `[Required]` → ASP.NET refuse la requete si ce champ est absent → 400 automatique.
- `[RegularExpression(@"^\d{11}$")]` → Doit etre exactement 11 chiffres.
  `^` = debut, `\d` = un chiffre, `{11}` = 11 fois, `$` = fin.
- `string? Adresse` → Le `?` rend le champ optionnel (peut etre null).
- `[EmailAddress]` → Verifie le format email (contient un @, un domaine...).

### 6.2 UpdatePatientDto

```csharp
public record UpdatePatientDto(
    [MaxLength(100)] string? Nom,      // TOUT est optionnel
    [MaxLength(100)] string? Prenom,   // On ne met a jour que ce qu'on envoie
    DateOnly? DateNaissance,
    string? Adresse,
    string? Telephone,
    [EmailAddress] string? Email);
```

La difference avec Create : TOUT est nullable. Si le frontend envoie
`{ "nom": "Nouveau nom" }` sans les autres champs, seul le nom change.
Le service fait : `patient.Nom = dto.Nom ?? patient.Nom` (si null → garde l'ancien).

### 6.3 Tous les DTOs du projet

| DTO | Utilise par | Champs |
|---|---|---|
| `LoginDto` | POST /api/auth/login | email, password |
| `AuthResponseDto` | Reponse du login | token, role, nom, prenom |
| `CreatePatientDto` | POST /api/patients | id_nat, nom, prenom, date_naissance, adresse, tel, email |
| `UpdatePatientDto` | PUT /api/patients/{id} | nom?, prenom?, date_naissance?, adresse?, tel?, email? |
| `AddMaladieDto` | POST /api/patients/{id}/maladies | id_maladie, date_diagnostic, observations? |
| `AddAssuranceDto` | POST /api/patients/{id}/assurances | id_assurance, numero_affiliation?, dates? |
| `CreateMedecinDto` | POST /api/medecins | id_nat, nom, prenom, email, mot_de_passe, id_specialisation, id_sucursale? |
| `UpdateMedecinDto` | PUT /api/medecins/{id} | nom?, prenom?, email?, id_specialisation?, id_sucursale? |
| `CreateSecretaireDto` | POST /api/secretaires | id_nat, nom, prenom, email, mot_de_passe, id_sucursale |
| `CreateRendezVousDto` | POST /api/rendezvous | id_nat_patient, id_nat_medecin, id_sucursale, date, heures, motif? |
| `UpdateStatutDto` | PATCH /api/rendezvous/{id}/statut | statut |
| `CreatePaiementDto` | POST /api/paiements | id_nat_patient, id_rdv?, montant, date, mode? |
| `CreateSucursaleDto` | POST /api/sucursales | nom, adresse, telephone?, email? |
| `AdminStatsDto` | GET /api/admin/stats (reponse) | totalPatients, totalMedecins, rdvAujourdHui, revenuDuMois... |

---

## 7. LES ENTITIES — LES FICHES DE LA BASE DE DONNEES

**Dossier :** `MediCareManager.Core/Entities/`

Chaque Entity represente UNE TABLE MySQL. Les proprietes C# correspondent
aux colonnes de la table.

### 7.1 Patient.cs

```csharp
public class Patient
{
    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNat { get; set; }              // Colonne id_nat (BIGINT)

    public string Nom { get; set; } = string.Empty;
    public string Prenom { get; set; } = string.Empty;
    public DateOnly DateNaissance { get; set; }   // Colonne date_naissance (DATE)
    public string? Adresse { get; set; }          // Nullable = colonne sans NOT NULL
    public string? Telephone { get; set; }
    public string? Email { get; set; }
}
```

`[JsonConverter(typeof(LongToStringJsonConverter))]` → Quand on envoie le JSON
au frontend, le nombre 99061534897 est converti en STRING "99061534897".
Pourquoi ? JavaScript perd la precision des grands nombres. Un NISS belge de
11 chiffres pourrait etre arrondi par le navigateur.

`= string.Empty` → Initialise a "" pour eviter les warnings du compilateur.

`DateOnly` → Type C# moderne qui ne contient que la date (pas l'heure).

### 7.2 Medecin.cs — avec [JsonIgnore]

```csharp
public class Medecin
{
    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNat { get; set; }
    public string Nom { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    [JsonIgnore]                                   // ← JAMAIS envoye au frontend !
    public string MotDePasse { get; set; } = string.Empty;

    public int IdSpecialisation { get; set; }
    public int? IdSucursale { get; set; }          // Nullable car optionnel

    // Champs d'affichage (remplis par des JOIN SQL dans le repository)
    public string? Specialisation { get; set; }     // N'existe PAS dans la table SQL
    public string? Sucursale { get; set; }          // N'existe PAS non plus
}
```

`[JsonIgnore]` est CRUCIAL pour la securite : le hash BCrypt du mot de passe
ne doit JAMAIS apparaitre dans les reponses JSON. Sans cet attribut, chaque
GET /api/medecins renverrait le hash.

Les champs `Specialisation` et `Sucursale` n'existent pas dans la table
Medecin en MySQL. Ils sont remplis par des JOIN dans le repository :
```sql
SELECT m.*, sp.libelle AS Specialisation, su.nom AS Sucursale
FROM Medecin m
JOIN SpecialisationMedecin sp ON ...
LEFT JOIN Sucursale su ON ...
```
Dapper mappe l'alias SQL `Specialisation` sur la propriete C# `Specialisation`.

### 7.3 RendezVous.cs — la plus complexe

```csharp
public class RendezVous
{
    public int IdRdv { get; set; }

    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNatPatient { get; set; }

    [JsonConverter(typeof(LongToStringJsonConverter))]
    public long IdNatMedecin { get; set; }

    [JsonConverter(typeof(NullableLongToStringJsonConverter))]
    public long? IdNatSecretaire { get; set; }     // Nullable (RDV sans secretaire)

    public int IdSucursale { get; set; }
    public DateOnly DateRdv { get; set; }
    public TimeOnly HeureDebut { get; set; }        // Type moderne : que l'heure
    public TimeOnly HeureFin { get; set; }
    public string? Motif { get; set; }
    public string Statut { get; set; } = "Planifie"; // 4 valeurs possibles

    // Champs d'affichage (JOIN)
    public string? PatientNom { get; set; }
    public string? MedecinNom { get; set; }
    public string? SucursaleNom { get; set; }
}
```

### 7.4 Toutes les Entities du projet

| Entity | Table MySQL | Cle primaire | Particularite |
|---|---|---|---|
| `Patient` | Patient | id_nat (BIGINT) | NISS belge, pas d'auto-increment |
| `Medecin` | Medecin | id_nat (BIGINT) | [JsonIgnore] sur le mot de passe |
| `Secretaire` | Secretaire | id_nat (BIGINT) | Liee obligatoirement a une sucursale |
| `Administrateur` | Administrateur | id_admin (INT auto) | Pas de NISS, pas de sucursale |
| `RendezVous` | RendezVous | id_rdv (INT auto) | 4 FK, statut ENUM |
| `Paiement` | Paiement | id_paiement (INT auto) | DECIMAL pour le montant |
| `PaiementHistorique` | Paiement_Historique | id_historique (INT auto) | Rempli par les TRIGGERS MySQL |
| `Sucursale` | Sucursale | id_sucursale (INT auto) | Les cabinets physiques |
| `Assurance` | Assurance | id_assurance (INT auto) | Table de reference |
| `TypeMaladie` | TypeMaladie | id_maladie (INT auto) | Code CIM-10 |
| `SpecialisationMedecin` | SpecialisationMedecin | id_specialisation (INT auto) | Table de reference |
| `PatientAssurance` | PatientAssurance | (id_nat_patient, id_assurance) | Table N:M |
| `PatientMaladie` | PatientMaladie | (id_nat_patient, id_maladie) | Table N:M avec observations |

---

## 8. LES SERVICES — LE CERVEAU

**Dossier :** `MediCareManager.Core/Services/`

### 8.1 Le pattern commun a tous les services

Chaque methode d'un service suit ce schema :
1. Valider les donnees (regles metier)
2. Verifier les pre-conditions (existe en base ? doublon ?)
3. Construire l'Entity depuis le DTO
4. Appeler le repository

### 8.2 PatientService — exemple detaille

```csharp
public async Task<long> CreateAsync(CreatePatientDto dto)
{
    // 1. REGLE METIER : valider le NISS belge (algo modulo 97)
    if (!BelgianNationalNumber.IsValid(dto.IdNat))
        throw new DomainValidationException("NISS invalide.");

    // 2. Convertir string → long
    var idNat = BelgianNationalNumber.ToLong(dto.IdNat);

    // 3. Verifier l'unicite en base
    if (await _repository.ExistsAsync(idNat))
        throw new IdNatAlreadyExistsException(idNat);

    // 4. Construire l'Entity
    var patient = new Patient {
        IdNat = idNat, Nom = dto.Nom, Prenom = dto.Prenom,
        DateNaissance = dto.DateNaissance, Email = dto.Email, ...
    };

    // 5. Inserer en base
    return await _repository.CreateAsync(patient);
}
```

```csharp
public async Task UpdateAsync(long idNat, UpdatePatientDto dto)
{
    // 1. Le patient existe ?
    var patient = await _repository.GetByIdAsync(idNat)
        ?? throw new PatientNotFoundException(idNat);

    // 2. Mise a jour PARTIELLE : seuls les champs non-null changent
    patient.Nom = dto.Nom ?? patient.Nom;
    patient.Prenom = dto.Prenom ?? patient.Prenom;
    // ...

    // 3. Sauvegarder
    await _repository.UpdateAsync(patient);
}
```

L'operateur `??` (null-coalescing) : si la valeur a gauche est null,
prend la valeur a droite. Donc `dto.Nom ?? patient.Nom` signifie :
"si le frontend a envoye un nom, utilise-le ; sinon garde l'ancien".

### 8.3 AuthService — l'authentification

Le service de login cherche l'email dans 3 tables dans l'ordre :
Medecin → Secretaire → Administrateur.

```
1. Chercher dans Medecin par email
   → Trouve ? Verifier le mot de passe avec BCrypt
     → Correct ? Generer un JWT avec role="medecin"
     → Incorrect ? Retourner null (= 401)
   → Pas trouve ? Continuer...

2. Chercher dans Secretaire par email
   → Meme logique avec role="secretaire"

3. Chercher dans Administrateur par email
   → Meme logique avec role="admin"

4. Rien trouve → Retourner null (= 401)
```

Il genere le JWT A LA MAIN (sans librairie) avec HMAC-SHA256.

### 8.4 RendezVousService — detection de conflits

```csharp
public async Task<int> CreateAsync(CreateRendezVousDto dto)
{
    // REGLE : heure fin > heure debut
    if (dto.HeureFin <= dto.HeureDebut)
        throw new DomainValidationException("Heure de fin doit etre apres le debut.");

    // REGLE : pas de chevauchement d'horaire pour le meme medecin
    if (await _repository.HasConflitAsync(dto.IdNatMedecin, dto.DateRdv,
                                          dto.HeureDebut, dto.HeureFin))
        throw new RendezVousConflitException(...);

    // OK → creer le RDV avec statut "Planifie"
    var rdv = new RendezVous { ... Statut = "Planifie" };
    return await _repository.CreateAsync(rdv);
}
```

L'algo de conflit en SQL :
```
Deux intervalles [A,B] et [C,D] se chevauchent si : A < D ET B > C
```
Exemple : RDV existant 10:00-11:00, demande 10:30-11:30
→ 10:00 < 11:30 ET 11:00 > 10:30 → CONFLIT !

### 8.5 MedecinService — regles de suppression

```csharp
public async Task DeleteAsync(long idNat)
{
    if (await _repository.GetByIdAsync(idNat) is null)
        throw new MedecinNotFoundException(idNat);

    // REGLE : impossible si RDV futurs planifies
    if (await _repository.HasRendezVousFutursAsync(idNat))
        throw new MedecinHasRendezVousException(idNat);

    await _repository.DeleteAsync(idNat);
}
```

### 8.6 PaiementService — les triggers

```csharp
public async Task UpdateAsync(int id, UpdatePaiementDto dto)
{
    var paiement = await _repository.GetByIdAsync(id) ?? throw new PaiementNotFoundException(id);

    paiement.Montant = dto.Montant ?? paiement.Montant;
    // ...

    // Le trigger MySQL Paiement_Update_Log s'active AUTOMATIQUEMENT
    await _repository.UpdateAsync(paiement);
}
```

Le code C# ne fait RIEN de special pour l'audit. C'est MYSQL qui,
en detectant un UPDATE sur la table Paiement, insere automatiquement
l'ancienne valeur dans Paiement_Historique grace a un trigger.

---

## 9. LES INTERFACES — LES CONTRATS

**Dossier :** `MediCareManager.Core/Interfaces/`

### C'est quoi concretement ?

```csharp
// L'interface (le CONTRAT) — dans Core
public interface IPatientRepository
{
    Task<IEnumerable<Patient>> GetAllAsync(string? search, int page, int pageSize);
    Task<Patient?> GetByIdAsync(long idNat);
    Task<long> CreateAsync(Patient patient);
    Task UpdateAsync(Patient patient);
    Task DeleteAsync(long idNat);
    Task<bool> ExistsAsync(long idNat);
    // ...
}
```

```csharp
// L'implementation — dans Infrastructure
public class PatientRepository : BaseRepository, IPatientRepository
{
    // Ici on ecrit le VRAI code SQL avec Dapper
    public async Task<Patient?> GetByIdAsync(long idNat)
    {
        const string sql = "SELECT * FROM Patient WHERE id_nat = @IdNat";
        // ...
    }
}
```

L'interface dit QUOI faire. La classe dit COMMENT le faire.
Le service utilise l'interface (il ne sait pas qu'il y a du SQL derriere).

### Pourquoi c'est utile ?

Si demain tu veux passer de MySQL a PostgreSQL :
1. Tu crees `PatientRepositoryPostgres` qui implemente `IPatientRepository`
2. Tu changes UNE LIGNE dans Program.cs :
   `AddScoped<IPatientRepository, PatientRepositoryPostgres>()`
3. Le reste du code (services, controllers) ne change PAS

---

## 10. LES EXCEPTIONS — LE SYSTEME D'ERREURS

**Dossier :** `MediCareManager.Core/Exceptions/`

Chaque type d'erreur metier a sa propre classe. C'est plus propre
que d'utiliser des `if/return BadRequest(...)` partout dans les controllers.

```
Exception (C# de base)
│
├── DomainValidationException      → HTTP 400 Bad Request
│   "NISS invalide", "heure fin < debut"...
│
├── NotFoundException               → HTTP 404 Not Found
│   ├── PatientNotFoundException    "Patient 99061534897 introuvable"
│   ├── MedecinNotFoundException
│   ├── PaiementNotFoundException
│   └── RendezVousNotFoundException
│
├── RendezVousConflitException     → HTTP 409 Conflict
│   "Ce medecin a deja un RDV a cette heure"
│
├── MedecinHasRendezVousException  → HTTP 409 Conflict
│   "Impossible de supprimer, des RDV futurs existent"
│
├── SucursaleHasPersonnelException → HTTP 409 Conflict
│   "Impossible de supprimer, du personnel y travaille"
│
├── IdNatAlreadyExistsException    → HTTP 409 Conflict
│   "Ce numero national existe deja"
│
└── EmailAlreadyExistsException    → HTTP 409 Conflict
    "Cette adresse email est deja utilisee"
```

Chaque classe est ultra-simple, par exemple :
```csharp
public class PatientNotFoundException : NotFoundException
{
    public PatientNotFoundException(long idNat)
        : base($"Patient introuvable (numero national {idNat}).") { }
}
```

---

## 11. LE MIDDLEWARE D'EXCEPTIONS — LE FILET DE SECURITE

**Fichier :** `MediCareManager.API/Middleware/ExceptionHandlingMiddleware.cs`

```csharp
public async Task InvokeAsync(HttpContext context)
{
    try
    {
        await _next(context);    // Execute TOUT le reste (controllers, services...)
    }
    catch (Exception ex)
    {
        // Si une exception est levee N'IMPORTE OU, on arrive ici
        var (status, message) = ex switch
        {
            DomainValidationException      => (400, ex.Message),
            NotFoundException              => (404, ex.Message),
            RendezVousConflitException     => (409, ex.Message),
            MedecinHasRendezVousException  => (409, ex.Message),
            SucursaleHasPersonnelException => (409, ex.Message),
            IdNatAlreadyExistsException    => (409, ex.Message),
            EmailAlreadyExistsException    => (409, ex.Message),
            _                             => (500, "Erreur interne du serveur")
        };

        // Renvoie { "error": "Patient introuvable..." }
        context.Response.StatusCode = status;
        await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
    }
}
```

Le `_` (underscore) a la fin = "tout le reste". Pour les erreurs inattendues
(bug, timeout...), on renvoie 500 avec un message GENERIQUE (pas le vrai
message d'erreur, pour la securite).

Avantage : les controllers n'ont PAS de try/catch. Tout est centralise ici.

---

## 12. L'AUTHENTIFICATION JWT — QUI ES-TU ?

### Le flux complet du login

```
1. Angular POST /api/auth/login { email, password }
2. AuthController recoit et passe au AuthService
3. AuthService cherche l'email dans Medecin → Secretaire → Admin
4. Verifie le mot de passe avec BCrypt
5. Si correct → genere un JWT signe HMAC-SHA256 avec :
   sub = "85032012345" (identifiant)
   role = "secretaire"
   given_name = "Marie"
   family_name = "Dupont"
   sucursale = 1
   exp = dans 8 heures
6. Retourne le token au frontend
7. Angular stocke le token en memoire
8. L'interceptor Angular ajoute "Authorization: Bearer <token>" a CHAQUE requete
```

### A chaque requete suivante

```
1. Le middleware Authentication lit le header Authorization
2. Il split le token : HEADER.PAYLOAD.SIGNATURE
3. Il recalcule la signature avec la cle secrete
4. Si la signature ne correspond pas → le token a ete modifie → 401
5. Il verifie que le token n'est pas expire (claim "exp")
6. Il extrait les claims (sub, role, sucursale)
7. Il cree un objet User accessible dans les controllers
```

### Ou sont les cles et configurations ?

Dans `appsettings.json` :
```json
{
  "Jwt": {
    "Key": "MediCareManagerSuperSecretJwtKey2024AtLeast32Chars!",
    "Issuer": "MediCareManagerAPI",
    "Audience": "MediCareManagerClient",
    "ExpiryHours": 8
  }
}
```

La cle DOIT rester SECRETE. Si quelqu'un la connait, il peut fabriquer
de faux tokens valides.

---

## 13. L'AUTORISATION PAR ROLES — AS-TU LE DROIT ?

3 roles dans l'application : `admin`, `medecin`, `secretaire`.

### Comment ca marche dans les controllers

```csharp
[Authorize]                          // Tout utilisateur connecte
[Authorize(Roles = "admin")]         // Admin uniquement
[Authorize(Roles = "secretaire,admin")] // Secretaire OU admin
[Authorize(Roles = "medecin,admin")]    // Medecin OU admin
```

### Regles speciales dans RendezVousController

1. **Secretaire filtree par succursale** :
   Quand une secretaire fait GET /api/rendezvous, le controller force
   un filtre sur SA succursale (lue depuis le claim JWT "sucursale").
   Elle ne voit que les RDV de son cabinet.

2. **Medecin : que ses propres RDV** :
   Quand un medecin fait PATCH /api/rendezvous/{id}/statut, le controller
   verifie que le RDV appartient bien a ce medecin (compare le claim "sub"
   du JWT avec l'id_nat_medecin du RDV). Sinon → 403 Forbidden.

### Tableau complet des droits

| Action | Admin | Secretaire | Medecin |
|---|:---:|:---:|:---:|
| Se connecter | oui | oui | oui |
| Voir les patients | oui | oui | oui |
| Creer/modifier un patient | oui | oui | non |
| Supprimer un patient | oui | non | non |
| Voir le dossier medical (maladies) | oui | non | oui |
| Ajouter un diagnostic | oui | non | oui |
| Voir les RDV | oui | SA succursale | oui |
| Creer/modifier un RDV | oui | oui | non |
| Changer le statut d'un RDV | oui | oui | SES RDV |
| Gerer les paiements | oui | oui | non |
| Voir l'audit des paiements | oui | non | non |
| Gerer le personnel | oui | non | non |
| Voir le dashboard stats | oui | non | non |

---

## 14. PARCOURS COMPLET D'UNE REQUETE REELLE

Prenons : **La secretaire cree un rendez-vous** (le cas le plus complet car
il y a une detection de conflit).

### Fichiers traverses dans l'ordre exact :

```
FICHIER 1: patient-form.component.html (Angular)
→ La secretaire clique "Creer"

FICHIER 2: rendez-vous-form.component.ts (Angular)
→ Recupere les valeurs, appelle le service Angular

FICHIER 3: rendez-vous.service.ts (Angular)
→ HttpClient.post('/api/rendezvous', body)

FICHIER 4: auth.interceptor.ts (Angular)
→ Ajoute "Authorization: Bearer eyJ..." au header

--- RESEAU ---

FICHIER 5: Program.cs (C#)
→ La requete entre dans le pipeline de middlewares

FICHIER 6: ExceptionHandlingMiddleware.cs (C#)
→ try { _next(context) }  ← englobe tout dans un try/catch

FICHIER 7: Program.cs — CORS
→ Verifie que localhost:4200 est autorise → OK

FICHIER 8: Program.cs — Authentication
→ Decode le JWT, verifie la signature → OK
→ Extrait : sub=85032012345, role=secretaire, sucursale=1

FICHIER 9: Program.cs — Authorization
→ [Authorize(Roles = "secretaire,admin")] → secretaire est dans la liste → OK

FICHIER 10: RendezVousController.cs (C#)
→ [FromBody] CreateRendezVousDto dto ← deserialise le JSON
→ Verifie les [Required] du DTO → OK
→ Appelle _rendezVousService.CreateAsync(dto)

FICHIER 11: RendezVousDtos.cs (C#)
→ Le DTO dans lequel le JSON a ete deserialise

FICHIER 12: RendezVousService.cs (C#)
→ Verifie heureFin > heureDebut → OK
→ Appelle _repository.HasConflitAsync(...)

FICHIER 13: RendezVousRepository.cs (C#)
→ SQL : SELECT COUNT(*) FROM RendezVous WHERE ... (detection conflit)
→ Dapper envoie a MySQL → MySQL repond 0 → pas de conflit

FICHIER 14: RendezVousService.cs (C#) — suite
→ Pas de conflit → cree l'objet RendezVous
→ Appelle _repository.CreateAsync(rdv)

FICHIER 15: BaseRepository.cs (C#)
→ ExecuteInTransactionAsync : ouvre connexion, BEGIN TRANSACTION

FICHIER 16: RendezVousRepository.cs (C#) — CreateAsync
→ SQL : INSERT INTO RendezVous (...) VALUES (...); SELECT LAST_INSERT_ID();
→ Dapper envoie a MySQL

FICHIER 17: MySQL
→ Insere la ligne → retourne l'id

FICHIER 18: BaseRepository.cs (C#)
→ COMMIT → la transaction est validee

--- CHEMIN RETOUR ---

FICHIER 19: RendezVousController.cs (C#)
→ Recoit l'id → refait un GetByIdAsync pour avoir le RDV complet
→ return CreatedAtAction(...) → HTTP 201

FICHIER 20: Program.cs — serialisation JSON
→ Les proprietes PascalCase deviennent snake_case
→ Les long deviennent des strings grace au converter

--- RESEAU ---

FICHIER 21: rendez-vous.service.ts (Angular)
→ Recoit le HTTP 201 avec le JSON du RDV

FICHIER 22: rendez-vous-form.component.ts (Angular)
→ Affiche "Rendez-vous cree" et redirige vers l'agenda
```

---

## 15. LES POINTS QUI PRETENT A CONFUSION

### "Pourquoi il y a des interfaces ET des classes ?"

L'interface dit QUOI. La classe dit COMMENT.
Le service connait le QUOI (il appelle IPatientRepository.CreateAsync).
Il ne sait pas le COMMENT (il ne sait pas que c'est du SQL MySQL derriere).
Ca permet de changer le COMMENT sans toucher au QUOI.

### "Pourquoi il y a des DTOs ET des Entities ?"

Le DTO = ce que le frontend peut ENVOYER (champs limites, validation).
L'Entity = ce que la base CONTIENT (tous les champs, y compris les secrets).
On ne veut pas que le frontend puisse envoyer un mot de passe hash ou modifier
des champs internes.

### "Pourquoi les controllers ne font rien ?"

C'est le principe de separation : le controller RECOIT et TRANSMET.
La logique est dans le service. Si la logique etait dans le controller,
elle serait impossible a tester sans lancer un serveur web complet.

### "C'est quoi la difference entre 401 et 403 ?"

- 401 Unauthorized = "Je ne sais pas QUI tu es" (pas de token, token invalide)
- 403 Forbidden = "Je sais QUI tu es, mais tu n'as PAS LE DROIT" (mauvais role)

### "Pourquoi snake_case dans le JSON mais PascalCase en C# ?"

Convention : C# utilise PascalCase (IdNat), JavaScript/Angular utilise snake_case (id_nat).
La conversion est automatique dans les deux sens grace a `SnakeCaseLower` dans Program.cs
et `MatchNamesWithUnderscores = true` dans Dapper.

### "Comment le mot de passe est-il protege ?"

1. Le frontend envoie le mot de passe en clair (mais en HTTPS donc chiffre en transit)
2. Le service le hash avec BCrypt AVANT de le stocker
3. En base, il y a "$2a$11$KIX7B3j..." (le hash, pas le mot de passe)
4. Pour verifier, BCrypt rehash le mot de passe fourni et compare les hash
5. Le champ [JsonIgnore] empeche le hash d'apparaitre dans les reponses JSON

---

## 16. EN RESUME

Le backend MediCareManager suit la **Clean Architecture** en 3 projets :

- **API** : recoit les requetes HTTP, verifie l'authentification et les roles,
  delegue aux services. Ne contient ni logique metier ni SQL.

- **Core** : contient TOUTE la logique metier (validation NISS, detection de conflits,
  regles de suppression). Definit les interfaces que l'Infrastructure doit implementer.
  Ne depend de RIEN d'externe.

- **Infrastructure** : contient le SQL (via Dapper), le hachage BCrypt, et la
  configuration de la connexion MySQL. C'est le SEUL endroit qui sait que MySQL existe.

Le flux d'une requete est toujours :
```
Angular → HTTP → Middleware → Controller → Service → Repository → MySQL
```

La securite repose sur :
- **JWT** pour l'authentification (qui es-tu ?)
- **[Authorize(Roles)]** pour l'autorisation (as-tu le droit ?)
- **BCrypt** pour les mots de passe (jamais stockes en clair)
- **Requetes parametrees Dapper** pour empecher l'injection SQL
- **ExceptionHandlingMiddleware** pour ne jamais exposer de details techniques au frontend
