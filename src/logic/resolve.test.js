import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCapabilities,
  buildAllRoles,
  formatRoleName,
  buildModuleDeps,
  expandModuleDeps,
  getBlockingDependents,
} from './resolve.js';

// --- formatRoleName ---

describe('formatRoleName', () => {
  it('capitalizes a single word', () => {
    assert.equal(formatRoleName('engineer'), 'Engineer');
  });

  it('capitalizes hyphenated words', () => {
    assert.equal(formatRoleName('product-owner'), 'Product Owner');
  });

  it('handles single character segments', () => {
    assert.equal(formatRoleName('a-b'), 'A B');
  });

  it('handles already capitalized input', () => {
    assert.equal(formatRoleName('CEO'), 'CEO');
  });
});

// --- buildAllRoles ---

describe('buildAllRoles', () => {
  const availableRoles = [
    { name: 'ceo', base: true },
    { name: 'engineer', base: true },
    { name: 'product-owner' },
  ];

  it('returns a Set containing base roles', () => {
    const result = buildAllRoles(availableRoles, []);
    assert.deepEqual(result, new Set(['ceo', 'engineer']));
  });

  it('adds extra roles to the set', () => {
    const result = buildAllRoles(availableRoles, ['product-owner']);
    assert.deepEqual(result, new Set(['ceo', 'engineer', 'product-owner']));
  });

  it('deduplicates roles present in both base and extra', () => {
    const result = buildAllRoles(availableRoles, ['ceo']);
    assert.deepEqual(result, new Set(['ceo', 'engineer']));
    assert.equal(result.size, 2);
  });

  it('works with empty available roles and extra', () => {
    const result = buildAllRoles([], []);
    assert.deepEqual(result, new Set());
  });
});

// --- resolveCapabilities ---

describe('resolveCapabilities', () => {
  const modules = [
    {
      name: 'auto-assign',
      capabilities: [{ skill: 'auto-assign', owners: ['product-owner', 'ceo'] }],
    },
    {
      name: 'pr-review',
      capabilities: [{ skill: 'pr-review', owners: ['code-reviewer', 'engineer'] }],
    },
    {
      name: 'backlog',
      capabilities: [{ skill: 'backlog-health', owners: ['product-owner', 'ceo'] }],
    },
    {
      name: 'no-caps',
      // module with no capabilities field
    },
  ];

  it('resolves primary owner from first matching role', () => {
    const allRoles = new Set(['ceo', 'engineer', 'product-owner']);
    const result = resolveCapabilities(modules, ['auto-assign'], allRoles);
    assert.equal(result.length, 1);
    assert.equal(result[0].primary, 'product-owner');
    assert.equal(result[0].skill, 'auto-assign');
    assert.equal(result[0].module, 'auto-assign');
  });

  it('falls back to second owner when primary is absent', () => {
    const allRoles = new Set(['ceo', 'engineer']); // no product-owner
    const result = resolveCapabilities(modules, ['auto-assign'], allRoles);
    assert.equal(result.length, 1);
    assert.equal(result[0].primary, 'ceo');
    assert.deepEqual(result[0].fallbacks, []);
  });

  it('includes fallback roles that are present but not primary', () => {
    const allRoles = new Set(['ceo', 'engineer', 'product-owner']);
    const result = resolveCapabilities(modules, ['auto-assign'], allRoles);
    assert.equal(result[0].primary, 'product-owner');
    assert.deepEqual(result[0].fallbacks, ['ceo']);
  });

  it('skips modules not in selectedModules', () => {
    const allRoles = new Set(['ceo', 'engineer']);
    const result = resolveCapabilities(modules, ['pr-review'], allRoles);
    assert.equal(result.length, 1);
    assert.equal(result[0].module, 'pr-review');
  });

  it('skips capabilities when no owner role is present', () => {
    const allRoles = new Set(['designer']); // none of the owners
    const result = resolveCapabilities(modules, ['auto-assign'], allRoles);
    assert.equal(result.length, 0);
  });

  it('skips modules with no capabilities field', () => {
    const allRoles = new Set(['ceo', 'engineer']);
    const result = resolveCapabilities(modules, ['no-caps'], allRoles);
    assert.equal(result.length, 0);
  });

  it('skips modules with empty capabilities array', () => {
    const mods = [{ name: 'empty', capabilities: [] }];
    const allRoles = new Set(['ceo']);
    const result = resolveCapabilities(mods, ['empty'], allRoles);
    assert.equal(result.length, 0);
  });

  it('resolves multiple modules at once', () => {
    const allRoles = new Set(['ceo', 'engineer']);
    const result = resolveCapabilities(modules, ['auto-assign', 'pr-review', 'backlog'], allRoles);
    assert.equal(result.length, 3);
    const skills = result.map((r) => r.skill);
    assert.ok(skills.includes('auto-assign'));
    assert.ok(skills.includes('pr-review'));
    assert.ok(skills.includes('backlog-health'));
  });

  it('returns empty array when no modules selected', () => {
    const allRoles = new Set(['ceo', 'engineer']);
    const result = resolveCapabilities(modules, [], allRoles);
    assert.equal(result.length, 0);
  });
});

