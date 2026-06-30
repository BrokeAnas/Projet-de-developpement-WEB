import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Assurance, CreateAssuranceDto } from '../models/assurance.model';

@Injectable({ providedIn: 'root' })
export class AssuranceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/assurances`;

  private assurancesSignal = signal<Assurance[]>([]);
  readonly assurances = this.assurancesSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadAssurances(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<Assurance[]>(this.apiUrl).subscribe({
      next: (data) => { this.assurancesSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }
  // Cette méthode permet de charger toutes les assurances depuis l'API et de mettre à jour le signal
  getAll(): Observable<Assurance[]> {
    return this.http.get<Assurance[]>(this.apiUrl);
  }

  create(dto: CreateAssuranceDto): Observable<Assurance> {
    return this.http.post<Assurance>(this.apiUrl, dto).pipe(
      tap(a => this.assurancesSignal.update(list => [...list, a]))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.assurancesSignal.update(list => list.filter(a => a.id_assurance !== id)))
    );
  }
}
