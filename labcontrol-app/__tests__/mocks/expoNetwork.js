const shared = (globalThis.__EXPO_NETWORK_MOCK__ =
  globalThis.__EXPO_NETWORK_MOCK__ || { listeners: new Set() });

module.exports = {
  addNetworkStateListener: jest.fn((listener) => {
    shared.listeners.add(listener);
    return {
      remove: () => shared.listeners.delete(listener),
    };
  }),
  getNetworkStateAsync: jest.fn(async () => ({
    type: "WIFI",
    isConnected: true,
    isInternetReachable: true,
  })),
  __emitNetworkState(state) {
    for (const listener of [...shared.listeners]) listener(state);
  },
  __resetListeners() {
    shared.listeners.clear();
  },
};