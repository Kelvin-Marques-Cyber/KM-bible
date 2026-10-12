"""Build original layered meshes with embedded CC0 PBR textures, offline GLB.

Run in a Blender 4.3 Python environment. Geometry is an interpretative educational
reconstruction, never archaeological measurement or an image of God.
"""
import argparse, json, math, random, struct, faulthandler
faulthandler.dump_traceback_later(45,repeat=True)
from pathlib import Path
import bpy
from mathutils import Vector

R=Path(__file__).resolve().parents[1];OUT=R/'assets/3d';SRC=R/'content_sources/polyhaven'
random.seed(1407)
parser=argparse.ArgumentParser();parser.add_argument('--only');parser.add_argument('--render',action='store_true');parser.add_argument('--resume',action='store_true');args=parser.parse_args()
catalog=json.loads((OUT/'models.json').read_text());materials={};active_refs=[]

def pbr(name,color,texture=None,metal=0,rough=.65):
 if name in materials:return materials[name]
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 if texture:
  for kind,socket in [('Diffuse','Base Color'),('Rough','Roughness'),('nor_gl','Normal')]:
   original=SRC/(texture+'-'+kind+'.jpg');small=SRC/(texture+'-'+kind+'-'+('-'.join(str(round(v*255)) for v in color) if kind=='Diffuse' else 'neutral')+'-512.jpg')
   if not small.exists():
    from PIL import Image, ImageStat
    im=Image.open(original).convert('RGB');im.thumbnail((512,512))
    if kind=='Diffuse':
     means=ImageStat.Stat(im).mean
     im=Image.merge('RGB',tuple(channel.point(lambda p,c=i:min(255,round(p*color[c]*255/max(1,means[c])))) for i,channel in enumerate(im.split())))
    im.save(small,quality=88)
   image=bpy.data.images.load(str(small),check_existing=True)
   if kind!='Diffuse':image.colorspace_settings.name='Non-Color'
   node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
   if kind=='nor_gl':
    normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.75
    m.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
   else:m.node_tree.links.new(node.outputs['Color'],bs.inputs[socket])
 materials[name]=m;return m

def get_mats():
 return dict(wood=pbr('Madeira com veios',(.36,.19,.075),'wood_planks'),stone=pbr('Arenito',(.63,.55,.39),'old_sandstone_02'),linen=pbr('Linho tecido',(.86,.79,.62),'rough_linen'),leather=pbr('Couro',(.27,.13,.065),'brown_leather'),gold=pbr('Ouro',(.83,.57,.16),metal=.93,rough=.23),bronze=pbr('Bronze',(.51,.25,.085),metal=.86,rough=.34),iron=pbr('Ferro',(.2,.21,.22),metal=.83,rough=.45),rope=pbr('Fibras de corda',(.66,.51,.28),'rough_linen'),purple=pbr('Púrpura',(.27,.06,.18),rough=.85),blue=pbr('Azul',(.035,.11,.27),rough=.85),scarlet=pbr('Escarlata',(.48,.025,.02),rough=.85),sand=pbr('Areia',(.54,.42,.25),rough=.96),clay=pbr('Terracota',(.51,.23,.10),rough=.7),leaf=pbr('Folhas',(.12,.25,.065),rough=.85),leaf2=pbr('Folhas claras',(.24,.33,.09),rough=.85),water=pbr('Água',(.055,.24,.30),metal=.2,rough=.14),wool=pbr('Lã',(.74,.70,.57),rough=.93))

M=get_mats()
def finish(obj,name,mat,layer='Estrutura',bevel=0):
 obj.name=name;obj['layer']=layer;obj['references']=active_refs
 if mat:obj.data.materials.clear();obj.data.materials.append(M[mat] if isinstance(mat,str) else mat)
 if bevel and obj.type=='MESH':
  mod=obj.modifiers.new('Arestas trabalhadas','BEVEL');mod.width=bevel;mod.segments=2
  mod=obj.modifiers.new('Normais de superfície','WEIGHTED_NORMAL');mod.keep_sharp=True
 return obj

