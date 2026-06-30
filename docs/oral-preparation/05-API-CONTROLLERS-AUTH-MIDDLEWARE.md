# 05 — MediCareManager.API — CONTROLLERS, AUTH JWT, MIDDLEWARE

## Table des matieres
1. Le Middleware d'exceptions — ligne par ligne
2. AuthController — le flux de login complet
3. PatientsController — tous les endpoints
4. RendezVousController — regles d'acces avancees
5. PaiementsController — audit et triggers
6. MedecinsController — protection par role
7. AdminController — dashboard admin
8. L'authentification JWT — comment ca marche dans chaque requete
9. L'autorisation par roles — [Authorize]

---

## 1. LE MIDDLEWARE D'EXCEPTIONS

### ExceptionHandlingMiddleware.cs — explique ligne par ligne

```csharp
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }
```

`RequestDelegate _next` :
→ C'est le PROCHAIN middleware dans le pipeline
→ L'appeler = passer la requete au middleware suivant
→ C'est une chaine : Middleware1 → Middleware2 → Middleware3 → Controller

`ILogger<ExceptionHandlingMiddleware> _logger` :
→ Logger ASP.NET pour ecrire dans la console/fichier de log
→ Injecte automatiquement par le conteneur DI

```csharp
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);    // ← On passe au middleware suivant
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);  // ← Si erreur, on la gere
        }
    }
```

`await _next(context)` :
→ Execute TOUT le reste du pipeline (CORS, Auth, Controller, etc.)
→ Si une exception est levee N'IMPORTE OU apres, elle remonte ici
→ C'est comme un try/catch GEANT autour de toute l'application

```csharp
    private async Task HandleAsync(HttpContext context, Exception ex)
    {
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

        if (status == 500)
            _logger.LogError(ex, "Erreur non geree");

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(
            JsonSerializer.Serialize(new { error = message }));
    }
}
```

`ex switch { ... }` :
→ Pattern matching C# : selon le TYPE de l'exception, on choisit le code HTTP
→ C'est l'equivalent d'une serie de if/else if mais plus elegant

MAPPING EXCEPTIONS → HTTP :
| Exception | Code HTTP | Signification |
|---|---|---|
| DomainValidationException | 400 Bad Request | Donnees invalides |
| NotFoundException | 404 Not Found | Ressource introuvable |
| RendezVousConflitException | 409 Conflict | Conflit d'horaire |
| MedecinHasRendezVousException | 409 Conflict | Suppression refusee |
| SucursaleHasPersonnelException | 409 Conflict | Suppression refusee |
| IdNatAlreadyExistsException | 409 Conflict | Doublon de NISS |
| EmailAlreadyExistsException | 409 Conflict | Doublon d'email |
| _ (tout le reste) | 500 Internal Server Error | Bug inattendu |

`_ => (500, "Erreur interne du serveur")` :
→ `_` est le wildcard : matche TOUT
→ Pour les erreurs inattendues (NullRef, timeout, bug...)
→ On NE RENVOIE PAS le vrai message d'erreur au client (securite !)
→ On log l'erreur complete cote serveur avec _logger.LogError

FORMAT DE REPONSE UNIFORME :
```json
{
  "error": "Patient introuvable (numero national 99061534897)."
}
```
→ Toujours la meme structure { "error": "..." }
→ Angular peut toujours lire response.error pour afficher le message

---

## 2. AUTH CONTROLLER — LE FLUX DE LOGIN

```csharp
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }
```

`[ApiController]` :
→ Active la validation automatique des DTOs ([Required], [EmailAddress]...)
→ Si un DTO est invalide, ASP.NET renvoie 400 AVANT d'appeler la methode

`[Route("api/[controller]")]` :
→ L'URL de base = /api/auth (le nom du controller sans "Controller")

`IAuthService _authService` :
→ Injecte par DI — le controller ne sait pas que c'est AuthService
→ Il travaille avec l'INTERFACE

```csharp
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var token = await _authService.LoginAsync(dto.Email, dto.Password);

        if (token is null)
            return Unauthorized(new { error = "Adresse e-mail ou mot de passe incorrect." });

        // Decoder le JWT pour extraire les claims (nom, role...)
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        string Claim(string type) =>
            jwt.Claims.FirstOrDefault(c => c.Type == type)?.Value ?? string.Empty;

        var response = new AuthResponseDto(
            Token: token,
            Role: Claim("role"),
            Nom: Claim("family_name"),
            Prenom: Claim("given_name"));

        return Ok(response);
    }
```

