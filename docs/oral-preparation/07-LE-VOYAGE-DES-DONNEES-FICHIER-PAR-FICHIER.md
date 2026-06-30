# LE VOYAGE DES DONNEES — FICHIER PAR FICHIER, LIGNE PAR LIGNE

Imagine que tu es une donnee. Tu es le numero national "99061534897" que
la secretaire vient de taper dans le formulaire. Ce document te raconte
TON voyage a travers CHAQUE fichier du projet, de l'ecran jusqu'a la
base de donnees MySQL, puis le chemin retour jusqu'a l'ecran.

On va faire 2 voyages complets :
- VOYAGE A : La secretaire se connecte (LOGIN)
- VOYAGE B : La secretaire cree un patient

Pour chaque etape, je te donne :
- Le NOM DU FICHIER exact
- Les LIGNES exactes du code qui s'executent
- POURQUOI on passe par ce fichier
- CE QUI SE PASSE concretement

C'est parti.

================================================================================
================================================================================

                    VOYAGE A : LA SECRETAIRE SE CONNECTE

================================================================================
================================================================================

La secretaire Marie Dupont ouvre l'app, voit le formulaire de login,
tape son email "marie.dupont@medicare.be" et son mot de passe "SecretPass123",
puis clique sur "Se connecter".

Voici EXACTEMENT ce qui se passe, fichier par fichier.


================================================================================
ARRET 1 — Le formulaire HTML ou la secretaire a clique
FICHIER : medicare-frontend/src/app/features/auth/login/login.component.html
================================================================================

Quelque part dans ce fichier, il y a un formulaire avec un bouton.
Quand la secretaire clique sur "Se connecter", Angular detecte le
(ngSubmit) et appelle la methode du composant TypeScript.

POURQUOI CE FICHIER ? C'est le point de depart. Tout commence par un clic
de l'utilisateur sur un bouton HTML. Le HTML ne fait rien de logique,
il dit juste "quand on clique, appelle cette methode TypeScript".


================================================================================
ARRET 2 — Le composant TypeScript qui reagit au clic
FICHIER : medicare-frontend/src/app/features/auth/login/login.component.ts
================================================================================

Ce composant recupère les valeurs du formulaire (email + password) et
appelle le service d'authentification :

    this.authService.login({ email, password }).subscribe(...)

POURQUOI CE FICHIER ? C'est le "chef d'orchestre" de la page login.
Il ne sait PAS comment fonctionne l'authentification. Il dit juste
au service : "voila un email et un mot de passe, debrouille-toi".


================================================================================
ARRET 3 — Le service Angular qui envoie la requete HTTP
FICHIER : medicare-frontend/src/app/core/services/auth.service.ts
LIGNES CLES : 27-36
================================================================================

```typescript
login(dto: LoginDto): Observable<void> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, dto).pipe(
      tap(response => {
        this.tokenSignal.set(response.token);
        this.roleSignal.set(response.role as UserRole);
        this.nomSignal.set(`${response.prenom} ${response.nom}`);
        this.userIdSignal.set(this.extractSub(response.token));
      }),
      map(() => void 0)
    );
  }
```

CE QUI SE PASSE LIGNE PAR LIGNE :

- Ligne 28 : `this.http.post<AuthResponse>(...)` — Angular cree une requete HTTP
  de type POST vers l'URL http://localhost:5000/api/auth/login.
  Le corps (body) de la requete contient le JSON :
  { "email": "marie.dupont@medicare.be", "password": "SecretPass123" }

- `this.apiUrl` vient du fichier environment.ts (ligne 4) :
  `apiUrl: 'http://localhost:5000/api'` + `/auth` = l'URL complete

