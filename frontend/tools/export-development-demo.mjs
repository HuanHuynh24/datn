// Export only source fixtures for a reviewed Development import, never runtime fallback.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceFile = path.join(root, 'frontend/src/marketplace/data.ts');
const referenceFile = path.join(root, 'frontend/src/marketplace/reference-data.json');
const source = fs.readFileSync(sourceFile, 'utf8');
const exported = { exports: {} };
// Repository-owned fixture module has no imports or external dependencies.
const ast = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
if (ast.statements.some(statement => ts.isImportDeclaration(statement))) throw new Error('Fixture module must remain self-contained');
new Function('exports', 'module', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exported.exports, exported);
const fixtures = exported.exports;
const reference = JSON.parse(fs.readFileSync(referenceFile, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = {
  version: 1,
  provenance: 'Synthetic/local Development fixtures; not verified real-world records',
  target_database: 'recruitment_db',
  source_sha256: { 'data.ts': hash(sourceFile), 'reference-data.json': hash(referenceFile) },
  fixtures: { companies: fixtures.companies, jobs: fixtures.jobs, candidates: [...fixtures.candidates, fixtures.pipelineCandidate], applications: fixtures.applications, categories: fixtures.categories },
  reference: { companies: reference.companies, jobs: reference.jobs, categories: reference.categories },
  excluded: ['Matching scores', 'fake applicant/open-job counters', 'saved jobs', 'interview schedules', 'CV/application records without a genuine private file snapshot', 'banners/editorial articles'],
  decisions: {
    missing_company_fields: ['tax_code', 'OWNER account', 'package'],
    job_currency: 'MySQL/API salary fields are VND; never silently treat USD as VND or invent an exchange rate',
    multiple_locations: 'Some reference jobs list several provinces but ERD has one province FK per job; mapping requires review',
    approval: 'Source verified flag is a presentation fixture, not actual Admin approval',
  },
};
const folder = path.join(root, '.local-backups/demo-import');
fs.mkdirSync(folder, { recursive: true });
const output = path.join(folder, 'source-manifest.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ status: 'EXPORTED_NO_DATABASE_WRITES', path: path.relative(root, output), fixtures: Object.fromEntries(Object.entries(report.fixtures).map(([key, values]) => [key, values.length])), reference: Object.fromEntries(Object.entries(report.reference).map(([key, values]) => [key, values.length])), manifest_sha256: hash(output) }, null, 2));
