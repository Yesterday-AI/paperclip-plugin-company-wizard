import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { provisionCompany } from './provision.js';

/**
 * Build a fake PaperclipClient that records calls and returns predictable IDs.
 */
function makeMockClient({ failIssues = [] } = {}) {
  let idCounter = 0;
  const calls = [];

  const nextId = () => `id-${++idCounter}`;

  return {
    calls,
    createCompany: mock.fn(async ({ name }) => {
      const id = nextId();
      calls.push({ method: 'createCompany', name });
      return { id };
    }),
    createGoal: mock.fn(async (_companyId, data) => {
      const id = nextId();
      calls.push({ method: 'createGoal', ...data });
      return { id };
    }),
    createProject: mock.fn(async (_companyId, data) => {
      const id = nextId();
      calls.push({ method: 'createProject', ...data });
      return { id };
    }),
    createAgent: mock.fn(async (_companyId, data) => {
      const id = nextId();
      calls.push({ method: 'createAgent', ...data });
      return { id };
    }),
    createIssue: mock.fn(async (_companyId, data) => {
      if (failIssues.includes(data.title)) {
        throw new Error(`API error for "${data.title}"`);
      }
      const id = nextId();
      calls.push({ method: 'createIssue', ...data });
      return { id };
    }),
    triggerHeartbeat: mock.fn(async () => {
      calls.push({ method: 'triggerHeartbeat' });
      return {};
    }),
  };
}

const baseOpts = {
  companyName: 'TestCo',
  companyDir: '/tmp/testco',
  goal: { title: 'Ship v1', description: 'Launch the product' },
  projectName: 'TestProject',
  allRoles: new Set(['ceo', 'engineer']),
  rolesData: new Map([
    ['ceo', { name: 'ceo', base: true }],
    ['engineer', { name: 'engineer', base: true }],
  ]),
  initialTasks: [],
  goalTemplate: null,
  onProgress: () => {},
};

describe('provisionCompany', () => {
  it('creates goal from template with issues linked to goal ID', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goalTemplate: {
        title: 'Build API',
        description: 'REST API goal',
        issues: [
          { title: 'Design schema', priority: 'high' },
          { title: 'Implement endpoints', priority: 'medium' },
        ],
      },
    });

    assert.ok(result.goalTemplateId, 'should return goalTemplateId');
    assert.equal(result.issueIds.length, 2, 'should create 2 issues');

    // Verify goal was created
    const goalCalls = client.calls.filter((c) => c.method === 'createGoal');
    assert.equal(goalCalls.length, 2); // company goal + template goal
    assert.equal(goalCalls[1].title, 'Build API');

    // Verify issues linked to template goal
    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.equal(issueCalls.length, 2);
    assert.equal(issueCalls[0].goalId, result.goalTemplateId);
    assert.equal(issueCalls[1].goalId, result.goalTemplateId);
  });

  it('sets priorities from the template', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      goalTemplate: {
        title: 'Test Goal',
        description: 'desc',
        issues: [
          { title: 'Critical task', priority: 'critical' },
          { title: 'Low task', priority: 'low' },
        ],
      },
    });

    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.equal(issueCalls[0].priority, 'critical');
    assert.equal(issueCalls[1].priority, 'low');
  });

  it('leaves goal template issues unassigned', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      goalTemplate: {
        title: 'Test Goal',
        description: 'desc',
        issues: [
          { title: 'Task with assignTo', priority: 'medium', assignTo: 'engineer' },
          { title: 'Task without assignTo', priority: 'medium' },
        ],
      },
    });

    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    // Both should have no assigneeAgentId — auto-assign handles it
    for (const call of issueCalls) {
      assert.equal(call.assigneeAgentId, undefined, `"${call.title}" should be unassigned`);
    }
  });

  it('handles partial failures — continues after issue creation error', async () => {
    const client = makeMockClient({ failIssues: ['Failing task'] });
    const progress = [];
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goalTemplate: {
        title: 'Test Goal',
        description: 'desc',
        issues: [
          { title: 'Good task', priority: 'medium' },
          { title: 'Failing task', priority: 'high' },
          { title: 'Another good task', priority: 'low' },
        ],
      },
      onProgress: (line) => progress.push(line),
    });

    // 2 of 3 issues should succeed
    assert.equal(result.issueIds.length, 2);
    // Error details returned
    assert.equal(result.goalTemplateErrors.length, 1);
    assert.equal(result.goalTemplateErrors[0].title, 'Failing task');
    // Goal template ID should still be set
    assert.ok(result.goalTemplateId);
    // Progress should mention the failure
    assert.ok(progress.some((line) => line.includes('Failed to create issue')));
  });

  it('returns empty goalTemplateErrors when no template selected', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goalTemplate: null,
    });

    assert.deepEqual(result.goalTemplateErrors, []);
    assert.equal(result.goalTemplateId, null);
  });
});