def box(name,loc,size,mat='wood',layer='Estrutura',bevel=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,mat,layer,bevel)

def ellipsoid(name,loc,size,mat='wood',layer='Estrutura',segments=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.scale=size
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,mat,layer)

def tube(name,points,radius,mat='wood',layer='Estrutura'):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=10;curve.bevel_depth=radius;curve.bevel_resolution=3
 spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
 for v,p in zip(spline.bezier_points,points):v.co=p;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o)
 return finish(o,name,mat,layer)

def cylinder(name,loc,radius,height,mat='wood',layer='Estrutura',vertices=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=height,location=loc)
 o=bpy.context.object
 for p in o.data.polygons:p.use_smooth=abs(p.normal.z)<.9
 return finish(o,name,mat,layer,.012)

def lathe(name,loc,profile,mat='clay',layer='Estrutura',sides=48):
 # Profile from bottom outside to rim and down inside produces a real open vessel.
 verts=[];faces=[]
 for radius,z in profile:
  for i in range(sides):a=math.tau*i/sides;verts.append((radius*math.cos(a)+loc[0],radius*math.sin(a)+loc[1],z+loc[2]))
 for j in range(len(profile)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
 o=mesh(name,verts,faces,mat,layer)
 for p in o.data.polygons:p.use_smooth=True
 return o

def mesh(name,verts,faces,mat='wood',layer='Estrutura',bevel=0):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 uv=data.uv_layers.new(name='UVMap')
 for p in data.polygons:
  normal=p.normal;axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
  for i in p.loop_indices:
   v=data.vertices[data.loops[i].vertex_index].co;uv.data[i].uv=(v[axes[0]]*.5,v[axes[1]]*.5)
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o)
 return finish(o,name,mat,layer,bevel)

def ring(name,loc,radius,minor,mat='gold',layer='Estrutura',rotation=None):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=loc,major_radius=radius,minor_radius=minor)
 o=bpy.context.object
 if rotation:o.rotation_euler=rotation
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,mat,layer)

def masonry(name,loc,size,layer='Alvenaria'):
 x,y,z=loc;w,d,h=size;course=.6;rows=max(1,round(h/course));parts=[]
 # Individual joints and uneven courses remain visible without enormous node counts.
 for row in range(rows):
  zz=z-h/2+(row+.5)*h/rows;columns=max(1,round(w/1.3));step=w/columns
  for col in range(columns):
   xx=x-w/2+(col+.5)*step
   o=box(name,(xx,y,zz),(step-.035,d,h/rows-.035),'stone',layer,.045);parts.append(o)
 return parts

def menorah(origin=(0,0,0),scale=1,layer='Utensílios'):
 x,y,z=origin
 def p(a,b,c):return (x+a*scale,y+b*scale,z+c*scale)
 lathe('Pedestal do candelabro',p(0,0,0),[(.2,0),(.25,.05),(.16,.15),(.08,.25)],'gold',layer)
 tube('Haste central',[p(0,0,.17),p(0,0,1.65)],.038*scale,'gold',layer)
 for side in [-1,1]:
  for i in range(1,4):
   a=side*i*.24;tube('Braço curvo',[p(0,0,.45+i*.15),p(a*.65,0,.65+i*.1),p(a,0,1.3),p(a,0,1.65)],.03*scale,'gold',layer)
 for i in range(-3,4):
  lathe('Lâmpada de azeite',p(i*.24,0,1.65),[(.035,0),(.11,.06),(.09,.12),(.07,.12),(.02,.04)],'gold',layer,sides=24)
  ellipsoid('Botão ornamental',p(i*.24,0,1.35),(.065,.065,.095),'gold',layer,16)

