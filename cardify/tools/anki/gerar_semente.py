"""Gera a semente `collection.anki2` (schema legado 11, sem notas) com a biblioteca oficial `anki`.

Uso: tools/anki/.venv/bin/python tools/anki/gerar_semente.py

Fluxo: coleção temporária -> 1 nota básica + 1 cloze (para que os dois note types entrem no
`col.models`) -> exportação .apkg com legacy=True -> extrai o banco real do zip -> apaga
notes/cards/revlog/graves -> VACUUM -> grava em libs/apkg/assets e fixtures/anki.

No modo legado o Anki grava DOIS bancos no zip: `collection.anki21` (o real, schema 11) e um
`collection.anki2` "dummy" com uma única nota pedindo para atualizar o Anki. O banco correto é
o `.anki21`; o script confere isso pela nota-aviso antes de aceitar o arquivo.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path

from anki.collection import Collection, ExportAnkiPackageOptions

RAIZ = Path(__file__).resolve().parents[2]
DESTINOS = [
    RAIZ / "libs" / "apkg" / "assets" / "collection.anki2",
    RAIZ / "fixtures" / "anki" / "collection.anki2",
]
SCHEMA_ESPERADO = 11


def exportar_legado(pasta: Path) -> Path:
    col = Collection(str(pasta / "origem.anki2"))
    try:
        basico = col.models.by_name("Basic")
        cloze = col.models.by_name("Cloze")
        assert basico is not None and cloze is not None
        nota = col.new_note(basico)
        nota["Front"], nota["Back"] = "frente", "verso"
        col.add_note(nota, 1)
        nota = col.new_note(cloze)
        nota["Text"] = "A {{c1::semente}} nasce vazia."
        col.add_note(nota, 1)

        saida = pasta / "legado.apkg"
        opcoes = ExportAnkiPackageOptions(
            with_scheduling=False, with_deck_configs=False, with_media=False, legacy=True
        )
        col.export_anki_package(out_path=str(saida), options=opcoes, limit=None)
        return saida
    finally:
        col.close()


def extrair_banco_real(apkg: Path, pasta: Path) -> Path:
    with zipfile.ZipFile(apkg) as z:
        nomes = z.namelist()
        if "collection.anki21" not in nomes:
            raise SystemExit(f"zip legado sem collection.anki21: {nomes}")
        real = pasta / "real.sqlite"
        real.write_bytes(z.read("collection.anki21"))
        dummy = pasta / "dummy.sqlite"
        dummy.write_bytes(z.read("collection.anki2"))

    flds = [r[0] for r in sqlite3.connect(dummy).execute("select flds from notes")]
    if not any("Please update to the latest Anki" in f for f in flds):
        raise SystemExit("collection.anki2 do zip não é o dummy esperado; formato mudou?")
    flds_reais = [r[0] for r in sqlite3.connect(real).execute("select flds from notes")]
    if len(flds_reais) != 2 or any("Please update" in f for f in flds_reais):
        raise SystemExit(f"collection.anki21 inesperado: {flds_reais}")
    return real


def esvaziar(banco: Path) -> None:
    con = sqlite3.connect(banco)
    con.isolation_level = None
    con.execute("pragma journal_mode = delete")
    for tabela in ("notes", "cards", "revlog", "graves"):
        con.execute(f"delete from {tabela}")
    con.execute("update col set tags = '{}'")
    for tabela in ("sqlite_stat1", "sqlite_stat4"):
        con.execute(f"drop table if exists {tabela}")
    con.execute("vacuum")
    con.close()


def descrever(banco: Path) -> dict:
    con = sqlite3.connect(banco)
    ver = con.execute("select ver from col").fetchone()[0]
    tabelas = [r[0] for r in con.execute("select name from sqlite_master where type='table' order by name")]
    contagens = {t: con.execute(f"select count(*) from {t}").fetchone()[0] for t in ("notes", "cards", "revlog", "graves")}
    modelos, baralhos = con.execute("select models, decks from col").fetchone()
    modelos = {k: {"nome": v["name"], "tipo": v["type"]} for k, v in json.loads(modelos).items()}
    baralhos = {k: v["name"] for k, v in json.loads(baralhos).items()}
    con.close()
    return {"ver": ver, "tabelas": tabelas, "contagens": contagens, "modelos": modelos, "baralhos": baralhos}


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        pasta = Path(tmp)
        apkg = exportar_legado(pasta)
        banco = extrair_banco_real(apkg, pasta)
        esvaziar(banco)
        info = descrever(banco)
        if info["ver"] != SCHEMA_ESPERADO:
            raise SystemExit(f"col.ver = {info['ver']}, esperado {SCHEMA_ESPERADO}")
        if info["contagens"]["notes"] or info["contagens"]["cards"]:
            raise SystemExit(f"semente não está vazia: {info['contagens']}")
        for destino in DESTINOS:
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(banco, destino)

    print("col.ver:", info["ver"])
    print("tabelas:", info["tabelas"])
    print("contagens:", info["contagens"])
    print("decks:", json.dumps(info["baralhos"], ensure_ascii=False))
    print("models:", json.dumps(info["modelos"], ensure_ascii=False))
    for destino in DESTINOS:
        print("gravado:", destino.relative_to(RAIZ), destino.stat().st_size, "bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
