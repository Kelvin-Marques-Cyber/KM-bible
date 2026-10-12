"""Generate original schematic glTF models from geometric primitives, with provenance."""
import json,math,struct
from pathlib import Path
R=Path(__file__).resolve().parents[1];O=R/'assets/3d'
materials=[('Madeira',[.43,.25,.12,1]),('Ouro',[.83,.62,.2,1]),('Pedra',[.68,.65,.57,1]),('Linho',[.87,.84,.73,1]),('Púrpura',[.42,.22,.44,1]),('Água',[.18,.39,.52,.8]),('Bronze',[.58,.36,.18,1]),('Telhado',[.52,.38,.25,1]),('Corda',[.8,.73,.51,1]),('Folhagem',[.24,.43,.22,1]),('Terracota',[.65,.31,.19,1]),('Ferro',[.28,.31,.32,1]),('Lã',[.91,.89,.8,1]),('Grão',[.79,.65,.32,1]),('Uvas',[.28,.18,.4,1]),('Areia',[.79,.71,.52,1]),('Tinta',[.1,.12,.14,1])]
KINDS=['box','cylinder','sphere','torus']
def geometry(kind):
 vertices=[];normals=[];indices=[]
 def quad(points,normal):
  n=len(vertices);vertices.extend(points);normals.extend([normal]*len(points));indices.extend([n,n+1,n+2,n,n+2,n+3])
 if kind=='box':
  for axis in range(3):
   for sign in [-1,1]:
    other=[a for a in range(3) if a!=axis];points=[]
    for v,w in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]:
     p=[0,0,0];p[axis]=sign*.5;p[other[0]]=v;p[other[1]]=w;points.append(p)
    normal=[0,0,0];normal[axis]=sign
    if (axis==1)==(sign==1):points.reverse()
    quad(points,normal)
 elif kind=='cylinder':
  for i in range(24):
   a=i*2*math.pi/24;b=(i+1)*2*math.pi/24
   quad([(math.cos(a)*.5,-.5,math.sin(a)*.5),(math.cos(a)*.5,.5,math.sin(a)*.5),(math.cos(b)*.5,.5,math.sin(b)*.5),(math.cos(b)*.5,-.5,math.sin(b)*.5)],(math.cos((a+b)/2),0,math.sin((a+b)/2)))
   for y in [-.5,.5]:
    n=len(vertices);vertices.extend([(0,y,0),(math.cos(a)*.5,y,math.sin(a)*.5),(math.cos(b)*.5,y,math.sin(b)*.5)]);normals.extend([(0,1 if y>0 else -1,0)]*3);indices.extend([n,n+1,n+2] if y<0 else [n,n+2,n+1])
 elif kind=='sphere':
  for i in range(13):
   a=math.pi*i/12
   for j in range(25):
    b=2*math.pi*j/24;n=(math.sin(a)*math.cos(b),math.cos(a),math.sin(a)*math.sin(b));vertices.append(tuple(v*.5 for v in n));normals.append(n)
  for i in range(12):
   for j in range(24):
    n=i*25+j;indices.extend([n,n+25,n+1,n+1,n+25,n+26])
 elif kind=='torus':
  for i in range(25):
   a=2*math.pi*i/24
   for j in range(13):
    b=2*math.pi*j/12;vertices.append(((.36+.09*math.cos(b))*math.cos(a),.09*math.sin(b),(.36+.09*math.cos(b))*math.sin(a)));normals.append((math.cos(b)*math.cos(a),math.sin(b),math.cos(b)*math.sin(a)))
  for i in range(24):
   for j in range(12):
    n=i*13+j;indices.extend([n,n+13,n+1,n+1,n+13,n+14])
 return vertices,normals,indices