- Ligne 30 : `this.tokenSignal.set(response.token)` — Quand la reponse reviendra
  du serveur (on n'y est pas encore !), on stockera le token JWT en memoire

- Ligne 31-33 : on stocke aussi le role, le nom complet et l'id utilisateur

POURQUOI CE FICHIER ? C'est le "messager". Il transforme l'action de
l'utilisateur ("je veux me connecter") en requete HTTP concrete.
Il utilise HttpClient d'Angular pour envoyer la requete.

MAIS ATTENTION : avant que la requete parte vraiment vers le serveur,
elle passe d'abord par l'interceptor...


================================================================================
ARRET 4 — L'interceptor Angular (ajoute le token JWT)
FICHIER : medicare-frontend/src/app/core/interceptors/auth.interceptor.ts
LIGNES CLES : 10-17
================================================================================

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (token) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
```

CE QUI SE PASSE :

- Ligne 11 : il regarde si on a deja un token JWT stocke en memoire
- Pour le LOGIN, c'est notre PREMIERE requete — on n'a PAS encore de token
- Donc `token` est null → on passe dans le else (ligne 16)
- `return next(req)` → la requete part telle quelle, SANS header Authorization

POURQUOI CE FICHIER ? L'interceptor est un "gardien" qui inspecte CHAQUE
requete HTTP avant qu'elle parte. Pour le login, il ne fait rien car on
n'est pas encore connecte. Mais pour TOUTES les requetes suivantes (creer
un patient, voir l'agenda...), il ajoutera automatiquement le token JWT.

C'est branche dans app.config.ts ligne 21 :
`provideHttpClient(withInterceptors([authInterceptor]))`
Ca dit a Angular : "pour chaque requete HTTP, passe-la d'abord par cet interceptor".


================================================================================
ARRET 5 — L'interceptor est configure ici
FICHIER : medicare-frontend/src/app/app.config.ts
LIGNE CLE : 21
================================================================================

```typescript
provideHttpClient(withInterceptors([authInterceptor])),
```

C'est ICI qu'on dit a Angular : "branche cet interceptor sur HttpClient".
Sans cette ligne, l'interceptor ne serait jamais appele et aucune requete
n'aurait le header Authorization.

--- LA REQUETE HTTP QUITTE MAINTENANT LE NAVIGATEUR ---
--- ELLE TRAVERSE LE RESEAU VERS LE SERVEUR C# ---

La requete qui part :
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json
Origin: http://localhost:4200

{ "email": "marie.dupont@medicare.be", "password": "SecretPass123" }
```


================================================================================
ARRET 6 — Le point d'entree du serveur C#
FICHIER : MediCareManager.API/Program.cs
LIGNES CLES : 118-131
================================================================================

```csharp
var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseMiddleware<ExceptionHandlingMiddleware>();  // ← ARRET 7
app.UseCors("Angular");                           // ← ARRET 8
app.UseAuthentication();                          // ← ARRET 9
app.UseAuthorization();                           // ← ARRET 10
app.MapControllers();                             // ← ARRET 11

app.Run();
```

CE QUI SE PASSE :

La requete HTTP arrive sur le serveur. ASP.NET la fait passer par chaque
middleware dans l'ordre. C'est comme un TUNNEL : la requete traverse
chaque etape une par une.

POURQUOI CE FICHIER ? C'est le "chef de gare" du serveur. Il decide
l'ordre dans lequel chaque middleware traite la requete. L'ordre
est TRES important : si on met Authentication avant CORS, ca ne marche pas.


================================================================================
ARRET 7 — Le middleware qui attrape les erreurs
FICHIER : MediCareManager.API/Middleware/ExceptionHandlingMiddleware.cs
LIGNES CLES : 22-28
================================================================================

```csharp
public async Task InvokeAsync(HttpContext context)
{
    try
    {
        await _next(context);   // "Passe au middleware suivant"
    }
    catch (Exception ex)
    {
        await HandleAsync(context, ex);  // "Si erreur, je m'en occupe"
    }
}
```

CE QUI SE PASSE :

Le middleware enveloppe TOUT le reste dans un try/catch.
- `await _next(context)` = "passe la requete au prochain middleware (CORS)"
- Si tout se passe bien, la reponse revient normalement
- Si une exception est levee N'IMPORTE OU plus loin, elle remonte ici
  et le catch la transforme en reponse HTTP propre (400, 404, 409, 500)

POUR LE LOGIN : pas d'erreur pour l'instant, la requete continue son chemin.

POURQUOI CE FICHIER ? C'est le "filet de securite". Sans lui, une exception
non geree ferait crasher le serveur ou enverrait une stack trace C# au
navigateur (ce qui serait un probleme de securite).


================================================================================
ARRET 8 — CORS : le serveur autorise Angular
FICHIER : MediCareManager.API/Program.cs
LIGNES CLES : 83-87
================================================================================

```csharp
builder.Services.AddCors(options => options.AddPolicy("Angular",
    p => p.WithOrigins("http://localhost:4200")
          .AllowAnyMethod()
          .AllowAnyHeader()
          .AllowCredentials()));
```

CE QUI SE PASSE :

Le navigateur a envoye un header "Origin: http://localhost:4200".
Le serveur verifie : est-ce que localhost:4200 est dans ma liste ?
→ OUI (ligne 84) → la requete est autorisee a continuer.

Si la requete venait d'un site malveillant (Origin: http://hackeur.com),
le serveur bloquerait la requete ici.

POURQUOI ? Securite du navigateur. Sans CORS, n'importe quel site web
pourrait envoyer des requetes a notre API en se faisant passer pour Angular.


================================================================================
ARRET 9 — Authentication : verification du token JWT
FICHIER : MediCareManager.API/Program.cs
LIGNES CLES : 59-78
================================================================================

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { ... });
```

CE QUI SE PASSE :

Le middleware d'authentification regarde : "est-ce qu'il y a un header
Authorization: Bearer <token> dans cette requete ?"
→ Pour le LOGIN : NON, il n'y a PAS de header Authorization
→ Le middleware note : "utilisateur = anonyme" et laisse passer

POURQUOI ? A cette etape, le serveur essaie juste de SAVOIR qui fait la requete.
Il ne bloque rien — c'est l'autorisation (etape suivante) qui decide si on bloque.


================================================================================
ARRET 10 — Authorization : est-ce que l'utilisateur a le droit ?
================================================================================

Le middleware d'autorisation regarde le controller qu'on va appeler.
Le AuthController a `[AllowAnonymous]` sur la methode Login.
→ Pas besoin d'etre connecte → on laisse passer.

POURQUOI [AllowAnonymous] ? Parce que c'est le LOGIN !
On ne peut pas demander a quelqu'un d'etre connecte pour se connecter...
C'est la seule route publique de toute l'application.


================================================================================
ARRET 11 — Le routage : quelle methode appeler ?
================================================================================

ASP.NET regarde l'URL et la methode HTTP :
- POST /api/auth/login
- Il cherche un controller avec [Route("api/[controller]")] ou [controller] = "auth"
  → C'est AuthController
- Il cherche une methode avec [HttpPost("login")]
  → C'est la methode Login

La requete arrive maintenant dans le controller.


================================================================================
ARRET 12 — Le Controller qui recoit la requete
FICHIER : MediCareManager.API/Controllers/AuthController.cs
LIGNES CLES : 21-39
================================================================================

```csharp
[AllowAnonymous]
[HttpPost("login")]
public async Task<IActionResult> Login([FromBody] LoginDto dto)
{
    var token = await _authService.LoginAsync(dto.Email, dto.Password);
    if (token is null)
        return Unauthorized(new { error = "Adresse e-mail ou mot de passe incorrect." });

    var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
    string Claim(string type) => jwt.Claims.FirstOrDefault(c => c.Type == type)?.Value ?? "";

    var response = new AuthResponseDto(
        Token: token,
        Role: Claim("role"),
        Nom: Claim("family_name"),
        Prenom: Claim("given_name"));

    return Ok(response);
}
```

CE QUI SE PASSE LIGNE PAR LIGNE :

1. `[FromBody] LoginDto dto` — ASP.NET prend le JSON du corps de la requete
   et le transforme en objet LoginDto. Le JSON etait :
   { "email": "marie.dupont@medicare.be", "password": "SecretPass123" }
   Il verifie aussi les [Required] et [EmailAddress] du DTO.

2. `await _authService.LoginAsync(dto.Email, dto.Password)` — Le controller
   NE SAIT PAS comment l'authentification fonctionne. Il delegue au service.
   _authService est une interface (IAuthService) injectee par DI.

3. Si le service retourne null → 401 Unauthorized

4. Si le service retourne un token → on le decode pour extraire le role et
   le nom, puis on renvoie le tout au client avec 200 OK

POURQUOI CE FICHIER ? Le controller est le "receptionniste". Il recoit la
requete HTTP, la traduit en appel de methode C#, et traduit le resultat
en reponse HTTP. Il ne contient AUCUNE logique metier.


================================================================================
ARRET 13 — Le DTO qui valide les donnees d'entree
FICHIER : MediCareManager.Core/DTOs/AuthDtos.cs
LIGNES CLES : 5-6
================================================================================

```csharp
public record LoginDto(
    [Required, EmailAddress] string Email,
    [Required] string Password);
