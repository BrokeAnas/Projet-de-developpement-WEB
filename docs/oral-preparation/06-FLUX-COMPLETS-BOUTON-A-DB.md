# 06 — FLUX COMPLETS : DU CLIC BOUTON JUSQU'A LA BASE DE DONNEES

Ce fichier decrit EXACTEMENT ce qui se passe quand l'utilisateur clique
sur un bouton dans l'interface Angular, jusqu'a l'ecriture en base MySQL,
et le retour de la reponse a l'ecran.

---

## FLUX 1 : LA SECRETAIRE SE CONNECTE (LOGIN)

### Etape 1 — L'utilisateur remplit le formulaire

L'ecran de login affiche deux champs : Email et Mot de passe.
La secretaire tape : marie.dupont@medicare.be / SecretPass123

### Etape 2 — Angular envoie la requete

```
Le composant LoginComponent appelle AuthService.login(email, password)
→ AuthService fait un HttpClient.post('http://localhost:5000/api/auth/login', body)
→ Le body JSON est : { "email": "marie.dupont@medicare.be", "password": "SecretPass123" }
→ PAS de header Authorization (c'est [AllowAnonymous])
```

### Etape 3 — ASP.NET recoit la requete

```
1. La requete arrive sur le serveur ASP.NET port 5000
2. Pipeline : ExceptionMiddleware → CORS → Authentication → Authorization → Controller
3. CORS : Origin = http://localhost:4200 → autorise
4. Authentication : pas de header Authorization → pas de token → User = anonyme
5. Authorization : [AllowAnonymous] sur la methode → OK, on passe
6. Route : POST /api/auth/login → AuthController.Login()
```

### Etape 4 — Le Controller appelle le Service

```csharp
// AuthController.Login()
var token = await _authService.LoginAsync(dto.Email, dto.Password);
```

### Etape 5 — AuthService cherche l'utilisateur

```
1. _medecinRepository.GetByEmailAsync("marie.dupont@medicare.be")
   → SQL : SELECT * FROM Medecin WHERE email = 'marie.dupont@medicare.be'
   → MySQL retourne : NULL (pas de medecin avec cet email)

2. _secretaireRepository.GetByEmailAsync("marie.dupont@medicare.be")
   → SQL : SELECT * FROM Secretaire WHERE email = 'marie.dupont@medicare.be'
   → MySQL retourne : { id_nat: 85032012345, nom: "Dupont", prenom: "Marie",
                         email: "marie.dupont@medicare.be",
                         mot_de_passe: "$2a$11$KIX7B3j...", id_sucursale: 1 }

3. secretaire trouvee !
   _passwordHasher.Verify("SecretPass123", "$2a$11$KIX7B3j...")
   → BCrypt extrait le salt du hash stocke
   → BCrypt rehash "SecretPass123" avec ce salt
   → Compare les deux hash → ils correspondent → TRUE

4. GenerateToken("85032012345", "secretaire", "Marie", "Dupont", 1)
   → Cree le JWT avec les claims :
     sub = "85032012345"
     role = "secretaire"
     given_name = "Marie"
     family_name = "Dupont"
     sucursale = 1
     exp = maintenant + 8 heures
   → Signe avec HMAC-SHA256
   → Retourne "eyJhbGci..."
```

### Etape 6 — Le Controller renvoie la reponse

```
Le controller decode le JWT pour extraire nom/role, puis retourne :
HTTP 200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NTAzMjAxMjM0NSIsInJvbGUiOiJzZWNyZXRhaXJlIiwiZ2l2ZW5fbmFtZSI6Ik1hcmllIiwiZmFtaWx5X25hbWUiOiJEdXBvbnQiLCJzdWN1cnNhbGUiOjEsImV4cCI6MTc1MDg3MDAwMH0.abc123signature",
  "role": "secretaire",
  "nom": "Dupont",
  "prenom": "Marie"
}
```

### Etape 7 — Angular stocke le token

```
1. AuthService recoit la reponse
2. Stocke le token dans localStorage : localStorage.setItem('jwt_token', token)
3. Stocke le role, nom, prenom pour l'affichage
4. Redirige vers le dashboard
5. La navbar affiche "Marie Dupont (secretaire)"
```

