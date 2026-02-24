import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getAgentCapabilities,
    isAgentModeAllowed,
    recommendPlanBySignalsUsage,
    toLegacyLimits,
} from './plan-catalog.js';

test('recommendPlanBySignalsUsage maps thresholds to expected plans', () => {
    assert.equal(recommendPlanBySignalsUsage(0), 'STARTER');
    assert.equal(recommendPlanBySignalsUsage(2_000), 'STARTER');
    assert.equal(recommendPlanBySignalsUsage(2_001), 'GROWTH');
    assert.equal(recommendPlanBySignalsUsage(10_000), 'GROWTH');
    assert.equal(recommendPlanBySignalsUsage(40_000), 'SCALE');
    assert.equal(recommendPlanBySignalsUsage(120_001), 'ENTERPRISE');
});

test('toLegacyLimits keeps historical limit fields aligned with plan capacity', () => {
    const starter = toLegacyLimits('STARTER');
    assert.equal(starter.leadsLimit, 500);
    assert.equal(starter.emailsLimit, 2_000);
    assert.equal(starter.whatsappLimit, 2_000);
    assert.equal(starter.enrichmentsLimit, 2_000);
});

test('agent mode matrix is enforced by plan', () => {
    const starter = getAgentCapabilities('STARTER');
    assert.equal(starter.defaultMode, 'ASSISTED');
    assert.equal(starter.allowedModes.includes('SUPERVISED'), false);

    assert.equal(isAgentModeAllowed('GROWTH', 'ASSISTED'), true);
    assert.equal(isAgentModeAllowed('GROWTH', 'SUPERVISED'), true);
    assert.equal(isAgentModeAllowed('GROWTH', 'AUTONOMOUS'), false);

    assert.equal(isAgentModeAllowed('SCALE', 'AUTONOMOUS'), true);
});
