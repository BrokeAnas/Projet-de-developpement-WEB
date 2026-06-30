import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Injecte automatiquement l'en-tête « Authorization: Bearer {token} »
 * lorsque l'utilisateur est authentifié.
 */
// C'est utile pour sécuriser les requêtes HTTP en ajoutant le token d'authentification
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (token) {
    // On clone la requête et on ajoute l'en-tête Authorization avec le token
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
