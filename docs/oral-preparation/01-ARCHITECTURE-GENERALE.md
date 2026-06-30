# 01 — ARCHITECTURE GENERALE DE MEDICARE MANAGER

## Table des matieres
1. Vue d'ensemble du projet
2. Les technologies utilisees et POURQUOI
3. Clean Architecture — explication complete
4. L'injection de dependances (DI) — ligne par ligne
5. Le pipeline HTTP ASP.NET — ce qui se passe a chaque requete
6. La serialisation JSON snake_case
7. CORS — pourquoi et comment

---

## 1. VUE D'ENSEMBLE DU PROJET

MediCareManager est une application web de gestion de cabinets medicaux
multi-succursales en Belgique.

### Ce qu'elle gere :
- Des PATIENTS (identifies par leur numero national belge — NISS)
- Des MEDECINS (avec specialisation et rattachement a une succursale)
- Des SECRETAIRES (rattachees a une succursale)
- Des ADMINISTRATEURS (super-utilisateurs)
- Des RENDEZ-VOUS (avec detection de conflits d'horaire)
- Des PAIEMENTS (avec audit automatique via triggers MySQL)
- Des ASSURANCES (liees aux patients via table N:M)
- Des MALADIES / DIAGNOSTICS (dossier medical, secret medical)
- Des SUCCURSALES (les cabinets physiques)
- Des SPECIALISATIONS medicales

### L'architecture en 4 morceaux :

```
┌─────────────────────────────────┐
│   ANGULAR FRONTEND              │  ← Ce que l'utilisateur voit
│   (medicare-frontend/)          │     SPA (Single Page Application)
│   Port 4200                     │     Communique en HTTP REST + JSON
└──────────────┬──────────────────┘
               │ HTTP POST/GET/PUT/DELETE + Header "Authorization: Bearer <JWT>"
               ▼
┌─────────────────────────────────┐
│   ASP.NET CORE API              │  ← Recoit les requetes HTTP
│   (MediCareManager.API)         │     Verifie l'authentification JWT
│   Port 5000                     │     Verifie les autorisations (roles)
│                                 │     Appelle les services metier
└──────────────┬──────────────────┘
               │ Appel de methode C# via interfaces
               ▼
┌─────────────────────────────────┐
│   CORE (logique metier)         │  ← Le cerveau de l'application
│   (MediCareManager.Core)        │     Valide les donnees
│                                 │     Applique les regles metier
│                                 │     NE CONNAIT PAS MySQL !
└──────────────┬──────────────────┘
               │ Appel de methode C# via interfaces
               ▼
┌─────────────────────────────────┐
│   INFRASTRUCTURE                │  ← L'acces aux donnees
│   (MediCareManager.Infrastructure)│  Ecrit le SQL avec Dapper
│                                 │     Hash les mots de passe (BCrypt)
└──────────────┬──────────────────┘
               │ SQL via Dapper (requetes parametrees)
               ▼
┌─────────────────────────────────┐
│   MySQL 8 (medconnect)          │  ← La base de donnees
│   11 tables, 2 triggers, 5 index│
└─────────────────────────────────┘
```

---

## 2. LES TECHNOLOGIES ET POURQUOI

### C# / ASP.NET Core 8
- Framework web de Microsoft, tres performant
- Typage fort = moins de bugs
- Injection de dependances integree
- Middleware pipeline = on peut intercepter chaque requete

### Angular 19
- Framework frontend de Google
- SPA = l'application charge une seule fois, puis tout se passe en JS
- HttpClient pour les requetes REST
- Guards et Interceptors pour la securite cote client

### Dapper (micro-ORM)
- On ecrit le SQL nous-memes (contrairement a Entity Framework qui le genere)
- Plus rapide qu'EF car pas de "tracking" des entites
- Mapping automatique des colonnes SQL → proprietes C#
- Ideal pour un projet pedagogique car on voit le vrai SQL

### MySQL 8
- SGBD relationnel open-source
- Supporte les triggers, les transactions, les FK avec ON DELETE
- Moteur InnoDB = support ACID complet

### BCrypt
- Algorithme de hachage de mots de passe
- Unidirectionnel = on ne peut pas retrouver le mot de passe original
- Salt integre = deux memes mots de passe donnent des hash differents
- Work factor ajustable = on peut le rendre plus lent si les machines deviennent plus rapides

### JWT (JSON Web Token)
- Token d'authentification stateless (le serveur n'a pas de session)
- Signe avec HMAC-SHA256 (on peut verifier qu'il n'a pas ete modifie)
- Contient des "claims" : identifiant, role, nom, succursale...

---

## 3. CLEAN ARCHITECTURE — EXPLICATION COMPLETE

### Le principe fondamental : L'INVERSION DE DEPENDANCES

En architecture classique :
```
Controller → Service → Repository → MySQL
(chaque couche depend de la suivante)
```

En Clean Architecture :
```
Controller → IService (interface) ← Service → IRepository (interface) ← Repository → MySQL
```

Le Core DEFINIT les interfaces.
L'Infrastructure IMPLEMENTE les interfaces.
L'API BRANCHE les implementations sur les interfaces (via DI).