def ark_covenant(origin=(0,0,0),scale=1):
 x,y,z=origin
 body=box('Baú revestido de ouro',(x,y,z+.38*scale),(1.25*scale,.75*scale,.75*scale),'gold',bevel=.025*scale)
 for level in [.03,.14,.66,.76]:box('Moldura ornamental',(x,y,z+level*scale),(1.3*scale,.8*scale,.045*scale),'gold','Ornamentos',.018*scale)
 box('Propiciatório',(x,y,z+.81*scale),(1.37*scale,.85*scale,.09*scale),'gold','Tampa',.025*scale)
 for yy in [-.46,.46]:
  tube('Varal de madeira',[ (x-1.13*scale,y+yy*scale,z+.3*scale),(x+1.13*scale,y+yy*scale,z+.3*scale)],.025*scale,'wood','Varais')
  for xx in [-.48,.48]:ring('Argola de ouro',(x+xx*scale,y+yy*scale,z+.3*scale),.057*scale,.013*scale,'gold','Varais',(math.pi/2,0,0))
 for side in [-1,1]:
  ellipsoid('Forma convencional de querubim',(x+side*.48*scale,y,z+.99*scale),(.065*scale,.09*scale,.16*scale),'gold','Querubins')
  for j in range(9):
   t=j/8;xx=side*(.48-.4*t)
   a=Vector((x+side*.48*scale,y+(t-.5)*.18*scale,z+1.01*scale));b=Vector((x+xx*scale,y+(t-.5)*.33*scale,z+(1.32-.11*t)*scale));c=Vector((x+side*.03*scale,y+(t-.5)*.24*scale,z+1.22*scale))
   feather=[]
   for i in range(13):
    u=i/12;point=(1-u)**2*a+2*(1-u)*u*b+u*u*c;width=math.sin(math.pi*u)*.036*scale
    feather.extend([tuple(point+Vector((0,-width,.007*scale))),tuple(point+Vector((0,width,-.007*scale)))])
   o=mesh('Pena dourada',feather,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(12)],'gold','Querubins')
   o.modifiers.new('Espessura da pena','SOLIDIFY').thickness=.009*scale
 for side in [-1,1]:
  for j in range(25):ellipsoid('Detalhe da borda',(x+(-.59+j*.049)*scale,y+side*.394*scale,z+.70*scale),(.017*scale,.014*scale,.022*scale),'gold','Ornamentos',12)

def hull(length=12,width=3,height=2,layer='Casco',base=0):
 verts=[];faces=[];bands=10;sections=24
 def point(t,s):
  xx=(t-.5)*length;wide=width/2*(.25+.75*math.sin(math.pi*t)**.35)
  angle=math.pi*s;yy=-wide*math.cos(angle);zz=base+height*(.8-1.1*math.sin(angle)**.8)
  return (xx,yy,zz)
 for i in range(sections):
  for j in range(bands):
   t0=(i+.009)/sections;t1=(i+.991)/sections;s0=(j+.014)/bands;s1=(j+.986)/bands
   points=[point(t0,s0),point(t1,s0),point(t1,s1),point(t0,s1)];k=len(verts);verts+=points;faces.append((k,k+1,k+2,k+3))
 o=mesh('Tábuas curvas do casco',verts,faces,'wood',layer,.013)
 mod=o.modifiers.new('Espessura das tábuas','SOLIDIFY');mod.thickness=.07
 for i in range(1,12):
  t=i/12;pts=[point(t,j/10) for j in range(11)];tube('Caverna do casco',pts,.055,'wood','Armação')
 for side in [-1,1]:tube('Borda do casco',[( (i/24-.5)*length,side*width/2*(.25+.75*math.sin(math.pi*i/24)**.35),base+height*.8+.03) for i in range(25)],.06,'wood',layer)

