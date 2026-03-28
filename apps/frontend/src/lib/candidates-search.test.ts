import { describe, expect, test } from 'bun:test';
import { CANDIDATES_SEARCH_DEBOUNCE_MS } from './candidates-search';

describe('Candidates search UX', () => {
  test('debounce ms matches Candidates page timer and helper text', () => {
    expect(CANDIDATES_SEARCH_DEBOUNCE_MS).toBe(320);
  });
});