```

CE QUI SE PASSE :

AVANT meme que le controller s'execute, ASP.NET verifie :
- Email present ? → OUI ✓
- Email au format valide ? → "marie.dupont@medicare.be" contient un @ → OUI ✓
- Password present ? → OUI ✓

Si un de ces checks echouait, ASP.NET renverrait immediatement 400 Bad Request
SANS jamais appeler le controller.

POURQUOI CE FICHIER ? C'est la "premiere ligne de defense". On refuse les
donnees mal formees le plus tot possible, avant de faire quoi que ce soit.


================================================================================
ARRET 14 — Le service d'authentification (la logique)
FICHIER : MediCareManager.Core/Services/AuthService.cs
LIGNES CLES : 37-65
================================================================================

```csharp
public async Task<string?> LoginAsync(string email, string password)
{
    // ETAPE 1 : chercher dans les Medecins
    var medecin = await _medecinRepository.GetByEmailAsync(email);
    if (medecin is not null)
    {
        return _passwordHasher.Verify(password, medecin.MotDePasse)
            ? GenerateToken(medecin.IdNat.ToString(), "medecin", ...)
            : null;
    }

    // ETAPE 2 : chercher dans les Secretaires
    var secretaire = await _secretaireRepository.GetByEmailAsync(email);
    if (secretaire is not null)
    {
        return _passwordHasher.Verify(password, secretaire.MotDePasse)
            ? GenerateToken(secretaire.IdNat.ToString(), "secretaire", ...)
            : null;
    }

    // ETAPE 3 : chercher dans les Administrateurs
    var admin = await _administrateurRepository.GetByEmailAsync(email);
    if (admin is not null) { ... }

    return null;
}
```

CE QUI SE PASSE POUR NOTRE SECRETAIRE :

1. On cherche "marie.dupont@medicare.be" dans la table Medecin → PAS TROUVE
2. On cherche dans la table Secretaire → TROUVE !
   Le repository retourne l'objet Secretaire avec le hash du mot de passe
3. _passwordHasher.Verify("SecretPass123", "$2a$11$KIX7B3j...")
   BCrypt rehash "SecretPass123" avec le meme salt → les hash correspondent → TRUE
4. On genere un JWT avec les claims : sub="85032012345", role="secretaire",
   given_name="Marie", family_name="Dupont", sucursale=1

POURQUOI CE FICHIER ? C'est le "cerveau" de l'authentification. Il contient
la LOGIQUE METIER : dans quel ordre chercher, comment verifier, quels claims
mettre dans le token. Il ne sait PAS comment la base de donnees fonctionne
(il utilise des interfaces de repository).


================================================================================
ARRET 15 — Le repository qui cherche dans MySQL
FICHIER : MediCareManager.Infrastructure/Repositories/SecretaireRepository.cs
LIGNES CLES : 38-46
================================================================================

```csharp
public async Task<Secretaire?> GetByEmailAsync(string email)
{
    const string sql = @"
        SELECT id_nat, nom, prenom, email, mot_de_passe, id_sucursale
        FROM Secretaire WHERE email = @Email;";

    using var connection = CreateConnection();
    return await connection.QueryFirstOrDefaultAsync<Secretaire>(sql, new { Email = email });
}
```

CE QUI SE PASSE :

1. `CreateConnection()` — cree une connexion TCP vers MySQL (herite de BaseRepository)
2. Le SQL `WHERE email = @Email` est envoye a MySQL avec le parametre
   @Email = "marie.dupont@medicare.be"
3. MySQL cherche dans la table Secretaire et trouve la ligne
4. Dapper mappe les colonnes SQL sur l'objet Secretaire :
   id_nat → IdNat, nom → Nom, mot_de_passe → MotDePasse, etc.
   (grace a MatchNamesWithUnderscores = true dans DatabaseConfiguration.cs)
5. Retourne l'objet Secretaire au service

POURQUOI CE FICHIER ? C'est le SEUL endroit ou on parle SQL. Le service
(Core) ne sait pas que c'est MySQL derriere. Il pourrait y avoir PostgreSQL,
MongoDB, ou meme un fichier JSON — le service s'en fiche, il appelle juste
l'interface ISecretaireRepository.


================================================================================
ARRET 16 — Le hachage du mot de passe
FICHIER : MediCareManager.Infrastructure/Security/BCryptPasswordHasher.cs
LIGNES CLES : 10-16
================================================================================

```csharp
public bool Verify(string password, string hash)
{
    try { return BCrypt.Net.BCrypt.Verify(password, hash); }
    catch { return false; }
}
```

CE QUI SE PASSE :

- password = "SecretPass123" (ce que la secretaire a tape)
- hash = "$2a$11$KIX7B3j..." (ce qui est stocke en base)
- BCrypt extrait le salt du hash stocke
- BCrypt rehash "SecretPass123" avec ce salt
- Compare les deux hash → ils correspondent → retourne TRUE

POURQUOI CE FICHIER ? On ne stocke JAMAIS les mots de passe en clair.
Si la base de donnees est volee, l'attaquant n'a que des hash inutilisables.


================================================================================
ARRET 17 — Generation du JWT
FICHIER : MediCareManager.Core/Services/AuthService.cs
LIGNES CLES : 67-100
================================================================================

Le service cree un token JWT avec :
- Header : { "alg": "HS256", "typ": "JWT" }
- Payload : { "sub": "85032012345", "role": "secretaire",
              "given_name": "Marie", "family_name": "Dupont",
              "sucursale": 1, "exp": <dans 8 heures> }
- Signature : HMAC-SHA256 de (Header.Payload) avec la cle secrete

Le token final est une longue chaine : "eyJhbGci.eyJzdWI.signature"

--- LA REPONSE REMONTE MAINTENANT ---
--- Service → Controller → Middleware → Reseau → Angular ---


================================================================================
ARRET 18 — Retour dans le Controller
FICHIER : MediCareManager.API/Controllers/AuthController.cs
================================================================================

Le service a retourne le token. Le controller construit la reponse :
```csharp
return Ok(new AuthResponseDto(Token: token, Role: "secretaire",
                               Nom: "Dupont", Prenom: "Marie"));
