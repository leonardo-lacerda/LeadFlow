import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function readFromRepo(relativePathFromRepoRoot: string) {
    const absolutePath = resolve(process.cwd(), '..', relativePathFromRepoRoot);
    return readFileSync(absolutePath, 'utf-8');
}

test('campaign operational endpoints remain available in backend routes', () => {
    const campaignsRoutes = readFromRepo('backend/src/modules/campaigns/campaigns.routes.ts');

    assert.ok(
        campaignsRoutes.includes("'/:id/launch'"),
        'Expected POST /:id/launch route to exist'
    );
    assert.ok(
        campaignsRoutes.includes("'/:id/pause'"),
        'Expected POST /:id/pause route to exist'
    );
    assert.ok(
        campaignsRoutes.includes("'/:id/resume'"),
        'Expected POST /:id/resume route to exist'
    );
    assert.ok(
        campaignsRoutes.includes("'/:id/leads'"),
        'Expected POST /:id/leads route to exist'
    );
});

test('frontend campaign client uses operational lifecycle methods', () => {
    const campaignsApi = readFromRepo('frontend/lib/campaigns-api.ts');

    assert.ok(
        campaignsApi.includes('api.post(`/campaigns/${id}/launch`)'),
        'Expected campaignsApi.launch to call /campaigns/:id/launch'
    );
    assert.ok(
        campaignsApi.includes('api.post(`/campaigns/${id}/pause`)'),
        'Expected campaignsApi.pause to call /campaigns/:id/pause'
    );
    assert.ok(
        campaignsApi.includes('api.post(`/campaigns/${id}/resume`)'),
        'Expected campaignsApi.resume to call /campaigns/:id/resume'
    );
    assert.ok(
        campaignsApi.includes('Promise<{ created: number }>'),
        'Expected campaignsApi.addLeads response contract to be { created }'
    );
    assert.ok(
        !campaignsApi.includes('added: number') && !campaignsApi.includes('skipped: number'),
        'Unexpected legacy addLeads response contract found'
    );
});

test('frontend enrichment integration avoids obsolete endpoints', () => {
    const leadsPage = readFromRepo('frontend/app/leads/page.tsx');
    const scrapingDetailsPage = readFromRepo('frontend/app/scraping/[id]/page.tsx');
    const enrichmentApi = readFromRepo('frontend/lib/enrichment-api.ts');

    assert.ok(
        enrichmentApi.includes('api.post("/enrichment/jobs"'),
        'Expected enrichmentApi to call /enrichment/jobs'
    );
    assert.ok(
        !leadsPage.includes('/enrichment/bulk'),
        'Unexpected legacy /enrichment/bulk call in leads page'
    );
    assert.ok(
        !scrapingDetailsPage.includes('bulk-by-scraping'),
        'Unexpected legacy bulk-by-scraping endpoint usage in scraping details page'
    );
});
