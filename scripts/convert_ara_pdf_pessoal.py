#!/usr/bin/env python3
"""Converte o PDF textual da ARA/SBB fornecido pelo proprietário em módulo
.biblepkg de uso pessoal. Não redistribuir o módulo ou o PDF.
Requer pymupdf (fitz). As fontes/versículos do PDF são reconhecidos pelo tamanho
14,25 (marcadores de versículo) e 21 (cabeçalhos de capítulo)."""
from pathlib import Path
import sys,fitz,re,json,hashlib,zipfile,sqlite3,collections,time

BOOKS=['Gênesis','Êxodo','Levítico','Números','Deuteronômio','Josué','Juízes','Rute','1Samuel','2Samuel','1Reis','2Reis','1Crônicas','2Crônicas','Esdras','Neemias','Ester','Jó','Salmo','Provérbios','Eclesiastes','Cântico','Isaías','Jeremias','Lamentações','Ezequiel','Daniel','Oseias','Joel','Amós','Obadias','Jonas','Miqueias','Naum','Habacuque','Sofonias','Ageu','Zacarias','Malaquias','Mateus','Marcos','Lucas','João','Atos','Romanos','1Coríntios','2Coríntios','Gálatas','Efésios','Filipenses','Colossenses','1Tessalonicenses','2Tessalonicenses','1Timóteo','2Timóteo','Tito','Filemom','Hebreus','Tiago','1Pedro','2Pedro','1João','2João','3João','Judas','Apocalipse']
BOOK_MAP={n:i+1 for i,n in enumerate(BOOKS)}
SINGLES={'Obadias','Filemom','2João','3João','Judas'}


def extract(pdf_file):
    doc=fitz.open(pdf_file)
    rows=[]; stats={'headings':[], 'sequence_issues':[], 'no_text':[], 'pages':len(doc)}
    book=None;chapter=0;verse=None; text=''; heading=''
    def flush():
        nonlocal text,verse
        if book is not None and verse is not None:
            txt=re.sub(r'\s+', ' ',text).replace(' †','').replace('†','').replace('\u00ad','').strip()
            if txt:
                rows.append({'reference':f'{book}:{chapter}:{verse}','text':txt,'metadata':{}})
            else:stats['no_text'].append((book,chapter,verse))
        text='';verse=None
    def append(words):
        nonlocal text
        words=words.strip()
        if words:
            if not text: text=words
            elif text.endswith('-'):text+=words
            else:text+=' '+words
    for pi in range(9,min(len(doc),4182)):
        page=doc[pi]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                spans=line.get('spans',[])
                if not spans: continue
                raw=''.join(s['text'] for s in spans).strip()
                if not raw:continue
                if len(spans)==1 and (abs(spans[0]['size']-21.0)<0.1 or abs(spans[0]['size']-28.5)<0.1):
                    m=re.fullmatch(r'(.+?)\s+([0-9]{1,3})',raw)
                    if m and m.group(1) in BOOK_MAP:
                        flush();book=BOOK_MAP[m.group(1)];chapter=int(m.group(2));heading=''
                        stats['headings'].append((book,chapter,pi+1))
                        continue
                    if raw in SINGLES:
                        flush();book=BOOK_MAP[raw];chapter=1;heading=''
                        stats['headings'].append((book,chapter,pi+1))
                        continue
                    if raw in BOOK_MAP:
                        # Cabeçalho de introdução: não acrescentar ao versículo anterior.
                        flush();book=None;chapter=0;heading=''
                        continue
                if book is None:continue
                # Notas finais / referências cruzadas da edição têm fonte 25,5 pt.
                # Encerrar o último versículo antes delas; nunca misturar notas ao texto.
                if spans[0]['size'] >= 24.0:
                    flush(); continue
                # Subtítulos 18,75 pt negrito sem marcador de versículo
                all_bold=all(('Bold' in s['font']) and s['size']>=18 for s in spans if s['text'].strip())
                if all_bold and not any(re.fullmatch(r'\d{1,3}\s*',s['text']) and abs(s['size']-14.25)<0.1 for s in spans):
                    heading=raw;continue
                chunks=[]
                for s in spans:
                    fragment=s['text']
                    marker=(abs(s['size']-14.25)<0.3 and 'Bold' in s['font'] and re.fullmatch(r'\s*\d{1,3}\s*',fragment))
                    if marker:
                        if chunks:
                            append(''.join(chunks));chunks=[]
                        num=int(fragment.strip())
                        if verse is not None and num!=verse+1:
                            stats['sequence_issues'].append((book,chapter,verse,num,pi+1))
                        flush();verse=num
                        continue
                    # Glifos editoriais de referência cruzada não são parte do versículo
                    fragment=fragment.replace('†','').replace('\ufeff','')
                    chunks.append(fragment)
                if chunks and verse is not None:append(''.join(chunks))
    flush()
    return rows,stats


def build(pdf_path,out_path):
    t=time.time()
    rows,stats=extract(pdf_path)
    keys=[r['reference'] for r in rows]
    duplicates=[(k,n) for k,n in collections.Counter(keys).items() if n>1]
    groups=collections.defaultdict(list)
    for k in keys:
        b,c,v=map(int,k.split(':'));groups[(b,c)].append(v)
    holes={f'{b}:{c}': sorted(set(range(1,max(vs)+1))-set(vs)) for (b,c),vs in groups.items() if set(vs)!=set(range(1,max(vs)+1))}
    book_groups={b for b,c in groups}
    print('Livros',len(book_groups),'capítulos',len(groups),'versículos',len(rows),'duplicatas',len(duplicates),'lacunas',len(holes),'problemas sequenciais',len(stats['sequence_issues']))
    print('Exemplos de problemas',stats['sequence_issues'][:20]);print('Lacunas',list(holes.items())[:20]);print('Faltando livros',set(range(1,67))-book_groups)
    if len(book_groups)!=66 or len(groups)!=1189 or len(rows)<30000 or duplicates or len(holes)>15:
        raise RuntimeError('Falha de validação de capítulos/versículos; módulo não gerado')
    manifest={
        'format_version':1, 'id':'ARA', 'kind':'bible',
        'title':'Almeida Revista e Atualizada (ARA) — Pessoal',
        'version':'2ª edição — importação pessoal', 'language':'pt',
        'author':'João Ferreira de Almeida; Sociedade Bíblica do Brasil',
        'license':'Todos os direitos reservados — uso pessoal',
        'license_text':'Almeida Revista e Atualizada (ARA). © 2010 Sociedade Bíblica do Brasil. Todos os direitos reservados. Conteúdo extraído exclusivamente do arquivo fornecido pelo próprio usuário, para leitura pessoal offline. Não publicar, compartilhar, adicionar a repositórios públicos, redistribuir ou comercializar este módulo sem autorização da titular dos direitos. A importação automática não concede licença de distribuição.',
        'source':'PDF pessoal da Bíblia Sagrada ARA, SBB, 2ª edição (1993), fornecido pelo usuário',
        'dependencies':[], 'min_app_version':'0.5.0',
        'metadata':{'versification':'protestant','original_format':'PDF', 'books':66,'chapters':1189,'verses':len(rows), 'offline':True,'personal_use_only':True},
        'files':{}
    }
    data=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    manifest['files']['verses.json']=hashlib.sha256(data).hexdigest()
    Path(out_path).parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out_path,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
        z.writestr('verses.json',data)
        z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf-8'))
    print('Arquivo',out_path,'bytes',Path(out_path).stat().st_size,'tempo',round(time.time()-t,2))
    return rows,stats

if __name__=='__main__':
    build(sys.argv[1],sys.argv[2])