### Etape 8 — Toutes les requetes suivantes

```
L'AuthInterceptor Angular intercepte CHAQUE requete HTTP
→ Lit le token depuis localStorage
→ Ajoute le header : Authorization: Bearer eyJhbGci...
→ Desormais, le serveur sait QUI fait la requete et SON ROLE
```

---

## FLUX 2 : LA SECRETAIRE CREE UN PATIENT

### Etape 1 — Le formulaire

La secretaire remplit le formulaire patient :
- Numero national : 99061534897
- Nom : Lemaire
- Prenom : Thomas
- Date de naissance : 1999-06-15
- Email : thomas.lemaire@gmail.com

Elle clique sur "Enregistrer".

### Etape 2 — Angular envoie la requete

```
PatientFormComponent.onSubmit()
→ PatientService.create(dto)
→ HttpClient.post('http://localhost:5000/api/patients', body)

Headers :
  Content-Type: application/json
  Authorization: Bearer eyJhbGci...    ← Ajoute par l'interceptor

Body JSON :
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

### Etape 3 — Le pipeline ASP.NET

```
1. ExceptionHandlingMiddleware : try { next(context) }
2. CORS : Origin localhost:4200 → OK
3. Authentication :
   → Lit le header Authorization: Bearer eyJhbGci...
   → Decode le JWT en 3 parties
   → Verifie la signature HMAC-SHA256 → OK
   → Verifie exp > maintenant → OK (pas expire)
   → Cree le ClaimsPrincipal : sub=85032012345, role=secretaire, sucursale=1
4. Authorization :
   → [Authorize(Roles = "secretaire,admin")] sur la methode Create
   → Le role est "secretaire" → c'est dans la liste → OK
5. Model Binding :
   → Deserialise le JSON en CreatePatientDto
   → Verifie [Required] sur IdNat → present → OK
   → Verifie [RegularExpression(@"^\d{11}$")] → "99061534897" = 11 chiffres → OK
   → Verifie [EmailAddress] sur Email → format valide → OK
6. Routing : POST /api/patients → PatientsController.Create()
```

### Etape 4 — Le Controller

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

### Etape 5 — PatientService.CreateAsync

```
1. BelgianNationalNumber.IsValid("99061534897")
   → Extrait les chiffres : "99061534897"
   → 11 chiffres → OK
   → 9 premiers = 990615348, checksum = 97
   → 97 - (990615348 % 97) = 97 - 0 = 97 → match ! → VALIDE

2. BelgianNationalNumber.ToLong("99061534897") → 99061534897L

3. _repository.ExistsAsync(99061534897)
   → SQL : SELECT COUNT(1) FROM Patient WHERE id_nat = 99061534897
   → MySQL retourne : 0 → false → OK, pas de doublon

4. Cree l'objet Patient { IdNat = 99061534897, Nom = "Lemaire", ... }

5. _repository.CreateAsync(patient)
```

### Etape 6 — PatientRepository.CreateAsync

```
1. Prepare le SQL :
   INSERT INTO Patient (id_nat, nom, prenom, date_naissance, adresse, telephone, email)
   VALUES (@IdNat, @Nom, @Prenom, @DateNaissance, @Adresse, @Telephone, @Email)

