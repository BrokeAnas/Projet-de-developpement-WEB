import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateMedecinDto, Medecin, UpdateMedecinDto } from '../models/medecin.model';

@Injectable({ providedIn: 'root' })
export class MedecinService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/medecins`;

  private medecinsSignal = signal<Medecin[]>([]);
  readonly medecins = this.medecinsSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadMedecins(search?: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    this.http.get<Medecin[]>(this.apiUrl, { params }).subscribe({
      next: (data) => { this.medecinsSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getById(idNat: string): Observable<Medecin> {
    return this.http.get<Medecin>(`${this.apiUrl}/${idNat}`);
  }

  create(dto: CreateMedecinDto): Observable<Medecin> {
    return this.http.post<Medecin>(this.apiUrl, dto).pipe(
      tap(medecin => this.medecinsSignal.update(list => [...list, medecin]))
    );
  }

  update(idNat: string, dto: UpdateMedecinDto): Observable<Medecin> {
    return this.http.put<Medecin>(`${this.apiUrl}/${idNat}`, dto).pipe(
      tap(updated => this.medecinsSignal.update(list =>
        list.map(m => m.id_nat === idNat ? updated : m)))
    );
  }

  delete(idNat: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idNat}`).pipe(
      tap(() => this.medecinsSignal.update(list => list.filter(m => m.id_nat !== idNat)))
    );
  }
}
