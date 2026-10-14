import { iniciarTelemetria } from './telemetria';

// Módulo de efeito colateral importado primeiro pelo main.ts: os imports seguintes carregam Nest, pg e pg-boss, que precisam estar instrumentados.
iniciarTelemetria('cardify-worker');