2. ExecuteInTransactionAsync :
   a. Cree une connexion MySQL
   b. Ouvre la connexion
   c. BEGIN TRANSACTION
   d. Dapper envoie l'INSERT avec les parametres :
      @IdNat = 99061534897
      @Nom = "Lemaire"
      @Prenom = "Thomas"
      @DateNaissance = 1999-06-15
      @Adresse = NULL
      @Telephone = NULL
      @Email = "thomas.lemaire@gmail.com"
   e. MySQL execute l'INSERT → 1 ligne inseree
   f. COMMIT → la ligne est persistee definitivement
   g. Retourne 99061534897 (l'id_nat)
   h. La connexion est fermee (using)
```

### Etape 7 — Le Controller renvoie la reponse

```
1. Le service retourne 99061534897
2. Le controller fait GetByIdAsync(99061534897)
   → SQL : SELECT * FROM Patient WHERE id_nat = 99061534897
   → Retourne le patient complet
3. CreatedAtAction retourne :

HTTP 201 Created
Location: /api/patients/99061534897
Content-Type: application/json

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

### Etape 8 — Angular affiche le resultat

```
1. PatientService recoit la reponse HTTP 201
2. Le composant recoit le patient cree
3. Redirige vers la liste des patients
4. Le nouveau patient apparait dans le tableau
```

---

## FLUX 3 : LA SECRETAIRE CREE UN RENDEZ-VOUS (AVEC CONFLIT)

### Etape 1 — Le formulaire

La secretaire veut creer un RDV :
- Patient : Thomas Lemaire (99061534897)
- Medecin : Dr. Martin (75012345678)
- Date : 2026-06-25
- Heure debut : 10:30
- Heure fin : 11:30
- Succursale : Cabinet Centre (id 1)
- Motif : "Consultation de suivi"

MAIS : Dr. Martin a deja un RDV le 25/06 de 10:00 a 11:00 !

### Etape 2 — Angular envoie la requete

```
POST /api/rendezvous
Authorization: Bearer eyJhbGci...

{
  "id_nat_patient": "99061534897",
  "id_nat_medecin": "75012345678",
  "id_nat_secretaire": "85032012345",
  "id_sucursale": 1,
  "date_rdv": "2026-06-25",
  "heure_debut": "10:30:00",
  "heure_fin": "11:30:00",
  "motif": "Consultation de suivi"
}
```

### Etape 3 — RendezVousService.CreateAsync

```
1. dto.HeureFin (11:30) > dto.HeureDebut (10:30) → OK

2. _repository.HasConflitAsync(75012345678, 2026-06-25, 10:30, 11:30)
   → SQL :
     SELECT COUNT(*) FROM RendezVous
     WHERE id_nat_medecin = 75012345678
       AND date_rdv = '2026-06-25'
       AND heure_debut < '11:30'     -- RDV existant 10:00 < 11:30 → TRUE
       AND heure_fin > '10:30'       -- RDV existant 11:00 > 10:30 → TRUE
       AND statut NOT IN ('Annule')  -- statut = 'Planifie' → TRUE
   → MySQL retourne : COUNT = 1 → IL Y A UN CONFLIT !

3. throw new RendezVousConflitException(75012345678, 2026-06-25, 10:30, 11:30)
```

### Etape 4 — L'exception remonte

```
1. L'exception est levee dans RendezVousService
2. Elle remonte : Service → Controller → ExceptionHandlingMiddleware
3. Le middleware la catch :
   RendezVousConflitException => (409, ex.Message)
4. Reponse :

HTTP 409 Conflict
{
  "error": "Conflit d'agenda : le medecin 75012345678 a deja un rendez-vous
            le 25/06/2026 entre 10:30 et 11:30."
}
```

### Etape 5 — Angular affiche l'erreur

```
1. HttpClient recoit le 409
2. L'Observable lance une erreur
3. Le composant lit le message d'erreur
4. Affiche un message rouge : "Conflit d'agenda : le medecin a deja un RDV..."
5. La secretaire choisit un autre creneau
```

---

## FLUX 4 : L'ADMIN MODIFIE UN PAIEMENT (TRIGGER D'AUDIT)

### Situation initiale

Le paiement #42 existe :
- Patient : Thomas Lemaire
- Montant : 50.00 €
- Mode : "Bancontact"

L'admin veut corriger le montant a 75.00 €.

### Etape 1 — Angular envoie

```
PUT /api/paiements/42
Authorization: Bearer eyJhbGci... (token admin)

{
  "montant": 75.00,
  "date_paiement": null,
  "mode_paiement": null
}
```

(date_paiement et mode_paiement sont null → on ne les modifie pas)

### Etape 2 — Pipeline ASP.NET

```
1. Auth : JWT valide, role = "admin"
2. Authorization : [Authorize(Roles = "secretaire,admin")] → "admin" est dedans → OK
3. PaiementsController.Update(42, dto)
```

### Etape 3 — PaiementService.UpdateAsync

```
1. _repository.GetByIdAsync(42)
   → SQL : SELECT * FROM Paiement pa JOIN Patient p ON ... WHERE pa.id_paiement = 42
   → Retourne le paiement existant { montant: 50.00, mode_paiement: "Bancontact" }

2. Mise a jour partielle :
   paiement.Montant = dto.Montant ?? paiement.Montant
   → dto.Montant = 75.00 → on met 75.00
   paiement.DatePaiement = dto.DatePaiement ?? paiement.DatePaiement
   → dto.DatePaiement = null → on garde l'ancien
   paiement.ModePaiement = dto.ModePaiement ?? paiement.ModePaiement
   → dto.ModePaiement = null → on garde "Bancontact"

3. _repository.UpdateAsync(paiement)
```

### Etape 4 — PaiementRepository.UpdateAsync

```
SQL execute :
  UPDATE Paiement
  SET montant = 75.00, date_paiement = '2026-06-20', mode_paiement = 'Bancontact'
  WHERE id_paiement = 42
```

### Etape 5 — LE TRIGGER MySQL S'EXECUTE AUTOMATIQUEMENT

```
APRES le UPDATE, MySQL execute Paiement_Update_Log :

  INSERT INTO Paiement_Historique
    (id_paiement, id_nat_patient, id_rdv, montant, date_paiement, operation)
  VALUES
    (42, 99061534897, NULL, 50.00, '2026-06-20', 'UPDATE')
                                    ^^^^
                                    L'ANCIEN montant (OLD.montant)

Maintenant Paiement_Historique contient :
| id_historique | id_paiement | montant | operation | date_operation |
|---|---|---|---|---|
| 1 | 42 | 50.00 | UPDATE | 2026-06-23 14:35:22 |
```

### Etape 6 — Consultation de l'audit

Plus tard, l'admin va sur la page "Audit des paiements" :
```
GET /api/paiements/audit → PaiementRepository.GetAuditLogAsync()

Resultat :
[
  {
    "id_historique": 1,
    "id_paiement": 42,
    "id_nat_patient": "99061534897",
    "montant": 50.00,           ← L'ANCIEN montant
    "date_paiement": "2026-06-20",
    "operation": "UPDATE",       ← Type d'operation
    "date_operation": "2026-06-23T14:35:22",
    "patient_nom": "Lemaire Thomas"
  }
]
```

L'admin peut voir : "Le paiement #42 a ete modifie le 23/06/2026 a 14h35.
L'ancien montant etait 50.00 € (maintenant c'est 75.00 €)."

