import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/test?schema=public';
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
process.env.SECRETS_ENCRYPTION_KEY ??= 'test-encryption-key';

const secrets = await import('./secrets.js');

test('encryptSecret and decryptSecret round-trip', () => {
    const original = 'smtp-password-123';
    const encrypted = secrets.encryptSecret(original);

    assert.ok(typeof encrypted === 'string');
    assert.notEqual(encrypted, original);
    assert.equal(secrets.decryptSecret(encrypted), original);
});

test('encryptSecret is idempotent on already-encrypted values', () => {
    const encrypted = secrets.encryptSecret('value-1');
    const encryptedAgain = secrets.encryptSecret(encrypted);

    assert.equal(encryptedAgain, encrypted);
});
