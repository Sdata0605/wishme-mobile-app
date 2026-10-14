/**
 * Lets the self-check scripts import app code that uses extensionless relative imports (`./nameMatch`), which
 * is what the app's TypeScript config requires but plain Node does not understand. Import this file first.
 */
import { register } from 'node:module';

const hook = String.raw`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context);
    throw error;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(hook));
