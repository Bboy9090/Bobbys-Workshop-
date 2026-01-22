/**
 * Evidence Bundle - Client-side evidence management
 */

export interface EvidenceBundle {
  id: string;
  name: string;
  timestamp: number;
  items: EvidenceBundleItem[];
  metadata?: Record<string, any>;
}

export interface EvidenceBundleItem {
  type: string;
  data: any;
  timestamp: number;
}

export function createEvidenceBundle(name: string): EvidenceBundle {
  return {
    id: `bundle-${Date.now()}`,
    name,
    timestamp: Date.now(),
    items: [],
  };
}

export function addEvidenceItem(bundle: EvidenceBundle, type: string, data: any): void {
  bundle.items.push({
    type,
    data,
    timestamp: Date.now(),
  });
}

export function exportEvidenceBundle(bundle: EvidenceBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function importEvidenceBundle(json: string): EvidenceBundle {
  return JSON.parse(json);
}

export interface SignatureVerification {
  valid: boolean;
  signedBy?: string;
  timestamp?: number;
  algorithm?: string;
  error?: string;
}

export interface EvidenceBundleAPI {
  create(name: string, deviceSerial: string): Promise<EvidenceBundle>;
  get(id: string): Promise<EvidenceBundle | null>;
  list(): Promise<EvidenceBundle[]>;
  addItem(bundleId: string, item: Omit<EvidenceBundleItem, 'timestamp'>): Promise<boolean>;
  sign(bundleId: string): Promise<string>;
  verify(bundleId: string): Promise<SignatureVerification>;
  export(bundleId: string): Promise<Blob>;
  import(file: Blob): Promise<EvidenceBundle>;
  delete(bundleId: string): Promise<boolean>;
}

const BUNDLES_KEY = 'phoenix.evidenceBundles';
const SIGNATURES_KEY = 'phoenix.evidenceSignatures';

function getStorage() {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available');
  }
  return localStorage;
}

function loadBundles(): EvidenceBundle[] {
  const storage = getStorage();
  const raw = storage.getItem(BUNDLES_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

function saveBundles(list: EvidenceBundle[]) {
  const storage = getStorage();
  storage.setItem(BUNDLES_KEY, JSON.stringify(list));
}

function loadSignatures(): Record<string, string> {
  const storage = getStorage();
  const raw = storage.getItem(SIGNATURES_KEY);
  if (!raw) return {};
  return JSON.parse(raw);
}

function saveSignatures(signatures: Record<string, string>) {
  const storage = getStorage();
  storage.setItem(SIGNATURES_KEY, JSON.stringify(signatures));
}

export const evidenceBundle: EvidenceBundleAPI = {
  async create(name: string, deviceSerial: string): Promise<EvidenceBundle> {
    const bundle: EvidenceBundle = {
      id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name,
      timestamp: Date.now(),
      items: [{
        type: 'device-info',
        data: { deviceSerial, createdAt: Date.now() },
        timestamp: Date.now()
      }]
    };
    const list = loadBundles();
    list.unshift(bundle);
    saveBundles(list);
    return bundle;
  },

  async get(id: string): Promise<EvidenceBundle | null> {
    const list = loadBundles();
    return list.find(bundle => bundle.id === id) || null;
  },

  async list(): Promise<EvidenceBundle[]> {
    const list = loadBundles();
    return list.sort((a, b) => b.timestamp - a.timestamp);
  },

  async addItem(bundleId: string, item: Omit<EvidenceBundleItem, 'timestamp'>): Promise<boolean> {
    const list = loadBundles();
    const bundle = list.find(b => b.id === bundleId);
    if (!bundle) return false;

    bundle.items.push({
      ...item,
      timestamp: Date.now()
    });

    saveBundles(list);
    return true;
  },

  async sign(bundleId: string): Promise<string> {
    const bundle = await this.get(bundleId);
    if (!bundle) {
      throw new Error('Bundle not found');
    }
    
    // Sign via backend API - NO MOCK SIGNATURES
    try {
      const response = await fetch('/api/v1/evidence/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId,
          items: bundle.items,
          metadata: bundle.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Signing failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok || !data.data?.signature) {
        throw new Error(data.error?.message || 'Signing failed');
      }

      const signature = data.data.signature;
      const signatureMap = loadSignatures();
      signatureMap[bundleId] = signature;
      saveSignatures(signatureMap);
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign bundle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async verify(bundleId: string): Promise<SignatureVerification> {
    const signatureMap = loadSignatures();
    const signature = signatureMap[bundleId];
    
    if (!signature) {
      return {
        valid: false,
        error: 'No signature found'
      };
    }
    
    // Verify via backend API - NO FAKE VERIFICATION
    try {
      const response = await fetch('/api/v1/evidence/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId, signature }),
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `Verification failed: HTTP ${response.status}`
        };
      }

      const data = await response.json();
      if (!data.ok) {
        return {
          valid: false,
          error: data.error?.message || 'Verification failed'
        };
      }

      return {
        valid: data.data?.valid ?? false,
        signedBy: data.data?.signedBy ?? 'Unknown',
        timestamp: data.data?.timestamp ?? Date.now(),
        algorithm: data.data?.algorithm ?? 'Unknown'
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  async export(bundleId: string): Promise<Blob> {
    const bundle = await this.get(bundleId);
    if (!bundle) {
      throw new Error('Bundle not found');
    }
    
    const signatureMap = loadSignatures();
    const signature = signatureMap[bundleId];
    const exportData = {
      bundle,
      signature,
      exportedAt: Date.now()
    };
    
    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  },

  async import(file: Blob): Promise<EvidenceBundle> {
    const text = await file.text();
    const data = JSON.parse(text);
    
    const bundle = data.bundle || data;
    bundle.id = `bundle-${Date.now()}-imported`;

    const list = loadBundles();
    list.unshift(bundle);
    saveBundles(list);

    if (data.signature) {
      const signatureMap = loadSignatures();
      signatureMap[bundle.id] = data.signature;
      saveSignatures(signatureMap);
    }

    return bundle;
  },

  async delete(bundleId: string): Promise<boolean> {
    const signatureMap = loadSignatures();
    delete signatureMap[bundleId];
    saveSignatures(signatureMap);

    const list = loadBundles();
    const filtered = list.filter(bundle => bundle.id !== bundleId);
    saveBundles(filtered);
    return filtered.length !== list.length;
  }
};