### Pourquoi c'est important ?

1. **Testabilite** : on peut tester le Core sans base de donnees (on mock les interfaces)
2. **Flexibilite** : on peut changer MySQL pour PostgreSQL en modifiant SEULEMENT Infrastructure
3. **Separation des responsabilites** : chaque couche a UN seul job

### Les 3 projets C# :

```
MediCareManager.sln
├── MediCareManager.API/              ← Couche de presentation (HTTP)
│   ├── Controllers/                  ← Endpoints REST
│   ├── Middleware/                    ← Interception des exceptions
│   └── Program.cs                    ← Configuration + DI
│
├── MediCareManager.Core/             ← Couche metier (AUCUNE dependance externe)
│   ├── Entities/                     ← Classes metier (Patient, Medecin...)
│   ├── DTOs/                         ← Objets de transfert (ce que le frontend envoie)
│   ├── Exceptions/                   ← Erreurs metier typees
│   ├── Interfaces/
│   │   ├── Repositories/             ← Contrats d'acces aux donnees
│   │   └── Services/                 ← Contrats de logique metier
│   ├── Services/                     ← Implementations de la logique metier
│   ├── Common/                       ← Utilitaires (validation NISS, converters JSON)
│   └── Settings/                     ← Configuration (JwtSettings)
│
├── MediCareManager.Infrastructure/   ← Couche d'acces aux donnees
│   ├── Repositories/                 ← Implementations SQL (Dapper + MySQL)
│   ├── Configuration/                ← Config Dapper (type handlers, connexion)
│   └── Security/                     ← BCrypt password hasher
│
└── medicare-frontend/                ← Frontend Angular
    └── src/app/
        ├── core/                     ← Services, guards, interceptors, modeles
        ├── features/                 ← Pages (patients, agenda, paiements...)
        └── shared/                   ← Composants partages (navbar)
```

### Regle d'or des dependances :

```
API         → depend de Core ET Infrastructure
Core        → ne depend de RIEN (0 reference externe)
Infrastructure → depend de Core (pour implementer ses interfaces)
```

Le Core est le centre. Il ne sait pas qu'il y a un serveur web, une base MySQL,
ou un frontend Angular. Il connait juste ses entities, ses regles, et ses interfaces.

---

## 4. L'INJECTION DE DEPENDANCES — LIGNE PAR LIGNE

Fichier : `MediCareManager.API/Program.cs`

### 4.1 La connexion string MySQL

```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddSingleton(connectionString);
```

- `GetConnectionString("DefaultConnection")` lit la valeur depuis `appsettings.json`
- `AddSingleton(connectionString)` enregistre la chaine comme un service singleton
  → Quand un repository aura besoin d'un `string` dans son constructeur, le conteneur DI
    lui fournira automatiquement cette connection string
- Le `!` a la fin est le "null-forgiving operator" : on dit au compilateur "je sais que c'est pas null"

### 4.2 Les settings JWT

```csharp
var jwtSettings = new JwtSettings
{
    Key = builder.Configuration["Jwt:Key"]!,
    Issuer = builder.Configuration["Jwt:Issuer"]!,
    Audience = builder.Configuration["Jwt:Audience"]!,
    ExpiryHours = int.TryParse(builder.Configuration["Jwt:ExpiryHours"], out var h) ? h : 8
};
builder.Services.AddSingleton(jwtSettings);
```

- On lit les 4 parametres depuis `appsettings.json` section "Jwt"
- `Key` = la cle secrete pour signer les tokens (doit rester SECRETE)
- `Issuer` = qui emet le token (ex: "MediCareManager")
- `Audience` = a qui le token est destine (ex: "MediCareManagerUsers")
- `ExpiryHours` = duree de validite du token (par defaut 8h)
- `AddSingleton` = une seule instance pour toute la duree de vie de l'app

### 4.3 L'enregistrement des repositories

```csharp
builder.Services.AddScoped<IPatientRepository, PatientRepository>();
builder.Services.AddScoped<IMedecinRepository, MedecinRepository>();
// ... etc pour chaque repository
```

QUE FAIT CETTE LIGNE ?
- Elle dit au conteneur DI : "Quand quelqu'un demande IPatientRepository,
  donne-lui une instance de PatientRepository"
- `AddScoped` = une NOUVELLE instance par requete HTTP
  (si 3 utilisateurs font 3 requetes, il y a 3 PatientRepository distincts)

LES 3 MODES DE VIE :
- `AddSingleton` : UNE instance pour toute l'app (connection string, JWT settings)
- `AddScoped`    : UNE instance par requete HTTP (repositories, services)
- `AddTransient` : UNE NOUVELLE instance a CHAQUE injection (rarement utilise ici)

### 4.4 L'enregistrement des services metier

```csharp
builder.Services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPatientService, PatientService>();
// ... etc
```

Meme principe. Quand le `AuthController` demande un `IAuthService` dans son constructeur,
le conteneur DI lui donne une instance de `AuthService`.

### 4.5 La chaine d'injection complete

