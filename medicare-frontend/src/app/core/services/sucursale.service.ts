import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSucursaleDto, Sucursale, UpdateSucursaleDto } from '../models/sucursale.model';

@Injectable({ providedIn: 'root' })
export class SucursaleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/sucursales`;

  private sucursalesSignal = signal<Sucursale[]>([]);
  readonly sucursales = this.sucursalesSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadSucursales(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<Sucursale[]>(this.apiUrl).subscribe({
      next: (data) => { this.sucursalesSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getAll(): Observable<Sucursale[]> {
    return this.http.get<Sucursale[]>(this.apiUrl);
  }

  getById(id: number): Observable<Sucursale> {
    return this.http.get<Sucursale>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateSucursaleDto): Observable<Sucursale> {
    return this.http.post<Sucursale>(this.apiUrl, dto).pipe(
      tap(s => this.sucursalesSignal.update(list => [...list, s]))
    );
  }

  update(id: number, dto: UpdateSucursaleDto): Observable<Sucursale> {
    return this.http.put<Sucursale>(`${this.apiUrl}/${id}`, dto).pipe(
      tap(updated => this.sucursalesSignal.update(list =>
        list.map(s => s.id_sucursale === id ? updated : s)))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.sucursalesSignal.update(list => list.filter(s => s.id_sucursale !== id)))
    );
  }
}
