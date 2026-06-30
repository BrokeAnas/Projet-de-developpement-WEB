import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSpecialisationDto, Specialisation } from '../models/specialisation.model';

@Injectable({ providedIn: 'root' })
export class SpecialisationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/specialisations`;

  private specialisationsSignal = signal<Specialisation[]>([]);
  readonly specialisations = this.specialisationsSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadSpecialisations(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<Specialisation[]>(this.apiUrl).subscribe({
      next: (data) => { this.specialisationsSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getAll(): Observable<Specialisation[]> {
    return this.http.get<Specialisation[]>(this.apiUrl);
  }

  create(dto: CreateSpecialisationDto): Observable<Specialisation> {
    return this.http.post<Specialisation>(this.apiUrl, dto).pipe(
      tap(s => this.specialisationsSignal.update(list => [...list, s]))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.specialisationsSignal.update(list => list.filter(s => s.id_specialisation !== id)))
    );
  }
}
