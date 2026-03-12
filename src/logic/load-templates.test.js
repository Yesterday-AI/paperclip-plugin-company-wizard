import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadGoals, validateGoalTemplate } from './load-templates.js';

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2));
}

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

describe('loadGoals', () => {
  let tmpDir;
  let templatesDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'load-goals-test-'));
    templatesDir = tmpDir;
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when goals directory does not exist', async () => {
    const result = await loadGoals(templatesDir);
    assert.deepStrictEqual(result, []);
  });

  it('loads valid goal templates from subdirectories', async () => {
    const goalDir = join(templatesDir, 'goals', 'mvp');
    await mkdir(goalDir, { recursive: true });
    await writeJson(join(goalDir, 'goal.meta.json'), {
      title: 'Ship MVP',
      description: 'Launch v1.',
      milestones: [{ id: 'build', title: 'Build it' }],
      issues: [{ title: 'Set up repo', milestone: 'build' }],
    });

    const goals = await loadGoals(templatesDir);
    assert.equal(goals.length, 1);
    assert.equal(goals[0].name, 'mvp');
    assert.equal(goals[0].title, 'Ship MVP');
    assert.equal(goals[0].milestones.length, 1);
    assert.equal(goals[0].issues.length, 1);
  });

  it('skips directories without goal.meta.json', async () => {
    const goalDir = join(templatesDir, 'goals', 'empty');
    await mkdir(goalDir, { recursive: true });

    const goals = await loadGoals(templatesDir);
    assert.equal(goals.length, 0);
  });

  it('throws on invalid goal template during load', async () => {
    const goalDir = join(templatesDir, 'goals', 'bad');
    await mkdir(goalDir, { recursive: true });
    await writeJson(join(goalDir, 'goal.meta.json'), { title: 'Missing desc' });

    await assert.rejects(() => loadGoals(templatesDir), /missing or invalid "description"/);
  });

  it('loads multiple goal templates', async () => {
    for (const name of ['alpha', 'beta']) {
      const goalDir = join(templatesDir, 'goals', name);
      await mkdir(goalDir, { recursive: true });
      await writeJson(join(goalDir, 'goal.meta.json'), {
        title: `Goal ${name}`,
        description: `Description for ${name}`,
      });
    }

    const goals = await loadGoals(templatesDir);
    assert.equal(goals.length, 2);
    const names = goals.map((g) => g.name).sort();
    assert.deepStrictEqual(names, ['alpha', 'beta']);
  });
});
