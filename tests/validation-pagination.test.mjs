import test from "node:test";
import assert from "node:assert/strict";
import { getValidationPage } from "../src/utils/validation-pagination.js";

test("validation pagination uses fifteen findings, clamps shrinking results and hides a single page", () => {
  assert.deepEqual(getValidationPage(0, 24), {
    offset: 0,
    end: 15,
    hasPages: true,
    hasPrevious: false,
    hasNext: true,
  });
  assert.deepEqual(getValidationPage(15, 24), {
    offset: 15,
    end: 24,
    hasPages: true,
    hasPrevious: true,
    hasNext: false,
  });
  assert.equal(getValidationPage(15, 23).offset, 15);
  assert.deepEqual(getValidationPage(15, 15), {
    offset: 0,
    end: 15,
    hasPages: false,
    hasPrevious: false,
    hasNext: false,
  });
  assert.deepEqual(getValidationPage(30, 0), {
    offset: 0,
    end: 0,
    hasPages: false,
    hasPrevious: false,
    hasNext: false,
  });
});
