/**
 * useYellowSession Hook
 *
 * Thin wrapper around YellowSessionContext.
 * All session state lives in the provider so it's shared across pages.
 */

import { useContext } from 'react';
import {
  YellowSessionContext,
  type YellowSessionContextValue,
} from '@/components/providers/YellowSessionProvider';

export type UseYellowSessionReturn = YellowSessionContextValue;

/**
 * Hook for Yellow Network session management.
 * Must be used within a YellowSessionProvider.
 */
export function useYellowSession(): UseYellowSessionReturn {
  return useContext(YellowSessionContext);
}
