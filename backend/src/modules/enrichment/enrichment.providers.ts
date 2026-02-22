import { cnpjProvider } from './providers/cnpj.provider.js';
import { domainProvider } from './providers/domain.provider.js';
import { icpProvider } from './providers/icp.provider.js';

export const enrichmentProviders = {
    cnpj: cnpjProvider,
    domain: domainProvider,
    icp: icpProvider,
};
