export const APP_VERSION='4.3.0';
export const APP_RELEASE='V4.3.0';
export const APP_HOTFIX='V4.3.0-HF4';
export const BUNDLE_FORMAT_VERSION='4.3.0';
export const LKL_SCHEMA_VERSION='2.1';
export const DEFAULT_RELATION_ROUTING='straight';

export function workspaceExportFilename(timestamp=Date.now()){return`lmn-workspace-v${APP_VERSION}-${timestamp}.json`}
