import json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'assets/private';root.mkdir(parents=True,exist_ok=True)
modules=[]
for file in sorted(root.glob('*.biblepkg')):
 with zipfile.ZipFile(file) as z:manifest=json.loads(z.read('manifest.json'))
 modules.append(dict(id=manifest['id'],file=file.name))
(root/'modules.json').write_text(json.dumps(modules,ensure_ascii=False,indent=2)+'\n')
