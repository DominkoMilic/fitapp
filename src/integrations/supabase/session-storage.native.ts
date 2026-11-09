import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { createChunkedStorage } from './chunked-storage';

// AFTER_FIRST_UNLOCK: tokens stay encrypted at rest, and can be refreshed while the screen is locked.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Session tokens in the iOS Keychain / Android Keystore (audit fix: not plain AsyncStorage). */
export const sessionStorage = createChunkedStorage(
  {
    getItem: (k) => SecureStore.getItemAsync(k, options),
    setItem: (k, v) => SecureStore.setItemAsync(k, v, options),
    removeItem: (k) => SecureStore.deleteItemAsync(k, options),
  },
  AsyncStorage,
);
