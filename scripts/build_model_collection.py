"""Original offline study models and curated coverage, at most four chapters apart.

Geometry is schematic. The association describes the text's genre, never a claim
that a metaphor, a vision, or an illustrative object is an archaeological find.
Run after building catalogue.sqlite; no network or external assets are used.
"""
import hashlib
import json
import math
import sqlite3
from build_models import M, Model, O, R


def beam(m, name, a, b, width=.08, material=0, layer='Estrutura'):
    d=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(v*v for v in d))
    if length<.00001:return
    n=[v/length for v in d];q=[n[2],0,-n[0],1+n[1]]
    norm=math.sqrt(sum(v*v for v in q));q=[v/norm for v in q] if norm>.00001 else [1,0,0,0]
    m.part(name,[(a[i]+b[i])/2 for i in range(3)],[width,length,width],material,kind='cylinder',layer=layer,rotation=q)


def ground(m, size=5, material=15):
    m.part('Base ilustrativa',[0,-.12,0],[size,.24,size],material,layer='Ambiente')


def jar(m, x=0,z=0,y=0,scale=1,material=10):
    for h,w in [(0,.52),(.2,.85),(.45,1),(.7,.75),(.9,.42)]:
        m.part('Parede do recipiente',[x,y+(h+.1)*scale,z],[w*scale,.22*scale,w*scale],material,kind='cylinder',layer='Recipiente')
    m.part('Boca aberta',[x,y+1.07*scale,z],[.49*scale,.55*scale,.49*scale],material,kind='torus',layer='Recipiente')


def table(m, x=0, y=0, z=0):
    m.part('Tampo',[x,y+1.1,z],[2.4,.16,1.2],0,layer='Mesa')
    for dx in [-1,1]:
        for dz in [-.45,.45]:m.part('Pé',[x+dx,y+.55,z+dz],[.14,1.1,.14],0,layer='Mesa')


def tree(m, species='oliveira'):
    ground(m,5)
    m.part('Tronco',[0,1.1,0],[.38,2.2,.38],0,kind='cylinder',layer='Tronco e ramos')
    if species=='palmeira':
        m.part('Tronco alto',[0,2.4,0],[.3,4.8,.3],0,kind='cylinder',layer='Tronco e ramos')
        for i in range(12):
            a=i*math.pi/6;x,z=math.cos(a),math.sin(a)
            beam(m,'Raque da folha',[0,4.8,0],[x*2.2,4.1,z*2.2],.07,9,'Folhagem')
            for k in range(1,6):
                t=k/6;beam(m,'Folíolo',[x*2.2*t,4.8-.7*t,z*2.2*t],[x*2.2*t-z*.55,4.5-.7*t,z*2.2*t+x*.55],.12,9,'Folhagem')
    else:
        for i in range(9):
            a=i*2*math.pi/9;x,z=math.cos(a),math.sin(a);h=2+(i%3)*.35
            beam(m,'Ramo',[0,1.4,0],[x*1.1,h,z*1.1],.14,0,'Tronco e ramos')
            m.part('Copa',[x,h+.5,z],[1.8,1.2,1.7],9,kind='sphere',layer='Folhagem')
            if species in ['figueira','sicômoro']:
                for k in [-1,0,1]:m.part('Fruto ilustrativo',[x+k*.2,h,z-.7],[.16,.2,.16],14 if species=='figueira' else 13,kind='sphere',layer='Frutos')
        if species=='amendoeira':
            for i in range(18):
                a=i*2*math.pi/18;m.part('Flor ilustrativa',[math.cos(a)*1.5,2.5+(i%4)*.25,math.sin(a)*1.5],[.15,.1,.15],12,kind='sphere',layer='Flores')