class Model:
 def __init__(self,id,title,description,refs):self.id=id;self.title=title;self.description=description;self.refs=refs;self.nodes=[]
 def part(self,name,position,size,material=0,kind='box',layer='Estrutura',rotation=None):
  node={'name':name,'mesh':(KINDS.index(kind)*len(materials)+material),'translation':position,'scale':size,'extras':{'layer':layer,'references':self.refs}}
  if rotation:node['rotation']=rotation
  self.nodes.append(node)
 def save(self):
  doc={'asset':{'version':'2.0','generator':'Biblia Reformada — geometria original'},'scene':0,'scenes':[{'nodes':list(range(len(self.nodes)))}],'nodes':self.nodes,'materials':[{'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.55 if i in [1,6] else .05,'roughnessFactor':.7}} for i,(name,color) in enumerate(materials)],'meshes':[],'bufferViews':[],'accessors':[]};data=bytearray()
  for kind in KINDS:
   vertices,normals,indices=geometry(kind);access=[]
   for array,component,type,target in [(vertices,5126,'VEC3',34962),(normals,5126,'VEC3',34962),(indices,5123,'SCALAR',34963)]:
    while len(data)%4:data.append(0)
    offset=len(data);flat=[a for point in array for a in point] if type=='VEC3' else array;data.extend(struct.pack('<'+('f' if component==5126 else 'H')*len(flat),*flat));view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)-offset,'target':target});accessor={'bufferView':view,'componentType':component,'count':len(array),'type':type}
    if type=='VEC3':accessor.update(min=[min(p[i] for p in array) for i in range(3)],max=[max(p[i] for p in array) for i in range(3)])
    access.append(len(doc['accessors']));doc['accessors'].append(accessor)
   for i in range(len(materials)):doc['meshes'].append({'primitives':[{'attributes':{'POSITION':access[0],'NORMAL':access[1]},'indices':access[2],'material':i}]})
  while len(data)%4:data.append(0)
  doc['buffers']=[{'byteLength':len(data)}];raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);blob=struct.pack('<III',0x46546c67,2,12+8+len(raw)+8+len(data))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(data),0x004e4942)+data;(O/(self.id+'.glb')).write_bytes(blob)
  return {'id':self.id,'title':self.title,'description':self.description,'references':self.refs,'file':self.id+'.glb','layers':list(dict.fromkeys(n['extras']['layer'] for n in self.nodes)),'license':'CC BY 4.0 — modelo geométrico original do projeto','license_url':'https://creativecommons.org/licenses/by/4.0/','author':'Kelvin e Silva Marques','certainty':'Reconstrução esquemática interpretativa; detalhes ausentes do texto são ilustrativos. Não é levantamento arqueológico.','category':getattr(self,'category','Santuário e arquitetura'),'kind':getattr(self,'study_kind','objeto textual'),'source':'Passagens bíblicas indicadas; geometria original e ilustração editorial do projeto.','parts':[n['name'] for n in self.nodes]}
M=[]
m=Model('arca_noe','Arca de Noé','Proporção textual 300 × 50 × 30 côvados, três pavimentos. O formato do casco e os compartimentos são uma hipótese visual. Côvado aqui convencionado como 0,5 m; escala não estabelece uma medida histórica única.',['1:6:14','1:6:15','1:6:16'])
m.part('Base do casco',[0,0,0],[30,.35,5]);
for y in [1,2,3]:m.part('Pavimento '+str(y),[0,y,0],[29,.1,4.8],layer='Pavimentos')
for z in [-2.5,2.5]:m.part('Parede longitudinal',[0,1.5,z],[30,3,.15])
for x in [-15,15]:m.part('Extremidade do casco',[x,1.5,0],[.15,3,5])
for x in range(-12,15,3):
 for y in [.5,1.5,2.5]:m.part('Compartimento ilustrativo',[x,y,0],[.08,.8,4.5],layer='Compartimentos')
m.part('Cobertura',[0,3.1,0],[30,.3,5.2],7,layer='Cobertura');m.part('Abertura superior',[0,3.5,0],[26,.6,3.5],3,layer='Cobertura');M.append(m)
m=Model('tabernaculo','Tabernáculo','Pátio de 100 × 50 côvados e estrutura interna de 30 × 10. O Santo dos Santos é separado por véu. Camadas permitem examinar cobertura, cortinas e utensílios.',['2:25:8','2:26:1','2:27:9'])
m.part('Pátio',[0,-.1,0],[50,.2,25],2)
for z in [-12.5,12.5]:
 m.part('Cortina lateral',[0,1.4,z],[50,2.8,.1],3,layer='Cortinas')
 for x in range(-25,26,5):m.part('Coluna do pátio',[x,1.5,z],[.18,3,.18],6,kind='cylinder')
