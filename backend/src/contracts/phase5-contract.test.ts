import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function readFromRepo(relativePathFromRepoRoot: string) {
    const absolutePath = resolve(process.cwd(), '..', relativePathFromRepoRoot);
    return readFileSync(absolutePath, 'utf-8');
}

test('backend registers ops routes and social publish worker', () => {
    const backendIndex = readFromRepo('backend/src/index.ts');

    assert.ok(
        backendIndex.includes("fastify.register(opsRoutes, { prefix: '/api/ops' })"),
        'Expected /api/ops routes registration in backend index'
    );
    assert.ok(
        backendIndex.includes('startSocialPublishWorker();'),
        'Expected social publish worker startup in backend index'
    );
});

test('integrations routes expose oauth and async publish endpoints', () => {
    const integrationsRoutes = readFromRepo('backend/src/modules/integrations/integrations.routes.ts');

    assert.ok(
        integrationsRoutes.includes("'/twitter/oauth/start'"),
        'Expected Twitter OAuth start endpoint'
    );
    assert.ok(
        integrationsRoutes.includes("'/linkedin/oauth/start'"),
        'Expected LinkedIn OAuth start endpoint'
    );
    assert.ok(
        integrationsRoutes.includes("'/twitter/oauth/callback'"),
        'Expected Twitter OAuth callback endpoint'
    );
    assert.ok(
        integrationsRoutes.includes("'/linkedin/oauth/callback'"),
        'Expected LinkedIn OAuth callback endpoint'
    );
    assert.ok(
        integrationsRoutes.includes("'/publish-jobs'"),
        'Expected publish-jobs list endpoint'
    );
    assert.ok(
        integrationsRoutes.includes("'/publish-jobs/:id/retry'"),
        'Expected publish-jobs retry endpoint'
    );
});

test('frontend clients target new growth and ops endpoints', () => {
    const growthApi = readFromRepo('frontend/lib/growth-api.ts');
    const opsApi = readFromRepo('frontend/lib/ops-api.ts');
    const rootPage = readFromRepo('frontend/app/page.tsx');

    assert.ok(
        growthApi.includes('"/integrations/twitter/oauth/start"'),
        'Expected growth client to call Twitter OAuth start'
    );
    assert.ok(
        growthApi.includes('"/integrations/linkedin/oauth/start"'),
        'Expected growth client to call LinkedIn OAuth start'
    );
    assert.ok(
        growthApi.includes('"/integrations/publish-jobs"'),
        'Expected growth client to call publish-jobs'
    );
    assert.ok(opsApi.includes('"/ops/summary"'), 'Expected ops client to call /ops/summary');
    assert.ok(rootPage.includes('./landing-v6/page'), 'Expected root page to render landing-v6');
});
