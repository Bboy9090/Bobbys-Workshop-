import { useDeviceSession } from '../hooks/useDeviceSession';

export function WorkflowControlPanel({ targetSerial }: { targetSerial?: string | null }) {
  const { active, status, error, leaseAge, initializeSession, clearSession } = useDeviceSession(targetSerial);
  return (
    <section aria-label="ADB session context" style={{ padding: 16, border: '1px solid currentColor', borderRadius: 8 }}>
      <h3>ADB Session Context</h3>
      <p>Target: {targetSerial || 'No device selected'}</p>
      <p role="status">Transport: {status}</p>
      {active && <p>Lease age: {leaseAge}s / 300s</p>}
      {error && <p role="alert">{error}</p>}
      {!active ? (
        <button type="button" disabled={!targetSerial || status === 'AUTHORIZING'} onClick={() => void initializeSession()}>
          {status === 'AUTHORIZING' ? 'Checking ADB authorization…' : 'Acquire verified session'}
        </button>
      ) : (
        <>
          <p>Transport authorization verified. Device operations remain disabled pending independent post-verification.</p>
          <button type="button" disabled>Deploy APK — verification gate pending</button>
          <button type="button" onClick={clearSession}>Clear local session</button>
        </>
      )}
    </section>
  );
}