---

## FLUX 5 : L'ADMIN SUPPRIME UN MEDECIN (REFUSE)

### Situation

L'admin veut supprimer le Dr. Martin (75012345678).
Mais Dr. Martin a un RDV "Planifie" le 25/06/2026.

### Etape 1 — Angular envoie

```
DELETE /api/medecins/75012345678
Authorization: Bearer eyJhbGci... (token admin)
```

### Etape 2 — MedecinService.DeleteAsync

```
1. _repository.GetByIdAsync(75012345678)
   → Retourne le medecin → existe → OK

2. _repository.HasRendezVousFutursAsync(75012345678)
   → SQL :
     SELECT COUNT(1) FROM RendezVous
     WHERE id_nat_medecin = 75012345678
       AND date_rdv >= CURDATE()            -- >= 2026-06-23
       AND statut IN ('Planifie', 'En cours')
   → MySQL retourne : COUNT = 1 → TRUE → IL A DES RDV FUTURS !

3. throw new MedecinHasRendezVousException(75012345678)
```

### Etape 3 — Reponse

```
HTTP 409 Conflict
{
  "error": "Impossible de supprimer le medecin 75012345678 :
            des rendez-vous futurs sont planifies."
}
```

### Resolution

L'admin doit d'abord :
- Annuler ou reassigner les RDV du Dr. Martin
- PUIS re-tenter la suppression
- Cette fois HasRendezVousFutursAsync retournera false → suppression OK

---

