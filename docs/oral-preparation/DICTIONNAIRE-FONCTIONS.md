# DICTIONNAIRE COMPLET — Chaque fonction, methode et mot-cle du projet

> Projet MediCareManager (Angular + C# + Dapper + MySQL)
> Ce fichier est un dictionnaire : trouve n'importe quelle fonction et tu sauras
> exactement ce qu'elle fait, pourquoi on l'utilise, et ou elle apparait dans le projet.

---

## TABLE DES MATIERES

- **PARTIE A** : Fonctions/methodes ANGULAR (TypeScript)
- **PARTIE B** : Fonctions/methodes C# (.NET / ASP.NET)
- **PARTIE C** : Mots-cles et operateurs speciaux des deux cotes

---

# ═══════════════════════════════════════════════════
# PARTIE A — ANGULAR (TypeScript)
# ═══════════════════════════════════════════════════


## A1. INJECTION DE DEPENDANCES ANGULAR

### inject()
```typescript
private readonly http = inject(HttpClient);
private readonly router = inject(Router);
private readonly authService = inject(AuthService);
```
**Ce que ca fait** : Demande a Angular de fournir une instance d'un service.
C'est comme dire "donne-moi le service HttpClient, je vais en avoir besoin".
Angular cree l'instance (ou reutilise celle qui existe) et te la donne.

**Ou dans le projet** : Dans TOUS les composants et services. C'est la facon
moderne (Angular 14+) de faire l'injection de dependances. Avant, on ecrivait
`constructor(private http: HttpClient)` — c'est la meme chose.

**Pourquoi** : Le composant ne cree PAS ses services lui-meme. Il les RECOIT.
Ca permet de les remplacer facilement (pour les tests par exemple).


## A2. LES SIGNALS ANGULAR (gestion d'etat)

### signal()
```typescript
readonly loading = signal(false);
readonly errorMessage = signal<string | null>(null);
private patientsSignal = signal<Patient[]>([]);
```
**Ce que ca fait** : Cree une "boite" reactive qui contient une valeur.
Quand la valeur change, Angular met automatiquement a jour l'ecran.

`signal(false)` → cree une boite qui contient `false`
`signal<string | null>(null)` → cree une boite qui peut contenir une string ou null, commence a null
`signal<Patient[]>([])` → cree une boite qui contient un tableau vide de patients

**Ou dans le projet** : PARTOUT. C'est la facon de stocker l'etat dans l'app.
- `loading` : est-ce qu'on attend une reponse du serveur ?
- `errorMessage` : y a-t-il un message d'erreur a afficher ?
- `patientsSignal` : la liste des patients en memoire

### .set()
```typescript
this.loading.set(true);
this.errorMessage.set(null);
this.patientsSignal.set(data);
```
**Ce que ca fait** : REMPLACE la valeur du signal par une nouvelle valeur.
`loading.set(true)` → maintenant loading vaut true → Angular met a jour l'ecran.

### .update()
```typescript
this.patientsSignal.update(list => [...list, patient]);
this.hidePassword.update(v => !v);
this.patientsSignal.update(list => list.filter(p => p.id_nat !== idNat));
this.patientsSignal.update(list => list.map(p => p.id_nat === idNat ? updated : p));
```
**Ce que ca fait** : Modifie la valeur du signal en se basant sur la valeur actuelle.
Tu passes une fonction qui recoit l'ancienne valeur et retourne la nouvelle.

- `list => [...list, patient]` → ajoute un patient a la fin de la liste
- `v => !v` → inverse un booleen (true → false, false → true)
- `list => list.filter(...)` → retire un element de la liste
- `list => list.map(...)` → remplace un element dans la liste

**Difference avec .set()** : `.set()` remplace tout. `.update()` modifie en
se basant sur la valeur actuelle. Utilise `.update()` quand tu as besoin
de l'ancienne valeur pour calculer la nouvelle.

### .asReadonly()
```typescript
readonly patients = this.patientsSignal.asReadonly();
```
**Ce que ca fait** : Cree une version en LECTURE SEULE du signal.
Les composants qui utilisent `patientService.patients` peuvent LIRE
la liste mais PAS la modifier directement. Seul le service peut modifier
`patientsSignal` en interne.

**Pourquoi** : Encapsulation. On ne veut pas qu'un composant fasse
`patientService.patients.set([])` et vide la liste par accident.

### computed()
```typescript
readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
readonly roleLabel = computed(() => {
    switch (this.authService.role()) { ... }
});
readonly totalPaiements = computed(() => this.paiementsSignal().length);
readonly montantTotal = computed(() =>
    this.paiementsSignal().reduce((sum, p) => sum + Number(p.montant), 0));
readonly filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.patientService.patients().filter(p =>
        `${p.prenom} ${p.nom}`.toLowerCase().includes(term));
});
```
**Ce que ca fait** : Cree un signal DERIVE qui se recalcule automatiquement
quand ses dependances changent. C'est une valeur calculee.

- `isAuthenticated` : recalcule chaque fois que `tokenSignal` change
- `totalPaiements` : recalcule chaque fois que `paiementsSignal` change
- `filteredPatients` : recalcule quand `searchTerm` OU `patients` changent

**Analogie** : C'est comme une formule Excel. Si la cellule A1 change,
toutes les cellules qui dependent de A1 se recalculent automatiquement.


## A3. REQUETES HTTP (HttpClient)

### this.http.get<T>(url)
```typescript
this.http.get<Patient[]>(this.apiUrl, { params })
this.http.get<Medecin>(`${this.apiUrl}/${idNat}`)
this.http.get<AuditLog[]>(`${this.apiUrl}/audit`)
```
**Ce que ca fait** : Envoie une requete HTTP GET a l'URL indiquee.
Retourne un Observable (pas directement les donnees — il faut `.subscribe()`).
Le `<Patient[]>` entre chevrons dit a TypeScript quel type de reponse attendre.
`{ params }` ajoute les parametres dans l'URL (ex: `?search=Dupont&page=1`).

### this.http.post<T>(url, body)
```typescript
this.http.post<Patient>(this.apiUrl, dto)
this.http.post<AuthResponse>(`${this.apiUrl}/login`, dto)
```
**Ce que ca fait** : Envoie une requete HTTP POST avec un corps JSON.
`dto` est l'objet qui sera serialise en JSON et envoye dans le body.

### this.http.put<T>(url, body)
```typescript
this.http.put<Patient>(`${this.apiUrl}/${idNat}`, dto)
```
**Ce que ca fait** : Envoie une requete HTTP PUT (mise a jour complete).

### this.http.patch<T>(url, body)
```typescript
this.http.patch<RendezVous>(`${this.apiUrl}/${id}/statut`, { statut })
```
**Ce que ca fait** : Envoie une requete HTTP PATCH (mise a jour partielle).
Dans le projet, utilise uniquement pour changer le statut d'un RDV.

### this.http.delete<T>(url)
```typescript
this.http.delete<void>(`${this.apiUrl}/${idNat}`)
```
**Ce que ca fait** : Envoie une requete HTTP DELETE.
`<void>` signifie "je n'attends pas de corps dans la reponse".

### HttpParams
```typescript
let params = new HttpParams();
params = params.set('search', 'Dupont');
params = params.set('page', 1);
this.http.get<Patient[]>(this.apiUrl, { params });
```
**Ce que ca fait** : Construit les parametres de l'URL.
Le resultat sera : `GET /api/patients?search=Dupont&page=1`.
`params.set()` retourne un NOUVEL objet (HttpParams est immutable),
c'est pourquoi on reassigne `params = params.set(...)`.


## A4. LES OBSERVABLES (RxJS)

### .subscribe({ next, error })
```typescript
this.authService.login(dto).subscribe({
    next: () => { this.router.navigate(['/dashboard']); },
    error: (err) => { this.errorMessage.set(err.error?.error ?? 'Erreur'); }
});
```
**Ce que ca fait** : DECLENCHE l'Observable. Sans `.subscribe()`, la requete
HTTP ne part PAS. C'est comme appuyer sur le bouton "envoyer".
- `next` : fonction appelee si tout se passe bien (succes)
- `error` : fonction appelee si le serveur repond une erreur (4xx, 5xx)

**CRUCIAL** : Un `this.http.get(...)` SANS `.subscribe()` ne fait RIEN.
L'Observable est "lazy" — il ne s'execute que quand quelqu'un s'y abonne.

### .pipe()
```typescript
this.http.post<Patient>(this.apiUrl, dto).pipe(
    tap(patient => this.patientsSignal.update(list => [...list, patient]))
);
```
**Ce que ca fait** : Chaine des operateurs sur l'Observable AVANT que
le resultat arrive au `.subscribe()`. C'est comme un tuyau ou les donnees
passent par des etapes successives.

### tap()
```typescript
tap(patient => this.patientsSignal.update(list => [...list, patient]))
tap(() => this.patientsSignal.update(list => list.filter(p => p.id_nat !== idNat)))
```
**Ce que ca fait** : Execute un "effet de bord" sans modifier les donnees.
Les donnees passent a travers `tap` sans etre changees.
Utilise pour mettre a jour le signal local apres une requete reussie.

**Analogie** : C'est un checkpoint. La donnee passe, tu fais quelque chose
(mettre a jour la liste locale), et la donnee continue son chemin.

### map()
```typescript
map(() => void 0)
```
**Ce que ca fait** : Transforme la valeur emise par l'Observable.
`map(() => void 0)` signifie : "peu importe ce que le serveur a retourne,
transforme-le en `undefined`" (= on n'a pas besoin de la reponse).

### startWith()
```typescript
this.searchControl.valueChanges.pipe(
    startWith(''),
    debounceTime(300),
    ...
)
```
**Ce que ca fait** : Emet une valeur initiale AVANT les vraies valeurs.
Sans `startWith('')`, rien ne se passe tant que l'utilisateur n'a pas tape.
Avec `startWith('')`, on charge immediatement tous les patients (recherche vide).

### debounceTime(300)
```typescript
debounceTime(300)
```
**Ce que ca fait** : Attend 300 millisecondes APRES la derniere frappe
avant d'emettre la valeur. Si l'utilisateur tape "D-u-p-o-n-t" rapidement,
au lieu d'envoyer 6 requetes (une par lettre), on n'en envoie qu'UNE
(celle apres 300ms d'inactivite).

**Pourquoi** : Evite de bombarder le serveur de requetes pendant que
l'utilisateur tape encore.

### distinctUntilChanged()
```typescript
distinctUntilChanged()
```
**Ce que ca fait** : N'emet que si la valeur a CHANGE par rapport a la precedente.
Si l'utilisateur tape "Dupont", efface le t, remet le t → "Dupont" n'est PAS
reemis car c'est la meme valeur qu'avant.

### takeUntilDestroyed(this.destroyRef)
```typescript
.pipe(takeUntilDestroyed(this.destroyRef))
```
**Ce que ca fait** : Desabonne automatiquement l'Observable quand le composant
est detruit (l'utilisateur quitte la page). Sans ca, l'Observable continuerait
a vivre en memoire et a envoyer des requetes meme apres avoir quitte la page.

**DestroyRef** : un objet Angular qui sait quand le composant va etre detruit.
`inject(DestroyRef)` le recupere.

### .valueChanges
```typescript
this.searchControl.valueChanges.pipe(...)
this.patientControl.valueChanges.pipe(...)
```
**Ce que ca fait** : Un Observable qui emet une nouvelle valeur CHAQUE FOIS
que le champ du formulaire change. Si l'utilisateur tape "D", puis "Du",
puis "Dup", l'Observable emet 3 fois.


## A5. LES FORMULAIRES REACTIFS

### FormBuilder / this.fb.nonNullable.group({})
```typescript
private readonly fb = inject(FormBuilder);

readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    montant: [0, [Validators.required, Validators.min(0.01)]]
});
```
**Ce que ca fait** : Cree un groupe de champs de formulaire avec des validations.
- Le premier element du tableau `['']` est la valeur par defaut
- Le deuxieme element `[Validators.required]` est la liste de validateurs
- `nonNullable` : empeche les valeurs null dans le formulaire (securite du typage)

### Validators.required
```typescript
email: ['', [Validators.required]]
```
**Ce que ca fait** : Le champ ne peut pas etre vide. Si l'utilisateur laisse
le champ vide, `form.invalid` sera `true` et le bouton Enregistrer sera desactive.

### Validators.email
```typescript
email: ['', [Validators.required, Validators.email]]
```
**Ce que ca fait** : Verifie que la valeur a le format d'un email
(contient un @, un domaine...). "abc" → invalide. "abc@def.com" → valide.

### Validators.maxLength(100)
```typescript
nom: ['', [Validators.required, Validators.maxLength(100)]]
```
**Ce que ca fait** : Le champ ne peut pas depasser 100 caracteres.
Correspond au `VARCHAR(100)` de MySQL.

### Validators.min(0.01)
```typescript
montant: [0, [Validators.required, Validators.min(0.01)]]
```
**Ce que ca fait** : La valeur doit etre au moins 0.01 (pas de montant negatif ou zero).

### idNatValidator() (validateur personnalise)
```typescript
export function idNatValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const val = (control.value ?? '').toString().replace(/\D/g, '');
        if (!val || val.length !== 11) return { idNat: 'Doit contenir 11 chiffres' };
        const n = BigInt(val.substring(0, 9));
        const cc = parseInt(val.substring(9, 11), 10);
        if (97 - Number(n % 97n) === cc) return null;
        const n2 = BigInt('2' + val.substring(0, 9));
        return 97 - Number(n2 % 97n) === cc ? null : { idNat: 'Invalide' };
    };
}
```
**Ce que ca fait** : Validateur cree sur mesure pour le numero national belge.
Verifie que le NISS a 11 chiffres ET que le checksum modulo 97 est correct.
Retourne `null` si valide, ou un objet d'erreur `{ idNat: 'message' }` si invalide.

### this.form.invalid
```typescript
if (this.form.invalid) { return; }
```
**Ce que ca fait** : Retourne `true` si AU MOINS UN champ du formulaire
ne respecte pas ses validateurs. Utilise pour empecher la soumission.

### this.form.markAllAsTouched()
```typescript
this.form.markAllAsTouched();
```
**Ce que ca fait** : Marque tous les champs comme "touches" (comme si
l'utilisateur avait clique sur chaque champ puis l'avait quitte).
Ca force l'affichage des messages d'erreur en rouge sous les champs.
Utile quand l'utilisateur clique "Enregistrer" sans avoir rempli le formulaire.

### this.form.getRawValue()
```typescript
const v = this.form.getRawValue();
```
**Ce que ca fait** : Recupere TOUTES les valeurs du formulaire, y compris
celles des champs desactives (disabled). Retourne un objet :
`{ email: "abc@def.com", password: "123", nom: "Dupont", ... }`

**Difference avec `.value`** : `.value` n'inclut PAS les champs disabled.
`.getRawValue()` inclut TOUT. Important pour le champ `id_nat` qui est
disabled en mode edition mais dont on a quand meme besoin.

### this.form.patchValue()
```typescript
this.form.patchValue({
    nom: p.nom,
    prenom: p.prenom,
    date_naissance: p.date_naissance?.substring(0, 10)
});
```
**Ce que ca fait** : Met a jour CERTAINS champs du formulaire (pas tous).
Les champs non mentionnes gardent leur valeur actuelle.
Utilise en mode edition : on remplit le formulaire avec les donnees existantes.

### this.form.reset()
```typescript
this.form.reset({ nom: '', prenom: '', email: '' });
```
**Ce que ca fait** : Reinitialise le formulaire aux valeurs fournies.
Utilise apres une creation reussie : on vide le formulaire.

### control.disable()
```typescript
this.form.controls.id_nat.disable();
```
**Ce que ca fait** : Desactive un champ (il devient grise et non modifiable).
En mode edition, on desactive id_nat car on ne peut pas changer la cle primaire.

### this.route.snapshot.paramMap.get('id')
```typescript
const id = this.route.snapshot.paramMap.get('id');
```
**Ce que ca fait** : Lit un parametre de l'URL.
Si l'URL est `/patients/99061534897/edit`, `paramMap.get('id')` retourne `"99061534897"`.
`snapshot` = la photo de l'URL au moment ou le composant a ete cree.


## A6. NAVIGATION (Router)

### this.router.navigate(['/path'])
```typescript
this.router.navigate(['/dashboard']);
this.router.navigate(['/patients']);
this.router.navigate(['/patients', id, 'edit']);
```
**Ce que ca fait** : Change de page dans l'application (sans recharger le navigateur).
`['/patients', id, 'edit']` → `/patients/99061534897/edit`

### this.dialogRef.close(result)
```typescript
this.dialogRef.close(true);   // Ferme le dialog avec succes
this.dialogRef.close(false);  // Ferme le dialog sans succes
```
**Ce que ca fait** : Ferme un dialog (popup) Material. Le parametre
`true`/`false` est retourne au composant qui a ouvert le dialog pour
qu'il sache si l'action a reussi ou a ete annulee.


## A7. GUARDS (protection des routes)

### authGuard (CanActivateFn)
```typescript
export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    if (auth.isAuthenticated()) return true;
    inject(Router).navigate(['/login']);
    return false;
};
```
**Ce que ca fait** : Verifie si l'utilisateur est connecte AVANT d'afficher la page.
Si `isAuthenticated()` est false (pas de token), redirige vers /login.
C'est un vigile a l'entree de chaque page.

### roleGuard
```typescript
export const roleGuard = (...requiredRoles: UserRole[]): CanActivateFn => () => {
    if (auth.hasRole(...requiredRoles)) return true;
    router.navigate(['/dashboard']);
    return false;
};
```
**Ce que ca fait** : Verifie que l'utilisateur a le BON ROLE.
`roleGuard('admin')` → seuls les admins passent.
`roleGuard('secretaire', 'admin')` → secretaires ET admins passent.

### authInterceptor (HttpInterceptorFn)
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = inject(AuthService).token();
    if (token) {
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    return next(req);
};
```
**Ce que ca fait** : Intercepte CHAQUE requete HTTP avant qu'elle parte.
Si on a un token, on le colle dans le header `Authorization: Bearer <token>`.
Si pas de token (pas encore connecte), on envoie la requete sans.

`req.clone(...)` → les requetes HTTP sont IMMUTABLES en Angular,
on ne peut pas les modifier. On cree une COPIE avec le header en plus.


## A8. FONCTIONS JAVASCRIPT NATIVES

### .replace(/\D/g, '')
```typescript
v.id_nat.replace(/\D/g, '')
```
**Ce que ca fait** : Enleve tous les caracteres qui ne sont PAS des chiffres.
`/\D/g` est une expression reguliere : `\D` = tout sauf un chiffre, `g` = global (tous les caracteres).
"99.061.534-897" → "99061534897"

### .substring(0, 10)
```typescript
p.date_naissance?.substring(0, 10)
new Date().toISOString().substring(0, 10)
```
**Ce que ca fait** : Extrait une partie d'une chaine.
`substring(0, 10)` prend les 10 premiers caracteres.
"2024-03-15T00:00:00.000Z".substring(0, 10) → "2024-03-15" (juste la date, sans l'heure)

### .toISOString()
```typescript
new Date().toISOString()
```
**Ce que ca fait** : Convertit une date en chaine au format ISO 8601.
`new Date()` → "2026-06-28T14:30:00.000Z"
Souvent combine avec `.substring(0, 10)` pour n'avoir que "2026-06-28".

### .toLowerCase()
```typescript
const term = this.searchTerm().toLowerCase();
`${p.prenom} ${p.nom}`.toLowerCase().includes(term)
```
**Ce que ca fait** : Convertit une chaine en minuscules.
"DUPONT" → "dupont". Utilise pour les recherches insensibles a la casse.

### .includes()
```typescript
`${p.prenom} ${p.nom}`.toLowerCase().includes(term)
p.id_nat.includes(term)
roles.includes(current)
```
**Ce que ca fait** : Verifie si une chaine contient une sous-chaine (ou si un tableau contient un element).
"Marie Dupont".includes("dup") → true
["admin", "secretaire"].includes("medecin") → false

### .filter()
```typescript
list.filter(p => p.id_nat !== idNat)
list.filter(p => `${p.prenom} ${p.nom}`.toLowerCase().includes(term))
```
**Ce que ca fait** : Cree un NOUVEAU tableau avec seulement les elements
qui respectent la condition. Ne modifie PAS le tableau original.
`list.filter(p => p.id_nat !== '123')` → garde tous les patients sauf celui avec id 123.

### .map()
```typescript
list.map(p => p.id_nat === idNat ? updated : p)
```
**Ce que ca fait** : Cree un NOUVEAU tableau en transformant chaque element.
Ici : pour chaque patient, si c'est celui qu'on vient de modifier, remplace-le
par la version mise a jour ; sinon garde l'original.

### .reduce()
```typescript
this.paiementsSignal().reduce((sum, p) => sum + Number(p.montant), 0)
```
**Ce que ca fait** : Reduit un tableau a une seule valeur en accumulant.
Commence a 0, puis pour chaque paiement, ajoute le montant.
[50, 30, 20].reduce((sum, x) => sum + x, 0) → 100

### .find()
```typescript
jwt.Claims.FirstOrDefault(c => c.Type == type)
```
(C'est la version C#. En TypeScript on utilise `.find()`)
**Ce que ca fait** : Cherche le PREMIER element qui respecte la condition.
Retourne l'element ou undefined/null si pas trouve.

### Number()
```typescript
Number(p.montant)
Number(s.revenu_du_mois).toFixed(2)
```
**Ce que ca fait** : Convertit une valeur en nombre. Utile quand le JSON
renvoie un montant en string ("50.00") et qu'on veut un vrai nombre (50.00).

### .toFixed(2)
```typescript
Number(s.revenu_du_mois).toFixed(2)
```
**Ce que ca fait** : Formate un nombre avec exactement 2 decimales.
75 → "75.00", 49.9 → "49.90", 123.456 → "123.46"

### parseInt()
```typescript
parseInt(val.substring(9, 11), 10)
```
**Ce que ca fait** : Convertit une chaine en nombre entier.
Le 2eme argument `10` est la base (base 10 = decimale).
"97" → 97

### BigInt()
```typescript
const n = BigInt(val.substring(0, 9));
const n2 = BigInt('2' + val.substring(0, 9));
```
**Ce que ca fait** : Cree un nombre de precision arbitraire (pas de limite de taille).
Necessaire pour le calcul modulo 97 du NISS car les nombres normaux de JavaScript
perdent la precision au-dela de 2^53.

`n % 97n` → le `n` apres 97 signifie "c'est un BigInt aussi".

### atob()
```typescript
const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
```
**Ce que ca fait** : Decode une chaine Base64 en texte lisible.
Le JWT est encode en Base64URL (avec - et _ au lieu de + et /).
On remplace d'abord les caracteres, puis on decode.
"eyJzdWIiOiI4NTAzMjAxMjM0NSJ9" → '{"sub":"85032012345"}'

### .split('.')
```typescript
const payload = token.split('.')[1];
```
**Ce que ca fait** : Decoupe une chaine en tableau selon un separateur.
"aaa.bbb.ccc".split('.') → ["aaa", "bbb", "ccc"]
[1] prend le 2eme element (le PAYLOAD du JWT, entre le HEADER et la SIGNATURE).

### JSON.parse()
```typescript
const claims = JSON.parse(json);
```
**Ce que ca fait** : Convertit une chaine JSON en objet JavaScript.
'{"sub":"85032012345","role":"secretaire"}' → { sub: "85032012345", role: "secretaire" }

### confirm()
```typescript
if (!confirm('Supprimer definitivement ce patient ?')) return;
```
**Ce que ca fait** : Affiche une boite de dialogue avec OK/Annuler.
Retourne `true` si l'utilisateur clique OK, `false` sinon.
Utilise comme confirmation avant une suppression.

### typeof
```typescript
if (typeof patient === 'string') { ... }
typeof v === 'string' ? v : `${v.prenom} ${v.nom}`
```
**Ce que ca fait** : Retourne le type d'une variable sous forme de chaine.
typeof "hello" → "string"
typeof 42 → "number"
typeof { nom: "Dupont" } → "object"
Utilise pour verifier si un champ autocomplete contient une string brute ou un objet Patient.


## A9. OPERATEURS SPECIAUX TypeScript/JavaScript

### ?? (null coalescing)
```typescript
err.error?.error ?? 'Erreur de chargement'
dto.IdNatSecretaire ?? undefined
```
**Ce que ca fait** : Si la valeur a GAUCHE est `null` ou `undefined`,
utilise la valeur a DROITE.
`null ?? 'Erreur'` → 'Erreur'
`'Un message'  ?? 'Erreur'` → 'Un message'

### ?. (optional chaining)
```typescript
err.error?.error
p.date_naissance?.substring(0, 10)
```
**Ce que ca fait** : Accede a la propriete seulement si l'objet n'est PAS null/undefined.
Si `err.error` est undefined, au lieu de crasher, ca retourne juste undefined.
Sans `?.` : `err.error.error` crasherait si `err.error` est undefined.

### || (OR logique utilise comme "valeur par defaut")
```typescript
v.motif || undefined
v.adresse || undefined
v.mode_paiement || undefined
```
**Ce que ca fait** : Si la valeur a gauche est "falsy" (false, 0, "", null, undefined),
utilise la valeur a droite. `"" || undefined` → undefined.
Utilise pour ne pas envoyer de chaines vides au backend (on envoie undefined = absent du JSON).

### != null (verifie null ET undefined)
```typescript
if (filtres.sucursaleId != null) params = params.set(...)
```
**Ce que ca fait** : Verifie que la valeur n'est NI `null` NI `undefined`.
`!= null` est VOLONTAIREMENT avec `!=` (pas `!==`) car `!=` traite null et undefined de la meme facon.

### `template literals` (backticks)
```typescript
`${environment.apiUrl}/patients`
`${p.prenom} ${p.nom}`
`Bearer ${token}`
```
**Ce que ca fait** : Permet d'inserer des variables dans une chaine.
Les backticks ` ` (pas les apostrophes '') permettent ${...} pour l'interpolation.

### ... (spread operator)
```typescript
[...list, patient]
```
**Ce que ca fait** : "Etale" un tableau. `[...list, patient]` cree un NOUVEAU tableau
qui contient tous les elements de `list` PLUS `patient` a la fin.
Equivalent de `list.concat([patient])`.

### => (arrow function)
```typescript
list.filter(p => p.id_nat !== idNat)
(err) => { this.errorMessage.set(err.error?.error); }
```
**Ce que ca fait** : Cree une fonction anonyme (sans nom).
`p => p.id_nat !== idNat` est equivalent a `function(p) { return p.id_nat !== idNat; }`
Plus court, plus lisible.


## A10. DECORATEURS ANGULAR (les @trucs)

### @Component({...})
```typescript
@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, MatCardModule, ...],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
```
**Ce que ca fait** : Dit a Angular "cette classe est un composant".
- `selector` : le nom de la balise HTML (`<app-login>`)
- `imports` : les modules/directives utilises dans le template
- `templateUrl` : le fichier HTML associe
- `styleUrl` : le fichier CSS/SCSS associe

### @Injectable({ providedIn: 'root' })
```typescript
@Injectable({ providedIn: 'root' })
export class PatientService { ... }
```
**Ce que ca fait** : Dit a Angular "cette classe est un service injectable".
`providedIn: 'root'` = le service est un SINGLETON pour toute l'application.
Une seule instance, partagee par tous les composants qui l'utilisent.

### interface OnInit / ngOnInit()
```typescript
export class DashboardComponent implements OnInit {
    ngOnInit(): void { ... }
}
```
**Ce que ca fait** : `ngOnInit()` est appele UNE SEULE FOIS quand le composant
est cree et affiche. C'est l'endroit ou on charge les donnees (appels HTTP).
C'est comme le "document.ready" de jQuery ou le "useEffect" de React.


## A11. FONCTIONS DU TEMPLATE HTML

### {{ expression }} (interpolation)
```html
{{ isEdit() ? 'Modifier le patient' : 'Nouveau patient' }}
{{ saving() ? 'En cours...' : 'Creer' }}
```
**Ce que ca fait** : Affiche la valeur d'une expression dans le HTML.
Le `?:` est un operateur ternaire : si `isEdit()` est true → 'Modifier', sinon → 'Nouveau'.

### [property]="value" (property binding)
```html
[disabled]="form.invalid || saving()"
[readonly]="isEdit()"
```
**Ce que ca fait** : Lie une propriete HTML a une valeur TypeScript.
Le bouton est desactive SI le formulaire est invalide OU si on est en cours de sauvegarde.

### (event)="method()" (event binding)
```html
(ngSubmit)="submit()"
(click)="annuler()"
```
**Ce que ca fait** : Quand l'evenement se produit, appelle la methode.
`(ngSubmit)` = quand le formulaire est soumis (clic sur le bouton submit ou touche Entree).
`(click)` = quand on clique sur le bouton.

### @if / @for (blocs de controle Angular 17+)
```html
@if (form.controls.nom.touched && form.controls.nom.hasError('required')) {
    <mat-error>Le nom est obligatoire.</mat-error>
}
```
**Ce que ca fait** : Affiche conditionnellement du HTML. Si la condition est vraie,
le contenu est affiche ; sinon il n'est pas rendu du tout.

### canActivate
```typescript
{ path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] }
```
**Ce que ca fait** : Avant d'afficher cette page, execute le guard.
Si le guard retourne `true` → affiche la page.
Si le guard retourne `false` → redirige ailleurs.


# ═══════════════════════════════════════════════════
# PARTIE B — C# (.NET / ASP.NET / Dapper)
# ═══════════════════════════════════════════════════


## B1. ATTRIBUTS ASP.NET (les [trucs])

### [ApiController]
Active la validation automatique des DTOs. Si un [Required] manque → 400 auto.

### [Route("api/[controller]")]
Definit l'URL de base. [controller] = nom de la classe sans "Controller".
`PatientsController` → `/api/patients`

### [Authorize]
Requiert un JWT valide. Sans token → 401.

### [Authorize(Roles = "admin")]
Requiert un role specifique. Mauvais role → 403.

### [AllowAnonymous]
Annule le [Authorize] pour cette methode. Pas besoin de token.

### [HttpGet], [HttpPost], [HttpPut], [HttpPatch], [HttpDelete]
Dit quel verbe HTTP la methode gere.
`[HttpGet("{id:long}")]` → GET /api/patients/99061534897
`[HttpPatch("{id:int}/statut")]` → PATCH /api/rendezvous/42/statut

### [FromBody], [FromQuery]
Dit OU trouver les donnees.
`[FromBody]` → dans le corps JSON de la requete
`[FromQuery]` → dans les parametres d'URL (?search=Dupont)

### [Required], [EmailAddress], [RegularExpression], [MaxLength], [Range]
Validateurs automatiques sur les DTOs. Verifie AVANT d'entrer dans le controller.

### [JsonIgnore]
Empeche un champ d'apparaitre dans le JSON de reponse.
Utilise sur `MotDePasse` pour ne JAMAIS envoyer le hash au client.

### [JsonConverter(typeof(LongToStringJsonConverter))]
Serialise un long en string dans le JSON (pour proteger la precision en JavaScript).


## B2. METHODES DE CONTROLLER

### Ok(data)
Retourne HTTP 200 avec `data` serialise en JSON.

### CreatedAtAction(action, routeValues, data)
Retourne HTTP 201 Created + header Location + data en JSON.

### Unauthorized(data)
Retourne HTTP 401 avec le message.

### Forbid()
Retourne HTTP 403 Forbidden.

### NoContent()
Retourne HTTP 204 (succes, pas de corps).

### StatusCode(201, data)
Retourne un code HTTP specifique avec des donnees.

### User.IsInRole("role")
Verifie si le JWT contient le role specifie.

### User.FindFirst("claim")?.Value
Lit un claim du JWT. `User.FindFirst("sub")?.Value` → "85032012345".


## B3. METHODES DAPPER

### QueryAsync<T>(sql, params)
Execute un SELECT et retourne une liste d'objets.

### QueryFirstOrDefaultAsync<T>(sql, params)
Execute un SELECT et retourne le premier resultat ou null.

### QueryFirstAsync<T>(sql, params)
Execute un SELECT et retourne le premier resultat (throw si aucun).

### ExecuteAsync(sql, params, transaction)
Execute un INSERT/UPDATE/DELETE. Retourne le nombre de lignes affectees.

### ExecuteScalarAsync<T>(sql, params)
Execute une requete qui retourne UNE valeur (COUNT, LAST_INSERT_ID).


## B4. MOTS-CLES C#

### async / await
```csharp
public async Task<long> CreateAsync(CreatePatientDto dto)
{
    var result = await _repository.CreateAsync(patient);
}
```
`async` : la methode peut contenir des `await`.
`await` : "attend que cette operation asynchrone se termine, mais sans bloquer le serveur".

### Task<T> / Task
```csharp
Task<Patient> → retourne un Patient (quand l'operation sera terminee)
Task          → ne retourne rien (void asynchrone)
```

### using
```csharp
using var connection = CreateConnection();
```
A la fin du bloc, la connexion est AUTOMATIQUEMENT fermee et liberee.
Meme si une exception est levee. C'est un "nettoyeur automatique".

### var
```csharp
var patient = await _repository.GetByIdAsync(idNat);
```
Le compilateur devine le type automatiquement. `var` = raccourci pour ne pas ecrire le type complet.

### ?? (null coalescing C#)
```csharp
patient.Nom = dto.Nom ?? patient.Nom;
```
Meme chose qu'en TypeScript : si la gauche est null, prend la droite.

### ?. (null conditional C#)
```csharp
User.FindFirst("sub")?.Value
```
Meme chose qu'en TypeScript : n'accede a `.Value` que si FindFirst n'est pas null.

### is not null / is null
```csharp
if (medecin is not null) { ... }
if (await _repository.GetByIdAsync(idNat) is null) { ... }
```
Verifie si un objet est null ou pas. Plus lisible que `!= null`.

### throw new Exception(message)
```csharp
throw new PatientNotFoundException(idNat);
throw new DomainValidationException("NISS invalide.");
```
Lance une exception. L'exception remonte jusqu'au middleware qui la traduit en HTTP.

### pattern matching (switch expression)
```csharp
var (status, message) = ex switch
{
    DomainValidationException => (400, ex.Message),
    NotFoundException         => (404, ex.Message),
    _                        => (500, "Erreur interne")
};
```
Verifie le TYPE de l'objet et retourne une valeur differente pour chaque type.
`_` = "tout le reste" (wildcard).

### catch (MySqlException ex) when (ex.Number == 1062)
```csharp
catch (MySqlException ex) when (ex.Number == DuplicateEntry)
```
Attrape UNIQUEMENT les exceptions MySQL avec le numero d'erreur 1062 (doublon).
Les autres exceptions MySQL ne sont PAS attrapees par ce catch.

### record (au lieu de class)
```csharp
public record LoginDto(string Email, string Password);
```
Un type IMMUTABLE avec Equals/GetHashCode auto-generes.
Parfait pour les DTOs car les donnees ne doivent pas etre modifiees.

### abstract class
```csharp
public abstract class BaseRepository { ... }
```
Ne peut PAS etre instanciee directement. Sert de base pour d'autres classes.

### protected
```csharp
protected readonly string ConnectionString;
protected MySqlConnection CreateConnection() => ...
```
Accessible par la classe ET ses classes filles, mais PAS par l'exterieur.

### const
```csharp
protected const int DuplicateEntry = 1062;
const string sql = @"SELECT ...";
```
Valeur constante, definie a la compilation, ne change JAMAIS.

### string.Empty
```csharp
public string Nom { get; set; } = string.Empty;
```
Equivalent de `""`. Plus explicite pour dire "chaine vide, pas null".

### Convert.ToDateTime()
```csharp
DateOnly.FromDateTime(Convert.ToDateTime(value))
```
Convertit n'importe quelle valeur en DateTime C#.

### Encoding.UTF8.GetBytes()
```csharp
Encoding.UTF8.GetBytes(_jwt.Key)
```
Convertit une chaine en tableau d'octets (necessaire pour les operations cryptographiques).

### HMACSHA256
```csharp
using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_jwt.Key));
var signature = hmac.ComputeHash(Encoding.UTF8.GetBytes(unsignedToken));
``` 
Calcule la signature HMAC-SHA256. Utilise pour signer le JWT.

### Convert.ToBase64String() / TrimEnd / Replace
```csharp
Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
```
Encode en Base64, puis convertit en Base64URL (remplace les caracteres non-URL-safe).

### string.Contains("...", StringComparison.OrdinalIgnoreCase)
```csharp
ex.Message.Contains("email", StringComparison.OrdinalIgnoreCase)
```
Verifie si une chaine contient un mot, en ignorant les majuscules/minuscules.

### DateTimeOffset.UtcNow
```csharp
var now = DateTimeOffset.UtcNow;
```
La date et l'heure actuelles en UTC (temps universel). Utilise pour le JWT
car les timestamps doivent etre en UTC.

### .ToUnixTimeSeconds()
```csharp
now.ToUnixTimeSeconds()
```
Convertit en "nombre de secondes depuis le 1er janvier 1970".
C'est le format standard pour les timestamps dans les JWT.

### $"..." (string interpolation C#)
```csharp
$"Patient introuvable (numero national {idNat})."
$"{headerSegment}.{payloadSegment}"
```
Meme chose que les template literals en TypeScript.
Insere des variables dans une chaine.

### @"..." (verbatim string)
```csharp
const string sql = @"
    SELECT id_nat, nom, prenom
    FROM Patient
    WHERE id_nat = @IdNat;";
```
Permet d'ecrire des chaines sur plusieurs lignes.
Utilise pour les requetes SQL lisibles.
