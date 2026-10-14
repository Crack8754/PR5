require('reflect-metadata');
const assert = require('node:assert/strict');
const { test, before, after, mock } = require('node:test');
const { createApp } = require('../dist/main');
const { ProjectsService } = require('../dist/projects/projects.service');
const { PROJECTS_REPOSITORY, DuplicateProjectNameError } = require('../dist/projects/ports/projects.repository');
const { InMemoryProjectsRepository } = require('../dist/projects/repositories/in-memory-projects.repository');
const { Test } = require('@nestjs/testing');
const { ProjectsModule } = require('../dist/projects/projects.module');

let app;
let baseUrl;
before(async () => {
  app = await createApp({ logger: false });
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => { if (app) await app.close(); });

async function request(method, path = '/projects', body, raw = false) {
  const response = await fetch(baseUrl + path, {
    method,
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

function assertProject(project) {
  assert.deepEqual(Object.keys(project).sort(), ['id', 'name', 'description', 'status', 'createdAt'].sort());
  assert.equal(typeof project.id, 'number');
  assert.ok(Number.isInteger(project.id));
  assert.ok(Number.isFinite(Date.parse(project.createdAt)));
}

function assertError(response, status, code, path) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.deepEqual(Object.keys(response.body).sort(),
    ['statusCode', 'errorCode', 'message', 'path', 'timestamp', 'traceId'].sort());
  assert.equal(response.body.statusCode, status);
  assert.equal(response.body.errorCode, code);
  assert.equal(response.body.path, path);
  assert.equal(typeof response.body.message, 'string');
  assert.ok(response.body.message.length > 0);
  assert.ok(Number.isFinite(Date.parse(response.body.timestamp)));
  assert.match(response.body.traceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(response.headers.get('x-trace-id'), response.body.traceId);
}

test('CRUD: numeric IDs, response DTO for POST/GET/list/PATCH, internal fields hidden', async () => {
  assert.deepEqual((await request('GET')).body, []);
  const created = await request('POST', '/projects', {
    name: '  StudyFlow  ', description: 'Система керування навчальними проєктами', status: 'active',
  });
  assert.equal(created.status, 201);
  assertProject(created.body);
  assert.equal(created.body.id, 1);
  assert.equal(created.body.name, 'StudyFlow');
  const path = '/projects/' + created.body.id;
  const internal = await app.get(PROJECTS_REPOSITORY).findOne(created.body.id);
  assert.ok(internal.internalNote);
  assert.ok(internal.updatedAt);
  assert.equal(internal.deletedAt, null);
  assert.deepEqual((await request('GET', path)).body, created.body);
  const listed = await request('GET');
  assert.deepEqual(listed.body, [created.body]);
  listed.body.forEach(assertProject);

  const updated = await request('PATCH', path, { status: 'completed' });
  assert.equal(updated.status, 200);
  assertProject(updated.body);
  assert.equal(updated.body.status, 'completed');
  assert.equal(updated.body.name, created.body.name);
  assert.equal(updated.body.createdAt, created.body.createdAt);
  assert.equal((await request('PATCH', path, { description: '' })).body.description, '');
  const deleted = await request('DELETE', path);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, null);
  assertError(await request('GET', path), 404, 'PROJECT_NOT_FOUND', path);
});

test('POST/PATCH: boundaries, enums, required fields, unknown fields and nulls', async () => {
  const invalid = [
    {}, { name: 'Valid' }, { status: 'draft' }, { name: 'ab', status: 'active' },
    { name: '   ', status: 'active' }, { name: '  ab  ', status: 'draft' },
    { name: 'x'.repeat(101), status: 'active' }, { name: 123, status: 'active' },
    { name: null, status: 'active' }, { name: 'Valid', status: 'invalid' },
    { name: 'Valid', status: null }, { name: 'Valid', status: 1 },
    { name: 'Valid', status: 'active', description: null },
    { name: 'Valid', status: 'active', description: 1 },
    { name: 'Valid', status: 'active', description: 'x'.repeat(501) },
    { name: 'Valid', status: 'active', internalNote: 'injected' },
    { name: 'Valid', status: 'active', id: 100 },
  ];
  for (const body of invalid) {
    assertError(await request('POST', '/projects', body), 400, 'VALIDATION_ERROR', '/projects');
  }
  for (const [name, status, description] of [
    ['abc', 'draft', undefined], ['x'.repeat(100), 'active', 'x'.repeat(500)],
    ['Completed', 'completed', ''],
  ]) {
    const created = await request('POST', '/projects', { name, status, description });
    assert.equal(created.status, 201);
    assert.equal(created.body.description, description ?? '');
    await request('DELETE', '/projects/' + created.body.id);
  }

  const created = await request('POST', '/projects', { name: 'Patch valid', status: 'draft' });
  const path = '/projects/' + created.body.id;
  for (const body of [
    { name: 'ab' }, { name: 'x'.repeat(101) }, { name: null }, { name: 123 },
    { description: null }, { description: 1 }, { description: 'x'.repeat(501) },
    { status: null }, { status: 'unknown' }, { status: 12 }, { deletedAt: 'injected' },
  ]) {
    assertError(await request('PATCH', path, body), 400, 'VALIDATION_ERROR', path);
  }
  assertError(await request('PATCH', path, {}), 400, 'EMPTY_UPDATE', path);
  assert.equal((await request('GET', path)).body.name, 'Patch valid');
  const patched = await request('PATCH', path, {
    name: 'y'.repeat(100), description: 'y'.repeat(500), status: 'completed',
  });
  assert.equal(patched.status, 200);
  assertProject(patched.body);
  await request('DELETE', path);
});

test('ParseIntPipe: controller passes number 10 to service; invalid IDs produce 400', async () => {
  const service = app.get(ProjectsService);
  const spy = mock.method(service, 'findOne', async (id) => {
    assert.strictEqual(id, 10);
    return { id, name: 'Ten', description: '', status: 'draft', createdAt: new Date().toISOString(), internalNote: 'secret' };
  });
  try {
    const response = await request('GET', '/projects/10');
    assert.equal(response.status, 200);
    assert.equal(spy.mock.calls.length, 1);
    assertProject(response.body);
  } finally {
    spy.mock.restore();
  }
  for (const id of ['abc', '1.5', '10abc']) {
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const path = '/projects/' + id;
      assertError(await request(method, path, method === 'PATCH' ? { status: 'active' } : undefined),
        400, 'BAD_REQUEST', path);
    }
  }
});

test('Service: predictable 404 on GET/PATCH/DELETE and unique trace IDs', async () => {
  const traces = new Set();
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const path = '/projects/99999';
    const response = await request(method, path, method === 'PATCH' ? { status: 'active' } : undefined);
    assertError(response, 404, 'PROJECT_NOT_FOUND', path);
    assert.equal(response.body.message, 'Project with id 99999 was not found');
    traces.add(response.body.traceId);
  }
  assert.equal(traces.size, 3);
});

test('Service: duplicate names return 409 on create and rename; own name is allowed', async () => {
  const first = await request('POST', '/projects', { name: 'Unique first', status: 'draft' });
  const second = await request('POST', '/projects', { name: 'Unique second', status: 'active' });
  assertError(await request('POST', '/projects', { name: '  Unique first  ', status: 'completed' }),
    409, 'PROJECT_NAME_CONFLICT', '/projects');
  const path = '/projects/' + second.body.id;
  assertError(await request('PATCH', path, { name: 'Unique first' }), 409, 'PROJECT_NAME_CONFLICT', path);
  assert.equal((await request('GET', path)).body.name, 'Unique second');
  assert.equal((await request('PATCH', path, { name: 'Unique second' })).status, 200);
  await request('DELETE', '/projects/' + first.body.id);
  await request('DELETE', path);
});

test('Concurrent create/rename preserve name uniqueness', async () => {
  const responses = await Promise.all(Array.from({ length: 5 }, () =>
    request('POST', '/projects', { name: 'Concurrent create', status: 'draft' })));
  assert.deepEqual(responses.map((item) => item.status).sort(), [201, 409, 409, 409, 409]);
  const created = responses.find((item) => item.status === 201);
  await request('DELETE', '/projects/' + created.body.id);
  const first = await request('POST', '/projects', { name: 'Race first', status: 'draft' });
  const second = await request('POST', '/projects', { name: 'Race second', status: 'draft' });
  const renamed = await Promise.all([first, second].map((item) =>
    request('PATCH', '/projects/' + item.body.id, { name: 'Race target' })));
  assert.deepEqual(renamed.map((item) => item.status).sort(), [200, 409]);
  await Promise.all([first, second].map((item) => request('DELETE', '/projects/' + item.body.id)));
});

test('Filter: malformed JSON, unknown route and unexpected 500 share error envelope', async () => {
  assertError(await request('POST', '/projects', '{"name":', true), 400, 'BAD_REQUEST', '/projects');
  assertError(await request('GET', '/missing'), 404, 'NOT_FOUND', '/missing');
  const service = app.get(ProjectsService);
  const spy = mock.method(service, 'findAll', async () => { throw new Error('secret database password'); });
  try {
    const response = await request('GET');
    assertError(response, 500, 'INTERNAL_SERVER_ERROR', '/projects');
    assert.equal(response.body.message, 'Internal server error');
    assert.ok(!JSON.stringify(response.body).includes('secret'));
    assert.ok(!JSON.stringify(response.body).includes('stack'));
  } finally {
    spy.mock.restore();
  }
});

test('DI: service uses repository port and maps atomic duplicate errors to ConflictException', async () => {
  const fake = {
    findByName: async () => null,
    create: async () => { throw new DuplicateProjectNameError(); },
    findAll: async () => [],
    findOne: async () => ({ id: 10, name: 'Existing' }),
    update: async () => { throw new DuplicateProjectNameError(); },
    remove: async () => false,
  };
  const module = await Test.createTestingModule({ imports: [ProjectsModule] })
    .overrideProvider(PROJECTS_REPOSITORY).useValue(fake).compile();
  try {
    const service = module.get(ProjectsService);
    await assert.rejects(service.create({ name: 'Duplicate', status: 'draft' }), { status: 409 });
    await assert.rejects(service.update(10, { name: 'Duplicate' }), { status: 409 });
    await assert.rejects(service.remove(10), { status: 404 });
  } finally {
    await module.close();
  }
});

test('Repository: numeric IDs not reused, copy isolation and duplicate protection', async () => {
  const repository = new InMemoryProjectsRepository();
  const input = {
    name: 'Original', description: '', status: 'draft', createdAt: 'now', updatedAt: 'now',
    internalNote: 'internal', deletedAt: null,
  };
  const created = await repository.create(input);
  input.name = 'Changed input';
  created.name = 'Changed output';
  const found = await repository.findOne(created.id);
  assert.equal(found.name, 'Original');
  found.name = 'Changed read';
  const list = await repository.findAll();
  list[0].name = 'Changed list';
  assert.equal((await repository.findByName('Original')).name, 'Original');
  await assert.rejects(repository.create({ ...input, name: 'Original' }), DuplicateProjectNameError);
  await repository.remove(created.id);
  const next = await repository.create(input);
  assert.ok(next.id > created.id);
  assert.equal(await repository.findOne(created.id), null);
  assert.equal(await repository.update(created.id, { name: 'Missing' }), null);
  assert.equal(await repository.remove(created.id), false);
});
