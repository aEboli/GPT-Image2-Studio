import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CREATION_UPSTREAM_TIMEOUT_MS,
  MAX_CREATION_REFERENCE_IMAGES,
  MAX_CREATION_PARALLEL_TASKS,
  MAX_PARALLEL_TASKS_PER_SESSION,
  MAX_PROMPT_PARALLEL_TASKS,
  MAX_PROMPT_QUEUE_SIZE,
  MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES,
  MAX_PORTRAIT_PERSON_REFERENCE_IMAGES,
  MAX_REFERENCE_IMAGES,
} from "../lib/studio-constants.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);
const limitedConcurrencyPath = new URL("../lib/limited-concurrency.mjs", import.meta.url);
const serverPath = new URL("../server.mjs", import.meta.url);

test("prompt mode keeps fifteen tasks visible while limiting generation to ten parallel tasks", async () => {
  assert.equal(MAX_PARALLEL_TASKS_PER_SESSION, 15);
  assert.equal(MAX_PROMPT_PARALLEL_TASKS, 10);
  assert.equal(MAX_PROMPT_QUEUE_SIZE, 15);

  const app = await readFile(appPath, "utf8");
  const index = await readFile(indexPath, "utf8");

  assert.doesNotMatch(app, /maxConcurrentTasksPerSession/);
  assert.match(app, /maxParallelTasksPerSession:\s*15/);
  assert.match(index, /id="liveCount">0 \/ 10<\/span>/);
  assert.match(app, /function getMaxQueuedJobCount\(mode = getCurrentGenerationQueueMode\(\)\) \{[\s\S]*MAX_PROMPT_QUEUE_SIZE/);
  assert.match(app, /function getMaxParallelJobCount\(mode = getCurrentGenerationQueueMode\(\)\) \{[\s\S]*MAX_PROMPT_PARALLEL_TASKS/);
  assert.match(app, /selectNextQueuedGenerationJobsByMode\(state\.jobs, getMaxParallelJobCountForJob(?:, getGenerationJobSchedulingKey)?\)/);
  assert.match(app, /提示词模式最多保留 \$\{MAX_PROMPT_QUEUE_SIZE\} 个任务/);
});

test("creation mode has an independent twenty-task parallel limit shared with repair", async () => {
  assert.equal(MAX_CREATION_PARALLEL_TASKS, 20);
  assert.equal(CREATION_UPSTREAM_TIMEOUT_MS, 20 * 60 * 1000);
  assert.equal(MAX_PROMPT_PARALLEL_TASKS, 10);

  const server = await readFile(serverPath, "utf8");
  assert.match(server, /if \(scope === "creation"\) \{\s*return MAX_CREATION_PARALLEL_TASKS;/);
  assert.match(server, /runWithConcurrency\(plan\.items, MAX_CREATION_PARALLEL_TASKS,/);
  assert.match(server, /runWithConcurrency\(repairItems, MAX_CREATION_PARALLEL_TASKS,/);

  // The bounded-concurrency helper must not clamp the creation limit back down.
  const limitedConcurrency = await readFile(limitedConcurrencyPath, "utf8");
  assert.match(limitedConcurrency, /const MAX_CONCURRENT_WORKERS = 20;/);

  // The browser reserves creation queue slots against the server's creation limit, not
  // the general per-session limit.
  const app = await readFile(appPath, "utf8");
  assert.match(app, /function getCreationMaxParallelTaskCount\(\) \{\s*return MAX_CREATION_PARALLEL_TASKS;/);
  assert.match(app, /getMaxParallelTasks: getCreationMaxParallelTaskCount/);
});

test("creation generation and repair both reuse one reference upload registry", async () => {
  const server = await readFile(serverPath, "utf8");

  // Uploading is limited to the one route whose image input accepts a file identifier.
  assert.match(
    server,
    /function supportsCreationReferenceFileIds\(generationConfig = \{\}\) \{[\s\S]*?IMAGE_ROUTE_A[\s\S]*?API_ENDPOINT_RESPONSES/,
  );

  const creationGenerateHandler =
    server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const creationRepairHandler =
    server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";

  assert.notEqual(creationGenerateHandler, "");
  assert.notEqual(creationRepairHandler, "");

  // Both handlers build the registry once, outside the per-item fan-out.
  for (const handler of [creationGenerateHandler, creationRepairHandler]) {
    assert.match(handler, /await createCreationReferenceUploadRegistry\(\{/);
    assert.match(handler, /applyReferenceFileIds\(\s*referenceUploads\.registry,/);
    assert.match(handler, /referenceUploadTargetKey/);
  }

  // The repair pass can span several saved upstreams, so it collects every item's config.
  assert.match(
    creationRepairHandler,
    /generationConfigs: repairItems\.map\(\(repairItem\) =>\s*resolveCreationRepairGenerationConfig\(repairItem, generationConfig\),/,
  );
  // The registry must be built before the fan-out, never per item.
  assert.ok(
    creationGenerateHandler.indexOf("createCreationReferenceUploadRegistry") <
      creationGenerateHandler.indexOf("runWithConcurrency"),
  );
  assert.ok(
    creationRepairHandler.indexOf("createCreationReferenceUploadRegistry") <
      creationRepairHandler.indexOf("runWithConcurrency"),
  );
});

test("studio reference limits keep standard references and creation references at fifteen", async () => {
  assert.equal(MAX_REFERENCE_IMAGES, 15);
  assert.equal(MAX_CREATION_REFERENCE_IMAGES, 15);
  assert.equal(MAX_PORTRAIT_PERSON_REFERENCE_IMAGES, 3);
  assert.equal(MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES, 9);

  const app = await readFile(appPath, "utf8");
  const index = await readFile(indexPath, "utf8");

  assert.match(app, /maxReferenceImages:\s*15/);
  assert.match(app, /maxCreationReferenceImages:\s*15/);
  assert.match(app, /maxPortraitPersonReferenceImages:\s*3/);
  assert.match(app, /maxPortraitAccessoryReferenceImages:\s*9/);
  assert.match(index, /id="referenceCount">0 \/ 15<\/small>/);
  assert.match(index, /id="referenceAnalysisCount">0 \/ 15<\/span>/);
  assert.match(index, /id="creationReferenceCount">0 \/ 15<\/small>/);
});

test("local server counts active generation slots per request mode", async () => {
  const server = await readFile(serverPath, "utf8");
  const generateHandler =
    server.match(/async function handleGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function routeRequest/)?.[0] || "";
  const creationGenerateHandler =
    server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const creationRepairHandler =
    server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  const articleGenerateHandler =
    server.match(/async function handleArticleIllustrationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationSetsGet/)?.[0] || "";

  assert.match(server, /function getStudioGenerationRequestScope\(generationMode, imageRoute\) \{/);
  assert.match(server, /if \(mode === "prompt"\) \{\s*return mode;/);
  assert.match(server, /function getGenerationTaskSlotScopeKey\(sessionId, requestScope\) \{/);
  assert.match(server, /function claimSessionTaskSlot\(sessionId, taskId, requestScope\) \{/);
  assert.match(server, /const sessionTaskSlotLimiter = createSessionTaskSlotLimiter\(/);
  assert.match(server, /function getSessionTaskSlotLimit\(requestScope\) \{/);
  assert.match(server, /MAX_PROMPT_PARALLEL_TASKS/);
  assert.match(server, /function isResponseWritable\(response\) \{/);
  assert.match(server, /async function waitForSessionTaskSlot\(sessionId, taskId, requestScope, options = \{\}\) \{/);
  assert.match(server, /async function waitForResponseSessionTaskSlot\(sessionId, taskId, requestScope, response\) \{/);
  assert.match(server, /function releaseSessionTaskSlot\(sessionId, taskId, requestScope\) \{/);
  assert.match(server, /isActive: \(\) => isResponseWritable\(response\)/);
  assert.doesNotMatch(server, /const activeTasksBySessionScope = new Map\(\);/);
  assert.doesNotMatch(server, /activeTasksBySession = new Map\(\)/);

  assert.match(generateHandler, /generationRequestScope = getStudioGenerationRequestScope\(generationMode, generationConfig\.imageRoute\);/);
  assert.match(generateHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(generateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(creationGenerateHandler, /const generationRequestScope = "creation";/);
  assert.match(creationGenerateHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(creationGenerateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(creationRepairHandler, /const generationRequestScope = "creation";/);
  assert.match(creationRepairHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(creationRepairHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);

  assert.match(articleGenerateHandler, /const generationRequestScope = "article-illustration";/);
  assert.match(articleGenerateHandler, /waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\)/);
  assert.match(articleGenerateHandler, /releaseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)/);
});
