export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  role: string;
  nom: string;
  prenom: string;
}

export type UserRole = 'admin' | 'medecin' | 'secretaire';