def noah():
 hull(30,5,1.7,base=.55)
 for z in [.60,1.35,2.1]:
  for i in range(20):box('Tábuas do pavimento',(-14.15+i*1.49,0,z),(1.47,4.1,.10),'wood','Pavimentos')
 for x in range(-12,14,3):
  for y in [-1.8,0,1.8]:box('Suporte interior',(x,y,1.52),(.16,.16,2.85),'wood','Armação')
 for side in [-1,1]:
  for z in [2.10,2.35,2.60]:box('Tábuas da superestrutura',(0,side*2.1,z),(27,.09,.23),'wood','Superestrutura')
 for x in [-13.5,13.5]:box('Parede de extremidade',(x,0,2.35),(.12,4.2,.75),'wood','Superestrutura')
 box('Porta lateral',(4,-2.17,2.04),(1.3,.14,1.5),'wood','Porta')
 for i in range(-13,14):
  for side in [-1,1]:
   o=box('Prancha da cobertura',(i,side*1.08,2.86),(1.0,2.23,.08),'wood','Cobertura');o.rotation_euler.x=-side*.10
 for x in range(-12,13,2):tube('Viga do telhado',[(x,-2.2,2.76),(x,0,2.98),(x,2.2,2.76)],.045,'wood','Cobertura')

def cloth(name,start,end,height,mat='linen',layer='Cortinas'):
 a=Vector(start);b=Vector(end);normal=(b-a).cross(Vector((0,0,1))).normalized();verts=[];faces=[];nx=36;nz=10
 for j in range(nz+1):
  for i in range(nx+1):
   t=i/nx;s=j/nz;v=a.lerp(b,t)+Vector((0,0,s*height));v+=normal*(.045*math.sin(t*math.tau*18)*(1-.2*s));verts.append(v)
 for j in range(nz):
  for i in range(nx):k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
 o=mesh(name,verts,faces,mat,layer)
 for p in o.data.polygons:p.use_smooth=True

def tabernacle():
 box('Solo do pátio',(0,0,-.12),(50,25,.2),'sand','Pátio',.0)
 for side in [-1,1]:
  cloth('Linho do pátio',(-25,side*12.5,0),(25,side*12.5,0),2.5)
  for i in range(20):
   x=-25+i*2.5+(2.5 if side==-1 else 0)
   cylinder('Coluna do pátio',(x,side*12.5,1.4),.10,2.8,'wood','Colunas');lathe('Base de bronze',(x,side*12.5,0),[(.2,0),(.2,.14),(.13,.2)],'bronze','Colunas',24)
 for x in [-25,25]:
  for i in range(10):
   y=-12.5+i*2.5+(2.5 if x==-25 else 0)
   cylinder('Coluna do pátio',(x,y,1.4),.10,2.8,'wood','Colunas');lathe('Base de bronze',(x,y,0),[(.2,0),(.2,.14),(.13,.2)],'bronze','Colunas',24)
  if x==-25:cloth('Linho transversal',(x,-12.5,0),(x,12.5,0),2.5)
  else:
   cloth('Linho junto à entrada',(x,-12.5,0),(x,-5,0),2.5)
   cloth('Linho junto à entrada',(x,5,0),(x,12.5,0),2.5)
   cloth('Cortina da entrada do pátio',(x,-5,0),(x,5,0),2.5,'blue')
 for side in [-1,1]:
  for i in range(20):box('Tábua revestida', (-14.625+i*.75,side*2.5,2.5),(.735,.19,5),'gold','Tábuas',.025)
 for i in range(6):box('Tábua posterior',(-15,-1.875+i*.75,2.5),(.19,.735,5),'gold','Tábuas',.025)
 for side in [-1,1]:box('Tábua de canto',(-15,side*2.5,2.5),(.32,.32,5),'gold','Tábuas',.025)
 cloth('Véu',(-10.5,-2.5,0),(-10.5,2.5,0),5,'purple')
 cloth('Entrada azul',(-.5,-2.5,0),(-.5,-.8,0),5,'blue')
 cloth('Entrada púrpura',(-.5,-.8,0),(-.5,.8,0),5,'purple')
 cloth('Entrada escarlata',(-.5,.8,0),(-.5,2.5,0),5,'scarlet')
 box('Camada de cobertura',(-8,0,5.1),(15.7,5.8,.16),'leather','Cobertura',.02)
 for y in [-2.7,2.7]:tube('Fixação longitudinal',[(-15.9,y,5.1),(-.1,y,5.1)],.025,'rope','Cobertura')
 ark_covenant((-13,0,.05),1.4);menorah((-5,-1.5,.1),1.3)
 box('Mesa dos pães',(-5,1.5,1.0),(1.8,.8,.11),'gold','Utensílios')
 for x in [-5.7,-4.3]:
  for y in [1.2,1.8]:box('Pé da mesa',(x,y,.5),(.08,.08,1),'gold','Utensílios')
 altar((9,0,0),2.5);lathe('Bacia de bronze',(4,0,.6),[(.2,0),(.28,.2),(.75,.7),(.72,.8),(.60,.62),(.22,.28)],'bronze','Utensílios')

