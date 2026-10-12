"""Verify the compiled APK and package a private, restorable release."""
import hashlib,json,os,re,shutil,sqlite3,struct,subprocess,zipfile
from pathlib import Path
R=Path(__file__).resolve().parents[1];W=R.parent
version,code=re.search(r'^version:\s*(\S+)\+(\d+)',(R/'pubspec.yaml').read_text(),re.M).groups()
tooling=W/'tooling';sdk=Path(os.environ.get('BIBLIA_ANDROID_SDK',str(tooling/'android')))
src=Path(os.environ.get('BIBLIA_APK_PATH','/tmp/biblia-android-build/biblia-reformada/build/app/outputs/flutter-apk/app-release.apk'))
out=W/'deliverables';out.mkdir(exist_ok=True);apk=out/f'Biblia-Reformada-v{version}.apk';shutil.copy2(src,apk)
env={**os.environ,'JAVA_HOME':str(tooling/'jdk17')}
def run(cmd):return subprocess.run(cmd,check=True,capture_output=True,text=True,env=env).stdout
sign=run([str(sdk/'build-tools/36.0.0/apksigner'),'verify','--verbose','--print-certs',str(apk)])
run([str(sdk/'build-tools/36.0.0/zipalign'),'-c','-P','16','4',str(apk)])
manifest=run([str(sdk/'build-tools/36.0.0/aapt2'),'dump','badging',str(apk)])
assert f"versionName='{version}'" in manifest and f"versionCode='{code}'" in manifest
assert "name='br.com.kelvin.biblia_reformada'" in manifest
permissions=[line for line in manifest.splitlines() if line.startswith('uses-permission:')]
assert not any('android.permission.INTERNET' in p for p in permissions)
libs=[];prefix='assets/flutter_assets/'
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None
 files=z.namelist();assert not any('needle' in name.lower() or name.endswith('.cact') for name in files)
 model_count=len(json.loads(z.read(prefix+'assets/3d/models.json')))
 assert len([n for n in files if n.startswith(prefix+'assets/3d/') and n.endswith('.glb')])==model_count==136
 scenes=json.loads(z.read(prefix+'assets/content/model-scenes.json'));assert scenes['blocks']==321 and scenes['chapters']==1189
 for package in ['ara.biblepkg','hdl.biblepkg']:assert prefix+'assets/private/'+package in files
 curriculum=json.loads(z.read(prefix+'assets/content/religion-curricula.json'));assert len(curriculum)==27 and sum(len(c['lessons']) for c in curriculum)==216
 for name in ['topics','portuguese','catalogue','lexicon','library','connections']:
  raw=z.read(prefix+f'assets/content/{name}.sqlite');digest=hashlib.sha256(raw).hexdigest()
  assert digest==z.read(prefix+f'assets/content/{name}.sha256').decode().strip(),name
  assert digest==hashlib.sha256((R/f'assets/content/{name}.sqlite').read_bytes()).hexdigest(),name
 for name in [n for n in files if n.endswith('.so')]:
  b=z.read(name);assert b[:4]==b'\x7fELF' and b[4]==2
  phoff=struct.unpack_from('<Q',b,32)[0];phsize,phnum=struct.unpack_from('<HH',b,54);alignments=[]
  for i in range(phnum):
   entry=phoff+i*phsize
   if struct.unpack_from('<I',b,entry)[0]==1:alignments.append(struct.unpack_from('<Q',b,entry+48)[0])
  assert min(alignments)>=16384,(name,alignments)
  libs.append({'file':name,'load_alignment':alignments})
