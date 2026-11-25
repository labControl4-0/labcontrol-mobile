// Estado da conexão do aparelho, via expo-network.
import * as Network from "expo-network";

import type { ConnectivitySource } from "../../services/occurrenceSync";

export const expoNetworkSource: ConnectivitySource = {
  subscribe(listener) {
    const subscription = Network.addNetworkStateListener((state) => listener(state));
    return () => subscription.remove();
  },
  getCurrent() {
    return Network.getNetworkStateAsync();
  },
};
