# tools/anki

Ferramentas Python (só de desenvolvimento/CI, não são dependência de runtime) baseadas na biblioteca oficial `anki`.

```
cd tools/anki
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt   # anki==25.2
```

## gerar_semente.py

`tools/anki/.venv/bin/python tools/anki/gerar_semente.py` (a partir de `cardify/`)

Gera a semente `collection.anki2` vazia, no schema legado 11, em `libs/apkg/assets/collection.anki2` (usada pelo empacotador) e `fixtures/anki/collection.anki2` (cópia). Só precisa rodar de novo para fixar a semente numa nova versão do Anki.

O `export_anki_package(legacy=True)` grava dois bancos no zip: `collection.anki21` (o real, schema 11) e `collection.anki2` (um dummy com uma nota "atualize o Anki"). O script usa o `.anki21`, confere que o `.anki2` é o dummy, apaga notes/cards/revlog/graves, descarta `sqlite_stat*` e faz `VACUUM`. O `col` mantém `models` (Basic e Cloze de fábrica, que o empacotador sobrescreve), `decks` (id 1 "Default"), `dconf` e `conf`.

## importar_apkg.py

`importar_apkg.py <arquivo.apkg> [--colecao caminho.anki2] [--json] [--atualizar se-mais-novo|sempre|nunca] [--estrito]`

Importa o `.apkg` com o importador oficial (sem GUI) e imprime JSON: `notas`, `cards`, `notas_por_note_type` (nome + `basico`/`cloze`), `guids`, `detalhe_notas` (campos, tags, ords dos cards, baralhos), `log_importacao` (new/updated/duplicate/...), `avisos` e `erros`. Código de saída 0 = importou, 2 = falhou, 3 = avisos com `--estrito`.

Com `--colecao`, a coleção é criada ou reaberta: rodar duas vezes o mesmo arquivo deve manter `notas`/`cards` (na segunda, `log_importacao.duplicate` = total de notas). Sem `--colecao` usa uma coleção temporária.

## gerar_apkg_minimo.py

Gera `fixtures/anki/minimo.apkg` (1 nota básica + 1 cloze com c1 e c2 = 3 cards) com a própria biblioteca `anki`, como entrada de teste do importador.