## FLUX 6 : UN MEDECIN TENTE D'ACCEDER AU DOSSIER MEDICAL (AUTORISE)

### Etape 1

Le Dr. Martin (medecin) veut voir les maladies du patient 99061534897.

```
GET /api/patients/99061534897/maladies
Authorization: Bearer eyJhbGci... (token medecin)
```

### Etape 2 — Pipeline

```
1. Auth : JWT valide, role = "medecin" → ClaimsPrincipal cree
2. [Authorize(Roles = "medecin,admin")] → "medecin" est dedans → OK
3. PatientsController.GetMaladies(99061534897)
```

### Etape 3 — PatientService + Repository

```
1. ExistsAsync(99061534897) → true → le patient existe
2. GetMaladiesAsync(99061534897)
   → SQL avec jointures :
     SELECT pm.*, tm.libelle, tm.code_CIM, CONCAT(m.nom, ' ', m.prenom) AS MedecinNom
     FROM PatientMaladie pm
     JOIN TypeMaladie tm ON tm.id_maladie = pm.id_maladie
     LEFT JOIN Medecin m ON m.id_nat = pm.id_nat_medecin
     WHERE pm.id_nat_patient = 99061534897
```

### Etape 4 — Reponse

```
HTTP 200 OK
[
  {
    "id_nat_patient": "99061534897",
    "id_maladie": 5,
    "libelle": "Diabete de type 2",
    "code_cim": "E11",
    "date_diagnostic": "2024-03-15",
    "observations": "Metformine prescrite, suivi trimestriel",
    "medecin_nom": "Martin Jean"
  }
]
```

---

## FLUX 7 : UNE SECRETAIRE TENTE D'ACCEDER AU DOSSIER MEDICAL (REFUSE)

### Etape 1

La secretaire Marie (role = secretaire) tente :

```
GET /api/patients/99061534897/maladies
Authorization: Bearer eyJhbGci... (token secretaire)
```

### Etape 2 — Pipeline

```
1. Auth : JWT valide, role = "secretaire" → ClaimsPrincipal cree
2. [Authorize(Roles = "medecin,admin")] sur GetMaladies
   → "secretaire" N'EST PAS dans la liste → REFUSE
3. ASP.NET retourne automatiquement :

HTTP 403 Forbidden
```

La secretaire n'a PAS acces au dossier medical. C'est le SECRET MEDICAL.
Seuls les medecins et les admins peuvent voir les diagnostics.

---

## RESUME : LA CHAINE COMPLETE POUR CHAQUE TYPE D'OPERATION

### LECTURE (GET)
```
Angular → HTTP GET + JWT → CORS → Auth → Authz → Controller → Service → Repository
→ SQL SELECT (pas de transaction) → MySQL → Dapper mappe → Reponse JSON → Angular affiche
```

### CREATION (POST)
```
Angular → HTTP POST + JWT + JSON body → CORS → Auth → Authz → Model Binding (validation DTO)
→ Controller → Service (regles metier) → Repository → BEGIN → SQL INSERT → COMMIT → MySQL
→ Reponse 201 + JSON → Angular affiche + redirige
```

### MODIFICATION (PUT/PATCH)
```
Angular → HTTP PUT + JWT + JSON body → CORS → Auth → Authz → Controller → Service
→ Repository.GetById (verifier existence) → Service (update partiel) → Repository
→ BEGIN → SQL UPDATE → COMMIT → (trigger si paiement) → Reponse 200 + JSON
```

### SUPPRESSION (DELETE)
```
Angular → HTTP DELETE + JWT → CORS → Auth → Authz → Controller → Service
→ (verifier existence) → (verifier regles : pas de RDV futurs, pas de personnel...)
→ Repository → BEGIN → SQL DELETE → COMMIT → (trigger si paiement) → Reponse 204
```

### ERREUR (n'importe ou)
```
Exception levee dans Service ou Repository
→ Remonte la pile d'appels
→ ExceptionHandlingMiddleware catch
→ Pattern matching sur le type d'exception
→ Code HTTP + message JSON { "error": "..." }
→ Angular affiche le message d'erreur
```
