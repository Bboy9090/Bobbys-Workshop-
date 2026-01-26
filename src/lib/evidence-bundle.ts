/**
 * Evidence Bundle - Stub implementation for evidence management
 */

export interface EvidenceBundle {
  id: string;
  name: string;
  timestamp: number;
  items: EvidenceBundleItem[];
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

// In-memory storage
const bundles: Map<string, EvidenceBundle> = new Map();
const signatures: Map<string, string> = new Map();

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
    
    bundles.set(bundle.id, bundle);
    return bundle;
  },

  async get(id: string): Promise<EvidenceBundle | null> {
    return bundles.get(id) || null;
  },

  async list(): Promise<EvidenceBundle[]> {
    return Array.from(bundles.values()).sort((a, b) => b.timestamp - a.timestamp);
  },

  async addItem(bundleId: string, item: Omit<EvidenceBundleItem, 'timestamp'>): Promise<boolean> {
    const bundle = bundles.get(bundleId);
    if (!bundle) return false;
    
    bundle.items.push({
      ...item,
      timestamp: Date.now()
    });
    
    return true;
  },

  async sign(bundleId: string): Promise<string> {
    const bundle = bundles.get(bundleId);
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
      signatures.set(bundleId, signature);
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign bundle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async verify(bundleId: string): Promise<SignatureVerification> {
    const signature = signatures.get(bundleId);
    
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
    const bundle = bundles.get(bundleId);
    if (!bundle) {
      throw new Error('Bundle not found');
    }
    
    const signature = signatures.get(bundleId);
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
    
    bundles.set(bundle.id, bundle);
    if (data.signature) {
      signatures.set(bundle.id, data.signature);
    }
    
    return bundle;
  },

  async delete(bundleId: string): Promise<boolean> {
    signatures.delete(bundleId);
    return bundles.delete(bundleId);
  }
};
