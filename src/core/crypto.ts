/**
 * Cocoro Crypto Module
 * 
 * Allowed primitives: AES-256-GCM, Ed25519, scrypt, SHA-256
 * Forbidden: AES-CBC, MD5, SHA-1
 * 
 * All encryption uses AEAD (Authenticated Encryption with Associated Data).
 * Key derivation uses scrypt with random salt.
 */

import {
    randomBytes,
    createCipheriv,
    createDecipheriv,
    scryptSync,
    createHash,
    generateKeyPairSync,
} from 'crypto';

// ─── Types ───────────────────────────────────────────────────

export interface EncryptedPayload {
    iv: string;        // hex
    ciphertext: string; // hex
    authTag: string;    // hex
    salt: string;       // hex (for key derivation)
}

export interface KeyPair {
    publicKey: string;  // PEM
    privateKey: string; // PEM
}

// ─── Constants ───────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELISM = 1; // p

// ─── Key Derivation ──────────────────────────────────────────

/**
 * Derive an encryption key using scrypt.
 * Never derive keys directly from hardware fingerprints.
 * Always use scrypt(source + randomSalt).
 */
export function deriveKey(source: string, salt: Buffer): Buffer {
    return scryptSync(source, salt, KEY_LENGTH, {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELISM,
    });
}

/**
 * Generate a random salt for key derivation.
 */
export function generateSalt(): Buffer {
    return randomBytes(SALT_LENGTH);
}

// ─── AES-256-GCM Encryption ─────────────────────────────────

/**
 * Encrypt plaintext using AES-256-GCM (AEAD).
 * Returns iv + ciphertext + authTag + salt.
 */
export function encrypt(plaintext: string, keySource: string): EncryptedPayload {
    const salt = generateSalt();
    const key = deriveKey(keySource, salt);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
        iv: iv.toString('hex'),
        ciphertext,
        authTag,
        salt: salt.toString('hex'),
    };
}

/**
 * Encrypt with a pre-derived key (no salt generation).
 */
export function encryptWithKey(plaintext: string, key: Buffer): Omit<EncryptedPayload, 'salt'> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return { iv: iv.toString('hex'), ciphertext, authTag };
}

/**
 * Decrypt AES-256-GCM encrypted payload.
 */
export function decrypt(payload: EncryptedPayload, keySource: string): string {
    const salt = Buffer.from(payload.salt, 'hex');
    const key = deriveKey(keySource, salt);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
}

/**
 * Decrypt with a pre-derived key.
 */
export function decryptWithKey(
    payload: Omit<EncryptedPayload, 'salt'>,
    key: Buffer
): string {
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
}

// ─── Ed25519 Key Pair ────────────────────────────────────────

/**
 * Generate an Ed25519 key pair for device identity.
 */
export function generateEd25519KeyPair(): KeyPair {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
}

// ─── Utility ─────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random token.
 */
export function generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
}

/**
 * SHA-256 hash (for non-security-critical operations only).
 */
export function sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}
