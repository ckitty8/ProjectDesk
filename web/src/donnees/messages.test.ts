import { describe, expect, it } from 'vitest';
import { emailNonVerifie, messageConnexion } from './messages';

describe('messages de connexion', () => {
  it('traduit un mauvais mot de passe', () => {
    expect(messageConnexion({ message: 'Invalid email or password' })).toBe('Email ou mot de passe incorrect.');
  });
  it('traduit un code de vérification refusé', () => {
    expect(messageConnexion({ message: 'Invalid OTP' })).toContain('Code incorrect ou expiré');
  });
  it('nomme l\'adresse du site quand Neon Auth la refuse', () => {
    expect(messageConnexion({ message: 'Invalid origin' }, 'https://x.fr')).toContain('https://x.fr');
  });
  it('traduit compte existant, réseau et lien expiré', () => {
    expect(messageConnexion({ message: 'User already exists' })).toContain('Un compte existe déjà');
    expect(messageConnexion({ message: 'Failed to fetch' })).toContain('injoignable');
    expect(messageConnexion({ message: 'INVALID_TOKEN' })).toContain('Lien de réinitialisation expiré');
  });
  it('laisse passer un message inconnu', () => {
    expect(messageConnexion({ message: 'Autre' })).toBe('Autre');
  });
  it('détecte un email non vérifié, par code ou par texte', () => {
    expect(emailNonVerifie({ code: 'EMAIL_NOT_VERIFIED' })).toBe(true);
    expect(emailNonVerifie({ message: 'Email is not verified' })).toBe(true);
    expect(emailNonVerifie({ message: 'autre' })).toBe(false);
  });
});
