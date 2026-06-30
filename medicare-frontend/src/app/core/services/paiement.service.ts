import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuditLog,
  CreatePaiementDto,
  Paiement,
  UpdatePaiementDto
} from '../models/paiement.model';

export interface PaiementFiltres {
  patientId?: string;
  dateDebut?: string;
  dateFin?: string;
}

@Injectable({ providedIn: 'root' })
export class PaiementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/paiements`;

  private paiementsSignal = signal<Paiement[]>([]);
  readonly paiements = this.paiementsSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Indicateurs dérivés (montant total du mois courant + total).
  readonly totalPaiements = computed(() => this.paiementsSignal().length);
  readonly montantTotal = computed(() =>
    this.paiementsSignal().reduce((sum, p) => sum + Number(p.montant), 0));
  readonly montantDuMois = computed(() => {
    const now = new Date();
    return this.paiementsSignal()
      .filter(p => {
        const d = new Date(p.date_paiement);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.montant), 0);
  });

  loadPaiements(filtres: PaiementFiltres = {}): void {
    this.isLoading.set(true);
    this.error.set(null);
    let params = new HttpParams();
    if (filtres.patientId) params = params.set('patientId', filtres.patientId);
    if (filtres.dateDebut) params = params.set('dateDebut', filtres.dateDebut);
    if (filtres.dateFin) params = params.set('dateFin', filtres.dateFin);

    this.http.get<Paiement[]>(this.apiUrl, { params }).subscribe({
      next: (data) => { this.paiementsSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getById(id: number): Observable<Paiement> {
    return this.http.get<Paiement>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreatePaiementDto): Observable<Paiement> {
    return this.http.post<Paiement>(this.apiUrl, dto).pipe(
      tap(paiement => this.paiementsSignal.update(list => [paiement, ...list]))
    );
  }

  update(id: number, dto: UpdatePaiementDto): Observable<Paiement> {
    return this.http.put<Paiement>(`${this.apiUrl}/${id}`, dto).pipe(
      tap(updated => this.paiementsSignal.update(list =>
        list.map(p => p.id_paiement === id ? updated : p)))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.paiementsSignal.update(list => list.filter(p => p.id_paiement !== id)))
    );
  }

  getAuditLog(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/audit`);
  }
}