for x in [-25,25]:m.part('Cortina transversal',[x,1.4,0],[.1,2.8,25],3,layer='Cortinas')
for z in [-2.5,2.5]:m.part('Parede de tábuas',[-8,2.5,z],[15,5,.2],0)
m.part('Parede ocidental',[-15.5,2.5,0],[.2,5,5],0);m.part('Cobertura',[-8,5.15,0],[15.5,.3,5.5],7,layer='Cobertura');m.part('Véu',[-10.5,2.5,0],[.07,5,5],4,layer='Cortinas');m.part('Arca esquemática',[-13,1,0],[1.25,.75,.75],1,layer='Utensílios');m.part('Altar do incenso',[-8,.8,0],[.5,1,.5],1,layer='Utensílios');m.part('Mesa',[-5,1,1.5],[1,.75,.5],1,layer='Utensílios');m.part('Candelabro',[-5,1,-1.5],[.3,1,.3],1,kind='cylinder',layer='Utensílios');m.part('Altar exterior',[9,.7,0],[2.5,1.5,2.5],6,layer='Utensílios');m.part('Bacia',[4,.6,0],[1.5,.4,1.5],6,kind='cylinder',layer='Utensílios');M.append(m)
m=Model('arca_alianca','Arca da Aliança','Caixa de 2,5 × 1,5 × 1,5 côvados, revestida de ouro. Argolas e varais seguem Êxodo 25. Querubins são indicados por formas abstratas; sua anatomia não é especificada.',['2:25:10','2:25:17','2:25:20'])
m.part('Corpo',[0,.4,0],[1.25,.75,.75],1);m.part('Propiciatório',[0,.81,0],[1.35,.1,.85],1,layer='Tampa');
for z in [-.45,.45]:m.part('Varal',[0,.35,z],[2,.05,.05],0,layer='Varais')
for x in [-.55,.55]:
 for z in [-.4,.4]:m.part('Argola',[x,.35,z],[.11,.11,.05],1,kind='cylinder',layer='Varais')
 m.part('Querubim abstrato',[x,.98,0],[.15,.3,.14],1,layer='Querubins');m.part('Asas esquemáticas',[x*.5,1.19,0],[.55,.05,.3],1,layer='Querubins')
M.append(m)
for id,title,herod in [('templo_salomao','Templo de Salomão',False),('segundo_templo','Segundo Templo — esquema herodiano',True)]:
 refs=['11:6:2','11:7:15'] if not herod else ['15:6:15','43:2:20'];m=Model(id,title,'Planta didática interpretativa. '+('Núcleo proporcional de 60 × 20 × 30 côvados; detalhes conforme 1 Reis 6–7.' if not herod else 'Representação genérica de recinto, pátios e santuário. Não reproduz todas as fases da construção ou uma planta arqueológica medida.'),refs)
 m.part('Plataforma',[0,-.2,0],[90 if herod else 60,.4,60 if herod else 40],2)
 for z in [-5,5]:m.part('Parede do santuário',[-10,7.5,z],[30,15,.6],2)
 m.part('Parede posterior',[-25,7.5,0],[.6,15,10],2);m.part('Teto do santuário',[-10,15.2,0],[31,.4,11],7,layer='Cobertura');m.part('Divisão interior',[-15,7.5,0],[.2,15,10],1,layer='Interior');m.part('Pórtico',[8,8,0],[5,16,12],2,layer='Pórtico');m.part('Altar exterior',[22,2,0],[7,4,7],6,layer='Interior')
 for z in [-7,7]:m.part('Coluna do pórtico',[11,5,z],[1.2,10,1.2],6,kind='cylinder',layer='Pórtico')
 if herod:
  for z in [-26,26]:
   m.part('Pórtico de recinto',[0,5,z],[86,.5,4],2,layer='Pátios')
   for x in range(-40,41,5):m.part('Coluna do recinto',[x,2.5,z],[.6,5,.6],2,kind='cylinder',layer='Pátios')
 M.append(m)
