/**
 * 🌟 World Class Universal Legend - End-to-End Encryption
 * 
 * Enterprise-grade encryption with:
 * - AES-256-GCM encryption
 * - Key management
 * - Data at rest encryption
 * - Data in transit encryption
 * - Key rotation
 */

import crypto from 'crypto';

class Encryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.masterKey = this._getOrGenerateMasterKey();
  }

  _getOrGenerateMasterKey() {
    // In production, this should come from a secure key management service
    const envKey = process.env.ENCRYPTION_MASTER_KEY;
    if (envKey) {
      return Buffer.from(envKey, 'hex');
    }

    // Generate a key for development (should be persisted securely)
    console.warn('⚠️  Using generated master key. Set ENCRYPTION_MASTER_KEY in production!');
    return crypto.randomBytes(this.keyLength);
  }

  // Derive key from master key and context
  _deriveKey(context = 'default') {
    return crypto.pbkdf2Sync(
      this.masterKey,
      context,
      100000, // iterations
      this.keyLength,
      'sha256'
    );
  }

  // Encrypt data
  encrypt(data, context = 'default') {
    try {
      const key = this._deriveKey(context);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Return encrypted data with IV and tag
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        context,
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  // Decrypt data
  decrypt(encryptedData, context = 'default') {
    try {
      const key = this._deriveKey(context);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  // Encrypt sensitive fields in object
  encryptFields(obj, fields, context = 'default') {
    const encrypted = { ...obj };
    
    for (const field of fields) {
      if (encrypted[field]) {
        const encryptedData = this.encrypt(encrypted[field], `${context}:${field}`);
        encrypted[field] = encryptedData;
        encrypted[`${field}_encrypted`] = true;
      }
    }

    return encrypted;
  }

  // Decrypt sensitive fields in object
  decryptFields(obj, fields, context = 'default') {
    const decrypted = { ...obj };
    
    for (const field of fields) {
      if (decrypted[`${field}_encrypted`] && decrypted[field]) {
        try {
          decrypted[field] = this.decrypt(decrypted[field], `${context}:${field}`);
          delete decrypted[`${field}_encrypted`];
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    }

    return decrypted;
  }

  // Hash data (one-way)
  hash(data, salt = null) {
    const hash = crypto.createHash('sha256');
    if (salt) {
      hash.update(salt);
    }
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  // Generate secure random token
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure random password
  generatePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const bytes = crypto.randomBytes(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }
    
    return password;
  }

  // Rotate master key (requires re-encryption of all data)
  rotateMasterKey(newKey) {
    const oldKey = this.masterKey;
    this.masterKey = Buffer.from(newKey, 'hex');
    
    // In production, this would trigger a re-encryption job
    console.log('⚠️  Master key rotated. Re-encryption required for all data.');
    
    return {
      success: true,
      message: 'Master key rotated. Re-encryption job should be triggered.',
      oldKeyHash: crypto.createHash('sha256').update(oldKey).digest('hex'),
      newKeyHash: crypto.createHash('sha256').update(this.masterKey).digest('hex'),
    };
  }
}

export default new Encryption();
