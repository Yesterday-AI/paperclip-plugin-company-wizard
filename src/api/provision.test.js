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
    boardUserId: 'local-board',
    createCompany: mock.fn(async ({ name }) => {
      const id = nextId();
      calls.push({ method: 'createCompany', name });
      return { id, issuePrefix: 'TC' };
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
  goals: [],
  onProgress: () => {},
};

describe('provisionCompany', () => {
  it('creates inline goals with issues linked to goal ID', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Build API',
          description: 'REST API goal',
          issues: [
            { title: 'Design schema', priority: 'high' },
            { title: 'Implement endpoints', priority: 'medium' },
          ],
        },
      ],
    });

    assert.equal(result.goalResults.length, 1);
    assert.ok(result.goalResults[0].goalId);
    assert.equal(result.issueIds.length, 2, 'should create 2 issues');

    // Verify goals: company goal + inline sub-goal
    const goalCalls = client.calls.filter((c) => c.method === 'createGoal');
    assert.equal(goalCalls.length, 2);
    assert.equal(goalCalls[1].title, 'Build API');

    // Verify issues linked to inline goal
    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.equal(issueCalls.length, 2);
    assert.equal(issueCalls[0].goalId, result.goalResults[0].goalId);
    assert.equal(issueCalls[1].goalId, result.goalResults[0].goalId);
  });

  it('sets priorities from inline goal issues', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Test Goal',
          description: 'desc',
          issues: [
            { title: 'Critical task', priority: 'critical' },
            { title: 'Low task', priority: 'low' },
          ],
        },
      ],
    });

    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.equal(issueCalls[0].priority, 'critical');
    assert.equal(issueCalls[1].priority, 'low');
  });

  it('assigns inline goal issues to agents when assignTo is set', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Test Goal',
          description: 'desc',
          issues: [
            { title: 'Task with assignTo', priority: 'medium', assignTo: 'engineer' },
            { title: 'Task without assignTo', priority: 'medium' },
          ],
        },
      ],
    });

    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    const withAssign = issueCalls.find((c) => c.title === 'Task with assignTo');
    const withoutAssign = issueCalls.find((c) => c.title === 'Task without assignTo');
    assert.ok(withAssign.assigneeAgentId, 'should have assigneeAgentId');
    assert.equal(withoutAssign.assigneeAgentId, null, 'should be unassigned');
  });

  it('handles partial failures — continues after issue creation error', async () => {
    const client = makeMockClient({ failIssues: ['Failing task'] });
    const progress = [];
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Test Goal',
          description: 'desc',
          issues: [
            { title: 'Good task', priority: 'medium' },
            { title: 'Failing task', priority: 'high' },
            { title: 'Another good task', priority: 'low' },
          ],
        },
      ],
      onProgress: (line) => progress.push(line),
    });

    // 2 of 3 issues should succeed
    assert.equal(result.issueIds.length, 2);
    // Error details returned
    assert.equal(result.goalErrors.length, 1);
    assert.equal(result.goalErrors[0].title, 'Failing task');
    // Goal result should still exist
    assert.ok(result.goalResults[0].goalId);
    // Progress should mention the failure
    assert.ok(progress.some((line) => line.includes('Failed to create issue')));
  });

  it('user tasks are left unassigned', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Relaunch Website',
          description: 'Relaunch',
          issues: [{ title: 'Provide designs', assignTo: 'user' }],
        },
      ],
    });

    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    const provideDesigns = issueCalls.find((c) => c.title === 'Provide designs');
    assert.equal(provideDesigns.assigneeAgentId, null, 'user tasks should not have agent assignee');
    assert.equal(
      provideDesigns.assigneeUserId,
      'local-board',
      'user tasks should be assigned to board user',
    );
  });

  it('initialTasks go to main project', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      initialTasks: [
        { title: 'Audit site', assignTo: 'engineer', module: 'website-relaunch' },
        { title: 'Init repo', assignTo: 'engineer', module: 'github-repo' },
      ],
      goals: [],
    });

    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.equal(issueCalls.length, 2);
    for (const call of issueCalls) {
      assert.equal(call.projectId, result.projectId);
      assert.equal(call.goalId, result.goalId);
    }
  });

  it('returns empty goalErrors when no goals', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goals: [],
    });

    assert.deepEqual(result.goalErrors, []);
    assert.deepEqual(result.goalResults, []);
  });

  it('creates goal-level project when project !== false', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Build API',
          description: 'desc',
          project: true,
          issues: [{ title: 'Task A' }],
        },
      ],
    });

    // Should have created a goal-level project (separate from main project)
    const projectCalls = client.calls.filter((c) => c.method === 'createProject');
    assert.equal(projectCalls.length, 2, 'main project + goal project');
    assert.equal(projectCalls[1].name, 'Build API');

    // Issue should be linked to goal project, not main project
    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.notEqual(issueCalls[0].projectId, result.projectId);
    assert.equal(issueCalls[0].projectId, result.goalResults[0].goalProjectId);
  });

  it('skips goal-level project when project === false', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'CI/CD Setup',
          description: 'desc',
          project: false,
          issues: [{ title: 'Configure linting' }],
        },
      ],
    });

    // Only main project created
    const projectCalls = client.calls.filter((c) => c.method === 'createProject');
    assert.equal(projectCalls.length, 1);

    // Issue falls back to main project
    const issueCalls = client.calls.filter((c) => c.method === 'createIssue');
    assert.equal(issueCalls[0].projectId, result.projectId);
  });

  it('creates milestones as sub-goals', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Build API',
          description: 'desc',
          milestones: [
            { id: 'design', title: 'Design phase' },
            { id: 'build', title: 'Build phase' },
          ],
          issues: [
            { title: 'Create schema', milestone: 'design' },
            { title: 'Implement endpoints', milestone: 'build' },
          ],
        },
      ],
    });

    const goalCalls = client.calls.filter((c) => c.method === 'createGoal');
    // company goal + inline goal + 2 milestones
    assert.equal(goalCalls.length, 4);
    assert.equal(goalCalls[2].title, 'Design phase');
    assert.equal(goalCalls[2].level, 'task');
    assert.equal(goalCalls[3].title, 'Build phase');
  });

  it('merges module adapterOverrides into agent config', async () => {
    const client = makeMockClient();
    await provisionCompany({
      ...baseOpts,
      client,
      roleAdapterOverrides: new Map([['engineer', { chrome: true }]]),
    });

    const agentCalls = client.calls.filter((c) => c.method === 'createAgent');
    const engineerCall = agentCalls.find((c) =>
      c.adapterConfig?.instructionsFilePath?.includes('/engineer/'),
    );
    assert.ok(engineerCall, 'should find engineer agent');
    assert.equal(engineerCall.adapterConfig.chrome, true, 'module override should be merged');

    const ceoCall = agentCalls.find((c) =>
      c.adapterConfig?.instructionsFilePath?.includes('/ceo/'),
    );
    assert.ok(ceoCall, 'should find ceo agent');
    assert.equal(ceoCall.adapterConfig.chrome, undefined, 'CEO should not have chrome override');
  });

  it('supports multiple inline goals', async () => {
    const client = makeMockClient();
    const result = await provisionCompany({
      ...baseOpts,
      client,
      goals: [
        {
          title: 'Goal A',
          description: 'First',
          issues: [{ title: 'Task A1' }],
        },
        {
          title: 'Goal B',
          description: 'Second',
          issues: [{ title: 'Task B1' }, { title: 'Task B2' }],
        },
      ],
    });

    assert.equal(result.goalResults.length, 2);
    assert.equal(result.issueIds.length, 3);
  });
});