Quand une requete arrive sur `PatientsController`, voici ce qui se passe :

```
1. ASP.NET recoit GET /api/patients
2. Il regarde : "PatientsController a besoin d'un IPatientService dans son constructeur"
3. Il regarde : "PatientService a besoin d'un IPatientRepository dans son constructeur"
4. Il regarde : "PatientRepository a besoin d'un string (connection string) dans son constructeur"
5. Il a la connection string (singleton) → il cree PatientRepository
6. Il a PatientRepository → il cree PatientService
7. Il a PatientService → il cree PatientsController
8. La requete est traitee
9. A la fin de la requete, les instances Scoped sont detruites
```

---

## 5. LE PIPELINE HTTP ASP.NET

### L'ordre des middlewares dans Program.cs

```csharp
var app = builder.Build();

app.UseSwagger();                                    // 1. Swagger (documentation API)
app.UseSwaggerUI();                                  // 2. Interface web Swagger

app.UseMiddleware<ExceptionHandlingMiddleware>();     // 3. NOTRE middleware d'erreurs

app.UseCors("Angular");                              // 4. CORS pour Angular
app.UseAuthentication();                             // 5. Verification du token JWT
app.UseAuthorization();                              // 6. Verification des roles
app.MapControllers();                                // 7. Routage vers les controllers

app.Run();                                           // 8. Demarrage du serveur
```

L'ORDRE EST CRITIQUE ! Chaque requete traverse les middlewares dans cet ordre :

```
Requete HTTP entrante
    │
    ▼
[ExceptionHandlingMiddleware]  ← Englobe TOUT (try/catch global)
    │
    ▼
[CORS]                         ← Verifie l'origine (localhost:4200)
    │
    ▼
[Authentication]               ← Lit le header "Authorization: Bearer <token>"
    │                             Verifie la signature, extrait les claims
    ▼
[Authorization]                ← Verifie [Authorize(Roles = "admin")] etc.
    │
    ▼
[Controller]                   ← Traite la requete
    │
    ▼
Reponse HTTP sortante
```

Si une exception est levee N'IMPORTE OU, elle remonte jusqu'au
ExceptionHandlingMiddleware qui la traduit en code HTTP.

---

## 6. LA SERIALISATION JSON SNAKE_CASE

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    });
```

### Que fait chaque ligne ?

1. `PropertyNamingPolicy = SnakeCaseLower` :
   - Les proprietes C# `IdNatPatient` deviennent `id_nat_patient` dans le JSON
   - Angular recoit donc du snake_case (convention JS/Python)
   - Sans ca, Angular recevrait du PascalCase (`IdNatPatient`) ce qui est non-conventionnel en JS

2. `DictionaryKeyPolicy = SnakeCaseLower` :
   - Meme chose pour les cles de dictionnaires

3. `NumberHandling = AllowReadingFromString` :
   - Permet de lire un nombre depuis une chaine JSON
   - Ex: `"id_sucursale": "3"` sera lu comme l'entier 3
   - Utile car Angular peut envoyer des nombres en string (surtout depuis les formulaires)

### La chaine de conversion complete :

```
MySQL (snake_case)     →  Dapper (MatchNamesWithUnderscores)  →  C# (PascalCase)
id_nat_patient              IdNatPatient                          IdNatPatient

C# (PascalCase)        →  JSON serializer (SnakeCaseLower)    →  Angular (snake_case)
IdNatPatient                id_nat_patient                        id_nat_patient
```

Donc : MySQL et Angular parlent en snake_case, C# parle en PascalCase,
et les conversions sont automatiques dans les deux sens.

---

## 7. CORS — POURQUOI ET COMMENT

### Le probleme sans CORS

Angular tourne sur `localhost:4200`.
L'API tourne sur `localhost:5000`.

Ce sont deux "origines" differentes (ports differents).
Par defaut, le navigateur BLOQUE les requetes entre origines differentes
pour des raisons de securite (Same-Origin Policy).

### La solution

```csharp
builder.Services.AddCors(options => options.AddPolicy("Angular",
    p => p.WithOrigins("http://localhost:4200")  // Seul Angular est autorise
          .AllowAnyMethod()                       // GET, POST, PUT, DELETE, PATCH
          .AllowAnyHeader()                       // Authorization, Content-Type...
          .AllowCredentials()));                   // Cookies / credentials autorises
```

```csharp
app.UseCors("Angular");  // Active la politique CORS
```

### Ce que ca fait concretement :

1. Angular fait un POST sur `http://localhost:5000/api/patients`
2. Le navigateur envoie d'abord une requete OPTIONS (preflight)
3. L'API repond avec les headers CORS :
   - `Access-Control-Allow-Origin: http://localhost:4200`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH`
4. Le navigateur autorise la vraie requete POST

### Pourquoi `WithOrigins` et pas `AllowAnyOrigin` ?

Securite ! Si on met `AllowAnyOrigin`, n'importe quel site web pourrait
faire des requetes a notre API. En production, on autoriserait uniquement
le domaine de production (ex: `https://medicare.be`).