```

ASP.NET serialise en JSON (avec snake_case grace a Program.cs) :
```json
{
  "token": "eyJhbGci...",
  "role": "secretaire",
  "nom": "Dupont",
  "prenom": "Marie"
}
```

Envoie HTTP 200 OK au navigateur.


================================================================================
ARRET 19 — Retour dans Angular
FICHIER : medicare-frontend/src/app/core/services/auth.service.ts
LIGNES CLES : 29-33
================================================================================

```typescript
tap(response => {
    this.tokenSignal.set(response.token);       // Stocke le JWT
    this.roleSignal.set(response.role);          // Stocke "secretaire"
    this.nomSignal.set(`${response.prenom} ${response.nom}`);  // "Marie Dupont"
    this.userIdSignal.set(this.extractSub(response.token));    // "85032012345"
})
```

Le token est maintenant en memoire. La secretaire est connectee.
La navbar affiche "Marie Dupont" et les menus visibles dependent du role.

FIN DU VOYAGE A. La secretaire est connectee.


================================================================================
================================================================================

               VOYAGE B : LA SECRETAIRE CREE UN PATIENT

================================================================================
================================================================================

La secretaire va sur la page "Nouveau patient" et remplit le formulaire :
- N° National : 99061534897
- Nom : Lemaire
- Prenom : Thomas
- Date naissance : 1999-06-15
- Email : thomas.lemaire@gmail.com

Elle clique sur "Creer".


================================================================================
ARRET 1 — Le bouton HTML
FICHIER : medicare-frontend/src/app/features/patients/patient-form/patient-form.component.html
LIGNE CLE : 8
================================================================================

```html
<form [formGroup]="form" (ngSubmit)="submit()" class="patient-form">
```

`(ngSubmit)="submit()"` — Quand le formulaire est soumis (clic sur le bouton
"Creer" ou touche Entree), Angular appelle la methode `submit()` du composant.

Ligne 64-65 : le bouton Creer :
```html
<button mat-raised-button color="primary" type="submit"
        [disabled]="form.invalid || saving()">
    {{ isEdit() ? 'Mettre à jour' : 'Créer' }}
