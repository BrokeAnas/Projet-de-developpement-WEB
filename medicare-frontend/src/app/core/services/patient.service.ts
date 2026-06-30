import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AddAssuranceDto,
  AddMaladieDto,
  CreatePatientDto,
  Patient,
  PatientAssurance,
  PatientMaladie,
  UpdatePatientDto
} from '../models/patient.model';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/patients`;

  // Gestion d'état via signal (PAS de NgRx, PAS de Redux).
  private patientsSignal = signal<Patient[]>([]);
  readonly patients = this.patientsSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadPatients(search?: string, page = 1, pageSize = 20): void {
    this.isLoading.set(true);
    this.error.set(null);
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    this.http.get<Patient[]>(this.apiUrl, { params }).subscribe({
      next: (data) => { this.patientsSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getById(idNat: string): Observable<Patient> {
    return this.http.get<Patient>(`${this.apiUrl}/${idNat}`);
  }

  // Returne un Observable<Patient> pour permettre à l'appelant de gérer la réponse ou l'erreur.
  // Le tap() est utilisé pour mettre à jour le signal local après la création du patient.
  create(dto: CreatePatientDto): Observable<Patient> {
    return this.http.post<Patient>(this.apiUrl, dto).pipe(
      tap(patient => this.patientsSignal.update(list => [...list, patient]))
    );
  }

  update(idNat: string, dto: UpdatePatientDto): Observable<Patient> {
    return this.http.put<Patient>(`${this.apiUrl}/${idNat}`, dto).pipe(
      tap(updated => this.patientsSignal.update(list =>
        list.map(p => p.id_nat === idNat ? updated : p)))
    );
  }

  delete(idNat: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idNat}`).pipe(
      tap(() => this.patientsSignal.update(list => list.filter(p => p.id_nat !== idNat)))
    );
  }

  getMaladies(idNat: string): Observable<PatientMaladie[]> {
    return this.http.get<PatientMaladie[]>(`${this.apiUrl}/${idNat}/maladies`);
  }

  addMaladie(idNat: string, dto: AddMaladieDto): Observable<PatientMaladie[]> {
    return this.http.post<PatientMaladie[]>(`${this.apiUrl}/${idNat}/maladies`, dto);
  }

  getAssurances(idNat: string): Observable<PatientAssurance[]> {
    return this.http.get<PatientAssurance[]>(`${this.apiUrl}/${idNat}/assurances`);
  }

  addAssurance(idNat: string, dto: AddAssuranceDto): Observable<PatientAssurance[]> {
    return this.http.post<PatientAssurance[]>(`${this.apiUrl}/${idNat}/assurances`, dto);
  }

  removeAssurance(idNat: string, idAssurance: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idNat}/assurances/${idAssurance}`);
  }
}
