"""Importa um .apkg com o importador oficial do Anki (sem GUI) e relata o resultado em JSON.

Uso:
  importar_apkg.py <arquivo.apkg> [--colecao caminho.anki2] [--json] [--atualizar {se-mais-novo,sempre,nunca}] [--estrito]

Sem --colecao usa uma coleção temporária descartável. Com --colecao a coleção é criada se não
existir e reaberta se existir; rodar duas vezes o mesmo arquivo sobre ela não deve aumentar
`notas` nem `cards` (RFC-001 §9 itens 3 e 6).

Saída: 0 = importou; 2 = o importador falhou; 3 = só com --estrito, importou mas com avisos.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from anki.collection import Collection, ImportAnkiPackageOptions, ImportAnkiPackageRequest
from anki.import_export_pb2 import (
    IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_ALWAYS,
    IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_IF_NEWER,
    IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_NEVER,
)

CONDICOES = {
    "se-mais-novo": IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_IF_NEWER,
    "sempre": IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_ALWAYS,
    "nunca": IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_NEVER,
}
# Categorias do log do importador que indicam problema (as demais são o fluxo normal).
CATEGORIAS_AVISO = ("conflicting", "missing_notetype", "missing_deck", "empty_first_field", "first_field_match")
CATEGORIAS_LOG = ("new", "updated", "duplicate") + CATEGORIAS_AVISO


def resumir_colecao(col: Collection) -> dict:
    por_tipo: dict[tuple[str, str], int] = {}
    notas = []
    for nid in col.find_notes(""):
        nota = col.get_note(nid)
        modelo = nota.note_type()
        tipo = "cloze" if modelo["type"] == 1 else "basico"
        por_tipo[(modelo["name"], tipo)] = por_tipo.get((modelo["name"], tipo), 0) + 1
        cards = nota.cards()
        notas.append(
            {
                "guid": nota.guid,
                "modelo": modelo["name"],
                "tipo": tipo,
                "mid": modelo["id"],
                "campos": list(nota.fields),
                "tags": list(nota.tags),
                "cards": len(cards),
                "ords": sorted(c.ord for c in cards),
                "baralhos": sorted({col.decks.name(c.did) for c in cards}),
            }
        )
    return {
        "notas": col.note_count(),
        "cards": col.card_count(),
        "notas_por_note_type": [
            {"nome": nome, "tipo": tipo, "notas": n} for (nome, tipo), n in sorted(por_tipo.items())
        ],
        "guids": sorted(n["guid"] for n in notas),
        "detalhe_notas": sorted(notas, key=lambda n: n["guid"]),
        "baralhos": sorted(d.name for d in col.decks.all_names_and_ids()),
    }


def importar(apkg: Path, colecao: Path, atualizar: str) -> dict:
    col = Collection(str(colecao))
    try:
        antes = {"notas": col.note_count(), "cards": col.card_count()}
        opcoes = ImportAnkiPackageOptions(
            merge_notetypes=False,
            update_notes=CONDICOES[atualizar],
            update_notetypes=CONDICOES[atualizar],
            with_scheduling=False,
            with_deck_configs=False,
        )
        resposta = col.import_anki_package(ImportAnkiPackageRequest(package_path=str(apkg), options=opcoes))
        log = {c: len(getattr(resposta.log, c)) for c in CATEGORIAS_LOG}
        avisos = [f"{c}: {log[c]} nota(s)" for c in CATEGORIAS_AVISO if log[c]]
        return {
            "ok": True,
            "arquivo": str(apkg),
            "colecao": str(colecao),
            "antes": antes,
            "log_importacao": log,
            "encontradas_no_pacote": resposta.log.found_notes,
            "avisos": avisos,
            "erros": [],
            **resumir_colecao(col),
        }
    finally:
        col.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("apkg", type=Path)
    ap.add_argument("--colecao", type=Path, help="coleção a criar/reabrir (padrão: temporária)")
    ap.add_argument("--json", action="store_true", help="imprime apenas o JSON (sem resumo legível)")
    ap.add_argument("--atualizar", choices=sorted(CONDICOES), default="se-mais-novo")
    ap.add_argument("--estrito", action="store_true", help="falha (código 3) se houver avisos")
    args = ap.parse_args()

    if not args.apkg.is_file():
        resultado = {"ok": False, "erros": [f"arquivo não encontrado: {args.apkg}"], "avisos": []}
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        return 2

    with tempfile.TemporaryDirectory() as tmp:
        colecao = args.colecao or Path(tmp) / "colecao.anki2"
        try:
            resultado = importar(args.apkg.resolve(), colecao.resolve(), args.atualizar)
        except Exception as exc:  # o backend Rust levanta tipos variados (BackendError, DBError...)
            resultado = {
                "ok": False,
                "arquivo": str(args.apkg),
                "erros": [f"{type(exc).__name__}: {exc}"],
                "avisos": [],
            }

    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    if not args.json:
        if resultado["ok"]:
            print(f"\n{resultado['notas']} nota(s), {resultado['cards']} card(s); log: {resultado['log_importacao']}", file=sys.stderr)
        else:
            print(f"\nFALHA: {resultado['erros']}", file=sys.stderr)
    if not resultado["ok"]:
        return 2
    if args.estrito and resultado["avisos"]:
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