def grain(m, sheaf=False):
    ground(m,4)
    for i in range(15):
        x=(i%5-.5)*.3-.6;z=(i//5-1)*.3;h=1.3+(i%3)*.15
        beam(m,'Haste',[x,0,z],[x,h,z],.028,13,'Plantas')
        for j in range(5):m.part('Grão',[x+(j%2-.5)*.12,h+j*.09,z],[.1,.17,.09],13,kind='sphere',layer='Espigas')
    if sheaf:m.part('Feixe atado',[0,.65,0],[1,.35,1],8,kind='torus',layer='Amarração')


def animal(m, species):
    ground(m,4)
    wool=12 if species in ['ovelha','cordeiro','pomba'] else 13 if species=='leao' else 0
    body=[2,1, .8];head=[.6,.6,.6]
    if species in ['peixe','peixe_grande']:
        m.part('Corpo genérico',[0,1,0],[3,1.1,.75],5,kind='sphere',layer='Corpo')
        for s in [-1,1]:beam(m,'Barbatana caudal',[-1.1,1,0],[-2,1+s*.7,0],.22,5,'Barbatanas')
        beam(m,'Barbatana dorsal',[0,1.4,0],[.2,2,0],.18,5,'Barbatanas')
        m.part('Olho',[1.12,1.1,.34],[.07,.07,.07],16,kind='sphere',layer='Corpo');return
    if species in ['pomba','aguia']:
        m.part('Corpo',[0,.8,0],[1.2,.8,.65],wool,kind='sphere',layer='Corpo')
        for s in [-1,1]:
            m.part('Asa',[0,1,s*.8],[1.1,.15,1.3],wool,kind='sphere',layer='Asas')
            for i in range(6):m.part('Pena estilizada',[-.45+i*.16,1,s*1.25],[.11,.1,.8],wool,kind='sphere',layer='Asas')
        m.part('Cabeça',[.7,1,0],[.4,.4,.4],wool,kind='sphere',layer='Corpo')
        beam(m,'Bico',[.85,1,0],[1.2,.95,0],.11,13,'Corpo');return
    if species=='gafanhoto':
        m.part('Abdome',[0,.6,0],[1.5,.4,.4],9,kind='sphere',layer='Corpo')
        for s in [-1,1]:
            for x in [-.5,0,.5]:
                beam(m,'Perna',[x,.6,0],[x-.2,.8,s*.6],.045,0,'Pernas');beam(m,'Perna',[x-.2,.8,s*.6],[x-.6,0,s*.9],.045,0,'Pernas')
        for s in [-1,1]:beam(m,'Antena',[.75,.7,0],[1.3,1,s*.3],.02,0,'Corpo')
        return
    m.part('Corpo',[0,1,0],body,wool,kind='sphere',layer='Corpo')
    for x in [-.7,.7]:
        for z in [-.28,.28]:beam(m,'Perna',[x,1,z],[x,.12,z],.14,wool,'Pernas')
    m.part('Cabeça',[1.05,1.4,0],head,wool,kind='sphere',layer='Corpo')
    for s in [-1,1]:m.part('Orelha',[1.05,1.65,s*.25],[.24,.12,.28],wool,kind='sphere',layer='Corpo')
    if species=='leao':m.part('Juba',[.85,1.4,0],[.9,.95,.9],0,kind='sphere',layer='Juba')
    if species in ['boi','cervo']:
        for s in [-1,1]:
            beam(m,'Chifre',[.9,1.65,s*.18],[.75,2.25,s*.5],.07,3,'Chifres')
            if species=='cervo':beam(m,'Galhada',[.8,1.95,s*.36],[1.2,2.2,s*.55],.05,3,'Chifres')
    beam(m,'Cauda',[-.9,1,0],[-1.4,.7,0],.07,wool,'Corpo')


def boat(m, merchant=False, wreck=False):
    ground(m,8,5)
    length=6 if merchant else 4
    m.part('Quilha',[0,.1,0],[length,.3,.2],0,layer='Casco')
    for z in [-.7,.7]:
        for i in range(9):
            x=(i-4)*length/9;w=.8-(abs(i-4)/4)**2*.5
            m.part('Costado',[x,.55,z*w],[length/9,.8,.12],0,layer='Casco')
    m.part('Convés',[0,.4,0],[length*.8,.08,1],0,layer='Convés')
    for x in [-length*.48,length*.48]:m.part('Extremidade',[x,.6,0],[.2,.9,.5],0,layer='Casco')
    beam(m,'Mastro',[0,.5,0],[0,3,0],.14,0,'Velame')
    beam(m,'Verga',[-1.5,2.7,0],[1.5,2.7,0],.1,0,'Velame')
    if not wreck:m.part('Vela',[0,2,0],[2.8,1.5,.035],3,layer='Velame')
    else:
        beam(m,'Verga quebrada',[0,1.2,0],[1.6,.3,1.1],.12,0,'Destroços');m.part('Rochedo',[-1,0,0],[2,1.2,2],2,kind='sphere',layer='Destroços')
    if merchant:
        for x in [-1.5,1.5]:jar(m,x,0,.5,.6)
    else:
        for x in [-1,1]:beam(m,'Remo',[x,.5,-.5],[x-.6,.2,-2],.08,0,'Remos')


def wall(m, gate=False, ruins=False):
    ground(m,8)
    for level in range(6 if not ruins else 3):
        for i in range(12):
            if gate and 4<=i<=7 and level<4:continue
            if ruins and (level+i)%4==0:continue
            m.part('Bloco de alvenaria',[(i-5.5)*.55+(level%2)*.15,.22+level*.45,0],[.52,.42,.65],2,layer='Muralha')
    if gate:
        for x in [-2,2]:m.part('Torre do portão',[x,1.7,0],[1,3.4,1.5],2,layer='Torres')
        m.part('Folha do portão',[-.43,.85,0],[.82,1.7,.1],0,layer='Porta');m.part('Folha do portão',[.43,.85,0],[.82,1.7,.1],0,layer='Porta')
    else:
        for i in range(6):m.part('Parapeito ameado',[(i-2.5)*1.1,2.9,0],[.55,.35,.65],2,layer='Parapeito')


def geometry_for(m, kind):
    if kind in ['oliveira','palmeira','figueira','amendoeira','sicômoro']:tree(m,kind)
    elif kind in ['ovelha','cordeiro','boi','cervo','pomba','leao','peixe','peixe_grande','aguia','gafanhoto']:animal(m,kind)
    elif kind in ['campo','feixes']:grain(m,kind=='feixes')
    elif kind in ['barco','navio','naufragio']:boat(m,kind=='navio',kind=='naufragio')
    elif kind in ['muralha','portao','ruinas']:wall(m,kind=='portao',kind=='ruinas')
    elif kind in ['jarro','oleo','vaso','pote','odres','copo']:
        if kind=='odres':
            m.part('Corpo flexível',[0,.6,0],[1.4,1.1,.6],0,kind='sphere',layer='Recipiente');beam(m,'Gargalo',[.5,.9,0],[.7,1.3,0],.17,0,'Recipiente')
        elif kind=='copo':
            m.part('Base',[0,.1,0],[.6,.15,.6],6,kind='cylinder',layer='Recipiente');m.part('Borda aberta',[0,.45,0],[.9,2.5,.9],6,kind='torus',layer='Recipiente')
        else:
            jar(m,scale=1.8 if kind=='pote' else 1)
            if kind=='jarro':
                for x in [-.6,.6]:m.part('Alça',[x,.65,0],[.6,1.5,.6],10,kind='torus',rotation=[math.sin(math.pi/4),0,0,math.cos(math.pi/4)],layer='Alças')
            if kind=='vaso':
                for node in m.nodes:
                    node['scale'][0]*=.7;node['scale'][2]*=.7;node['translation'][1]*=1.4;node['scale'][1]*=1.4
        if kind=='oleo':m.part('Óleo ilustrativo',[0,.9,0],[.38,.03,.38],1,kind='cylinder',layer='Conteúdo')
        if kind=='odres':
            for x in [-.7,.7]:beam(m,'Correia',[x,.7,0],[0,1.2,0],.05,8,'Correia')
    elif kind in ['bacia','mar_bronze','tacas']:
        n=7 if kind=='tacas' else 1
        for i in range(n):
            x=(i-(n-1)/2)*1.3;m.part('Pedestal',[x,.3,0],[.4,.6,.4],6,kind='cylinder',layer='Suporte')
            m.part('Base da bacia',[x,.6,0],[1,.1,1],6,kind='cylinder',layer='Bacia');m.part('Borda',[x,.85,0],[1.5,2,1.5],6,kind='torus',layer='Bacia')
        if kind=='mar_bronze':
            for i in range(12):
                a=i*math.pi/6;m.part('Boi de suporte esquemático',[math.cos(a)*.5,.2,math.sin(a)*.5],[.3,.2,.2],6,kind='sphere',layer='Doze suportes')
    elif kind in ['cesto','cesto_frutos']:
        for y in [.1,.2,.3,.4,.5,.6,.7]:m.part('Trama circular',[0,y,0],[1.6,1,1.6],8,kind='torus',layer='Trama')
        for i in range(20):
            a=i*math.pi/10;beam(m,'Trama vertical',[math.cos(a)*.5,0,math.sin(a)*.5],[math.cos(a)*.6,.8,math.sin(a)*.6],.035,8,'Trama')
        m.part('Fundo',[0,.04,0],[1,.08,1],8,kind='cylinder',layer='Trama')
        if kind=='cesto_frutos':
            for i in range(7):m.part('Fruto',[(i%3-1)*.25,.55+(i//3)*.16,(i//3-1)*.25],[.3,.3,.3],13,kind='sphere',layer='Frutos')
    elif kind in ['pao','incenso']:
        if kind=='pao':
            for i in range(5):m.part('Pão',[(i%3-1)*.5,.1,(i//3)*.5],[.7,.25,.45],13,kind='sphere',layer='Alimento')
        else:
            m.part('Brasas',[0,.15,0],[.6,.3,.6],10,kind='sphere',layer='Conteúdo');m.part('Borda do incensário',[0,.2,0],[1.2,1.5,1.2],6,kind='torus',layer='Recipiente')
            for i in range(3):beam(m,'Corrente',[math.cos(i*2*math.pi/3)*.4,.4,math.sin(i*2*math.pi/3)*.4],[0,1.5,0],.03,6,'Correntes')
    elif kind in ['lampada','sete_lampadas','candelabro']:
        n=7 if kind!='lampada' else 1
        for i in range(n):
            x=(i-(n-1)/2)*.7
            if kind!='lampada':beam(m,'Pedestal',[x,0,0],[x,1.5,0],.08,1,'Suportes')
            y=1.5 if kind!='lampada' else 0
            m.part('Reservatório',[x,y+.12,0],[.5,.24,.35],10 if kind=='lampada' else 1,kind='sphere',layer='Lâmpadas')
            beam(m,'Bico e pavio',[x+.15,y+.13,0],[x+.4,y+.13,0],.045,8,'Lâmpadas')
        if kind=='candelabro':beam(m,'Travessa esquemática',[-2.1,1,0],[2.1,1,0],.09,1,'Suportes')
    elif kind in ['pergaminho','sete_selos','carta','papiro','tinta','tabuas','documento']:
        m.part('Superfície de escrita',[0,.2,0],[2.8,.04,1.6],2 if kind=='tabuas' else 3,layer='Suporte')
        if kind in ['pergaminho','sete_selos']:
            for x in [-1.35,1.35]:beam(m,'Rolo',[x,.35,-1],[x,.35,1],.3,0,'Rolos')
        if kind=='sete_selos':
            for i in range(7):m.part('Selo de número '+str(i+1),[(i-3)*.3,.28,.7],[.18,.07,.18],10,kind='cylinder',layer='Selos')
        if kind in ['tinta','papiro','documento','carta']:
            jar(m,2,0,0,.4,16);beam(m,'Cálamo',[1.6,.2,-.4],[2.5,.2,.5],.05,0,'Escrita')
        if kind!='sete_selos':
            for i in range(6):m.part('Linha simbólica sem texto',[0,.225,-.5+i*.2],[1.7,.007,.035],16,layer='Escrita')
    elif kind in ['vara','cajado','prumo','jugo','escada','corrente']:
        if kind=='escada':
            for x in [-.5,.5]:beam(m,'Longarina',[x,0,0],[x,3,0],.1,0)
            for i in range(8):beam(m,'Degrau',[-.5,i*.4,0],[.5,i*.4,0],.1,0,'Degraus')
        elif kind=='corrente':
            for i in range(12):m.part('Elo',[(i-5.5)*.38,.2,0],[.6,.6,.6],11,kind='torus',rotation=[math.sin(math.pi/4),0,0,math.cos(math.pi/4)] if i%2 else None,layer='Elos')
        elif kind=='jugo':
            m.part('Travessa',[0,1,0],[2.5,.2,.25],0)
            for x in [-.7,.7]:m.part('Arco do pescoço',[x,.5,0],[1,3,1],0,kind='torus',rotation=[math.sin(math.pi/4),0,0,math.cos(math.pi/4)],layer='Arcos')
        elif kind=='prumo':
            beam(m,'Linha de prumo',[0,0,0],[0,2,0],.025,8,'Linha');m.part('Peso',[0,.1,0],[.4,.5,.4],6,kind='sphere',layer='Peso')
        else:
            beam(m,'Haste',[0,0,0],[0,2.4,0],.09,0)
            if kind=='cajado':m.part('Extremidade curva',[0,2.35,0],[.55,2,.55],0,kind='torus',rotation=[math.sin(math.pi/4),0,0,math.cos(math.pi/4)])
    elif kind in ['balanca','moedas','metais','colar','cetro','trono','roupa']:
        if kind=='balanca':
            beam(m,'Coluna',[0,0,0],[0,2,0],.13,6);beam(m,'Braço',[-1,1.8,0],[1,1.8,0],.08,6)
            for x in [-1,1]:
                for z in [-.2,.2]:beam(m,'Suspensão',[x,1.8,0],[x,.8,z],.02,8,'Pratos')
                m.part('Prato',[x,.8,0],[.7,.08,.7],6,kind='cylinder',layer='Pratos')
        elif kind in ['moedas','metais','colar']:
            for i in range(12):
                if kind=='colar':
                    a=i*math.pi/6;position=[math.cos(a),.2,math.sin(a)];size=[.2,.2,.2]
                else:position=[(i%4-1.5)*.4,.1+(i//4)*.1,(i//4-1)*.3];size=[.32,.05,.32] if kind=='moedas' else [.38,.14,.25]
                m.part('Conta' if kind=='colar' else 'Peça sem inscrição',position,size,1 if i%2 else 6,kind='sphere' if kind=='colar' else 'cylinder' if kind=='moedas' else 'box',layer='Peças')
        elif kind=='cetro':
            beam(m,'Haste',[0,0,0],[0,2.3,0],.13,1);m.part('Extremidade ornamental',[0,2.4,0],[.35,.4,.35],1,kind='sphere',layer='Ornamento')
        elif kind=='trono':
            m.part('Assento',[0,1,0],[1.6,.25,1.3],1);m.part('Encosto',[0,1.8,-.55],[1.7,1.8,.18],0,layer='Encosto')
            for x in [-.65,.65]:
                for z in [-.45,.45]:m.part('Pé',[x,.5,z],[.15,1,.15],1)
                m.part('Apoio de braço',[x,1.4,0],[.12,.2,1.3],1)
        else:
            m.part('Túnica sem corpo humano',[0,1.3,0],[1.3,2.6,.12],3,layer='Túnica');m.part('Éfode ilustrativo',[0,2,.08],[1.1,1,.05],4,layer='Éfode')
            m.part('Peitoral',[0,2,.14],[.6,.5,.05],1,layer='Peitoral')
            for i in range(12):m.part('Pedra ilustrativa',[(i%3-1)*.17,1.85+(i//3)*.1,.18],[.1,.08,.05],i%2+4,kind='sphere',layer='Peitoral')
    elif kind in ['trombeta','flauta','tambor','cimbalos']:
        if kind in ['trombeta','flauta']:
            beam(m,'Tubo',[-1,0,0],[1,0,0],.15,6 if kind=='trombeta' else 0)
            if kind=='trombeta':
                for i in range(6):m.part('Pavilhão',[1+i*.1,0,0],[.15,.2+i*.12,.2+i*.12],6,kind='cylinder',rotation=[0,0,math.sin(math.pi/4),math.cos(math.pi/4)],layer='Pavilhão')
            else:
                for i in range(6):m.part('Orifício',[-.6+i*.25,.09,0],[.05,.01,.05],16,kind='cylinder',layer='Orifícios')
        elif kind=='tambor':
            m.part('Aro',[0,.1,0],[2,1,2],0,kind='torus');m.part('Pele',[0,.16,0],[1.5,.03,1.5],3,kind='cylinder',layer='Membrana')
        else:
            for x in [-.7,.7]:m.part('Disco',[x,.15,0],[1.3,.1,1.3],6,kind='cylinder',layer='Discos');m.part('Pega',[x,.25,0],[.15,.2,.15],0,kind='cylinder')
    elif kind in ['rede','peneira','tecido','tear','fuso']:
        if kind=='fuso':
            beam(m,'Fuso',[0,0,0],[0,2,0],.08,0);m.part('Volante',[0,.3,0],[.65,.12,.65],2,kind='cylinder',layer='Volante');m.part('Fio',[0,1,0],[.4,.8,.4],12,kind='sphere',layer='Fio')
        else:
            for x in [-1,1]:beam(m,'Travessa',[x,0,0],[x,2,0],.09,0)
            for y in [0,2]:beam(m,'Travessa',[-1,y,0],[1,y,0],.09,0)
            for i in range(15):
                beam(m,'Urdidura',[-.93+i*.13,0,0],[-.93+i*.13,2,0],.018,8,'Trama')
                if kind!='tear':beam(m,'Trama',[-1,i*.14,0],[1,i*.14,0],.018,8,'Trama')
            if kind=='tear':m.part('Tecido',[0,.5,0],[1.8,1,.03],3,layer='Trama')
    elif kind in ['poco','cisterna','piscina','fonte']:
        ground(m,6)
        if kind in ['poco','cisterna']:
            for i in range(12):
                a=i*math.pi/6;m.part('Bloco do anel',[math.cos(a),.45,math.sin(a)],[.5,.9,.5],2,layer='Alvenaria')
            m.part('Água ilustrativa',[0,.05,0],[1.7,.02,1.7],5,kind='cylinder',layer='Água')
            if kind=='poco':
                for x in [-1.2,1.2]:beam(m,'Suporte',[x,0,0],[x,2.2,0],.14,0)
                beam(m,'Travessa',[-1.2,2.2,0],[1.2,2.2,0],.12,0);beam(m,'Corda',[0,2.2,0],[0,.5,0],.035,8,'Corda')
        else:
            m.part('Espelho de água',[0,.1,0],[4,.1,3],5,layer='Água')
            for z in [-1.5,1.5]:m.part('Borda',[0,.3,z],[4,.4,.3],2,layer='Alvenaria')
            if kind=='fonte':m.part('Canal de nascente',[-1,.25,0],[.5,.2,3],2,layer='Alvenaria')
    elif kind in ['moinho','eira','celeiro','lagar','forno','fornalha','bigorna','roda_oleiro','tijolos','mina']:
        ground(m,6)
        if kind=='moinho':
            for y in [.2,.6]:m.part('Mó',[0,y,0],[1.8,.4,1.8],2,kind='cylinder',layer='Pedras')
            beam(m,'Manivela',[.6,.8,0],[.6,1.2,0],.1,0,'Manivela')
        elif kind=='eira':
            m.part('Piso de debulha',[0,.02,0],[5,.08,5],2,kind='cylinder');
            for i in range(12):m.part('Feixe ilustrativo',[(i%4-1.5)*.7,.2,(i//4-1)*.6],[.6,.3,.3],13,kind='sphere',layer='Feixes')
        elif kind=='celeiro':
            m.part('Base',[0,.2,0],[4,.4,3],2)
            for x in [-2,2]:m.part('Parede',[x,1,0],[.2,1.8,3],2)
            for z in [-1.5,1.5]:m.part('Parede',[0,1,z],[4,1.8,.2],2)
            for i in range(6):m.part('Depósito de grãos',[(i%3-1)*1.2,.55,(i//3-.5)*1.3],[1,.5,1],13,kind='sphere',layer='Grãos')
        elif kind=='lagar':
            m.part('Piso de prensagem',[-1,.45,0],[2.5,.3,2],2)
            for z in [-1,1]:m.part('Borda do lagar',[-1,.7,z],[2.5,.4,.2],2)
            m.part('Canal',[.5,.3,0],[1.5,.1,.3],2);m.part('Tanque de coleta',[1.6,.1,0],[1.5,.15,1.7],14,layer='Coleta')
        elif kind in ['forno','fornalha']:
            for i in range(12):
                a=i*math.pi/6;m.part('Parede de barro',[math.cos(a),.6,math.sin(a)],[.5,1.2,.5],10,layer='Paredes')
            m.part('Abertura superior',[0,1.3,0],[1.6,1.5,1.6],10,kind='torus',layer='Paredes')
            m.part('Brasas ilustrativas',[0,.1,0],[1.5,.12,1.5],10,kind='cylinder',layer='Conteúdo')
        elif kind=='bigorna':
            m.part('Cepo',[0,.5,0],[1,1,1],0);m.part('Corpo da bigorna',[0,1.2,0],[1.4,.45,.65],11);beam(m,'Martelo',[-1,.2,0],[-1,1,0],.08,0,'Ferramentas');m.part('Cabeça do martelo',[-1,1,0],[.5,.2,.2],11,layer='Ferramentas')
        elif kind=='roda_oleiro':
            for y in [.2,.8]:m.part('Disco giratório',[0,y,0],[1.5,.1,1.5],0,kind='cylinder',layer='Roda')
            beam(m,'Eixo',[0,.2,0],[0,.8,0],.1,0,'Roda');jar(m,y=.85,scale=.7)
        elif kind=='tijolos':
            for i in range(18):m.part('Tijolo ilustrativo',[(i%6-2.5)*.7,.15+(i//6)*.3,0],[.65,.28,.4],10)
        else:
            for x in [-1,1]:beam(m,'Esteio',[x,0,0],[x,2.5,0],.18,0)
            beam(m,'Travessa',[-1,2.5,0],[1,2.5,0],.18,0)
            for x in [-2,2]:m.part('Rocha',[x,1.3,0],[2,2.6,3],2,kind='sphere',layer='Rocha')
    elif kind in ['tenda','acampamento','manjedoura','leito','mesa','banquete','cofre','carro','tribunal']:
        ground(m,6)
        if kind in ['tenda','acampamento']:
            for j in range(3 if kind=='acampamento' else 1):
                x=(j-1)*2 if kind=='acampamento' else 0
                for z in [-1,1]:beam(m,'Polo',[x,0,z],[x,2,z],.08,0)
                for s in [-1,1]:
                    beam(m,'Borda inclinada',[x,2,0],[x+s*1.5,0,0],.08,8,'Cobertura')
                    m.part('Pano',[x+s*.65,1,0],[.035,2.5,2.5],3,rotation=[0,0,s*math.sin(.32),math.cos(.32)],layer='Cobertura')
        elif kind=='manjedoura':
            m.part('Fundo',[0,.5,0],[1.8,.15,.8],0)
            for z in [-.45,.45]:m.part('Parede',[0,.8,z],[1.8,.6,.1],0)
            for x in [-.9,.9]:m.part('Extremidade',[x,.8,0],[.1,.6,.9],0)
            for x in [-.65,.65]:m.part('Pé',[x,.25,0],[.15,.5,.15],0)
            m.part('Palha',[0,.7,0],[1.5,.1,.6],13,layer='Palha')
        elif kind=='leito':
            m.part('Estrado',[0,.4,0],[2.8,.18,1.4],0);m.part('Esteira',[0,.52,0],[2.7,.06,1.3],8,layer='Esteira');m.part('Almofada',[-1,.6,0],[.5,.15,1.2],3,layer='Esteira')
        elif kind in ['mesa','banquete','tribunal']:
            table(m)
            if kind=='banquete':
                for x in [-.8,.8]:jar(m,x,0,1.2,.4)
                m.part('Travessa',[0,1.21,0],[.8,.05,.6],6,kind='cylinder',layer='Alimentos')
            if kind=='tribunal':m.part('Estrado do tribunal',[0,-.1,0],[4,.5,3],2,layer='Estrado')
        elif kind=='cofre':
            m.part('Caixa',[0,.6,0],[2,1.2,1],0);m.part('Tampa',[0,1.25,0],[2.1,.15,1.1],0,layer='Tampa');m.part('Fecho',[0,.8,.55],[.2,.35,.06],6,layer='Fecho')
        else:
            m.part('Plataforma',[0,.6,0],[1.6,.15,1.2],0)
            for z in [-.8,.8]:m.part('Roda',[0,.55,z],[1.2,.2,1.2],0,kind='torus',rotation=[math.sin(math.pi/4),0,0,math.cos(math.pi/4)],layer='Rodas')
            for z in [-.45,.45]:beam(m,'Timão',[0,.6,z],[2.4,.4,z],.1,0)
            m.part('Anteparo',[.6,1,0],[.15,.9,1.2],0)
    elif kind in ['torre','fortaleza','cidade','templo_zorobabel','templo_visao','nova_jerusalem']:
        ground(m,8)
        if kind=='torre':
            for z in [-1,1]:m.part('Parede',[0,2,z],[2,4,.3],2)
            for x in [-1,1]:m.part('Parede',[x,2,0],[.3,4,2],2)
            m.part('Plataforma superior',[0,4,0],[2.5,.2,2.5],2,layer='Plataforma')
        elif kind in ['fortaleza','cidade','nova_jerusalem']:
            for s in [-1,1]:
                for axis in [0,2]:
                    p=[0,.7,0];p[axis]=s*3;m.part('Muralha',p,[.25,1.4,6] if axis==0 else [6,1.4,.25],1 if kind=='nova_jerusalem' else 2,layer='Muralhas')
            for x in [-3,3]:
                for z in [-3,3]:m.part('Torre',[x,1.2,z],[.8,2.4,.8],2,layer='Torres')
            if kind=='nova_jerusalem':
                for i in range(12):
                    a=i*math.pi/6;m.part('Porta simbólica',[math.cos(a)*2.9,.5,math.sin(a)*2.9],[.4,1,.3],12,layer='Doze portas')
                m.part('Rio simbólico',[0,.05,0],[.6,.02,5],5,layer='Rio')
            else:
                for x in [-1,1]:
                    for z in [-1,1]:m.part('Edificação',[x,.6,z],[1,1.2,1],2,layer='Edificações')
        else:
            for z in [-1,1]:m.part('Parede do santuário',[0,1.5,z],[4,3,.3],2)
            m.part('Parede posterior',[-2,1.5,0],[.3,3,2],2);m.part('Teto',[0,3.1,0],[4.4,.2,2.4],7,layer='Cobertura')
            m.part('Divisão ilustrativa',[-.7,1.5,0],[.1,3,2],3,layer='Interior')
            if kind=='templo_visao':
                for z in [-3,3]:m.part('Pátio da visão',[0,.1,z],[7,.15,1],2,layer='Pátios')
    elif kind in ['montanha','deserto','rio','mar','estrada','rocha','caverna','tumulo','jardim','nuvens','flores','videira','uvas','escalas','ossos','serpente_bronze','escudo','elmo','armadura','espada','lanca','arco','funda','estadio','fruto_ouro','grade_telhado','pedras_memoria','porta_casa','inscricao']:
        if kind in ['montanha','rocha','deserto','caverna','tumulo']:
            ground(m,7)
            if kind in ['montanha','rocha','deserto']:
                for i in range(5):m.part('Relevo ilustrativo',[(i%3-1)*1.5,.6+(i%2)*.7,(i//3-.5)*2],[3,2+(i%2)*2,3],15 if kind=='deserto' else 2,kind='sphere',layer='Relevo')
            else:
                for x in [-1.5,1.5]:m.part('Rocha lateral',[x,1.2,0],[2,2.4,3],2,kind='sphere',layer='Rocha')
                m.part('Rocha superior',[0,2.5,0],[4.5,1.2,3],2,kind='sphere',layer='Rocha')
                if kind=='tumulo':
                    m.part('Pedra removível',[1,.6,1.5],[1.6,.3,1.6],2,kind='cylinder',rotation=[math.sin(math.pi/4),0,0,math.cos(math.pi/4)],layer='Pedra da entrada');m.part('Banco funerário',[0,.3,0],[2,.4,.8],2,layer='Interior')
        elif kind in ['rio','mar','estrada','jardim']:
            ground(m,8,5 if kind=='mar' else 15)
            if kind!='mar':m.part('Canal' if kind=='rio' else 'Caminho',[0,.02,0],[1.5,.05,8],5 if kind=='rio' else 2,layer='Trajeto')
            if kind=='jardim':
                for i in range(8):m.part('Canteiro',[(i%4-1.5)*1.5,.2,(i//4-.5)*3],[1,.4,1],9,kind='sphere',layer='Vegetação')
        elif kind=='nuvens':
            for i in range(8):m.part('Nuvem simbólica',[(i%4-1.5)*.8,1+(i%2)*.2,(i//4)*.6],[1.5,.7,1],12,kind='sphere',layer='Nuvens')
        elif kind=='flores':
            for i in range(6):
                x=(i%3-1)*.8;z=(i//3-.5)*.8;beam(m,'Haste',[x,0,z],[x,1,z],.04,9)
                for j in range(5):
                    a=j*2*math.pi/5;m.part('Pétala',[x+math.cos(a)*.17,1,z+math.sin(a)*.17],[.25,.09,.25],12,kind='sphere',layer='Flores')
        elif kind in ['videira','uvas']:
            if kind=='videira':
                for x in [-1,1]:beam(m,'Estaca',[x,0,0],[x,1.5,0],.09,0)
                beam(m,'Ramo',[-1,1.3,0],[1,1.3,0],.1,0,'Ramos')
            for i in range(12):m.part('Uva',[(i%3-1)*.22,1.2-(i//3)*.22,((i//3)%2)*.15],[.24,.24,.24],14,kind='sphere',layer='Frutos')
            if kind=='videira':
                for x in [-.8,.8]:m.part('Folha',[x,1.3,0],[.55,.08,.45],9,kind='sphere',layer='Folhagem')
        elif kind=='escalas':
            for i in range(20):m.part('Placa simbólica',[(i%5-2)*.3,.2,(i//5-1.5)*.25],[.5,.12,.4],6,kind='sphere',layer='Placas')
        elif kind=='ossos':
            for i in range(9):
                x=(i%3-1)*.7;z=(i//3-1)*.7;beam(m,'Osso estilizado',[x-.25,.1,z],[x+.25,.1,z],.1,3,'Ossos')
                for dx in [-.25,.25]:m.part('Extremidade',[x+dx,.1,z],[.2,.17,.2],3,kind='sphere',layer='Ossos')
        elif kind=='serpente_bronze':
            beam(m,'Haste',[0,0,0],[0,2.5,0],0.1,0)
            for i in range(18):
                a=i*math.pi/5;b=(i+1)*math.pi/5;beam(m,'Serpente estilizada',[math.cos(a)*.25,.8+i*.08,math.sin(a)*.25],[math.cos(b)*.25,.8+(i+1)*.08,math.sin(b)*.25],.1,6,'Serpente')
        elif kind in ['elmo','escudo','armadura']:
            if kind=='elmo':m.part('Calota',[0,1,0],[1.1,.8,1],11,kind='sphere');m.part('Aba',[0,.75,0],[1.4,.1,1.2],11,kind='sphere')
            elif kind=='escudo':m.part('Face do escudo',[0,1,0],[1.5,2,.15],6,kind='sphere');m.part('Reforço central',[0,1,.08],[.35,.35,.15],6,kind='sphere',layer='Reforço')
            else:
                m.part('Peitoral sem figura humana',[0,1.4,0],[1.3,1.4,.35],11,kind='sphere',layer='Peitoral');m.part('Cinturão',[0,.8,0],[1.4,.15,.4],0,layer='Cinturão')
                for x in [-.4,.4]:m.part('Greva',[x,.35,0],[.35,.7,.3],11,layer='Grevas')
        elif kind in ['espada','lanca','arco','funda']:
            if kind in ['espada','lanca']:
                beam(m,'Empunhadura',[0,0,0],[0,.8 if kind=='espada' else 2.4,0],.12,0)
                m.part('Lâmina esquemática',[0,1.4 if kind=='espada' else 2.65,0],[.18,1.2 if kind=='espada' else .5,.05],11,layer='Metal')
                if kind=='espada':m.part('Guarda',[0,.8,0],[.6,.08,.08],11,layer='Metal')
            elif kind=='arco':
                for i in range(18):
                    a=-math.pi/2+i*math.pi/18;b=-math.pi/2+(i+1)*math.pi/18;beam(m,'Arco',[math.cos(a)*.8,1+math.sin(a),0],[math.cos(b)*.8,1+math.sin(b),0],.06,0)
                beam(m,'Corda',[0,0,0],[0,2,0],.02,8,'Corda')
            else:
                m.part('Bolsa de couro',[0,.4,0],[.5,.04,.3],0,kind='sphere');beam(m,'Correia',[-.2,.4,0],[-1.5,.4,0],.025,8,'Correias');beam(m,'Correia',[.2,.4,0],[1.5,.4,0],.025,8,'Correias')
        elif kind=='estadio':
            m.part('Pista',[0,.05,0],[7,.15,5],15,kind='torus',layer='Pista')
            for i in range(4):m.part('Arquibancada',[0,.2+i*.25,0],[8+i*.6,.5,6+i*.6],2,kind='torus',layer='Arquibancada')
        elif kind=='fruto_ouro':
            m.part('Salva',[0,.1,0],[2,.1,1.4],11,kind='sphere',layer='Salva')
            for x in [-.5,0,.5]:m.part('Fruto simbólico',[x,.4,0],[.5,.5,.5],1,kind='sphere',layer='Frutos')
        elif kind=='grade_telhado':
            m.part('Terraço',[0,0,0],[4,.2,3],2)
            for z in [-1.5,1.5]:m.part('Parapeito',[0,.5,z],[4,1,.15],2,layer='Parapeito')
            for x in [-2,2]:m.part('Parapeito',[x,.5,0],[.15,1,3],2,layer='Parapeito')
        elif kind=='pedras_memoria':
            for i in range(12):m.part('Pedra memorial',[(i%4-1.5)*.6,.25+(i//4)*.2,(i//4-1)*.5],[.6,.6,.55],2,kind='sphere',layer='Pedras')
        elif kind=='porta_casa':
            for x in [-.7,.7]:beam(m,'Ombreira',[x,0,0],[x,2.5,0],.2,0)
            beam(m,'Verga',[-.7,2.5,0],[.7,2.5,0],.2,0);m.part('Folha da porta',[0,1.2,0],[1.2,2.4,.08],0,layer='Porta')
        else:
            m.part('Parede',[0,1,0],[4,2,.3],2)
            for i in range(3):m.part('Linha sem palavras reconstruídas',[0,1.2+i*.2,.17],[2.5,.035,.01],16,layer='Inscrição')
    else:raise ValueError('Unknown geometry '+kind)


# Distinct models, with reusable geometric vocabulary. No renamed duplicate files.
definitions='''
oliveira|Oliveira|Plantas e paisagens
palmeira|Palmeira|Plantas e paisagens
figueira|Figueira|Plantas e paisagens
amendoeira|Amendoeira|Plantas e paisagens
sicômoro|Sicômoro|Plantas e paisagens
videira|Videira e seus ramos|Plantas e paisagens
uvas|Cacho de uvas|Plantas e paisagens
flores|Flores do campo|Plantas e paisagens
campo|Campo de cereais|Plantas e paisagens
feixes|Feixes de colheita|Plantas e paisagens
jardim|Jardim e canteiros|Plantas e paisagens
montanha|Relevo montanhoso|Plantas e paisagens
deserto|Paisagem árida|Plantas e paisagens
rio|Rio e margens|Plantas e paisagens
mar|Superfície do mar|Plantas e paisagens
estrada|Caminho e deslocamento|Plantas e paisagens
rocha|Rochedos|Plantas e paisagens
nuvens|Nuvens|Plantas e paisagens
ovelha|Ovelha|Animais
cordeiro|Cordeiro|Animais
boi|Boi|Animais
cervo|Cervo|Animais
pomba|Pomba|Animais
leao|Leão|Animais
peixe|Peixe|Animais
peixe_grande|Grande animal aquático — forma genérica|Animais
aguia|Águia estilizada|Animais
gafanhoto|Gafanhoto|Animais
barco|Barco de pesca|Navegação e viagens
navio|Embarcação mercante|Navegação e viagens
naufragio|Embarcação e naufrágio|Navegação e viagens
jarro|Jarro de armazenamento|Vida cotidiana
oleo|Jarro de azeite|Vida cotidiana
vaso|Vaso de barro|Vida cotidiana
copo|Copo e recipiente de bebida|Vida cotidiana
pote|Panela e recipiente de cozinha|Vida cotidiana
odres|Odres — esquema de recipiente flexível|Vida cotidiana
bacia|Bacia e pedestal|Santuário e arquitetura
mar_bronze|Mar de bronze — esquema dos suportes|Santuário e arquitetura
tacas|Sete taças — símbolo da visão|Visões e símbolos
cesto|Cesto trançado|Vida cotidiana
cesto_frutos|Cesto de frutos|Vida cotidiana
pao|Pães|Vida cotidiana
incenso|Incensário|Santuário e arquitetura
lampada|Lâmpada de azeite|Vida cotidiana
sete_lampadas|Sete candeeiros separados|Visões e símbolos
candelabro|Candelabro de sete lâmpadas|Santuário e arquitetura
pergaminho|Rolo de escrita|Escrita e documentos
sete_selos|Rolo com sete selos|Visões e símbolos
carta|Carta e cálamo|Escrita e documentos
papiro|Folha de escrita e tinta|Escrita e documentos
tinta|Tinteiro e cálamo|Escrita e documentos
tabuas|Tábuas de pedra|Escrita e documentos
documento|Documento escrito|Escrita e documentos
vara|Vara e instrumento de medição|Vida cotidiana
cajado|Cajado|Vida cotidiana
prumo|Prumo|Vida cotidiana
jugo|Jugo|Vida cotidiana
escada|Escada|Vida cotidiana
corrente|Corrente e elos|Vida cotidiana
balanca|Balança de dois pratos|Vida cotidiana
moedas|Moedas sem inscrição reconstruída|Vida cotidiana
metais|Metais e pesos|Vida cotidiana
colar|Colar de contas|Vida cotidiana
cetro|Cetro real|Vida cotidiana
trono|Assento real|Vida cotidiana
roupa|Vestes sacerdotais sem figura humana|Santuário e arquitetura
trombeta|Trombeta|Instrumentos musicais
flauta|Flauta|Instrumentos musicais
tambor|Tambor de aro|Instrumentos musicais
cimbalos|Címbalos|Instrumentos musicais
rede|Rede e sua trama|Vida cotidiana
peneira|Peneira — esquema de trama|Vida cotidiana
tecido|Tecido e trama|Vida cotidiana
tear|Tear|Vida cotidiana
fuso|Fuso de fiar|Vida cotidiana
poco|Poço e corda|Vida cotidiana
cisterna|Cisterna|Vida cotidiana
piscina|Tanque de água|Vida cotidiana
fonte|Nascente e canal|Plantas e paisagens
moinho|Mó e moinho manual|Trabalho e produção
eira|Eira e feixes|Trabalho e produção
celeiro|Depósito de cereais|Trabalho e produção
lagar|Lagar e tanque de coleta|Trabalho e produção
forno|Forno de barro|Trabalho e produção
fornalha|Fornalha — esquema aberto|Trabalho e produção
bigorna|Bigorna e ferramentas de metal|Trabalho e produção
roda_oleiro|Roda de oleiro|Trabalho e produção
tijolos|Tijolos e alvenaria|Trabalho e produção
mina|Galeria de mineração|Trabalho e produção
tenda|Tenda|Santuário e arquitetura
acampamento|Acampamento|Santuário e arquitetura
manjedoura|Manjedoura vazia|Vida cotidiana
leito|Leito e esteira|Vida cotidiana
mesa|Mesa|Vida cotidiana
banquete|Mesa de refeição|Vida cotidiana
cofre|Cofre e tampa|Vida cotidiana
carro|Carro de duas rodas|Navegação e viagens
tribunal|Estrado de tribunal|Santuário e arquitetura
muralha|Muralha|Santuário e arquitetura
portao|Portão e torres|Santuário e arquitetura
ruinas|Alvenaria em ruínas|Santuário e arquitetura
torre|Torre de vigia|Santuário e arquitetura
fortaleza|Fortaleza|Santuário e arquitetura
cidade|Cidade murada — planta genérica|Santuário e arquitetura
templo_zorobabel|Segundo Templo — fase de Zorobabel|Santuário e arquitetura
templo_visao|Santuário na visão de Ezequiel|Visões e símbolos
nova_jerusalem|Nova Jerusalém — esquema simbólico|Visões e símbolos
caverna|Caverna|Plantas e paisagens
tumulo|Sepulcro escavado — hipótese ilustrativa|Santuário e arquitetura
escalas|Escamas como placas — imagem poética|Visões e símbolos
ossos|Ossos secos — imagem da visão|Visões e símbolos
serpente_bronze|Serpente de bronze — objeto do relato|Santuário e arquitetura
escudo|Escudo|Equipamentos históricos
elmo|Elmo|Equipamentos históricos
armadura|Peitoral e grevas sem figura humana|Equipamentos históricos
espada|Espada — esquema de identificação|Equipamentos históricos
lanca|Lança — esquema de identificação|Equipamentos históricos
arco|Arco — esquema de identificação|Equipamentos históricos
funda|Funda — esquema de identificação|Equipamentos históricos
estadio|Pista de corrida e arquibancada|Santuário e arquitetura
fruto_ouro|Frutos de ouro em salva — imagem poética|Visões e símbolos
grade_telhado|Terraço e parapeito|Santuário e arquitetura
pedras_memoria|Doze pedras memoriais|Santuário e arquitetura
porta_casa|Ombreiras, verga e porta|Santuário e arquitetura
inscricao|Parede e espaço para inscrição|Escrita e documentos
'''.strip()

descriptions={
 'peixe_grande':'Forma genérica para explorar o relato de Jonas. O texto não fornece uma identificação zoológica nem dimensões que permitam reconstruir o animal.',
 'templo_zorobabel':'Edificação genérica para estudar a reconstrução narrada em Esdras e Ageu. É distinta da fase herodiana. Esta planta não é uma restituição arqueológica da construção de Zorobabel.',
 'templo_visao':'Santuário ilustrativo para a visão de Ezequiel 40–48. A classificação como visão permanece visível; a geometria não resolve as divergências reformadas sobre sua interpretação.',
 'nova_jerusalem':'Muralhas, doze portas e rio em esquema simbólico de Apocalipse 21–22. A cena não representa Deus, Cristo ou pessoas glorificadas e não procura localizar geograficamente a visão.',
 'sete_lampadas':'Sete suportes separados, conforme a imagem de Apocalipse 1. Não confundir com um único candelabro de sete braços.',
 'serpente_bronze':'Esquema do objeto narrado em Números 21:9. Consulte também 2 Reis 18:4 sobre sua destruição. A representação serve à leitura histórica e não ao culto.',
 'manjedoura':'Recipiente de alimentação animal vazio, associado a Lucas 2:7. Não contém representação de Jesus, de Maria ou de outros personagens.',
 'tabuas':'Tábuas lisas com linhas simbólicas. Nenhuma grafia original ou composição dos mandamentos é afirmada pela geometria.',
 'escalas':'Placas estilizadas para examinar a linguagem poética de Jó 41:15. Não identifica com certeza a espécie ou a anatomia do Leviatã.',
 'ossos':'Elementos ósseos abstratos para o estudo da visão de Ezequiel 37. A interpretação deve ser examinada no texto e nas fontes confessionais.',
 'candelabro':'Sete lâmpadas em um suporte esquemático. Êxodo 25:31–40 fundamenta o estudo; ornamentação e junções desta geometria são ilustrativas.',
}
by_id={m.id:m for m in M}
# Correct the Noah model's convention: 300 × 50 × 30 cubits at 0.5 m/cubit.
for node in by_id['arca_noe'].nodes:
    node['translation']=[v*5 for v in node['translation']];node['scale']=[v*5 for v in node['scale']]
# Ezra describes an earlier construction phase, not the later Herodian complex.
by_id['segundo_templo'].refs=['43:2:20','41:13:1']
for line in definitions.splitlines():
    id,title,category=line.split('|');m=Model(id,title,descriptions.get(id,f'{title}: geometria original para leitura das passagens indicadas. Forma, escala, materiais e detalhes não especificados são escolhas didáticas; consulte a indicação de objeto, contexto, metáfora ou visão em cada associação.'),[])
    m.category=category;geometry_for(m,id)
    if id=='cordeiro':
        for node in m.nodes:
            node['scale']=[v*.65 for v in node['scale']];node['translation']=[v*.65 for v in node['translation']]
    M.append(m);by_id[id]=m

# One editorial association per four-chapter block. @ chapter:verse;
# t = textual object, c = cultural context, m = metaphor/poetry, v = vision.
coverage={
1:'jardim@2:9 arca_noe@6:14 torre@11:4 tenda@13:18 tenda@18:1 poco@21:25 escada@28:12 ovellha@29:2 altar@33:20 cisterna@37:24 celeiro@41:49 carro@46:29 tumulo@50:13',
2:'cesto@2:3 tijolos@5:7 cordeiro@12:3 pao@16:14 montanha@19:18 tabuas@24:12 arca_alianca@25:10 bacia@30:18 tabernaculo@35:11 candelabro@37:17',
3:'altar@1:5 roupa@8:7 altar@9:9 habitacao@14:34 campo@19:9 lampada@24:2 balanca@25:14:c',
4:'acampamento@2:2 candelabro@8:2 trombeta@10:2 uvas@13:23 vara@17:8 serpente_bronze@21:9 altar@28:2 ovellha@32:16 estrada@33:1:c',
5:'tabuas@4:13 porta_casa@6:9 arca_alianca@10:3 tenda@16:13 pergaminho@17:18 grade_telhado@22:8 cesto@26:2 pergaminho@31:24 montanha@34:1',
6:'pedras_memoria@4:20 muralha@6:20 odres@9:4 cidade@15:21 cidade@20:2 altar@22:10',
7:'carro@4:3 jarro@7:16 moinho@9:53 habitacao@16:29 estrada@19:10 videira@21:20',
8:'campo@2:2',
9:'arca_alianca@4:4 arca_alianca@5:2 altar@10:8 harpa@16:23 funda@17:49 pao@21:6 ovellha@25:2 escudo@31:10',
10:'trono@3:10 cidade@5:7 mesa@9:7 portao@15:2 pedras_memoria@18:17:c eira@24:18',
11:'banquete@4:22 templo_salomao@6:2 trono@10:18 altar@13:1 oleo@17:14 videira@21:1',
12:'oleo@4:1 rio@5:14 carro@9:16 altar@16:10 muralha@19:21 prumo@21:13 ruinas@25:9',
13:'tear@4:21 campo@5:9:c portao@9:22 arca_alianca@13:3 tenda@17:1 altar@21:26 harpa@25:1 metais@29:7',
14:'mar_bronze@4:2 templo_salomao@5:1 trono@9:17 acampamento@13:7:c harpa@20:28 cofre@24:8 torre@26:9 cordeiro@30:15 templo_zorobabel@36:23:c',
15:'templo_zorobabel@3:10 templo_zorobabel@6:15 templo_zorobabel@10:1',
16:'muralha@3:1 pergaminho@8:1 harpa@12:27 portao@13:19',
17:'banquete@1:3 cetro@5:2 carta@9:29',
18:'ovellha@1:3 balanca@6:2:m vaso@10:9:m rocha@14:19 lampada@18:6:m campo@24:6 mina@28:1 portao@29:7 vaso@33:6:m mar@38:8:m escalas@41:15:m',
19:'oliveira@1:3:m leito@6:6 arco@11:2:m tacas@16:5:m fortaleza@18:2:m cajado@23:4:m altar@26:6 cervo@29:9 harpa@33:2 pergaminho@40:7 montanha@43:3 montanha@46:3 oliveira@52:8:m pomba@55:6:m harpa@57:8 torre@61:3:m campo@65:13 balanca@72:2:c tabernaculo@73:17:c videira@80:8:m trombeta@81:3 montanha@87:1 palmeira@92:12:m mar@93:3 portao@100:4 oliveira@104:16 tenda@106:25 pao@111:5 tacas@116:13:m lampada@119:105:m montanha@121:1 feixes@126:6 tabernaculo@132:13:c oleo@133:2:m harpa@137:2 incenso@141:2:m oliveira@148:9 cimbalos@150:5',
20:'colar@1:9:m cisterna@5:15:m habitacao@9:1:m balanca@16:11 balanca@20:23 habitacao@24:3:m fruto_ouro@25:11:m fuso@31:19',
21:'jardim@3:2:c campo@5:9 poco@12:6:m',
22:'fonte@4:15:m videira@7:12',
23:'boi@1:3 lagar@5:2:m vara@10:5:m cidade@16:14 campo@17:5:m torre@21:8 eira@28:28 roda_oleiro@29:16:m deserto@35:1:m ovellha@40:11:m bigorna@44:12 vaso@45:9:m tacas@51:17:m ovellha@53:7:m muralha@60:10 jardim@61:11:m jardim@65:17:v',
24:'amendoeira@1:11:v bigorna@6:28:m madeira@10:3:c tecido@13:1 roda_oleiro@18:3 cesto_frutos@24:2:v jugo@27:2 documento@32:10 pergaminho@36:2 cisterna@38:6 tijolos@43:9 lagar@48:33 templo_salomao@52:17',
25:'ruinas@1:1:c campo@5:2',
26:'cidade@4:1 balanca@5:1 templo_visao@10:3:v videira@15:2:m aguia@17:3:m pote@24:3:m navio@27:5 rede@29:4:m campo@34:14:m ossos@37:1:v templo_visao@41:1:v rio@47:1:v',
27:'banquete@1:5 inscricao@5:5 templo_zorobabel@9:17:c',
28:'videira@2:15:m forno@7:4:m jugo@10:11:m flores@14:5:m',
29:'gafanhoto@1:4',
30:'altar@3:14 cesto_frutos@8:1:v peneira@9:9:m',
31:'montanha@1:3',
32:'navio@1:3',
33:'videira@4:4 balanca@6:11',
34:'carro@2:3',
35:'torre@2:1',
36:'habitacao@1:13',
37:'templo_zorobabel@1:8',
38:'candelabro@4:2:v pergaminho@5:1:v moedas@11:12 montanha@14:4:v',
39:'altar@1:7',
40:'pergaminho@4:4:c lampada@5:15:m campo@12:1 rede@13:47:m moedas@17:27 lagar@21:33:m lampada@25:1:m',
41:'barco@4:35 pao@6:41 videira@12:1:m tumulo@15:46',
42:'manjedoura@2:7 barco@5:2 lampada@11:33:m torre@14:28:m sicômoro@19:4 tumulo@24:2',
43:'jarro@2:6 piscina@5:2 porta_casa@10:7:m bacia@13:5 tumulo@20:1 rede@21:6',
44:'segundo_templo@3:2 carro@8:28 cesto@9:25 navio@13:4 barco@20:13 tribunal@24:10 naufragio@27:41',
45:'pomba@1:23:c tumulo@6:4:m oliveira@11:17:m armadura@13:12:m',
46:'habitacao@3:10:m pao@5:7:m estadio@9:24:m campo@15:37:m',
47:'vaso@4:7:m tenda@5:1:m fortaleza@10:4:m carta@13:10:c',
48:'pergaminho@3:8:c campo@6:7:m',
49:'templo_salomao@2:21:m armadura@6:13:m',
50:'corrente@1:13',
51:'carta@4:16',
52:'trombeta@4:16:v elmo@5:8:m',
53:'carta@3:17',
54:'pergaminho@4:13:c moedas@6:10',
55:'corrente@1:16',
56:'jugo@3:3:c',
57:'corrente@1:13:c',
58:'espada@4:12:m altar@7:27 tabernaculo@9:2 altar@13:10:m',
59:'balanca@2:1:c campo@5:7:m',
60:'templo_salomao@2:5:m leao@5:8:m',
61:'corrente@2:4:m',
62:'oleo@2:27:c carta@5:13:c',
63:'papiro@1:12',
64:'tinta@1:13',
65:'nuvens@1:12:m',
66:'sete_lampadas@1:12:v sete_selos@5:1:v vara@11:1:v tacas@15:7:v corrente@20:1:v nova_jerusalem@21:12:v',
}
# Typographic aliases only; no duplicate geometry.
aliases={'ovellha':'ovelha','madeira':'bigorna'}
names={'t':'Objeto no texto','c':'Contexto cultural','m':'Metáfora ou linguagem poética','v':'Visão e símbolo'}
explanations={
 't':'O recurso permite examinar um objeto, lugar ou elemento mencionado nesta passagem. A forma e os detalhes não especificados são ilustrativos.',
 'c':'Ilustração de contexto para estudar a passagem. O objeto específico desta cena não é afirmado pelo versículo; não se trata de uma reconstrução comprovada.',
 'm':'A passagem usa imagem, comparação ou linguagem poética. A cena ajuda a reconhecer a imagem e não transforma a metáfora em acontecimento ou objeto literal.',
 'v':'Associação a uma visão ou linguagem simbólica. A cena não é uma fotografia de um acontecimento histórico nem decide entre interpretações escatológicas.',
}
c=sqlite3.connect(R/'assets/content/catalogue.sqlite')
chapters=dict(c.execute("SELECT book,MAX(chapter) FROM verses WHERE translation='BLN4' GROUP BY book"))
scenes=[]
for book,tokens in coverage.items():
    tokens=tokens.split();expected=(chapters[book]+3)//4
    assert len(tokens)==expected,(book,len(tokens),expected)
    for i,token in enumerate(tokens):
        model_id,anchor=token.split('@');model_id=aliases.get(model_id,model_id)
        if model_id=='tacas' and book!=66:model_id='copo'
        fields=anchor.split(':');ch,verse=map(int,fields[:2]);mode=fields[2] if len(fields)>2 else 't'
        start=i*4+1;end=min(start+3,chapters[book]);ref=f'{book}:{ch}:{verse}'
        assert start<=ch<=end,(book,token,start,end)
        assert c.execute("SELECT 1 FROM verses WHERE translation='BLN4' AND reference=?",(ref,)).fetchone(),ref
        assert model_id in by_id,model_id
        model=by_id[model_id]
        if ref not in model.refs:model.refs.append(ref)
        scenes.append({'id':f'block-{book}-{start}','book':book,'start_chapter':start,'end_chapter':end,'items':[{'model_id':model_id,'reference':ref,'kind':mode,'genre':names[mode],'explanation':explanations[mode]}]})

# Further relevant resources within blocks, adding variety rather than unrelated filler.
extras=[('1:2:9','figueira','c'),('4:21:9','serpente_bronze','t'),('11:7:23','mar_bronze','t'),('11:7:18','templo_salomao','t'),('12:18:4','serpente_bronze','t'),('19:150:4','tambor','t'),('19:150:4','flauta','t'),('26:47:12','jardim','v'),('32:1:17','peixe_grande','t'),('40:27:60','tumulo','t'),('41:2:4','habitacao','t'),('43:15:1','videira','m'),('46:9:24','estadio','m'),('59:1:23','espelho','m'),('66:22:2','oliveira','c')]
# A mirror has reflective material and its own distinct shape.
m=Model('espelho','Espelho polido','Disco metálico em esquema para a comparação de Tiago 1:23. Não é espelho moderno de vidro. Os detalhes de borda e empunhadura são ilustrativos.',[]);m.category='Vida cotidiana';m.part('Superfície polida',[0,1,0],[1.2,1.2,.05],11,kind='sphere',layer='Disco');beam(m,'Empunhadura',[0,0,0],[0,.45,0],.12,0);M.append(m);by_id[m.id]=m
for ref,id,mode in extras:
    book,ch,_=map(int,ref.split(':'));block=next(s for s in scenes if s['book']==book and s['start_chapter']<=ch<=s['end_chapter'])
    if not any(item['model_id']==id for item in block['items']):block['items'].append({'model_id':id,'reference':ref,'kind':mode,'genre':names[mode],'explanation':explanations[mode]})
    if ref not in by_id[id].refs:by_id[id].refs.append(ref)

# Other catalogue entries still have genuine anchor passages; these are searchable
# without manufacturing an artificial association for every object in every block.
anchors={'pote':'12:4:38','vaso':'47:4:7','odres':'40:9:17','incenso':'19:141:2','cetro':'17:5:2','flauta':'19:150:4','tambor':'19:150:4','rede':'43:21:6','peneira':'30:9:9','leito':'19:6:6','lanca':'9:17:7','espada':'58:4:12','arco':'19:11:2','elmo':'52:5:8','rocha':'19:18:2','jardim':'1:2:8','tinta':'64:1:13','documento':'24:32:10','roupa':'2:28:4','tecido':'24:13:1','fornalha':'27:3:6','caverna':'9:24:3','fonte':'22:4:15','fruto_ouro':'20:25:11','papiro':'63:1:12','tacas':'66:15:7','peixe':'43:21:9','cordeiro':'2:12:3','candelabro':'2:25:31','cidade':'6:20:2','piscina':'43:5:2','montanha':'5:34:1','metais':'13:29:7'}
for id,m in by_id.items():
    if not m.refs:
        if id not in anchors:raise ValueError('Missing anchor for '+id)
        m.refs.append(anchors[id])
    for ref in m.refs:
        assert c.execute("SELECT 1 FROM verses WHERE translation='BLN4' AND reference=?",(ref,)).fetchone(),(id,ref)
    for node in m.nodes:node['extras']['references']=m.refs
entries=[m.save() for m in M]
assert len({e['id'] for e in entries})==len(entries)
assert len({hashlib.sha256((O/e['file']).read_bytes()).hexdigest() for e in entries})==len(entries)
(O/'models.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
data={'version':1,'translation_basis':'BLN4','editorial_author':'Kelvin e Silva Marques','chapter_interval':4,'books':66,'chapters':sum(chapters.values()),'blocks':len(scenes),'models':len(entries),'scenes':scenes,'methodology':'Cada bloco de até quatro capítulos possui uma associação editorial ancorada em uma passagem real. Recursos podem reaparecer quando o texto retoma o objeto. Objeto, contexto cultural, metáfora e visão são distinguídos; não há representação de Deus ou de Cristo.'}
(R/'assets/content/model-scenes.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))

# Unified offline search includes models and passage associations.
for e in entries:
    ident='model:'+e['id'];body=e['description']+'\n'+e['certainty']+'\n'+' · '.join(e['references'])
    c.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?,?,?)',(ident,'APP-3D','model_index',e['title'],body,e['references'][0],json.dumps({'model_id':e['id'],'references':e['references']},ensure_ascii=False)))
c.execute("DELETE FROM document_search WHERE id LIKE 'model:%'")
c.execute("INSERT INTO document_search SELECT id,title,body FROM documents WHERE module_id='APP-3D'")
c.execute('INSERT OR REPLACE INTO content_modules VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',('APP-3D','Acervo 3D e associações bíblicas','model_collection','pt','1.0','Kelvin e Silva Marques','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/','Referências bíblicas indicadas; geometria original do projeto.',1,1,json.dumps({'models':len(entries),'blocks':len(scenes),'chapter_interval':4})))
c.commit();c.close()
p=R/'assets/content/catalogue.sqlite';p.with_suffix('.sha256').write_text(hashlib.sha256(p.read_bytes()).hexdigest())
print(json.dumps({'models':len(entries),'chapter_blocks':len(scenes),'chapters':sum(chapters.values()),'bytes':sum((O/e['file']).stat().st_size for e in entries)},ensure_ascii=False))
