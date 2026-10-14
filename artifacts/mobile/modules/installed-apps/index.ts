import { requireOptionalNativeModule } from 'expo';

export interface LaunchableApp {
  label: string;
  packageName: string;
  activityName?: string;
}

export interface IntentSpec {
  action: string;
  category?: string;
  /** Used for Intent.makeMainSelectorActivity (APP_CONTACTS, APP_GALLERY, APP_CALCULATOR ...). */
  selectorCategory?: string;
  data?: string;
  type?: string;
  packageName?: string;
  className?: string;
}

export interface InstalledAppsNative {
  getLaunchableApps(): Promise<LaunchableApp[]>;
  getAppsForCategory(category: string): Promise<LaunchableApp[]>;
  isInstalled(packageName: string): Promise<boolean>;
  getDefaultSmsPackage(): Promise<string | null>;
  getDefaultDialerPackage(): Promise<string | null>;
  launchApp(packageName: string, activityName: string | null): Promise<boolean>;
  launchIntent(spec: IntentSpec): Promise<boolean>;
}

/** null on iOS and web, and in every build made before this module existed (a JavaScript reload cannot add native code). */
export default requireOptionalNativeModule<InstalledAppsNative>('InstalledApps');
