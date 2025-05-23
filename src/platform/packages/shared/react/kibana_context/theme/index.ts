/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export { KibanaThemeProvider, type KibanaThemeProviderProps } from './theme_provider';
export { wrapWithTheme } from './with_theme';
export { useKibanaIsDarkMode } from './hooks';

// Re-exporting from @kbn/react-kibana-context-common for convenience to consumers.
export { defaultTheme, type KibanaTheme } from '@kbn/react-kibana-context-common';