</button>
```

Le bouton est DESACTIVE si le formulaire est invalide (un champ [Required]
est vide, ou le NISS est invalide). Ca empeche l'envoi de donnees pourries.


================================================================================
ARRET 2 — Le composant TypeScript qui reagit au clic
FICHIER : medicare-frontend/src/app/features/patients/patient-form/patient-form.component.ts
LIGNES CLES : 81-117
================================================================================

```typescript
submit(): void {
    if (this.form.invalid) {           // Double verification (securite)
      this.form.markAllAsTouched();    // Affiche les erreurs
      return;                          // Arrete tout
    }
    this.saving.set(true);             // Affiche un spinner "en cours..."
    const v = this.form.getRawValue(); // Recupere les valeurs du formulaire

    // On est en mode CREATION (pas edition)
    this.patientService.create({
      id_nat: v.id_nat.replace(/\D/g, ''),  // Enleve tout sauf les chiffres
      nom: v.nom,
      prenom: v.prenom,
      date_naissance: v.date_naissance,
      adresse: v.adresse || undefined,       // "" devient undefined (= pas envoye)
      telephone: v.telephone || undefined,
      email: v.email || undefined
    }).subscribe({
      next: () => this.onSuccess('Patient cree.'),   // Si ca marche
      error: (err) => this.onError(err)               // Si erreur
    });
}
```

CE QUI SE PASSE :

1. Ligne 82 : `if (this.form.invalid)` — recheck que tout est valide
   (le bouton etait deja desactive mais on est prudent)

2. Ligne 87 : `this.form.getRawValue()` — prend les valeurs de tous les champs

3. Ligne 104 : `v.id_nat.replace(/\D/g, '')` — enleve les espaces, tirets, etc.
   Si l'utilisateur a tape "990.615.348-97", ca devient "99061534897"

4. Ligne 109 : `v.adresse || undefined` — si l'adresse est vide (""),
   on envoie undefined au lieu de "" (le backend traitera comme null)

5. `.subscribe(...)` — DECLENCHE l'appel HTTP. Sans subscribe, RIEN ne se passe !
   C'est le concept d'Observable en Angular : la requete ne part que quand
   quelqu'un s'y "abonne" (subscribe).

MAIS AVANT : le composant ne sait pas comment envoyer une requete HTTP.
Il delegue au service PatientService...


================================================================================
ARRET 3 — Le validateur de NISS cote Angular
FICHIER : medicare-frontend/src/app/features/patients/patient-form/patient-form.component.ts
LIGNES CLES : 19-29
================================================================================

```typescript
export function idNatValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = (control.value ?? '').toString().replace(/\D/g, '');
    if (!val || val.length !== 11) return { idNat: 'Doit contenir 11 chiffres' };
    const n = BigInt(val.substring(0, 9));
    const cc = parseInt(val.substring(9, 11), 10);
    if (97 - Number(n % 97n) === cc) return null;       // Ne avant 2000
    const n2 = BigInt('2' + val.substring(0, 9));
    return 97 - Number(n2 % 97n) === cc ? null : { idNat: 'Invalide' };  // Ne apres 2000
  };
}
```

CE VALIDATEUR S'EXECUTE PENDANT QUE L'UTILISATEUR TAPE :
- Verifie que le NISS a 11 chiffres
- Applique l'algorithme modulo 97 (meme algo que cote C#)
- Si invalide : le champ est en ROUGE et le bouton Creer est desactive

POURQUOI VALIDER DES DEUX COTES (Angular ET C#) ?
- Angular : feedback instantane pour l'utilisateur (UX)
- C# : securite (on ne fait JAMAIS confiance au frontend, un hacker
  pourrait envoyer une requete sans passer par Angular)


================================================================================
ARRET 4 — Le modele TypeScript (l'interface des donnees)
FICHIER : medicare-frontend/src/app/core/models/patient.model.ts
LIGNES CLES : 11-19
================================================================================

```typescript
export interface CreatePatientDto {
  id_nat: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  adresse?: string;       // Le ? veut dire optionnel
  telephone?: string;
  email?: string;
}
```

C'est juste la FORME de l'objet qu'on va envoyer. Ca ne fait rien
a l'execution, mais ca aide le compilateur TypeScript a verifier qu'on
n'oublie pas un champ ou qu'on n'envoie pas le mauvais type.


================================================================================
ARRET 5 — Le service Angular qui envoie la requete HTTP
FICHIER : medicare-frontend/src/app/core/services/patient.service.ts
LIGNES CLES : 43-46
================================================================================

```typescript
create(dto: CreatePatientDto): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, dto).pipe(
      tap(patient => this.patientsSignal.update(list => [...list, patient]))
    );
}
```

CE QUI SE PASSE :

1. `this.http.post<Patient>(this.apiUrl, dto)` — Cree une requete HTTP POST
   vers http://localhost:5000/api/patients avec le JSON du patient

2. `tap(patient => ...)` — Quand la reponse reviendra (on n'y est pas encore),
   on ajoutera le nouveau patient a la liste locale en memoire

3. L'Observable est retourne au composant qui fera .subscribe() pour declencher

POURQUOI CE FICHIER ? Separation des responsabilites :
- Le composant gere l'INTERFACE (formulaire, boutons, erreurs)
- Le service gere la COMMUNICATION avec le serveur
- Si demain l'URL change ou la structure du JSON change, on modifie
  seulement CE fichier, pas tous les composants qui creent des patients


================================================================================
ARRET 6 — L'interceptor ajoute le token JWT
FICHIER : medicare-frontend/src/app/core/interceptors/auth.interceptor.ts
================================================================================

```typescript
const token = inject(AuthService).token();   // "eyJhbGci..."
if (token) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
}
```

CETTE FOIS, la secretaire EST connectee. Le token existe.
L'interceptor CLONE la requete et ajoute le header :
`Authorization: Bearer eyJhbGciOiJIUzI1NiI...`

La requete qui part du navigateur :
```
POST http://localhost:5000/api/patients
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiI...
Origin: http://localhost:4200