def altar(origin=(0,0,0),scale=1):
 x,y,z=origin;box('Altar',(x,y,z+.3*scale),(scale,scale,.6*scale),'bronze','Corpo',.035)
 for side in [-1,1]:
  for yy in [-.5,.5]:tube('Chifre do altar',[(x+side*.45*scale,y+yy*scale,z+.55*scale),(x+side*.5*scale,y+yy*scale,z+.8*scale)],.06*scale,'bronze','Chifres')
 for i in range(-5,6):
  box('Grade',(x+i*.08*scale,y,z+.65*scale),(.018*scale,.85*scale,.035*scale),'iron','Grade')
  box('Grade',(x,y+i*.08*scale,z+.65*scale),(.85*scale,.018*scale,.035*scale),'iron','Grade')

def temple(herod=False):
 size=84 if herod else 56;box('Plataforma',(0,0,-.4),(size,54 if herod else 34,.8),'stone','Plataforma',.08)
 for side in [-1,1]:masonry('Pedras do santuário',(-8,side*5,7.5),(30,.7,15))
 masonry('Parede posterior',(-23,0,7.5),(.8,10,15))
 box('Interior dourado',(-8,0,.1),(28,9.2,.13),'gold','Interior')
 cloth('Véu do santuário',(-13,-4.6,0),(-13,4.6,0),14,'purple','Interior')
 for xx in range(-23,9,2):box('Vigas de cedro',(xx,0,15.1),(.3,10.8,.4),'wood','Cobertura')
 box('Cobertura de cedro',(-8,0,15.45),(31,11,.30),'wood','Cobertura')
 for side in [-1,1]:
  loc=(10,side*6,0);lathe('Coluna do pórtico',loc,[(.90,0),(1,.4),(.67,.7),(.62,8.8),(.95,9.1),(.95,9.6),(.65,10)],'bronze','Pórtico')
  for level in [9.15,9.45]:
   for i in range(24):a=i*math.tau/24;ellipsoid('Romã ornamental',(10+.94*math.cos(a),side*6+.94*math.sin(a),level),(.085,.085,.1),'bronze','Pórtico',12)
 for i in range(7):box('Degrau',(13+i*.9,0,.10+i*.10),(1,14,.20+i*.2),'stone','Escadaria',.025)
 altar((23,0,.1),5)
 if herod:
  for side in [-1,1]:
   for x in range(-36,37,4):
    for y in [side*21,side*24]:
     lathe('Coluna do recinto',(x,y,0),[(.6,0),(.65,.3),(.4,.6),(.36,4.8),(.6,5),(.64,5.3)],'stone','Pátios',24)
   box('Entablamento do recinto',(0,side*22.5,5.65),(78,5,.5),'stone','Pátios',.07)

