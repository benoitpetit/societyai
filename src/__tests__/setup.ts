/**
 * Jest global setup
 * Supprime les logs pendant les tests pour garder une sortie propre
 */

import { setGlobalLogLevel } from '../observability/logger';
import { LogLevel } from '../core/config';

// Configure le logger en mode SILENT pour les tests
setGlobalLogLevel(LogLevel.SILENT);

// Mock console.warn pour supprimer les warnings OpenTelemetry
const originalWarn = console.warn;
global.console.warn = jest.fn();

// Mock console.log et console.error pour les tests
// On les sauvegarde pour pouvoir les restaurer si nécessaire
const originalLog = console.log;
const originalError = console.error;

// Supprime les logs de production pendant les tests
global.console.log = jest.fn();
global.console.error = jest.fn();

// Timeout global pour les tests async
jest.setTimeout(10000);

// Exporte les originaux si on veut les utiliser dans certains tests
export { originalLog, originalError, originalWarn };
