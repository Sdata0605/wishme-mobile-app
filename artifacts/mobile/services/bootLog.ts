/** Start-up timeline for the Metro log (development builds only): every line shows the seconds since the first app code ran. */
const T0 = Date.now();
export const bootStamp = () => `app+${((Date.now() - T0) / 1000).toFixed(2)}s`;
export const bootLog: (...args: unknown[]) => void = __DEV__ ? (...args) => console.log(`[boot ${bootStamp()}]`, ...args) : () => {};