def harp():
 lathe('Caixa de ressonância',(0,0,0),[(.1,0),(.7,.1),(.88,.5),(.68,.9),(.5,1.0),(.45,.91),(.1,.15)],'wood','Caixa')
 for side in [-1,1]:tube('Braço curvo da lira',[(side*.56,0,.48),(side*.83,0,1.15),(side*.76,0,2.25)],.09,'wood','Armação')
 tube('Travessa esculpida',[(-.87,0,2.23),(0,0,2.3),(.87,0,2.23)],.09,'wood','Armação')
 for i in range(9):
  x=-.61+i*.152;tube('Corda',[(x,-.10,.51),(x,-.10,2.3)],.0035,'rope','Cordas');cylinder('Pino de afinação',(x,-.11,2.35),.021,.18,'wood','Afinação',16)
 ring('Abertura acústica',(0,-.72,.43),.16,.013,'iron','Caixa',(math.pi/2,0,0))

def house():
 box('Piso do pátio',(0,0,-.12),(12,10,.2),'stone','Piso')
 for side in [-1,1]:masonry('Parede de pedra',(0,side*5,1.6),(12,.6,3.2))
 masonry('Parede posterior',(-6,0,1.6),(.6,10,3.2));masonry('Lateral da porta',(6,-3.3,1.6),(.6,3.4,3.2));masonry('Lateral da porta',(6,3.3,1.6),(.6,3.4,3.2));box('Verga da entrada',(6,0,2.9),(.8,3.5,.5),'wood','Alvenaria')
 for y in range(-4,5):tube('Viga de cobertura',[(-5.8,y,3.28),(0,y,3.28)],.09,'wood','Cobertura')
 box('Terra sobre vigas',(-3,0,3.43),(6,10,.22),'sand','Cobertura',.04)
 for i in range(9):box('Degrau da escada',(4.5,3-i*.55,.18+i*.33),(1.8,.7,.35),'stone','Escada')
 cloth('Toldo do pátio',(0,-3.5,2.9),(5,-3.5,2.7),1.0,'linen','Toldo')
 for x,y in [(2,3),(3,3.2),(1.2,3.4)]:lathe('Jarro doméstico',(x,y,0),[(.22,0),(.45,.2),(.53,.55),(.43,.9),(.19,1.1),(.18,1.15),(.14,1.1),(.34,.85),(.41,.45),(.13,.12)],'clay','Objetos')
 box('Banco',(2,-3,.45),(3,.7,.15),'wood','Objetos');box('Esteira',(-3,2,.05),(2.6,1.4,.05),'linen','Objetos')

def boat(ship=False):
 hull(15 if ship else 8,4 if ship else 2.8,2.4 if ship else 1.6)
 for x in range(-3,4):box('Banco de remadores',(x,0,1.0),(.35,2.55,.12),'wood','Bancos')
 tube('Mastro',[(0,0,.15),(0,0,7 if ship else 4.8)],.14,'wood','Vela');tube('Verga',[(-2.4,0,5.3 if ship else 3.6),(2.4,0,5.3 if ship else 3.6)],.07,'wood','Vela')
 cloth('Vela de linho',(-2.3,0,1.8),(2.3,0,1.8),3.4 if ship else 1.8,'linen','Vela')
 for side in [-1,1]:
  for x in [-2,0,2]:tube('Remo',[(x,side*.5,1.1),(x-.6,side*3,0)],.045,'wood','Remos');o=box('Pá do remo',(x-.6,side*3.1,-.03),(.45,.9,.08),'wood','Remos');o.rotation_euler.z=-side*.2
 for point in [(-3,1,1.0),(3,1,1.0),(-3,-1,1.0),(3,-1,1.0)]:tube('Cordame',[(0,0,4.8),point],.017,'rope','Cordame')

