import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateGoalTemplate, collectGoals, modulesWithActiveGoals } from './load-templates.js';

describe('validateGoalTemplate', () => {
  it('accepts a valid minimal goal (title + description only)', () => {
    assert.doesNotThrow(() =>
      validateGoalTemplate({ title: 'Ship MVP', description: 'Launch the first version.' }, 'mvp'),
    );
  });

  it('accepts a valid goal with milestones and issues', () => {
    const goal = {
      title: 'Ship MVP',
      description: 'Launch v1.',
      milestones: [
        { id: 'design', title: 'Design phase', completionCriteria: 'Figma approved' },
        { id: 'build', title: 'Build phase' },
      ],
      issues: [
        { title: 'Create wireframes', priority: 'high', milestone: 'design' },
        { title: 'Implement API', milestone: 'build', assignTo: 'engineer' },
      ],
    };
    assert.doesNotThrow(() => validateGoalTemplate(goal, 'mvp'));
  });

  it('throws when title is missing', () => {
    assert.throws(
      () => validateGoalTemplate({ description: 'desc' }, 'bad'),
      /missing or invalid "title"/,
    );
  });

  it('throws when description is missing', () => {
    assert.throws(
      () => validateGoalTemplate({ title: 'ok' }, 'bad'),
      /missing or invalid "description"/,
    );
  });

  it('throws when milestone id is not kebab-case', () => {
    assert.throws(
      () =>
        validateGoalTemplate(
          {
            title: 'T',
            description: 'D',
            milestones: [{ id: 'Bad Id', title: 'M' }],
          },
          'bad',
        ),
      /kebab-case/,
    );
  });

  it('throws on duplicate milestone ids', () => {
    assert.throws(
      () =>
        validateGoalTemplate(
          {
            title: 'T',
            description: 'D',
            milestones: [
              { id: 'alpha', title: 'A' },
              { id: 'alpha', title: 'B' },
            ],
          },
          'bad',
        ),
      /duplicate milestone id "alpha"/,
    );
  });

  it('throws when issue references unknown milestone', () => {
    assert.throws(
      () =>
        validateGoalTemplate(
          {
            title: 'T',
            description: 'D',
            milestones: [{ id: 'alpha', title: 'A' }],
            issues: [{ title: 'Task', milestone: 'beta' }],
          },
          'bad',
        ),
      /unknown milestone "beta"/,
    );
  });

  it('throws on invalid priority', () => {
    assert.throws(
      () =>
        validateGoalTemplate(
          {
            title: 'T',
            description: 'D',
            issues: [{ title: 'Task', priority: 'urgent' }],
          },
          'bad',
        ),
      /invalid priority "urgent"/,
    );
  });

  it('throws when issue title is missing', () => {
    assert.throws(
      () =>
        validateGoalTemplate(
          {
            title: 'T',
            description: 'D',
            issues: [{ description: 'no title' }],
          },
          'bad',
        ),
      /issue\[0\] missing "title"/,
    );
  });
});

describe('collectGoals', () => {
  it('returns empty array when no preset goals or module goals', () => {
    const goals = collectGoals(null, [], new Set());
    assert.deepStrictEqual(goals, []);
  });

  it('collects goals from preset', () => {
    const preset = {
      name: 'startup',
      goals: [
        { title: 'Launch MVP', description: 'Ship it' },
        { title: 'Scale', description: 'Grow' },
      ],
    };
    const goals = collectGoals(preset, [], new Set());
    assert.equal(goals.length, 2);
    assert.equal(goals[0].title, 'Launch MVP');
    assert.equal(goals[0]._source, 'preset:startup');
    assert.equal(goals[1]._source, 'preset:startup');
  });

  it('collects goal from selected module', () => {
    const modules = [
      { name: 'ci-cd', goal: { title: 'CI/CD Setup', description: 'Automate' } },
      { name: 'backlog', description: 'no goal here' },
    ];
    const goals = collectGoals(null, modules, new Set(['ci-cd', 'backlog']));
    assert.equal(goals.length, 1);
    assert.equal(goals[0].title, 'CI/CD Setup');
    assert.equal(goals[0]._source, 'module:ci-cd');
    assert.equal(goals[0]._module, 'ci-cd');
  });

  it('skips module goals for unselected modules', () => {
    const modules = [{ name: 'ci-cd', goal: { title: 'CI/CD Setup', description: 'Automate' } }];
    const goals = collectGoals(null, modules, new Set([]));
    assert.equal(goals.length, 0);
  });

  it('combines preset and module goals', () => {
    const preset = {
      name: 'quality',
      goals: [{ title: 'Preset Goal', description: 'From preset' }],
    };
    const modules = [{ name: 'ci-cd', goal: { title: 'Module Goal', description: 'From module' } }];
    const goals = collectGoals(preset, modules, new Set(['ci-cd']));
    assert.equal(goals.length, 2);
    assert.equal(goals[0]._source, 'preset:quality');
    assert.equal(goals[1]._source, 'module:ci-cd');
  });
});

describe('modulesWithActiveGoals', () => {
  it('returns empty set when no module goals', () => {
    const goals = [{ title: 'A', _source: 'preset:fast' }];
    const result = modulesWithActiveGoals(goals);
    assert.equal(result.size, 0);
  });

  it('returns module names that have active goals', () => {
    const goals = [
      { title: 'A', _source: 'module:ci-cd', _module: 'ci-cd' },
      { title: 'B', _source: 'preset:fast' },
      { title: 'C', _source: 'module:website-relaunch', _module: 'website-relaunch' },
    ];
    const result = modulesWithActiveGoals(goals);
    assert.equal(result.size, 2);
    assert.ok(result.has('ci-cd'));
    assert.ok(result.has('website-relaunch'));
  });
});
