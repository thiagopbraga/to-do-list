# IMP-T01 — Leitura do arquivo (FileReader)

> **Spec:** [Importação de Dados](../importacao-dados.md)
> **Requisitos:** IMP-01, IMP-02, IMP-NF-02
> **Dependências:** FND-T04

## Objetivo

Permitir selecionar um `.json` e ler seu conteúdo de forma segura.

## Passos

1. `<input type="file" accept="application/json">` (oculto + botão "Importar").
2. No `change`, usar `FileReader.readAsText`.
3. Capturar erros de leitura e encaminhar para o tratamento (IMP-T04).
4. Resetar o `value` do input para permitir reimportar o mesmo arquivo.

## Critérios de Verificação (DoD)

- [ ] Seleção de arquivo lê o conteúdo como texto.
- [ ] Erro de leitura não trava a app.
- [ ] É possível reimportar o mesmo arquivo em sequência.

## Arquivos afetados (estimado)

`src/components/Toolbar.tsx`, `src/lib/file.ts`