{
  "id_nat": "99061534897",
  "nom": "Lemaire",
  "prenom": "Thomas",
  "date_naissance": "1999-06-15",
  "email": "thomas.lemaire@gmail.com"
}
```

--- LA REQUETE QUITTE LE NAVIGATEUR ---


================================================================================
ARRET 7 — Le pipeline ASP.NET (meme trajet que le login)
FICHIER : MediCareManager.API/Program.cs
================================================================================

La requete traverse les middlewares dans l'ordre :

1. ExceptionHandlingMiddleware → try { next } catch { ... }
2. CORS → Origin localhost:4200 → OK
3. Authentication → LIT le header "Authorization: Bearer eyJ..."
   → Decode le JWT, verifie la signature HMAC-SHA256 → VALIDE
   → Extrait les claims : sub=85032012345, role=secretaire, sucursale=1
   → Cree un ClaimsPrincipal (l'identite de l'utilisateur)
4. Authorization → La methode Create a [Authorize(Roles = "secretaire,admin")]
   → Le role est "secretaire" → c'est dans la liste → AUTORISE
5. Routing → POST /api/patients → PatientsController.Create()


================================================================================
ARRET 8 — Le Controller recoit la requete
FICHIER : MediCareManager.API/Controllers/PatientsController.cs
LIGNES CLES : 31-38
================================================================================

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

1. `[FromBody] CreatePatientDto dto` — ASP.NET deserialise le JSON en objet C#.
   Le JSON est en snake_case ("id_nat") et la propriete C# est en PascalCase
   ("IdNat"). La conversion est automatique grace a `SnakeCaseLower` dans Program.cs.

2. ASP.NET verifie les DataAnnotations du DTO :
   [Required] sur IdNat → present ? OUI
   [RegularExpression(@"^\d{11}$")] → "99061534897" = 11 chiffres ? OUI
   [Required] sur Nom, Prenom → presents ? OUI
   Si un check echoue → 400 Bad Request automatique

3. `await _patientService.CreateAsync(dto)` → delegue au service metier


================================================================================
ARRET 9 — Le DTO de creation
FICHIER : MediCareManager.Core/DTOs/PatientDtos.cs
LIGNES CLES : 5-12
================================================================================

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

C'est l'objet dans lequel le JSON a ete deserialise. Les annotations
[Required], [RegularExpression], [EmailAddress] ont deja ete verifiees
par ASP.NET AVANT d'arriver dans le controller.


================================================================================
ARRET 10 — Le service metier : le CERVEAU
FICHIER : MediCareManager.Core/Services/PatientService.cs
LIGNES CLES : 29-51
================================================================================

```csharp
public async Task<long> CreateAsync(CreatePatientDto dto)
{
    // ETAPE 1 : Valider le NISS avec l'algo modulo 97
    if (!BelgianNationalNumber.IsValid(dto.IdNat))
        throw new DomainValidationException("NISS invalide");

    // ETAPE 2 : Convertir la string en nombre
    var idNat = BelgianNationalNumber.ToLong(dto.IdNat);

    // ETAPE 3 : Verifier l'unicite
    if (await _repository.ExistsAsync(idNat))
        throw new IdNatAlreadyExistsException(idNat);

    // ETAPE 4 : Construire l'entite Patient
    var patient = new Patient
    {
        IdNat = idNat,           // 99061534897
        Nom = dto.Nom,           // "Lemaire"
        Prenom = dto.Prenom,     // "Thomas"
        DateNaissance = dto.DateNaissance,  // 1999-06-15
        Adresse = dto.Adresse,
        Telephone = dto.Telephone,
        Email = dto.Email
    };

    // ETAPE 5 : Deleguer l'insertion au repository
    return await _repository.CreateAsync(patient);
}
```

POURQUOI CHAQUE ETAPE ?
- Etape 1 : defense en profondeur (Angular a verifie, mais on ne fait
  JAMAIS confiance au frontend)
- Etape 3 : verifie en base avant d'inserer (plus clair qu'attraper une exception MySQL)
- Etape 4 : le DTO (ce que le frontend envoie) n'est PAS la meme chose que
  l'Entity (ce qui va en base). Le DTO a IdNat en string, l'Entity en long.
- Etape 5 : le service ne sait PAS comment fonctionne MySQL. Il appelle
  _repository.CreateAsync() qui est une INTERFACE.


================================================================================
ARRET 11 — La validation du NISS belge
FICHIER : MediCareManager.Core/Common/BelgianNationalNumber.cs
LIGNES CLES : 11-26
================================================================================

```csharp
public static bool IsValid(string? idNat)
{
    var digits = new string(idNat.Where(char.IsDigit).ToArray());  // "99061534897"
    if (digits.Length != 11) return false;                          // 11 chiffres OK

    var nine = digits.Substring(0, 9);                              // "990615348"
    var cc = int.Parse(digits.Substring(9, 2));                     // 97

    var n = long.Parse(nine);                                       // 990615348
    if (97 - (int)(n % 97) == cc) return true;                     // 97 - 0 = 97 ✓
    // ... (test pour les nes apres 2000)
}
```

990615348 % 97 = 0 → 97 - 0 = 97 → cc est bien 97 → VALIDE !


================================================================================
ARRET 12 — Le repository verifie l'unicite
FICHIER : MediCareManager.Infrastructure/Repositories/PatientRepository.cs
LIGNES CLES : 93-99
================================================================================

```csharp
public async Task<bool> ExistsAsync(long idNat)
{
    const string sql = "SELECT COUNT(1) FROM Patient WHERE id_nat = @IdNat;";
    using var connection = CreateConnection();
    return await connection.ExecuteScalarAsync<int>(sql, new { IdNat = idNat }) > 0;
}
```

Dapper envoie a MySQL : SELECT COUNT(1) FROM Patient WHERE id_nat = 99061534897
MySQL repond : 0 (ce patient n'existe pas encore)
0 > 0 = false → le NISS est disponible, on peut continuer.


================================================================================
ARRET 13 — Le repository insere en base
FICHIER : MediCareManager.Infrastructure/Repositories/PatientRepository.cs
LIGNES CLES : 45-63
================================================================================

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

CE QUI SE PASSE :

1. ExecuteInTransactionAsync (dans BaseRepository) :
   → Ouvre une connexion MySQL
   → BEGIN TRANSACTION
   → Passe la connexion et la transaction a notre lambda

2. `conn.ExecuteAsync(sql, patient, tx)` :
   → Dapper remplace les @parametres par les valeurs de l'objet patient :
     @IdNat = 99061534897, @Nom = "Lemaire", @Prenom = "Thomas",
     @DateNaissance = 1999-06-15, @Email = "thomas.lemaire@gmail.com"
   → La requete preparee est envoyee a MySQL
   → MySQL insere la ligne dans la table Patient
   → 1 ligne affectee → succes

3. COMMIT → la ligne est definitivement en base

4. `return patient.IdNat` → retourne 99061534897 au service

5. Si MySQL avait refuse (doublon), le catch attrape MySqlException 1062
   et la transforme en IdNatAlreadyExistsException (exception metier)


================================================================================
ARRET 14 — La base de donnees MySQL (destination finale !)
================================================================================

Apres le COMMIT, la table Patient contient une nouvelle ligne :

| id_nat | nom | prenom | date_naissance | adresse | telephone | email |
|---|---|---|---|---|---|---|
| 99061534897 | Lemaire | Thomas | 1999-06-15 | NULL | NULL | thomas.lemaire@gmail.com |

C'est fait ! La donnee est en base.


--- MAINTENANT, LE CHEMIN RETOUR ---


================================================================================
ARRET 15 — Le repository retourne l'id au service
FICHIER : MediCareManager.Core/Services/PatientService.cs
================================================================================

CreateAsync retourne 99061534897 (le numero national).


================================================================================
ARRET 16 — Le controller recupere le patient complet
FICHIER : MediCareManager.API/Controllers/PatientsController.cs
LIGNES CLES : 35-37
================================================================================

```csharp
var idNat = await _patientService.CreateAsync(dto);              // 99061534897
var patient = await _patientService.GetByIdAsync(idNat);         // Refait un SELECT
return CreatedAtAction(nameof(GetById), new { id = idNat }, patient);
```

Pourquoi un deuxieme GetByIdAsync ? Pour retourner le patient COMPLET
(avec les valeurs par defaut calculees par MySQL si necessaire).

`CreatedAtAction` genere la reponse HTTP :
- Status : 201 Created
- Header Location : /api/patients/99061534897
- Body : le patient complet en JSON


================================================================================
ARRET 17 — La serialisation JSON (C# → JSON snake_case)
FICHIER : MediCareManager.API/Program.cs (configuration)
================================================================================

ASP.NET serialise l'objet Patient en JSON :
- Propriete C# `IdNat` → cle JSON `id_nat` (grace a SnakeCaseLower)
- Propriete C# `DateNaissance` → cle JSON `date_naissance`
- Le [JsonConverter(LongToStringJsonConverter)] sur IdNat fait que
  le nombre 99061534897 devient la string "99061534897" dans le JSON

```json
{
  "id_nat": "99061534897",
  "nom": "Lemaire",
  "prenom": "Thomas",
  "date_naissance": "1999-06-15",
  "adresse": null,
  "telephone": null,
  "email": "thomas.lemaire@gmail.com"
}
```


================================================================================
ARRET 18 — La reponse traverse les middlewares en sens inverse
================================================================================

La reponse repasse par :
1. Authorization → rien a faire (c'est la reponse, pas la requete)
2. Authentication → rien a faire
3. CORS → ajoute les headers Access-Control-Allow-Origin
4. ExceptionHandlingMiddleware → pas d'exception → rien a faire

La reponse HTTP quitte le serveur.


================================================================================
ARRET 19 — Angular recoit la reponse
FICHIER : medicare-frontend/src/app/core/services/patient.service.ts
LIGNES CLES : 44-45
================================================================================

```typescript
return this.http.post<Patient>(this.apiUrl, dto).pipe(
    tap(patient => this.patientsSignal.update(list => [...list, patient]))
);
```

L'Observable recoit la reponse HTTP 201 avec le JSON du patient.
Le `tap` ajoute le nouveau patient a la liste locale (sans refaire un GET).


================================================================================
ARRET 20 — Le composant affiche le succes
FICHIER : medicare-frontend/src/app/features/patients/patient-form/patient-form.component.ts
LIGNES CLES : 113-114, 124-128
================================================================================

```typescript
.subscribe({
    next: () => this.onSuccess('Patient cree.'),
    error: (err) => this.onError(err)
});

