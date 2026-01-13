import type { Store } from '@reduxjs/toolkit';

let registeredStore: Store | null = null;

export function registerStore(store: Store): void {
  registeredStore = store;
}

export function getStore(): Store {
  if (!registeredStore) {
    throw new Error(
      'Store not registered. Call registerStore(store) before using API methods.'
    );
  }
  return registeredStore;
}
