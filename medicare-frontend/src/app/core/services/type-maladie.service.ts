import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateTypeMaladieDto, TypeMaladie } from '../models/type-maladie.model';

@Injectable({ providedIn: 'root' })
export class TypeMaladieService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/typesmaladies`;

  private typesSignal = signal<TypeMaladie[]>([]);
  readonly types = this.typesSignal.asReadonly();
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadTypes(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.http.get<TypeMaladie[]>(this.apiUrl).subscribe({
      next: (data) => { this.typesSignal.set(data); this.isLoading.set(false); },
      error: (err) => { this.error.set(err.error?.error ?? 'Erreur de chargement'); this.isLoading.set(false); }
    });
  }

  getAll(): Observable<TypeMaladie[]> {
    return this.http.get<TypeMaladie[]>(this.apiUrl);
  }

  create(dto: CreateTypeMaladieDto): Observable<TypeMaladie> {
    return this.http.post<TypeMaladie>(this.apiUrl, dto).pipe(
      tap(t => this.typesSignal.update(list => [...list, t]))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.typesSignal.update(list => list.filter(t => t.id_maladie !== id)))
    );
  }
}
