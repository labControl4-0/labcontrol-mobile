import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getAuthSession } from "../auth";
import { subscribeToSync } from "../../services/occurrenceSync";
import { countUnsynced } from "./occurrenceRepository";

/** Quantidade de ocorrências do usuário logado que ainda não chegaram ao servidor. */
export function useUnsyncedCount(): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    (async () => {
      const session = await getAuthSession();
      const userId = session?.user.id;
      setCount(userId ? await countUnsynced(userId) : 0);
    })().catch(() => setCount(0));
  }, []);

  useFocusEffect(refresh);
  useEffect(() => subscribeToSync(refresh), [refresh]);

  return { count, refresh };
}