def vessels(id):
 if id in ['bacia','mar_bronze','tacas','copo']:
  mat='bronze' if id in ['bacia','mar_bronze'] else 'gold';s=3 if id=='mar_bronze' else 1
  profile=[(.03,0),(.25,.08),(.20,.25),(.18,.7),(.55,1),(.75,1.5),(.78,1.65),(.73,1.67),(.67,1.42),(.45,1.0),(.13,.84)]
  lathe('Recipiente aberto',(0,0,0),[(r*s,z*s) for r,z in profile],mat)
  ring('Borda trabalhada',(0,0,1.65*s),.75*s,.025*s,mat,'Ornamentos')
 else:
  lathe('Vaso de cerâmica',(0,0,0),[(.20,0),(.35,.07),(.62,.4),(.70,.85),(.59,1.25),(.35,1.52),(.27,1.75),(.31,1.80),(.27,1.82),(.22,1.7),(.29,1.45),(.51,1.2),(.60,.85),(.50,.40),(.18,.12)],'clay')
  for level in [1.56,1.64,1.72]:ring('Incisão cerâmica',(0,0,level),.285,.009,'clay','Ornamentos')
  for side in [-1,1]:tube('Alça',[(side*.38,0,1.5),(side*.72,0,1.45),(side*.82,0,1.15),(side*.57,0,.87)],.047,'clay','Alças')

def utensils():
 menorah((-1.8,0,0),1.4);lathe('Bacia sacerdotal',(1.5,0,0),[(.15,0),(.45,.15),(.20,.5),(.3,.75),(.8,1.1),(.82,1.25),(.74,1.20),(.61,.96),(.2,.7)],'bronze','Bacia')
 box('Mesa dos pães',(0,2,1.05),(2.2,.9,.13),'gold','Mesa')
 for x in [-.9,.9]:
  for y in [1.65,2.35]:box('Pé de mesa',(x,y,.5),(.09,.09,1.0),'gold','Mesa')
 for x in [-.45,.45]:
  for z in [1.18,1.24,1.30]:ellipsoid('Pão',(x,2,z),(.32,.27,.05),'linen','Mesa')

def tree(id):
 tube('Tronco',[(0,0,0),(.06,.03,1.1),(-.08,0,2.3),(0,.1,3.4)],.19,'wood','Tronco')
 for i in range(14):
  a=i*2.399;z=1.4+i*.14;radius=1.6 if id!='palmeira' else 2.2
  end=(radius*math.cos(a),radius*math.sin(a),z+.8);tube('Ramo',[(0,0,z),(.6*end[0],.6*end[1],z+.5),end],.04,'wood','Ramos')
  for j in range(18):
   t=.2+j*.8/18;xx=end[0]*t+random.uniform(-.22,.22);yy=end[1]*t+random.uniform(-.22,.22);zz=z+.8*t+random.uniform(-.12,.12)
   o=ellipsoid('Folha',(xx,yy,zz),(.13,.045,.01),'leaf' if j%3 else 'leaf2','Folhas',12);o.rotation_euler.z=a+random.uniform(-1,1)
  if id!='palmeira':ellipsoid('Fruto',(end[0]*.75,end[1]*.75,end[2]-.15),(.043,.038,.07),'leaf2','Frutos',12)

builders={'arca_noe':noah,'tabernaculo':tabernacle,'arca_alianca':ark_covenant,'templo_salomao':temple,'segundo_templo':lambda:temple(True),'utensilios':utensils,'harpa':harp,'habitacao':house,'altar':altar,'barco':boat,'navio':lambda:boat(True)}
for id in ['jarro','vaso','pote','oleo','copo','bacia','mar_bronze','tacas']:builders[id]=lambda id=id:vessels(id)
for id in ['oliveira','figueira','palmeira','amendoeira','sicômoro']:builders[id]=lambda id=id:tree(id)