`[AllowAnonymous]` :
→ CRUCIAL ! Cette route est accessible SANS token JWT
→ C'est la seule route non-protegee (a part Swagger)
→ Logique : on ne peut pas demander un token pour obtenir un token...

`[HttpPost("login")]` :
→ Route complete : POST /api/auth/login

`[FromBody] LoginDto dto` :
→ ASP.NET lit le corps JSON de la requete et le deserialise en LoginDto
→ Les [Required] et [EmailAddress] sont verifies automatiquement

`return Unauthorized(new { error = "..." })` :
→ Retourne HTTP 401 Unauthorized
→ Message generique : ne dit PAS si c'est l'email ou le mdp qui est faux
→ Securite : empeche l'enumeration des comptes

`new JwtSecurityTokenHandler().ReadJwtToken(token)` :
→ Decode le JWT pour extraire les claims
→ On a besoin du role et du nom pour les renvoyer au frontend
→ (Le frontend pourrait aussi decoder le JWT lui-meme, mais c'est plus simple ici)

`return Ok(response)` :
→ Retourne HTTP 200 avec le JSON :
```json
{
  "token": "eyJhbGciOiJIUzI1NiI...",
  "role": "medecin",
  "nom": "Dupont",
  "prenom": "Marie"
}
```

---

## 3. PATIENTS CONTROLLER — TOUS LES ENDPOINTS

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]                          // ← TOUT le controller est protege
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patientService;

    public PatientsController(IPatientService patientService)
    {
        _patientService = patientService;
    }
```

`[Authorize]` au niveau de la CLASSE :
→ TOUTES les methodes de ce controller necessitent un JWT valide
→ Sans token → 401 Unauthorized
→ Avec token expire → 401 Unauthorized
→ Avec token invalide (signature modifiee) → 401 Unauthorized

### GET /api/patients — Liste avec recherche et pagination

```csharp
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
        => Ok(await _patientService.GetAllAsync(search, page, pageSize));
```

`[FromQuery]` : les parametres viennent de l'URL
→ GET /api/patients?search=Dupont&page=2&pageSize=10

Pas de [Authorize(Roles = ...)] supplementaire :
→ Le [Authorize] de la classe suffit → tout utilisateur connecte peut lister

### POST /api/patients — Creation (secretaire/admin only)

```csharp
    [HttpPost]
    [Authorize(Roles = "secretaire,admin")]
    public async Task<IActionResult> Create([FromBody] CreatePatientDto dto)
    {
        var idNat = await _patientService.CreateAsync(dto);
        var patient = await _patientService.GetByIdAsync(idNat);
        return CreatedAtAction(nameof(GetById), new { id = idNat }, patient);
    }
```

`[Authorize(Roles = "secretaire,admin")]` :
→ Seuls les utilisateurs avec role "secretaire" OU "admin" peuvent acceder
→ Un medecin avec un JWT valide recevra 403 Forbidden

`return CreatedAtAction(nameof(GetById), new { id = idNat }, patient)` :
→ Retourne HTTP 201 Created
→ Header "Location: /api/patients/99061534897" (URL du nouveau patient)
→ Corps : le patient complet en JSON
→ C'est la convention REST : un POST reussi retourne 201 + la ressource creee

### DELETE /api/patients/{id} — Suppression (admin only)

```csharp
    [HttpDelete("{id:long}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(long id)
    {
        await _patientService.DeleteAsync(id);
        return NoContent();
    }
```

`[Authorize(Roles = "admin")]` : SEUL l'admin peut supprimer des patients
`return NoContent()` : HTTP 204 (succes, pas de corps dans la reponse)

### GET /api/patients/{id}/maladies — Secret medical

```csharp
    [HttpGet("{id:long}/maladies")]
    [Authorize(Roles = "medecin,admin")]
    public async Task<IActionResult> GetMaladies(long id)
        => Ok(await _patientService.GetMaladiesAsync(id));
```

`[Authorize(Roles = "medecin,admin")]` :
→ Le dossier medical est un SECRET MEDICAL
→ Seuls les medecins et admins y ont acces
→ Les secretaires NE PEUVENT PAS voir les diagnostics des patients

---

## 4. RENDEZVOUS CONTROLLER — REGLES D'ACCES AVANCEES

### GET /api/rendezvous — Filtrage par succursale pour les secretaires

```csharp
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] long? medecinId,
        [FromQuery] long? patientId,
        [FromQuery] int? sucursaleId,
        [FromQuery] DateOnly? date)
    {
        // REGLE METIER : une secretaire ne voit que SA succursale
        if (User.IsInRole("secretaire") && !User.IsInRole("admin"))
        {
            var sucursale = GetSucursaleClaim();
            if (sucursale.HasValue) sucursaleId = sucursale.Value;
        }

        return Ok(await _rendezVousService.GetAllAsync(
            medecinId, patientId, sucursaleId, date));
    }
