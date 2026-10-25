import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type Status = 'OFFLINE' | 'AUTHORIZING' | 'TRANSPORT_AUTHORIZED' | 'VALIDATING';
type InitResponse = { token: string; status: string; expiresInSeconds: number };
type ValidateResponse = { valid: boolean; status: string };

export function useDeviceSession(targetSerial: string | null | undefined) {
  const [status, setStatus] = useState<Status>('OFFLINE');
  const [error, setError] = useState<string | null>(null);
  const [leaseAge, setLeaseAge] = useState(0);
  const [active, setActive] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const startRef = useRef(0);
  const deadlineRef = useRef(0);
  const serialRef = useRef(targetSerial);
  serialRef.current = targetSerial;

  const clearSession = useCallback(() => {
    epochRef.current += 1;
    const token = tokenRef.current;
    tokenRef.current = null;
    if (token) {
      void invoke<boolean>('tauri_revoke_adb_session', { request: { token } })
        .catch((e) => console.warn('Native session revocation failed:', e));
    }
    deadlineRef.current = 0;
    setActive(false);
    setLeaseAge(0);
    setStatus('OFFLINE');
  }, []);

  const initializeSession = useCallback(async () => {
    clearSession();
    const serial = serialRef.current;
    if (!serial) { setError('Select an ADB target first.'); return; }
    const epoch = epochRef.current;
    setError(null);
    setStatus('AUTHORIZING');
    try {
      const result = await invoke<InitResponse>('tauri_initialize_adb_session', { request: { targetSerial: serial } });
      if (epoch !== epochRef.current || serial !== serialRef.current) return;
      if (!result.token || result.status !== 'adb_transport_authorized') throw new Error('Native authorization was not confirmed');
      tokenRef.current = result.token;
      startRef.current = Date.now();
      deadlineRef.current = startRef.current + Math.min(result.expiresInSeconds, 300) * 1000;
      setActive(true);
      setStatus('TRANSPORT_AUTHORIZED');
    } catch (e) {
      if (epoch !== epochRef.current) return;
      clearSession();
      setError(String(e));
    }
  }, [clearSession]);

  useEffect(() => { clearSession(); return clearSession; }, [targetSerial, clearSession]);

  useEffect(() => {
    if (!active) return;
    let checking = false;
    const tick = async () => {
      const token = tokenRef.current;
      if (!token) return;
      if (Date.now() >= deadlineRef.current) {
        clearSession(); setError('Device session expired.'); return;
      }
      setLeaseAge(Math.floor((Date.now() - startRef.current) / 1000));
      if (checking) return;
      checking = true;
      const epoch = epochRef.current;
      try {
        const result = await invoke<ValidateResponse>('tauri_validate_adb_session', { request: { token } });
        if (epoch !== epochRef.current) return;
        if (!result.valid || result.status !== 'adb_transport_authorized') throw new Error('Authorization lost');
      } catch (e) {
        if (epoch === epochRef.current) { clearSession(); setError(`Transport validation failed: ${String(e)}`); }
      } finally { checking = false; }
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, 4000);
    return () => clearInterval(timer);
  }, [active, clearSession]);

  return { active, status, error, leaseAge, initializeSession, clearSession };
}
