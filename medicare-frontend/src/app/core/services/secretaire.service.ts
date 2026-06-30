import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSecretaireDto, Secretaire, UpdateSecretaireDto } from '../models/secretaire.model';

@Injectable({ providedIn: 'root' })
export class SecretaireService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/secretaires`;

  private secretairesSignal = signal<Secretaire[]>([]);
  readonly secretaires = this.secretairesSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadSecretaires(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<Secretaire[]>(this.apiUrl).subscribe({
      next: (data) => { this.secretairesSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getById(idNat: string): Observable<Secretaire> {
    return this.http.get<Secretaire>(`${this.apiUrl}/${idNat}`);
  }

  create(dto: CreateSecretaireDto): Observable<Secretaire> {
    return this.http.post<Secretaire>(this.apiUrl, dto).pipe(
      tap(secretaire => this.secretairesSignal.update(list => [...list, secretaire]))
    );
  }

  update(idNat: string, dto: UpdateSecretaireDto): Observable<Secretaire> {
    return this.http.put<Secretaire>(`${this.apiUrl}/${idNat}`, dto).pipe(
      tap(updated => this.secretairesSignal.update(list =>
        list.map(s => s.id_nat === idNat ? updated : s)))
    );
  }

  delete(idNat: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idNat}`).pipe(
      tap(() => this.secretairesSignal.update(list => list.filter(s => s.id_nat !== idNat)))
    );
  }
}
