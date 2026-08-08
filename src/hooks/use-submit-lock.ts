"use client";

import { useCallback, useRef } from "react";

/**
 * Trava síncrona anti double-submit.
 * `setLoading(true)` só desabilita o botão no próximo paint — neste gap
 * um segundo clique ainda dispara outro POST (e duplica o caixa).
 */
export function useSubmitLock() {
  const locked = useRef(false);

  const tryLock = useCallback(() => {
    if (locked.current) return false;
    locked.current = true;
    return true;
  }, []);

  const unlock = useCallback(() => {
    locked.current = false;
  }, []);

  const isLocked = useCallback(() => locked.current, []);

  return { tryLock, unlock, isLocked };
}
