# tools/anki

Ferramentas Python (só de desenvolvimento/CI, não são dependência de runtime) baseadas na biblioteca oficial `anki`.

```
bash tools/anki/preparar.sh   # cria tools/anki/.venv (python3.11, ou python3) e instala requirements.txt (anki==25.2)
```

`preparar.sh` é idempotente: se o venv já tem a biblioteca `anki`, só confirma a versão. A CI roda-o antes de `npm run test:apkg`.

## gerar_semente.py

`tools/anki/.venv/bin/python tools/anki/gerar_semente.py` (a partir de `cardify/`)

Gera a semente `collection.anki2` vazia, no schema legado 11, em `libs/apkg/assets/collection.anki2` (usada pelo empacotador) e `fixtures/anki/collection.anki2` (cópia). Só precisa rodar de novo para fixar a semente numa nova versão do Anki.

O `export_anki_package(legacy=True)` grava dois bancos no zip: `collection.anki21` (o real, schema 11) e `collection.anki2` (um dummy com uma nota "atualize o Anki"). O script usa o `.anki21`, confere que o `.anki2` é o dummy, apaga notes/cards/revlog/graves, descarta `sqlite_stat*` e faz `VACUUM`. O `col` mantém `models` (Basic e Cloze de fábrica, que o empacotador sobrescreve), `decks` (id 1 "Default"), `dconf` e `conf`.

## importar_apkg.py

`importar_apkg.py <arquivo.apkg> [--colecao caminho.anki2] [--json] [--atualizar se-mais-novo|sempre|nunca] [--estrito]`

Importa o `.apkg` com o importador oficial (sem GUI) e imprime JSON: `notas`, `cards`, `notas_por_note_type` (nome + `basico`/`cloze`), `guids`, `detalhe_notas` (campos, tags, ords dos cards, baralhos), `log_importacao` (new/updated/duplicate/...), `avisos` e `erros`. Código de saída 0 = importou, 2 = falhou, 3 = avisos com `--estrito`.

Com `--colecao`, a coleção é criada ou reaberta: rodar duas vezes o mesmo arquivo deve manter `notas`/`cards` (na segunda, `log_importacao.duplicate` = total de notas). Sem `--colecao` usa uma coleção temporária.

## importar_csv.py

`importar_csv.py <arquivo.csv|tsv> [--colecao caminho.anki2] [--json]`

Importa o texto gerado por `exportarDelimitado` (`libs/apkg/src/delimitado.ts`) com o importador de texto oficial (`Collection.get_csv_metadata` + `import_csv`), do mesmo jeito que a GUI em Arquivo > Importar: os cabeçalhos `#separator`, `#notetype column`, `#deck column`, `#tags column` e `#columns` são lidos do arquivo e aplicados sem ajuste manual. A saída JSON tem o mesmo formato do `importar_apkg.py` (`notas`, `cards`, `notas_por_note_type`, `detalhe_notas`, `baralhos`, `avisos`, `erros`) mais `metadados` (o que o Anki detectou nos cabeçalhos), `log_importacao` e `note_types` (todos os note types da coleção). Código de saída 0 = importou, 2 = falhou.

Atenção ao ler `ok: true`: o importador de texto não falha quando o note type da coluna 1 não existe; ele descarta a linha e conta em `log_importacao.missing_notetype` (e em `avisos`). Numa coleção nova, onde `Cardify Básico`/`Cardify Cloze` ainda não existem, nenhuma nota é criada.

## Suíte de integração (RFC-001 §9)

`npm run test:apkg` (a partir de `cardify/`) roda `libs/apkg/src/apkg.int.test.ts`, que usa os dois importadores acima, um processo por importação e sempre sobre uma coleção temporária nova. Sem `tools/anki/.venv/bin/python` a suíte falha pedindo `preparar.sh`; ela não pula. `CARDIFY_ANKI_PYTHON` troca o interpretador (usado pela própria suíte para provar essa mensagem).

## gerar_apkg_minimo.py

Gera `fixtures/anki/minimo.apkg` (1 nota básica + 1 cloze com c1 e c2 = 3 cards) com a própria biblioteca `anki`, como entrada de teste do importador.