def enhance_existing(file):
 bpy.ops.import_scene.gltf(filepath=str(file))
 bpy.ops.object.select_all(action='DESELECT')
 names={'Madeira':'wood','Ouro':'gold','Pedra':'stone','Linho':'linen','Púrpura':'purple','Água':'water','Bronze':'bronze','Telhado':'wood','Corda':'rope','Folhagem':'leaf','Terracota':'clay','Ferro':'iron','Lã':'wool','Grão':'linen','Uvas':'purple','Areia':'sand','Tinta':'iron'}
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  old=o.data.materials[0].name.split('.')[0] if o.data.materials else 'Madeira'
  o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(M[names.get(old,'wood')])
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False)
  if not o.data.uv_layers:
   uv=o.data.uv_layers.new(name='UVMap')
   for p in o.data.polygons:
    axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
    for i in p.loop_indices:
     v=o.data.vertices[o.data.loops[i].vertex_index].co;uv.data[i].uv=(v[axes[0]],v[axes[1]])
  if len(o.data.vertices)<100:
   mod=o.modifiers.new('Arestas suavizadas','BEVEL');mod.width=min(o.dimensions)*.10;mod.segments=2
   o.modifiers.new('Normais de superfície','WEIGHTED_NORMAL')

def render_preview(id):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.render.threads_mode='FIXED';scene.render.threads=3;scene.cycles.samples=20;scene.cycles.use_denoising=True
 scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='AgX'
 objects=[o for o in scene.objects if o.type in ['MESH','CURVE']];points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
 minimum=Vector([min(p[i] for p in points) for i in range(3)]);maximum=Vector([max(p[i] for p in points) for i in range(3)]);center=(minimum+maximum)/2;extent=max(maximum-minimum)
 box('Solo de apresentação',(center.x,center.y,minimum.z-.14),(extent*3,extent*3,.10),'sand','Ambiente',.0)
 for loc,power,size in [(center+Vector((extent*.5,-extent*.7,extent*1.3)),700*extent,extent*.8),(center+Vector((-extent*.8,extent*.5,extent*.8)),380*extent,extent)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=center+Vector((extent*.95,-extent*1.1,extent*.77)));camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=46;scene.camera=camera
 folder=R.parent/'qa-3d';folder.mkdir(exist_ok=True);scene.render.filepath=str(folder/(id+'.png'));bpy.ops.render.render(write_still=True)

stats=[]
for record in catalog:
 id=record['id']
 if args.resume and record.get('geometry_version') in ['2.0','2.1']:continue
 if args.only and id not in args.only.split(','):continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);active_refs=record['references']
 file=OUT/record['file'];original=R/'content_sources/original_models'/file.name
 original.parent.mkdir(parents=True,exist_ok=True)
 if not original.exists():original.write_bytes(file.read_bytes())
 if id in builders:builders[id]()
 else:enhance_existing(original)
 layers=list(dict.fromkeys(o.get('layer','Estrutura') for o in bpy.context.scene.objects));parts=[o.name for o in bpy.context.scene.objects]
 bpy.ops.export_scene.gltf(export_draco_mesh_compression_enable=False,export_image_format='JPEG',filepath=str(file),export_format='GLB',export_extras=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_normals=True,export_texcoords=True,export_cameras=False,export_lights=False,export_animations=False)
 blob=file.read_bytes();length,kind=struct.unpack_from('<II',blob,12);g=json.loads(blob[20:20+length])
 triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'] if 'indices' in p)
 record.update(layers=layers,parts=parts,quality='Detalhado com materiais PBR' if id in builders else 'Materiais PBR e superfícies aprimoradas',geometry_version='2.1',triangles=triangles,texture_license='Poly Haven CC0',certainty='Reconstrução interpretativa. Proporções textuais são indicadas quando disponíveis; formas, acabamentos e ambiente não especificados são ilustrativos. Não é levantamento arqueológico.',license='CC BY 4.0 — geometria original; materiais Poly Haven CC0')
 stats.append(dict(id=id,triangles=triangles,bytes=len(blob),images=len(g.get('images',[])),detailed=id in builders))
 print('BUILT',json.dumps(stats[-1]),flush=True)
 # Save the registry after each asset, so interrupted work is resumable.
 (OUT/'models.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
 if args.render and id in ['arca_noe','arca_alianca','tabernaculo','templo_salomao','habitacao','harpa']:render_preview(id)
(R/'assets/content/model-quality.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
