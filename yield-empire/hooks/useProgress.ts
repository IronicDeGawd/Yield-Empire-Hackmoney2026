/**
 * Bridge progress tracking hook for Circle BridgeKit.
 * Processes BridgeKit events into step progression for UX display.
 *
 * Reference: resources/circle-bridge-kit-transfer/src/hooks/useProgress.ts
 */

import { useState } from 'react';

export type StepKey =
  | 'idle'
  | 'approving'
  | 'burning'
  | 'waiting-attestation'
  | 'minting'
  | 'completed'
  | 'error';

function now() {
  return new Date().toLocaleTimeString();
}

export function useProgress() {
  const [currentStep, setCurrentStep] = useState<StepKey>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  function addLog(line: string, includeTimestamp = true) {
    setLogs((prev) => [...prev, includeTimestamp ? `[${now()}] ${line}` : line]);
  }

  function reset() {
    setCurrentStep('idle');
    setLogs([]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEvent(msg: any) {
    const method: string | undefined = msg?.method;
    const state: string | undefined = msg?.values?.state;
    const txHash: string | undefined = msg?.values?.txHash;

    if (!method) return;

    if (method === 'approve') {
      if (state === 'success') {
        addLog(`USDC Approval Tx: ${txHash}`);
        setCurrentStep('burning');
        addLog('Burning USDC\u2026');
      } else if (state === 'error') {
        addLog('Approval failed');
        setCurrentStep('error');
      }
    } else if (method === 'burn') {
      if (state === 'success') {
        addLog(`Burn Tx: ${txHash}`);
        setCurrentStep('waiting-attestation');
        addLog('Waiting for attestation\u2026');
      } else if (state === 'error') {
        addLog('Burn failed');
        setCurrentStep('error');
      }
    } else if (method === 'fetchAttestation') {
      if (state === 'success') {
        addLog('Attestation retrieved!');
        setCurrentStep('minting');
        addLog('Minting USDC\u2026');
      } else {
        addLog('Waiting for attestation\u2026');
        setCurrentStep('waiting-attestation');
      }
    } else if (method === 'mint') {
      if (state === 'success') {
        addLog(`Mint Tx: ${txHash}`);
        addLog('Transfer completed successfully.');
        setCurrentStep('completed');
      } else if (state === 'error') {
        addLog('Mint failed');
        setCurrentStep('error');
      }
    }
  }

  return { currentStep, logs, addLog, handleEvent, reset, setCurrentStep };
}