m=Model('utensilios','Utensílios sacerdotais','Candelabro de sete lâmpadas, mesa e bacia em esquema. Ornamentos e tamanhos não especificados são ilustrativos.',['2:25:23','2:25:31','2:30:18'])
m.part('Base do candelabro',[-2,.1,0],[1,.2,1],1);m.part('Haste',[-2,1,0],[.12,2,.12],1,kind='cylinder')
for i in range(-3,4):
 x=-2+i*.32;y=1.7-abs(i)*.12;m.part('Braço',[(x-2)/2,y/2,0],[abs(i)*.32+.1,.09,.09],1);m.part('Haste da lâmpada',[x,y,0],[.08,1,.08],1,kind='cylinder');m.part('Lâmpada',[x,y+.52,0],[.2,.1,.2],1,kind='cylinder')
m.part('Mesa dos pães',[1,1,0],[1.8,.12,.8],1,layer='Mesa')
for x in [.3,1.7]:
 for z in [-.3,.3]:m.part('Pé da mesa',[x,.5,z],[.08,1,.08],1,layer='Mesa')
m.part('Bacia',[3,.9,0],[1.3,.4,1.3],6,kind='cylinder',layer='Bacia');m.part('Pedestal',[3,.4,0],[.6,.6,.6],6,kind='cylinder',layer='Bacia');M.append(m)
m=Model('harpa','Lira do mundo bíblico','Instrumento de cordas estilizado. A tradução harpa não identifica com certeza a forma ou quantidade de cordas do kinnor. Este modelo mostra uma hipótese de lira, sem pretensão de reproduzir o instrumento de Davi.',['9:16:23','19:33:2'])
m.part('Caixa de ressonância',[0,.25,0],[2,.5,.5]);
for x in [-.9,.9]:m.part('Braço da lira',[x,1.2,0],[.18,2,.18])
m.part('Travessa superior',[0,2.15,0],[2.1,.2,.2]);
for i in range(8):m.part('Corda ilustrativa',[-.7+i*.2,1.3,-.12],[.012,1.7,.012],8,layer='Cordas')
M.append(m)
m=Model('habitacao','Habitação antiga','Casa com pátio e cobertura plana, esquema de técnicas correntes no Levante. Não identifica a casa de um personagem nem um sítio específico. A abertura do telhado em Marcos 2 ajuda a explorar usos narrativos da arquitetura.',['41:2:4','42:5:19'])
m.part('Piso',[0,0,0],[10,.25,8],2)
for z in [-4,4]:m.part('Parede',[0,1.4,z],[10,2.8,.3],2)
for x in [-5,5]:m.part('Parede',[x,1.4,0],[.3,2.8,8],2)
m.part('Parede interna',[0,1.4,-1],[.25,2.8,6],2);m.part('Cobertura removível',[-2.5,2.9,0],[5,.2,8],7,layer='Cobertura');m.part('Toldo do pátio',[2.5,2.6,-2],[4,.12,3],3,layer='Cobertura');
for i in range(8):m.part('Degrau da escada',[4, i*.35, -3+i*.6],[1.5,.35,.6],2,layer='Escada')
M.append(m)
m=Model('altar','Altar de holocaustos','Altar do tabernáculo, 5 × 5 × 3 côvados. A grelha, os chifres e os varais são uma representação didática de Êxodo 27.',['2:27:1','2:27:4','2:27:6'])
m.part('Base',[0,.1,0],[2.5,.2,2.5],6)
for z in [-1.25,1.25]:m.part('Parede de bronze',[0,.75,z],[2.5,1.5,.1],6)
for x in [-1.25,1.25]:m.part('Parede de bronze',[x,.75,0],[.1,1.5,2.5],6)
for i in range(12):m.part('Grelha',[0,.9,-1.1+i*.2],[2.3,.03,.03],6,layer='Grelha')
for x in [-1.1,1.1]:
 for z in [-1.1,1.1]:m.part('Chifre',[x,1.6,z],[.16,.3,.16],6)
for z in [-1.45,1.45]:m.part('Varal',[0,.7,z],[4,.1,.1],0,layer='Varais')
M.append(m)
entries=[m.save() for m in M];(O/'models.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2));print('Models:',len(entries),'bytes:',sum((O/e['file']).stat().st_size for e in entries))