private onSuccess(message: string): void {
    this.saving.set(false);                                  // Cache le spinner
    this.snackBar.open(message, 'OK', { duration: 3000 });  // Message vert "Patient cree."
    this.router.navigate(['/patients']);                      // Redirige vers la liste
}
```

La secretaire voit :
1. Un message vert en bas de l'ecran : "Patient cree."
2. La page redirige vers la liste des patients
3. Thomas Lemaire apparait dans le tableau

FIN DU VOYAGE B.


================================================================================
================================================================================

                    RESUME : LA CARTE DU VOYAGE

================================================================================
================================================================================

```
CLIC BOUTON (HTML)
    │
    ▼
COMPOSANT ANGULAR (TypeScript)
    │  Recupere les valeurs du formulaire
    │  Valide le NISS cote client (feedback instantane)
    ▼
SERVICE ANGULAR (TypeScript)
    │  Construit la requete HTTP
    │  HttpClient.post(url, body)
    ▼
INTERCEPTOR ANGULAR (TypeScript)
    │  Ajoute le header "Authorization: Bearer <JWT>"
    │
    ▼ ══════════════ RESEAU ══════════════
    │
PROGRAM.CS (ASP.NET — configuration)
    │  Definit l'ordre des middlewares
    ▼
MIDDLEWARE EXCEPTION (C#)
    │  try { next } catch { erreur → HTTP 4xx/5xx }
    ▼
CORS MIDDLEWARE
    │  Verifie que l'origine est autorisee
    ▼
AUTHENTICATION MIDDLEWARE
    │  Decode et verifie le JWT
    │  Extrait les claims (role, sub, sucursale)
    ▼
AUTHORIZATION MIDDLEWARE
    │  Verifie [Authorize(Roles = "...")] → le role est-il autorise ?
    ▼
CONTROLLER (C#)
    │  Recoit le DTO, appelle le service
    │  NE CONTIENT AUCUNE LOGIQUE METIER
    ▼
SERVICE METIER (C# — Core)
    │  Valide les regles metier (NISS, unicite, conflits...)
    │  Appelle le repository via INTERFACE
    │  NE CONNAIT PAS MySQL
    ▼
REPOSITORY (C# — Infrastructure)
    │  Ecrit le SQL avec Dapper
    │  Utilise des @parametres (anti injection SQL)
    │  Execute dans une TRANSACTION (BEGIN/COMMIT/ROLLBACK)
    ▼
MySQL
    │  Execute la requete SQL
    │  (active les TRIGGERS si UPDATE/DELETE sur Paiement)
    │  Retourne le resultat
    │
    ▼ ══════════ CHEMIN RETOUR ══════════
    │
REPOSITORY → SERVICE → CONTROLLER
    │  Le controller serialise en JSON (snake_case)
    │  Renvoie HTTP 201/200/204
    ▼
MIDDLEWARES (sens inverse)
    │  CORS ajoute les headers
    │
    ▼ ══════════════ RESEAU ══════════════
    │
SERVICE ANGULAR
    │  Recoit la reponse, met a jour la liste locale
    ▼
COMPOSANT ANGULAR
    │  Affiche le message de succes
    │  Redirige vers la liste
    ▼
L'UTILISATEUR VOIT LE RESULTAT
```
