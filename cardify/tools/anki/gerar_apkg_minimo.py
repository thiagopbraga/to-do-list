"""Gera fixtures/anki/minimo.apkg com a biblioteca oficial `anki`: 1 nota básica + 1 cloze (c1 e c2).

Serve de referência de "como o Anki real exporta" e de entrada de teste para importar_apkg.py.
Uso: tools/anki/.venv/bin/python tools/anki/gerar_apkg_minimo.py [saida.apkg]
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from anki.collection import Collection, ExportAnkiPackageOptions

RAIZ = Path(__file__).resolve().parents[2]


def main() -> None:
    saida = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "fixtures" / "anki" / "minimo.apkg"
    saida.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        col = Collection(str(Path(tmp) / "c.anki2"))
        try:
            did = col.decks.id("Cardify::Teste")
            basico = col.models.by_name("Basic")
            cloze = col.models.by_name("Cloze")
            n1 = col.new_note(basico)
            n1["Front"], n1["Back"] = "Qual é a função do nó sinoatrial?", "Marca-passo natural do coração."
            n1.tags = ["cardify::teste::basico"]
            col.add_note(n1, did)
            n2 = col.new_note(cloze)
            n2["Text"] = "O {{c1::nó sinoatrial}} dispara cerca de {{c2::70}} vezes por minuto."
            n2.tags = ["cardify::teste::cloze"]
            col.add_note(n2, did)
            opcoes = ExportAnkiPackageOptions(
                with_scheduling=False, with_deck_configs=False, with_media=False, legacy=True
            )
            col.export_anki_package(out_path=str(saida), options=opcoes, limit=None)
        finally:
            col.close()
    print("gerado:", saida)


if __name__ == "__main__":
    main()
