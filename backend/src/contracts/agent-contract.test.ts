import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function readFromRepo(relativePathFromRepoRoot: string) {
    const absolutePath = resolve(process.cwd(), '..', relativePathFromRepoRoot);
    return readFileSync(absolutePath, 'utf-8');
}

test('backend exposes agent policy and handoff endpoints', () => {
    const routes = readFromRepo('backend/src/modules/agent/agent.routes.ts');
    const backendIndex = readFromRepo('backend/src/index.ts');

    assert.ok(routes.includes("'/policy'"), 'Expected /agent/policy endpoint');
    assert.ok(routes.includes("'/summary'"), 'Expected /agent/summary endpoint');
    assert.ok(routes.includes("'/conversations'"), 'Expected /agent/conversations endpoint');
    assert.ok(
        routes.includes("'/conversations/:messageId/feedback'"),
        'Expected /agent/conversations/:messageId/feedback endpoint'
    );
    assert.ok(routes.includes("'/optimization'"), 'Expected /agent/optimization endpoint');
    assert.ok(routes.includes("'/handoffs'"), 'Expected /agent/handoffs endpoint');
    assert.ok(
        routes.includes("'/handoffs/:handoffId/resolve'"),
        'Expected /agent/handoffs/:handoffId/resolve endpoint'
    );
    assert.ok(routes.includes("'/runs/auto-cycle'"), 'Expected /agent/runs/auto-cycle endpoint');
    assert.ok(
        backendIndex.includes('startAgentWorker();'),
        'Expected agent worker startup in backend index'
    );
});

test('frontend agent module consumes policy and renders risk controls', () => {
    const apiClient = readFromRepo('frontend/lib/agent-api.ts');
    const settingsPage = readFromRepo('frontend/app/settings/agent/page.tsx');

    assert.ok(apiClient.includes('api.get("/agent/policy")'), 'Expected policy API call');
    assert.ok(
        apiClient.includes('api.get("/agent/conversations"'),
        'Expected conversations API call'
    );
    assert.ok(
        apiClient.includes('api.get("/agent/optimization"'),
        'Expected optimization API call'
    );
    assert.ok(settingsPage.includes('Guardrails de risco'), 'Expected guardrails section in UI');
    assert.ok(settingsPage.includes('Matriz de risco (MVP)'), 'Expected risk matrix section in UI');
    assert.ok(settingsPage.includes('Modos operacionais'), 'Expected mode definitions section in UI');
    assert.ok(
        settingsPage.includes('Conversa e qualificacao avancada'),
        'Expected conversation intelligence section in UI'
    );
    assert.ok(
        settingsPage.includes('Experimentos A/B por segmento/canal'),
        'Expected A/B experimentation section in UI'
    );
});
