import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticConformance } from './fixtures/diagnostic-conformance.js';
diagnosticConformance(test, assert);
