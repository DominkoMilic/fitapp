import AsyncStorage from '@react-native-async-storage/async-storage';

/** Web: the browser's localStorage (via AsyncStorage). There is no OS keychain on the web. */
export const sessionStorage = AsyncStorage;
