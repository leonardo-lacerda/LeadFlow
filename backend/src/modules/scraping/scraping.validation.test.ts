import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeScrapingQuery } from './scraping.validation.js';

describe('sanitizeScrapingQuery', () => {
    it('normalizes text fields and parses limit for google_maps', () => {
        const query = sanitizeScrapingQuery('google_maps', {
            query: '  agencias de marketing  ',
            location: ' Sao Paulo, SP ',
            limit: '120',
        });

        assert.deepEqual(query, {
            query: 'agencias de marketing',
            location: 'Sao Paulo, SP',
            limit: 120,
        });
    });

    it('uses default limit when omitted', () => {
        const query = sanitizeScrapingQuery('reclame_aqui', {
            query: 'operadoras',
        });

        assert.equal(query.limit, 100);
    });

    it('parses list-like inputs for cnpj', () => {
        const query = sanitizeScrapingQuery('cnpj', {
            cnpj: '00.000.000/0001-00\n11.111.111/0001-11',
            limit: 2,
        });

        assert.deepEqual(query, {
            cnpj: ['00.000.000/0001-00', '11.111.111/0001-11'],
            limit: 2,
        });
    });

    it('rejects out-of-range limit', () => {
        assert.throws(
            () =>
                sanitizeScrapingQuery('indeed', {
                    query: 'designer',
                    location: 'Sao Paulo',
                    limit: 1001,
                }),
            /limit must be between 1 and 1000/i
        );
    });

    it('rejects missing required fields', () => {
        assert.throws(
            () =>
                sanitizeScrapingQuery('indeed', {
                    query: 'designer',
                }),
            /location is required/i
        );
    });
});