// --- buildModuleDeps ---

describe('buildModuleDeps', () => {
  const modules = [
    { name: 'github-repo' },
    { name: 'pr-review', requires: ['github-repo'] },
    { name: 'architecture-plan', requires: ['tech-stack'] },
    { name: 'tech-stack' },
    { name: 'no-deps' },
  ];

  it('builds requires map from module data', () => {
    const { requires } = buildModuleDeps(modules);
    assert.deepEqual(requires.get('pr-review'), ['github-repo']);
    assert.deepEqual(requires.get('github-repo'), []);
    assert.deepEqual(requires.get('no-deps'), []);
  });

  it('builds reverse requiredBy map', () => {
    const { requiredBy } = buildModuleDeps(modules);
    assert.deepEqual(requiredBy.get('github-repo'), ['pr-review']);
    assert.deepEqual(requiredBy.get('tech-stack'), ['architecture-plan']);
    assert.equal(requiredBy.has('no-deps'), false);
  });
});

// --- expandModuleDeps ---

describe('expandModuleDeps', () => {
  const requires = new Map([
    ['pr-review', ['github-repo']],
    ['github-repo', []],
    ['architecture-plan', ['tech-stack']],
    ['tech-stack', []],
    ['chain-a', ['chain-b']],
    ['chain-b', ['chain-c']],
    ['chain-c', []],
  ]);

  it('expands direct dependencies', () => {
    const { expanded, autoSelected } = expandModuleDeps(['pr-review'], requires);
    assert.ok(expanded.includes('pr-review'));
    assert.ok(expanded.includes('github-repo'));
    assert.deepEqual(autoSelected, ['github-repo']);
  });

  it('expands transitive dependencies', () => {
    const { expanded, autoSelected } = expandModuleDeps(['chain-a'], requires);
    assert.ok(expanded.includes('chain-a'));
    assert.ok(expanded.includes('chain-b'));
    assert.ok(expanded.includes('chain-c'));
    assert.deepEqual(autoSelected, ['chain-b', 'chain-c']);
  });

  it('does not duplicate already-selected deps', () => {
    const { autoSelected } = expandModuleDeps(['pr-review', 'github-repo'], requires);
    assert.deepEqual(autoSelected, []);
  });

  it('returns empty autoSelected when no deps', () => {
    const { autoSelected } = expandModuleDeps(['tech-stack'], requires);
    assert.deepEqual(autoSelected, []);
  });
});

// --- getBlockingDependents ---

describe('getBlockingDependents', () => {
  const requiredBy = new Map([
    ['github-repo', ['pr-review']],
    ['tech-stack', ['architecture-plan']],
  ]);

  it('returns dependents that are currently selected', () => {
    const blockers = getBlockingDependents('github-repo', ['pr-review', 'github-repo'], requiredBy);
    assert.deepEqual(blockers, ['pr-review']);
  });

  it('returns empty when no dependents are selected', () => {
    const blockers = getBlockingDependents('github-repo', ['github-repo'], requiredBy);
    assert.deepEqual(blockers, []);
  });

  it('returns empty for modules with no dependents', () => {
    const blockers = getBlockingDependents('no-deps', ['no-deps', 'pr-review'], requiredBy);
    assert.deepEqual(blockers, []);
  });
});
