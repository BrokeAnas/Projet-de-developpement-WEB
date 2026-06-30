import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginDto, UserRole } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // Stockage en mémoire vive uniquement (protection XSS) — aucun stockage persistant.
  private tokenSignal = signal<string | null>(null);
  private roleSignal = signal<UserRole | null>(null);
  private nomSignal = signal<string | null>(null);
  private userIdSignal = signal<string | null>(null);

  readonly token = this.tokenSignal.asReadonly();
  readonly role = this.roleSignal.asReadonly();
  readonly nom = this.nomSignal.asReadonly();
  readonly userId = this.userIdSignal.asReadonly();
  // Le signal isAuthenticated est calculé en fonction de la présence d'un token.
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  login(dto: LoginDto): Observable<void> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, dto).pipe(
      tap(response => {
        this.tokenSignal.set(response.token);
        this.roleSignal.set(response.role as UserRole);
        this.nomSignal.set(`${response.prenom} ${response.nom}`);
        this.userIdSignal.set(this.extractSub(response.token));
      }),
      map(() => void 0)
    );
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.roleSignal.set(null);
    this.nomSignal.set(null);
    this.userIdSignal.set(null);
    this.router.navigate(['/login']);
  }

  /** Extrait le claim « sub » (identifiant utilisateur) du JWT, sans librairie externe. */
  private extractSub(token: string): string | null {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(json);
      return claims.sub ?? null;
    } catch {
      return null;
    }
  }

  hasRole(...roles: UserRole[]): boolean {
    const current = this.roleSignal();
    return current !== null && roles.includes(current);
  }
}
