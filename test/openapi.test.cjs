const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { createApp } = require('../dist/main');
const document = require('../openapi.json');
let app;
let baseUrl;
before(async () => {
  app = await createApp({ logger: false });
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => { if (app) await app.close(); });

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'contract', components: document.components });
function matches(schema, value) {
  const validate = ajv.compile({ ...schema, components: document.components });
  assert.ok(validate(value), JSON.stringify(validate.errors));
}
async function request(method, url, body, headers = {}) {
  const response = await fetch(baseUrl + url, {
    method, signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
}
function matchesResponse(route, method, response) {
  const spec = document.paths[route][method].responses[response.status];
  assert.ok(spec, `Missing response ${method} ${route} ${response.status}`);
  if (response.status === 204) {
    assert.equal(spec.content, undefined);
    assert.equal(response.body, undefined);
  } else {
    matches(spec.content['application/json'].schema, response.body);
  }
}

test('Swagger UI assets and served OpenAPI match the submitted document', async () => {
  const response = await fetch(baseUrl + '/docs', { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /swagger-ui/);
  for (const asset of ['/docs/swagger-ui-bundle.js', '/docs/swagger-ui.css', '/docs/swagger-ui-init.js']) {
    const assetResponse = await fetch(baseUrl + asset);
    assert.equal(assetResponse.status, 200);
    assert.ok((await assetResponse.text()).length > 100);
  }
  const served = await request('GET', '/openapi.json');
  assert.deepEqual(served.body, document);
});

test('Five operations have summaries, tags, schemas, examples and honest bearer security', () => {
  let count = 0;
  const operationIds = new Set();
  for (const item of Object.values(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['get', 'post', 'patch', 'delete'].includes(method)) continue;
      count++;
      assert.ok(operation.summary);
      assert.deepEqual(operation.tags, ['Projects']);
      assert.ok(!operationIds.has(operation.operationId));
      operationIds.add(operation.operationId);
      for (const parameter of operation.parameters ?? []) {
        if (parameter.name === 'id') assert.equal(parameter.schema.type, 'integer');
      }
      for (const response of Object.values(operation.responses)) {
        for (const media of Object.values(response.content ?? {})) {
          if (media.example) matches(media.schema, media.example);
          for (const example of Object.values(media.examples ?? {})) matches(media.schema, example.value);
        }
      }
      for (const media of Object.values(operation.requestBody?.content ?? {})) {
        for (const example of Object.values(media.examples ?? {})) matches(media.schema, example.value);
      }
    }
  }
  assert.equal(count, 5);
  assert.equal(document.components.securitySchemes.bearer.scheme, 'bearer');
  assert.deepEqual(document.security, [{}, { bearer: [] }]);
  assert.equal(document.components.schemas.UpdateProjectDto.minProperties, 1);
  assert.equal(document.components.schemas.CreateProjectDto.additionalProperties, false);
});

test('Real CRUD, errors and exported examples conform to OpenAPI schemas', async () => {
  const example = JSON.parse(readFileSync(path.join(__dirname, '../examples/create-project.json')));
  const created = await request('POST', '/projects', example);
  assert.equal(created.status, 201);
  matchesResponse('/projects', 'post', created);
  const url = '/projects/' + created.body.id;
  const list = await request('GET', '/projects');
  matchesResponse('/projects', 'get', list);
  matchesResponse('/projects/{id}', 'get', await request('GET', url));
  const updated = await request('PATCH', url, { status: 'completed' });
  matchesResponse('/projects/{id}', 'patch', updated);
  assert.equal(updated.body.status, 'completed');
  const duplicate = await request('POST', '/projects', example);
  assert.equal(duplicate.status, 409);
  matchesResponse('/projects', 'post', duplicate);
  const invalid = await request('POST', '/projects', { ...example, name: 'ab' });
  assert.equal(invalid.status, 400);
  matchesResponse('/projects', 'post', invalid);
  const invalidId = await request('GET', '/projects/abc');
  assert.equal(invalidId.status, 400);
  matchesResponse('/projects/{id}', 'get', invalidId);
  const oversized = await request('POST', '/projects', { ...example, description: 'x'.repeat(110000) });
  assert.equal(oversized.status, 413);
  matchesResponse('/projects', 'post', oversized);
  assert.equal(oversized.body.errorCode, 'PAYLOAD_TOO_LARGE');
  matchesResponse('/projects/{id}', 'delete', await request('DELETE', url));
  const missing = await request('GET', url);
  assert.equal(missing.status, 404);
  matchesResponse('/projects/{id}', 'get', missing);
  assert.equal(missing.headers.get('x-trace-id'), missing.body.traceId);
});

test('Bearer auth is optional and is not falsely documented as enforced', async () => {
  assert.equal((await request('GET', '/projects')).status, 200);
  assert.equal((await request('GET', '/projects', undefined, { Authorization: 'Bearer invalid-demo-token' })).status, 200);
});

test('GET with malformed JSON is rejected by parser with the documented 400 schema', async () => {
  const result = await new Promise((resolve, reject) => {
    const req = http.request(baseUrl + '/projects', {
      method: 'GET', headers: { 'Content-Type': 'application/json', 'Content-Length': 1 },
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(text) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Request timed out')));
    req.end('{');
  });
  assert.equal(result.status, 400);
  matchesResponse('/projects', 'get', result);
});
