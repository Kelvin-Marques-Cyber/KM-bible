#!/usr/bin/env python3
"""Exporta EXCLUSIVAMENTE o acervo de Apologetica e as fontes ja citadas.

O ZIP pode ser enviado para revisão e enriquecimento das leituras
'Apologética reformada' e 'Estudo impessoal'. Não exporta Bíblias,
comentários bíblicos gerais, devocionais, notas, ARA ou Agostinho.
Fontes externas só são cadastradas por URL: seu texto integral ainda
depende de licença e de coleta/revisão específica.
"""
from __future__ import annotations
import datetime as dt
import io
import json
import re
import sqlite3
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
CONTENT=ROOT/"assets"/"content"
BUNDLED=ROOT/"assets"/"bundled"
OUTPUT=ROOT/"exportacoes"
ORIGINS=ROOT/"acervo-apologetica-entrada"
MODULE_IDS={"EXP2-APOL-REF","EXP2-APOL-NEUTRO"}
MODULE_FILES=("PTBR-Apologetica-Presbiteriana-64-PTBR.biblepkg",
              "PTBR-Panoramas-Imparciais-64-PTBR.biblepkg")
ALLOWED={".pdf",".txt",".md",".html",".htm",".json",".epub"}
MAX_FILE=40_000_000

def load(name, default):
    path=CONTENT/name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default

def db_studies():
    path=CONTENT/"catalogue.sqlite"
    if not path.is_file():
        return []
    con=sqlite3.connect(f"file:{path.resolve()}?mode=ro&immutable=1",uri=True)
    con.row_factory=sqlite3.Row
    try:
        t=con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='studies'").fetchone()
        if not t: return []
        rows=[]
        for rec in con.execute("SELECT * FROM studies"):
            item=dict(rec)
            for key in ("sources","refs"):
                if isinstance(item.get(key),str):
                    try:item[key]=json.loads(item[key])
                    except ValueError:item[key]=[]
            rows.append(item)
        return rows
    finally:con.close()

def read_modules(zf):
    total=0
    for name in MODULE_FILES:
        f=BUNDLED/name
        if not f.is_file(): continue
        with zipfile.ZipFile(f) as inner:
            manifest=json.loads(inner.read("manifest.json"))
            if manifest.get("id") not in MODULE_IDS:continue
            data=json.loads(inner.read("data.json"))
            mid=manifest["id"]
            zf.writestr(f"apologetica/modulos/{mid}/manifest.json",json.dumps(manifest,ensure_ascii=False,indent=2))
            zf.writestr(f"apologetica/modulos/{mid}/data.json",json.dumps(data,ensure_ascii=False))
            total+=len(data)
    return total

def pack():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    studies=load("studies.json",[])
    expansion=load("editorial-expansion.json",{})
    expanded=expansion.get("studies",[])
    curricula=load("religion-curricula.json",[])
    confessional=load("confessional-guides.json",{})
    sqlite_studies=db_studies()
    by_id={}
    for source in (studies,expanded,sqlite_studies):
        for study in source:
            if isinstance(study,dict) and study.get("id"):
                by_id[str(study["id"])]=study
    # Apologetica: preserva duas perspectivas, doutrinas, argumentos e fontes.
    records=list(by_id.values())
    unique={}
    refs_by_study={}
    for study in records:
        study_sources=study.get("sources") or []
        if isinstance(study_sources,str):
            try:study_sources=json.loads(study_sources)
            except ValueError:study_sources=[]
        urls=[]
        if isinstance(study_sources,list):
            for source in study_sources:
                if isinstance(source,dict):
                    url=source.get("url")
                    if isinstance(url,str) and url.startswith(("https://","http://")):
                        unique[url]={
                            "url":url,
                            "title":source.get("title",""),
                            "host":urlparse(url).hostname,
                            "copyright":"verificar condições da fonte antes de redistribuir",
                            "language":"a verificar",
                            "full_text_imported":False,
                        }
                        urls.append(url)
        refs_by_study[str(study["id"])]=urls
    category_counts=Counter(str(x.get("target") or "sem tradição") for x in records)
    output=OUTPUT/("KM-bible-apologetica-"+dt.date.today().strftime("%Y%m%d")+".zip")
    with zipfile.ZipFile(output,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        def write(name,obj):
            archive.writestr(name,json.dumps(obj,ensure_ascii=False,indent=2))
        write("apologetica/estudos-consolidados.json",records)
        write("apologetica/estudos-originais.json",studies)
        write("apologetica/estudos-expandidos.json",expanded)
        write("apologetica/curriculos-27-tradicoes.json",curricula)
        write("apologetica/guias-confessionais.json",confessional)
        write("apologetica/fontes-externas.json",list(unique.values()))
        write("apologetica/fontes-por-estudo.json",refs_by_study)
        modules=read_modules(archive)
        if ORIGINS.exists():
            for path in sorted(ORIGINS.rglob("*")):
                if path.is_file() and path.suffix.lower() in ALLOWED and path.stat().st_size <= MAX_FILE:
                    archive.write(path,"apologetica/originais-autorizados/"+path.relative_to(ORIGINS).as_posix())
        write("INVENTARIO.json",{
            "escopo":"somente Apologética: reformada e impessoal",
            "estudos":len(records),"tradicoes":len(category_counts),
            "por_tradicao":dict(category_counts),
            "fontes_url":len(unique),"entradas_modulos":modules,
            "gerado_em":dt.datetime.now(dt.timezone.utc).isoformat(),
            "excluidos":"Agostinho, Bíblias, notas, devocionais, comentários gerais, dados pessoais",
        })
        archive.writestr("LEIA-ME.txt",
            "Exportação exclusiva dos materiais de APOLOGÉTICA do KM-bible.\n"
            "Inclui ambas as perspectivas (reformada/impessoal), currículos, fontes,\n"
            "guias históricos comparativos e módulos específicos da Apologética.\n"
            "Links públicos são referências bibliográficas, NÃO licença de redistribuição.\n"
            "A obra integral de Santo Agostinho será tratada SEPARADAMENTE.\n"
            "Não inclua PDFs de traduções bíblicas licenciadas sem necessidade.\n")
    print(f"Arquivo: {output.resolve()}")
    print(f"Estudos: {len(records)} | tradições: {len(category_counts)}"
          f" | fontes citadas: {len(unique)} | entradas de módulos: {modules}")
    print(f"Tamanho: {output.stat().st_size/1_048_576:.2f} MiB")
    print("Envie APENAS esse ZIP para a ampliação da aba Apologética.")

if __name__=="__main__":
    pack()
