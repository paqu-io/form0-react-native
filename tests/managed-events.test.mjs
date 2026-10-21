import assert from 'node:assert/strict';
import test from 'node:test';
import { eventConformance } from './fixtures/event-conformance.js';

eventConformance(test, assert);
