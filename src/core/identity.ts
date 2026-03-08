/**
 * Cocoro Device Identity
 *
 * Generates and manages the unique device identity:
 * - Ed25519 keypair
 * - Hardware fingerprint (scrypt-derived, not direct)
 * - Encrypted private key storage (AES-256-GCM)
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    generateEd25519KeyPair,
    encrypt,
    decrypt,
    sha256,
    type EncryptedPayload,
} from './crypto';

const DATA_DIR = path.join(process.cwd(), '.cocoro');
const IDENTITY_FILE = path.join(DATA_DIR, 'device_identity.json');
const PRIVATE_KEY_FILE = path.join(DATA_DIR, 'device_private_key.enc');

// ─── Types ───────────────────────────────────────────────────

export interface DeviceIdentity {
    device_id: string;
    public_key: string;
    creation_time: string;
    fingerprint_hash: string; // truncated hash, not raw fingerprint
}

export interface UserProfile {
    name: string;
    nickname: string;
    interests: string[];
    ai_preferences: {
        personality: string;
        language: string;
        formality: string;
    };
}

// ─── Helpers ─────────────────────────────────────────────────

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Collect hardware fingerprint material.
 * This is used as the source for scrypt KDF — never used directly as a key.
 */
function getHardwareFingerprint(): string {
    const interfaces = os.networkInterfaces();
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const cpus = os.cpus().map(c => c.model).join(',');

    let mac = '';
    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (iface) {
            for (const info of iface) {
                if (!info.internal && info.mac !== '00:00:00:00:00:00') {
                    mac = info.mac;
                    break;
                }
            }
        }
        if (mac) break;
    }

    return `cocoro:identity:${hostname}:${platform}:${arch}:${cpus}:${mac}`;
}

// ─── Identity Management ────────────────────────────────────

let cachedIdentity: DeviceIdentity | null = null;

export function getOrCreateDeviceIdentity(): DeviceIdentity {
    if (cachedIdentity) return cachedIdentity;

    ensureDataDir();

    // Load existing identity
    if (fs.existsSync(IDENTITY_FILE)) {
        cachedIdentity = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'));
        return cachedIdentity!;
    }

    // Generate new identity
    const keyPair = generateEd25519KeyPair();
    const fingerprint = getHardwareFingerprint();

    const identity: DeviceIdentity = {
        device_id: uuidv4(),
        public_key: keyPair.publicKey,
        creation_time: new Date().toISOString(),
        fingerprint_hash: sha256(fingerprint).substring(0, 16) + '...',
    };

    // Save identity (public info only)
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));

    // Encrypt private key using scrypt-derived key from fingerprint
    // encrypt() internally uses scrypt + random salt
    const encryptedPrivateKey = encrypt(keyPair.privateKey, fingerprint);
    fs.writeFileSync(PRIVATE_KEY_FILE, JSON.stringify(encryptedPrivateKey, null, 2));

    cachedIdentity = identity;
    return identity;
}

/**
 * Decrypt and retrieve the private key.
 */
export function getPrivateKey(): string | null {
    if (!fs.existsSync(PRIVATE_KEY_FILE)) return null;

    try {
        const payload: EncryptedPayload = JSON.parse(
            fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        );
        const fingerprint = getHardwareFingerprint();
        return decrypt(payload, fingerprint);
    } catch {
        return null;
    }
}

// ─── User Profile ────────────────────────────────────────────

import { getDatabase } from '@/db';

const DEFAULT_PROFILE: UserProfile = {
    name: 'ユーザー',
    nickname: 'ユーザー',
    interests: ['AI', 'テクノロジー'],
    ai_preferences: {
        personality: 'friendly',
        language: 'ja',
        formality: 'casual',
    },
};

export function getUserProfile(): UserProfile {
    try {
        const db = getDatabase();
        const row = db.prepare('SELECT value FROM user_settings WHERE key = ?').get('profile') as { value: string } | undefined;
        if (row) return JSON.parse(row.value);
    } catch {
        // Fall through to default
    }
    return { ...DEFAULT_PROFILE };
}

export function updateUserProfile(updates: Partial<UserProfile>): UserProfile {
    const current = getUserProfile();
    const updated = {
        ...current,
        ...updates,
        ai_preferences: {
            ...current.ai_preferences,
            ...(updates.ai_preferences || {}),
        },
    };

    const db = getDatabase();
    db.prepare(`
    INSERT INTO user_settings (key, value, encrypted, updated_at)
    VALUES ('profile', ?, 0, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
  `).run(
        JSON.stringify(updated),
        new Date().toISOString(),
        JSON.stringify(updated),
        new Date().toISOString()
    );

    return updated;
}
