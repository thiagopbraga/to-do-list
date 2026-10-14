"""Importa o CSV/TSV gerado por `exportarDelimitado` com o importador de texto oficial do Anki (sem GUI).

Uso:
  importar_csv.py <arquivo.csv|tsv> [--colecao caminho.anki2] [--json]

Faz o que a GUI faz em Arquivo > Importar: `get_csv_metadata` lê os cabeçalhos `#...` do arquivo e
`import_csv` aplica exatamente os metadados detectados, sem o usuário ajustar nada. Sem --colecao usa
uma coleção temporária. Com --colecao a coleção é criada se não existir e reaberta se existir (por
exemplo, uma onde o .apkg do Cardify já foi importado).

Saída (JSON): `metadados` detectados, `log_importacao`, contagens, `note_types` da coleção, `avisos`
e `erros`. Código de saída 0 = importou, 2 = o importador falhou.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # também sob `python -I`, que não inclui a pasta do script

from anki.collection import Collection, CsvMetadata, ImportCsvRequest  # noqa: E402

from importar_apkg import CATEGORIAS_AVISO, CATEGORIAS_LOG, resumir_colecao  # noqa: E402

DELIMITADORES = {v.number: v.name for v in CsvMetadata.Delimiter.DESCRIPTOR.values}
RESOLUCOES = {v.number: v.name for v in CsvMetadata.DupeResolution.DESCRIPTOR.values}


def descrever_metadados(col: Collection, meta: CsvMetadata) -> dict:
    nt_global = meta.global_notetype
    modelo = col.models.get(nt_global.id) if nt_global.id else None
    deck = col.decks.get(meta.deck_id) if meta.deck_id else None
    return {
        "delimitador": DELIMITADORES.get(meta.delimiter, str(meta.delimiter)),
        "html": meta.is_html,
        "colunas": list(meta.column_labels),
        "coluna_note_type": meta.notetype_column,
        "coluna_baralho": meta.deck_column,
        "coluna_tags": meta.tags_column,
        "coluna_guid": meta.guid_column,
        "note_type_global": {
            "id": nt_global.id,
            "nome": modelo["name"] if modelo else None,
            "colunas_dos_campos": list(nt_global.field_columns),
        },
        "baralho_global": deck["name"] if deck else None,
        "tags_globais": list(meta.global_tags),
        "duplicatas": RESOLUCOES.get(meta.dupe_resolution, str(meta.dupe_resolution)),
        "previa": [list(linha.vals) for linha in meta.preview][:3],
    }


def importar(arquivo: Path, colecao: Path) -> dict:
    col = Collection(str(colecao))
    try:
        antes = {
            "notas": col.note_count(),
            "cards": col.card_count(),
            "note_types": sorted(m["name"] for m in col.models.all()),
        }
        meta = col.get_csv_metadata(str(arquivo), None)
        descricao = descrever_metadados(col, meta)
        resposta = col.import_csv(ImportCsvRequest(path=str(arquivo), metadata=meta))
        log = {c: len(getattr(resposta.log, c)) for c in CATEGORIAS_LOG}
        avisos = [f"{c}: {log[c]} nota(s)" for c in CATEGORIAS_AVISO if log[c]]
        return {
            "ok": True,
            "arquivo": str(arquivo),
            "colecao": str(colecao),
            "antes": antes,
            "metadados": descricao,
            "log_importacao": log,
            "encontradas_no_arquivo": resposta.log.found_notes,
            "avisos": avisos,
            "erros": [],
            "note_types": [
                {"nome": m["name"], "tipo": "cloze" if m["type"] == 1 else "basico", "campos": [f["name"] for f in m["flds"]]}
                for m in sorted(col.models.all(), key=lambda m: m["name"])
            ],
            **resumir_colecao(col),
        }
    finally:
        col.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("arquivo", type=Path)
    ap.add_argument("--colecao", type=Path, help="coleção a criar/reabrir (padrão: temporária)")
    ap.add_argument("--json", action="store_true", help="imprime apenas o JSON (sem resumo legível)")
    args = ap.parse_args()

    if not args.arquivo.is_file():
        print(json.dumps({"ok": False, "erros": [f"arquivo não encontrado: {args.arquivo}"], "avisos": []}, ensure_ascii=False, indent=2))
        return 2

    with tempfile.TemporaryDirectory() as tmp:
        colecao = args.colecao or Path(tmp) / "colecao.anki2"
        try:
            resultado = importar(args.arquivo.resolve(), colecao.resolve())
        except Exception as exc:  # o backend Rust levanta tipos variados (BackendError, DBError...)
            resultado = {"ok": False, "arquivo": str(args.arquivo), "erros": [f"{type(exc).__name__}: {exc}"], "avisos": []}

    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    if not args.json:
        if resultado["ok"]:
            print(f"\n{resultado['notas']} nota(s), {resultado['cards']} card(s); log: {resultado['log_importacao']}", file=sys.stderr)
        else:
            print(f"\nFALHA: {resultado['erros']}", file=sys.stderr)
    return 0 if resultado["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
