const { writeFile, readFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const { createApp } = require('../dist/main');
const { createOpenApiDocument } = require('../dist/openapi/swagger');
const { createProjectExample, projectExample, updateProjectExample, errorExample } = require('../dist/openapi/examples');

async function main() {
  const app = await createApp({ logger: false });
  try {
    const files = {
      'openapi.json': createOpenApiDocument(app),
      'examples/create-project.json': createProjectExample,
      'examples/update-project.json': updateProjectExample,
      'examples/project-response.json': projectExample,
      'examples/project-list.json': [projectExample],
      'examples/not-found.json': errorExample(404, 'PROJECT_NOT_FOUND', 'Project with id 10 was not found', '/projects/10'),
      'examples/conflict.json': errorExample(409, 'PROJECT_NAME_CONFLICT', 'Project with name "StudyFlow" already exists', '/projects'),
    };
    for (const [relative, value] of Object.entries(files)) {
      const target = path.join(__dirname, '..', relative);
      const text = JSON.stringify(value, null, 2) + '\n';
      if (process.argv.includes('--check')) {
        if (await readFile(target, 'utf8') !== text) throw new Error(`${relative} is stale. Run npm run openapi:generate`);
      } else {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, text);
      }
    }
    console.log(process.argv.includes('--check') ? 'OpenAPI and examples match source.' : 'Generated openapi.json and examples/*.json');
  } finally {
    await app.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
