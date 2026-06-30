import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateRendezVousDto,
  RendezVous,
  StatutRdv,
  UpdateRendezVousDto
} from '../models/rendezvous.model';

export interface RendezVousFiltres {
  medecinId?: string;
  patientId?: string;
  sucursaleId?: number;
  date?: string;
}

@Injectable({ providedIn: 'root' })
export class RendezVousService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/rendezvous`;

  private rendezVousSignal = signal<RendezVous[]>([]);
  readonly rendezVous = this.rendezVousSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadRendezVous(filtres: RendezVousFiltres = {}): void {
    this.isLoading.set(true);
    this.error.set(null);
    let params = new HttpParams();
    if (filtres.medecinId) params = params.set('medecinId', filtres.medecinId);
    if (filtres.patientId) params = params.set('patientId', filtres.patientId);
    if (filtres.sucursaleId != null) params = params.set('sucursaleId', filtres.sucursaleId);
    if (filtres.date) params = params.set('date', filtres.date);

    this.http.get<RendezVous[]>(this.apiUrl, { params }).subscribe({
      next: (data) => { this.rendezVousSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getById(id: number): Observable<RendezVous> {
    return this.http.get<RendezVous>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateRendezVousDto): Observable<RendezVous> {
    return this.http.post<RendezVous>(this.apiUrl, dto).pipe(
      tap(rdv => this.rendezVousSignal.update(list => [...list, rdv]))
    );
  }

  update(id: number, dto: UpdateRendezVousDto): Observable<RendezVous> {
    return this.http.put<RendezVous>(`${this.apiUrl}/${id}`, dto).pipe(
      tap(updated => this.rendezVousSignal.update(list =>
        list.map(r => r.id_rdv === id ? updated : r)))
    );
  }

  updateStatut(id: number, statut: StatutRdv): Observable<RendezVous> {
    return this.http.patch<RendezVous>(`${this.apiUrl}/${id}/statut`, { statut }).pipe(
      tap(updated => this.rendezVousSignal.update(list =>
        list.map(r => r.id_rdv === id ? updated : r)))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.rendezVousSignal.update(list => list.filter(r => r.id_rdv !== id)))
    );
  }
}
