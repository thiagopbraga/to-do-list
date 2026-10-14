import { iniciarTelemetria } from './telemetria';

// Módulo de efeito colateral importado primeiro pelo main.ts: os imports seguintes carregam Nest, fastify e pg, que precisam estar instrumentados.
iniciarTelemetria('cardify-api');
