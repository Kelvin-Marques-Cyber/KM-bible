"""Package a real Xcode device build as an unsigned IPA for personal sideloading."""
import argparse
import hashlib
import json
import plistlib
import stat
import struct
import zipfile
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--app',type=Path,default=Path('build/ios/iphoneos/Runner.app'))
p.add_argument('--output-dir',type=Path,default=Path('dist'))
args=p.parse_args()
app=args.app.resolve()
if not app.is_dir():raise SystemExit('Runner.app ausente: execute a compilação iOS em um executor macOS com Xcode.')
info=plistlib.loads((app/'Info.plist').read_bytes())

def arm64_macho(path):
    data=path.read_bytes()
    if len(data)<32:raise ValueError(f'Executável incompleto: {path.name}')
    magic=struct.unpack_from('<I',data)[0]
    if magic==0xfeedfacf:
        if struct.unpack_from('<I',data,4)[0]!=0x100000c:raise ValueError('Executável não ARM64')
        return
    if struct.unpack_from('>I',data)[0] in [0xcafebabe,0xcafebabf]:
        fat64=struct.unpack_from('>I',data)[0]==0xcafebabf
        count=struct.unpack_from('>I',data,4)[0]
        if not any(struct.unpack_from('>I',data,8+i*(32 if fat64 else 20))[0]==0x100000c for i in range(count)):raise ValueError('ARM64 ausente do binário universal')
        return
    raise ValueError(f'O arquivo {path.name} não é um executável Mach-O compilado')

arm64_macho(app/info['CFBundleExecutable'])
arm64_macho(app/'Frameworks/App.framework/App')
assert info['CFBundleSupportedPlatforms']==['iPhoneOS'],'Exige build para aparelho, não simulador'
asset_root=app/'Frameworks/App.framework/flutter_assets'
models=json.loads((asset_root/'assets/3d/models.json').read_text())
assert len(models)>=130
for model in models:assert (asset_root/'assets/3d'/model['file']).is_file()
for name in ['catalogue','lexicon','library']:
    source=asset_root/f'assets/content/{name}.sqlite'
    expected=(asset_root/f'assets/content/{name}.sha256').read_text().strip()
    assert hashlib.sha256(source.read_bytes()).hexdigest()==expected,name
version=info['CFBundleShortVersionString'];out=args.output_dir;out.mkdir(parents=True,exist_ok=True)
ipa=out/f'Biblia-Reformada-v{version}-iOS-sem-assinatura.ipa'
with zipfile.ZipFile(ipa,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in sorted(app.rglob('*')):
        if not f.is_file():continue
        member='Payload/Runner.app/'+f.relative_to(app).as_posix()
        if f.is_symlink():
            item=zipfile.ZipInfo(member);item.create_system=3;item.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(item,str(f.readlink()))
        else:z.write(f,member)
with zipfile.ZipFile(ipa) as z:assert z.testzip() is None
digest=hashlib.sha256(ipa.read_bytes()).hexdigest()
report={'version':version,'sha256':digest,'bytes':ipa.stat().st_size,'models':len(models),'device_macho_arm64':True,'aot_flutter_macho_arm64':True,'signature':'Sem assinatura de distribuição. Reassinar com sua conta Apple antes da instalação.','physical_iphone_test':'Pendente; a compilação não comprova a instalação e os fluxos no aparelho.'}
(out/'VERIFICACAO-iOS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(out/'iOS-SHA256.txt').write_text(digest+'  '+ipa.name+'\n')
guide=Path('docs/INSTALAR-iOS.md')
with zipfile.ZipFile(out/f'Biblia-Reformada-v{version}-iOS.zip','w',zipfile.ZIP_STORED) as z:
    for f in [ipa,out/'VERIFICACAO-iOS.json',out/'iOS-SHA256.txt']:z.write(f,f.name)
    if guide.exists():z.write(guide,guide.name)
print(json.dumps({'ipa':str(ipa),'sha256':digest,'bytes':ipa.stat().st_size,'models':len(models)},ensure_ascii=False))