topics=sqlite3.connect(f'file:{R/"assets/content/topics.sqlite"}?mode=ro',uri=True);assert topics.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
topic_count=topics.execute('SELECT count(*) FROM topics').fetchone()[0];link_count=topics.execute('SELECT count(*) FROM topic_verses').fetchone()[0];verse_count=topics.execute('SELECT count(DISTINCT reference) FROM topic_verses').fetchone()[0]
assert (topic_count,link_count,verse_count)==(628,52211,22941);topics.close()
tests=(W/'recovery/tests.log').read_text();assert 'All tests passed!' in tests;test_count=int(re.findall(r'\+(\d+):',tests)[-1]);assert 'No issues found!' in (W/'recovery/analyze.log').read_text()
cert=re.search(r'Signer #1 certificate SHA-256 digest: (\S+)',sign)
report={'app_version':version,'version_code':int(code),'apk_sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apk_bytes':apk.stat().st_size,'signature_verified':True,'signing_certificate_sha256':cert.group(1) if cert else None,'permissions':permissions,'native_libraries':libs,'zip_integrity':True,'models':model_count,'chapter_blocks':321,'covered_chapters':1189,'personal_RA':True,'personal_Hernandes':True,'religion_curricula':len(curriculum),'new_curriculum_lessons':216,'topics':topic_count,'topic_links':link_count,'verses_with_topic_links':verse_count,'ai_runtime_included':False,'automated_tests':test_count,'ios_status':'Projeto e workflow preparados. Não há IPA compilado nesta entrega.','device_status':'Testes no runtime Flutter concluídos; esta versão ainda precisa ser testada no aparelho físico.','editorial_status':'Sínteses, traduções de estudo e glosas precisam de revisão especializada. Fontes e originais identificados.'}
(out/'VERIFICACAO.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(out/'APK-SHA256.txt').write_text(report['apk_sha256']+'  '+apk.name+'\n')
(out/'LEIA-ME.txt').write_text(f'Bíblia Reformada {version} — Android ARM64, Android 7/API 24 ou posterior.\nCriado por Kelvin e Silva Marques.\nEm presente dedicatória à Rebeca Teles.\n\nAbra o APK para atualizar o aplicativo. Preserve a instalação atual para manter suas anotações. A atualização usa a mesma chave pessoal. Faça também um backup em Configurações antes de atualizar.\n\nA Needle e o Assistente de Navegação Inteligente foram retirados. A busca tradicional, a leitura e o acervo local continuam disponíveis sem internet.\n\n216 novos estudos em 27 trilhas, 628 temas com 52.211 vínculos e interlinear prioritariamente em português. Os textos de estudo e traduções identificam fontes e revisão pendente. As trilhas são introdutórias; não esgotam todas as religiões e seus assuntos.\n\nContexto de todos os 66 livros e comentários de trechos; dados históricos específicos ausentes permanecem identificados. 136 modelos, com associações em 321 blocos; reconstruções interpretativas.\n\nEste APK contém a RA e os comentários fornecidos sob autorização pessoal. Não compartilhar. Hernandes cobre os livros e trechos presentes nas fontes recebidas, não todos os versículos.\n\nNão há IPA compilado neste pacote. O projeto iOS e as instruções de compilação estão nas fontes.\n')
android_zip=out/f'Biblia-Reformada-v{version}-Android.zip'
with zipfile.ZipFile(android_zip,'w',zipfile.ZIP_STORED) as z:
 for f in [apk,out/'LEIA-ME.txt',out/'APK-SHA256.txt',out/'VERIFICACAO.json']:z.write(f,f.name)
personal_zip=out/f'Biblia-Reformada-v{version}-Pessoal.zip'
with zipfile.ZipFile(personal_zip,'w',zipfile.ZIP_DEFLATED) as z:
 for f in (R/'assets/private').glob('*'):
  if f.is_file() and f.name!='.keep':z.write(f,'assets/private/'+f.name)
 for f in (W/'private-signing').glob('*'):
  if f.is_file():z.write(f,'assinatura-android/'+f.name)
 z.writestr('LEIA-ME.txt','Conteúdo e assinatura pessoais de Kelvin e Silva Marques. Não distribuir.\nRA e Hernandes mantêm os direitos dos titulares e a autorização pessoal declarada.\nPreserve esta chave e senha para assinar futuras atualizações.\nRestaure assets/private no projeto e a assinatura fora dele antes de compilar.\n')
for f in [android_zip,personal_zip]:
 with zipfile.ZipFile(f) as z:assert z.testzip() is None
print(json.dumps(report,ensure_ascii=False))