```

`User.IsInRole("secretaire")` :
→ `User` est le ClaimsPrincipal extrait du JWT par le middleware d'auth
→ Il contient tous les claims : sub, role, sucursale, etc.
→ `IsInRole` verifie le claim "role"

`GetSucursaleClaim()` :
→ Lit le claim "sucursale" du JWT (ex: 1 = Cabinet Centre)
→ FORCE le filtre sur cette succursale
→ La secretaire du Cabinet Centre ne voit QUE les RDV du Cabinet Centre

### PATCH /api/rendezvous/{id}/statut — Le medecin ne modifie que ses RDV

```csharp
    [HttpPatch("{id:int}/statut")]
    [Authorize(Roles = "secretaire,medecin,admin")]
    public async Task<IActionResult> UpdateStatut(int id, [FromBody] UpdateStatutDto dto)
    {
        // Un medecin ne peut modifier que SES PROPRES rendez-vous
        if (User.IsInRole("medecin") && !User.IsInRole("admin") && !User.IsInRole("secretaire"))
        {
            var rdv = await _rendezVousService.GetByIdAsync(id);
            if (rdv.IdNatMedecin.ToString() != GetSub())
                return Forbid();
        }

        await _rendezVousService.UpdateStatutAsync(id, dto.Statut);
        return Ok(await _rendezVousService.GetByIdAsync(id));
    }
