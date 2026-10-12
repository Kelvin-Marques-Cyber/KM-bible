"""Verify the actual APK, then package it and private restoration assets separately."""
import hashlib,json,os,shutil,struct,subprocess,zipfile
from pathlib import Path
R=Path(__file__).resolve().parents[1];W=R.parent;tooling=W/'tooling';src=Path('/tmp/biblia-android-build/biblia-reformada/build/app/outputs/flutter-apk/app-release.apk');out=W/'deliverables';out.mkdir(exist_ok=True)
env={**os.environ,'JAVA_HOME':str(tooling/'jdk17')};apk=out/'Biblia-Reformada-v0.3.8.apk';shutil.copy2(src,apk)
def run(cmd):return subprocess.run(cmd,check=True,capture_output=True,text=True,env=env).stdout
sign=run([str(tooling/'android/build-tools/36.0.0/apksigner'),'verify','--verbose','--print-certs',str(apk)])
align=run([str(tooling/'android/build-tools/36.0.0/zipalign'),'-c','-P','16','4',str(apk)])
manifest=run([str(tooling/'android/build-tools/36.0.0/aapt2'),'dump','badging',str(apk)])
assert "versionName='0.3.8'" in manifest and "versionCode='38'" in manifest
permissions=[line for line in manifest.splitlines() if line.startswith('uses-permission:')]
assert not any('android.permission.INTERNET' in p for p in permissions)
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None
 files=z.namelist();model_count=len(json.loads(z.read('assets/flutter_assets/assets/3d/models.json')));assert model_count==136
 assert len([n for n in files if n.startswith('assets/flutter_assets/assets/3d/') and n.endswith('.glb')])==model_count
 scenes=json.loads(z.read('assets/flutter_assets/assets/content/model-scenes.json'));assert scenes['blocks']==321 and scenes['chapters']==1189
 assert 'assets/flutter_assets/assets/private/ara.biblepkg' in files
 assert 'assets/flutter_assets/assets/licenses/NEEDLE-APACHE-2.txt' in files
 assert 'lib/arm64-v8a/libneedle_runtime.so' in files
 libs=[]
 for name in [n for n in files if n.endswith('.so')]:
  b=z.read(name);assert b[:4]==b'\x7fELF' and b[4]==2
  phoff=struct.unpack_from('<Q',b,32)[0];phsize,phnum=struct.unpack_from('<HH',b,54)
  aligned=[]
  for i in range(phnum):
   entry=phoff+i*phsize
   if struct.unpack_from('<I',b,entry)[0]==1:aligned.append(struct.unpack_from('<Q',b,entry+48)[0])
  assert min(aligned)>=16384,(name,aligned)
  libs.append({'file':name,'load_alignment':aligned})
report={'app_version':'0.3.8','apk_sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'apk_bytes':apk.stat().st_size,'signature_verified':True,'permissions':permissions,'native_libraries':libs,'zip_integrity':True,'models':model_count,'chapter_blocks':321,'covered_chapters':1189,'personal_RA':True,'automated_tests':20,'ios_status':'Projeto e workflow macOS para IPA sem assinatura preparados. Compilação iOS ainda não executada.','device_status':'Testes de interface no runtime Flutter; teste no aparelho físico pendente.'}
(out/'VERIFICACAO.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));(out/'APK-SHA256.txt').write_text(report['apk_sha256']+'  '+apk.name+'\n')
(out/'LEIA-ME.txt').write_text('Bíblia Reformada 0.3.8 — Android ARM64, Android 7/API 24 ou posterior.\nCriado por Kelvin e Silva Marques.\nEm presente dedicatória à Rebeca Teles.\n\nExtraia o ZIP e abra o APK no seu Android. Autorize a instalação pelo gerenciador de arquivos quando o sistema solicitar. A leitura não exige conta ou Internet.\n\n136 modelos 3D esquemáticos, com recursos em 321 blocos de até quatro capítulos nos 66 livros. Acesso pelo ícone 3D do leitor ou pela galeria em Explorar.\n\nEste APK contém a RA fornecida pelo usuário sob autorização pessoal. Não compartilhar com outras pessoas.\n\nO código Android/iOS está em outro ZIP, com workflow do GitHub Actions para gerar IPA real sem assinatura. Não há IPA compilado neste pacote: o workflow macOS ainda precisa executar. A instalação pode usar a assinatura pessoal do SideStore.\n')
with zipfile.ZipFile(out/'Biblia-Reformada-v0.3.8-Android.zip','w',zipfile.ZIP_STORED) as z:
 for file in [apk,out/'LEIA-ME.txt',out/'APK-SHA256.txt',out/'VERIFICACAO.json']:z.write(file,file.name)
with zipfile.ZipFile(out/'Biblia-Reformada-v0.3.8-Pessoal.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in (R/'assets/private').glob('*'):
  if file.is_file() and file.name!='.keep':z.write(file,'assets/private/'+file.name)
 for file in (W/'private-signing').glob('*'):
  if file.is_file():z.write(file,'assinatura-android/'+file.name)
 z.writestr('LEIA-ME.txt','Conteúdo e assinatura pessoais de Kelvin e Silva Marques. Não distribuir.\nA RA mantém os direitos reservados da Sociedade Bíblica do Brasil e a autorização pessoal declarada.\nPreserve a chave e a senha: atualizações Android precisam da mesma assinatura.\nPara compilar com a RA, extraia assets/private dentro do projeto e execute scripts/prepare_optional_content.py.\n')
for name in ['Biblia-Reformada-v0.3.8-Android.zip','Biblia-Reformada-v0.3.8-Pessoal.zip']:
 f=out/name
 with zipfile.ZipFile(f) as z:assert z.testzip() is None
 print(f.name,f.stat().st_size)
print(json.dumps({k:v for k,v in report.items() if k not in ['native_libraries']},ensure_ascii=False))