```

`[HttpPatch("{id:int}/statut")]` :
→ PATCH = modification partielle (seulement le statut)
→ Route : PATCH /api/rendezvous/42/statut

`User.IsInRole("medecin") && !User.IsInRole("admin") && !User.IsInRole("secretaire")` :
→ Si c'est UNIQUEMENT un medecin (pas admin ni secretaire)

`rdv.IdNatMedecin.ToString() != GetSub()` :
→ GetSub() lit le claim "sub" du JWT (l'identifiant de l'utilisateur connecte)
→ On compare avec le medecin du RDV
→ Si c'est pas son RDV → return Forbid() → HTTP 403 Forbidden

EXEMPLE :
- Dr. Dupont (NISS 99061534897) se connecte
- Son JWT contient sub="99061534897", role="medecin"
- Il tente de modifier le statut du RDV #42 (medecin = 85032012345)
- 85032012345 != 99061534897 → INTERDIT !

---

## 5. PAIEMENTS CONTROLLER — AUDIT ET TRIGGERS

```csharp
    // GET /api/paiements/audit — Log d'audit (admin uniquement)
    [HttpGet("audit")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetAuditLog()
        => Ok(await _paiementService.GetAuditLogAsync());
```

Cette route retourne TOUTES les modifications/suppressions de paiements
grace a la table Paiement_Historique alimentee par les triggers MySQL.

```csharp
    // PUT /api/paiements/{id} — Declenchera le trigger UPDATE
    [HttpPut("{id:int}")]
    [Authorize(Roles = "secretaire,admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePaiementDto dto)
    {
        await _paiementService.UpdateAsync(id, dto);
        return Ok(await _paiementService.GetByIdAsync(id));
    }
```

Quand cette methode s'execute :
1. Le service met a jour le paiement via le repository
2. Le repository fait un UPDATE SQL
3. MySQL detecte le UPDATE et execute le trigger `Paiement_Update_Log`
4. Le trigger insere l'ANCIENNE valeur dans Paiement_Historique
5. L'audit est fait automatiquement, le code C# ne fait rien de special

---

## 6. L'AUTHENTIFICATION JWT — DANS CHAQUE REQUETE

### Cote Angular (envoi du token)

```typescript
// auth.interceptor.ts
intercept(req, next) {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        req = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` }
        });
    }
    return next(req);
}
```

Chaque requete HTTP envoyee par Angular contient le header :
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIi...
```

### Cote ASP.NET (verification du token)

Configure dans Program.cs :
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;   // Garder nos noms de claims
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,           // Verifier l'emetteur
            ValidateAudience = true,         // Verifier le destinataire
            ValidateLifetime = true,         // Verifier l'expiration
            ValidateIssuerSigningKey = true,  // Verifier la signature
            ValidIssuer = "...",
            ValidAudience = "...",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cle)),
            RoleClaimType = "role",          // Ou trouver le role
            NameClaimType = "sub",           // Ou trouver l'identifiant
            ClockSkew = TimeSpan.FromMinutes(1)  // Tolerance de 1 min pour l'horloge
        };
    });
```

CE QUI SE PASSE A CHAQUE REQUETE :

```
1. Le middleware d'auth lit le header "Authorization: Bearer <token>"
2. Il split le token en 3 parties : Header.Payload.Signature
3. Il decode le Header (Base64) pour connaitre l'algorithme (HS256)
4. Il recalcule la signature : HMAC-SHA256(Header.Payload, cleSecrete)
5. Il compare avec la signature du token
   → Si different : le token a ete modifie → 401 Unauthorized
6. Il decode le Payload (Base64) pour lire les claims
7. Il verifie :
   - "iss" == ValidIssuer ? (l'emetteur est correct)
   - "aud" == ValidAudience ? (le destinataire est correct)
   - "exp" > maintenant ? (le token n'est pas expire)
   - "nbf" < maintenant ? (le token est actif)
8. Si tout est OK → il cree un ClaimsPrincipal avec les claims
9. Ce ClaimsPrincipal est accessible via `User` dans les controllers
```

`ClockSkew = TimeSpan.FromMinutes(1)` :
→ Tolerance de 1 minute pour les decalages d'horloge entre machines
→ Un token qui vient d'expirer il y a 30 secondes est encore accepte

---

## 7. RESUME DES AUTORISATIONS PAR ENDPOINT

| Methode | Route | Role requis | Commentaire |
|---|---|---|---|
| POST | /api/auth/login | Aucun ([AllowAnonymous]) | Obtenir un JWT |
| GET | /api/patients | Tout connecte | Liste des patients |
| GET | /api/patients/{id} | Tout connecte | Detail d'un patient |
| POST | /api/patients | secretaire, admin | Creer un patient |
| PUT | /api/patients/{id} | secretaire, admin | Modifier un patient |
| DELETE | /api/patients/{id} | admin | Supprimer un patient |
| GET | /api/patients/{id}/maladies | medecin, admin | Secret medical |
| POST | /api/patients/{id}/maladies | medecin, admin | Ajouter un diagnostic |
| GET | /api/patients/{id}/assurances | Tout connecte | Assurances du patient |
| POST | /api/patients/{id}/assurances | secretaire, admin | Ajouter une assurance |
| DELETE | /api/patients/{id}/assurances/{ida} | secretaire, admin | Retirer une assurance |
| GET | /api/medecins | Tout connecte | Liste des medecins |
| POST | /api/medecins | admin | Creer un medecin |
| PUT | /api/medecins/{id} | admin | Modifier un medecin |
| DELETE | /api/medecins/{id} | admin | Supprimer (si pas de RDV futurs) |
| GET | /api/rendezvous | Tout connecte* | *Secretaire filtree par succursale |
| POST | /api/rendezvous | secretaire, admin | Creer un RDV (conflit detecte) |
| PUT | /api/rendezvous/{id} | secretaire, admin | Modifier un RDV |
| PATCH | /api/rendezvous/{id}/statut | secretaire, medecin*, admin | *Medecin = ses RDV seulement |
| DELETE | /api/rendezvous/{id} | secretaire, admin | Supprimer un RDV |
| GET | /api/paiements | secretaire, admin | Liste des paiements |
| POST | /api/paiements | secretaire, admin | Creer un paiement |
| PUT | /api/paiements/{id} | secretaire, admin | Modifier (trigger audit) |
| DELETE | /api/paiements/{id} | admin | Supprimer (trigger audit) |
| GET | /api/paiements/audit | admin | Historique d'audit |
| GET | /api/admin/stats | admin | Dashboard statistiques |
