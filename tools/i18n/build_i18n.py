# English for everything on screen (ES -> EN). Spanish in the game code is the source text.
# When you add or change a Spanish text, add its English here:
#   EN  exact strings · P  texts with numbers (regex) · H  whole tutorial lines (with <b>) · VO subtitles come from vo_en.py
# then run   python3 tools/i18n/build_i18n.py   — it rewrites the i18n block inside public/i18n.js.
import json, re, sys, os, glob
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0,HERE)
from vo_en import VO_EN
I18N_JS=os.path.join(ROOT,'public','i18n.js')
rd=lambda p:open(p,encoding='utf-8').read()
# all the game's source text: page markup, game code and the language script
b=rd(os.path.join(ROOT,'index.html'))+''.join(rd(f) for f in sorted(glob.glob(os.path.join(ROOT,'src','game','*.js'))))+rd(I18N_JS)

EN={
# --- v66 phone tutorial ---
'MUÉVETE':'MOVE','MIRA Y DISPARA':'AIM AND SHOOT','RECOGE Y DEPOSITA':'COLLECT AND DEPOSIT','TRAJE Y NAVE':'SUIT AND SHIP',
'PULGAR IZQUIERDO':'LEFT THUMB','ARRASTRA = GIRAS':'DRAG = TURN','MANTÉN':'HOLD','TOCA PARA SEGUIR':'TAP TO CONTINUE',
'¡A JUGAR!':"LET'S PLAY!",'CÓMO SE JUEGA':'HOW TO PLAY',
# --- HUD ---
'TRICOMAS':'TRICHOMES','TRICOMAS ·':'TRICHOMES ·','TRICOMAS A BORDO':'TRICHOMES ABOARD','TRICOMAS RECOGIDOS':'TRICHOMES COLLECTED',
'PUNTUACIÓN':'SCORE','BAJAS':'KILLS','TANQUE':'TANK','TRAJE':'SUIT','NAVE':'SHIP','RACHA':'STREAK','RECARGANDO':'RECHARGING',
'FUGAS SELLADAS':'LEAKS SEALED','RESPIRO':'BREATHER','CALMA':'CALM','RONDA':'ROUND','CARGA':'CARGO','COMBATE':'COMBAT','PUNTOS':'POINTS',
'DESCARGANDO…':'UNLOADING…','LLENO · VE A BODEGA':'FULL · GO TO THE HOLD','LLÉVALOS A LA BODEGA':'TAKE THEM TO THE HOLD',
'BODEGA':'HOLD','DEPOSITAR':'DEPOSIT','FLOTANDO':'FLOATING','A BORDO':'ABOARD','PERDIDA':'LOST','PERDIDOS':'LOST',
'CABINA':'COCKPIT','REACTOR':'REACTOR','MOTORES':'ENGINES','MOTOR':'ENGINE','ESCUPIDORA':'SPITTER','INCINERADORA':'INCINERATOR',
'PILOTO':'PILOT','INGENIERÍA':'ENGINEERING','Carga asegurada':'Cargo secured','DESCARGANDO EN LA BODEGA':'UNLOADING IN THE HOLD',
'ARAÑAS ENCIMA':'SPIDERS ON IT','▼ FUGA · recógelos y llévalos a la bodega':'▼ LEAK · collect them and take them to the hold',
'Haz clic para capturar el ratón · Esc para soltarlo':'Click to capture the mouse · Esc to release it',
'CLIC O ENTER PARA SALTAR':'CLICK OR ENTER TO SKIP','SALTAR':'SKIP','Saltar la intro':'Skip the intro',
'CARGANDO':'LOADING','JUGAR':'PLAY','REINTENTAR':'RETRY','No se pudieron cargar los modelos. Recarga la página.':'Could not load the models. Reload the page.',
# --- tips ---
'CLIC IZQ.':'LEFT CLICK','CLIC DER.':'RIGHT CLICK','DISPARAR':'SHOOT','Apunta a las arañas con la mira':'Aim at the spiders with the crosshair',
'ASPIRAR TRICOMAS':'VACUUM TRICHOMES','Apunta la boquilla al polvo dorado que flota':'Point the nozzle at the floating gold dust',
'DESCARGA EN LA BODEGA':'UNLOAD IN THE HOLD','Sigue el marcador cian hasta el anillo verde':'Follow the cyan marker to the green ring',
'MANTÉN PARA SOLDAR':'HOLD TO WELD','Acércate a la rotura y suelda el casco':'Get close to the breach and weld the hull','o':'or',
# --- messages ---
'¡NOS ATACAN!':"WE'RE UNDER ATTACK!",'Defiende la nave':'Defend the ship','Ahora vienen a comerse la nave':"Now they're coming to eat the ship",
'Algo enorme se acerca…':'Something huge is coming…','¡OTRA TANDA!':'ANOTHER SWARM!','Repara y recoge la carga · llega otra tanda':'Repair and collect the cargo · another swarm is coming',
'DEMASIADO LEJOS':'TOO FAR','Vuelve a la nave':'Go back to the ship','Marcadas en rojo · vienen a por ti':"Marked in red · they're coming for you",
'¡CRÍAS!':'HATCHLINGS!','Muchas y rápidas · no comen la nave, van a por ti':"Many and fast · they don't eat the ship, they come for you",
'¡CUIDADO ARRIBA!':'WATCH OUT ABOVE!','Algo enorme cae sobre la nave':'Something huge is falling onto the ship','La Incineradora cae sobre la nave':'The Incinerator is dropping onto the ship',
'¡ESCUPIDORA!':'SPITTER!','Mátala antes de que destroce la nave · esquiva su ácido con Shift':'Kill it before it wrecks the ship · dodge its acid with Shift',
'¡INCINERADORA!':'INCINERATOR!','Viene a por ti · esquiva el láser con Shift · su núcleo del pecho es el punto débil':"It's coming for you · dodge the laser with Shift · the core in its chest is the weak spot",
'¡LA CARGA SE AGOTA!':'CARGO RUNNING OUT!','Si los tricomas a bordo llegan a 0, se acabó':"If the trichomes aboard reach 0, it's over",
'¡LA ESCUPIDORA MUERDE LA NAVE!':'THE SPITTER IS BITING THE SHIP!','Si no vas a por ella, abre agujeros enormes':"If you don't go after it, it tears huge holes",
'Las arañas entran por ahí · repárala para cerrarlo':'Spiders get in through there · repair it to seal it','Nido cerrado':'Nest sealed',
'¡NUBE DE TRICOMAS!':'TRICHOME CLOUD!','Recógela antes de que se pierda en el vacío':"Collect it before it's lost in space",
'¡UN HUEVO!':'AN EGG!','¡HUEVO!':'EGG!','Destrúyelo antes de que eclosione':'Destroy it before it hatches',
'MÚSICA ON':'MUSIC ON','MÚSICA OFF':'MUSIC OFF','VOCES ON':'VOICES ON','VOCES OFF':'VOICES OFF','EXTRA POWER agotado':'EXTRA POWER depleted',
'¡RESERVA BAJA!':'LOW RESERVE!','¡DESCARGA COMPLETA!':'UNLOAD COMPLETE!','TANQUE LLENO':'TANK FULL','BODEGA DESTRUIDA':'HOLD DESTROYED',
'¡ÁCIDO!':'ACID!','BLOQUEADO':'BLOCKED','¡DOBLE!':'DOUBLE!','¡TRIPLE!':'TRIPLE!','¡MASACRE!':'MASSACRE!',
'¡ESCUPIDORA ABATIDA!':'SPITTER DOWN!','¡INCINERADORA ABATIDA!':'INCINERATOR DOWN!',
'¡BODEGA!':'THE HOLD!','¡CABINA!':'THE COCKPIT!','¡MOTORES!':'THE ENGINES!','¡REACTOR!':'THE REACTOR!',
# --- prizes ---
'DESCARGA TOTAL':'HULL SHOCK','Todas las arañas del casco, fritas':'Every spider on the hull, fried','REPARACIÓN TOTAL':'FULL REPAIR','El casco queda como nuevo':'The hull is good as new',
'SOBRECARGA':'OVERCHARGE','Cada disparo mata · 20 s':'Every shot kills · 20 s','PUNTOS DOBLES':'DOUBLE POINTS','TODO A BORDO':'ALL ABOARD',
'Todos los tricomas que flotan vuelven a la nave':'Every floating trichome returns to the ship','IMÁN DE MOCHILA':'BACKPACK MAGNET',
'Aspira solo los tricomas que tienes cerca · llévalos a la bodega · 15 s':'Pulls in the trichomes near you · take them to the hold · 15 s',
'SOLDADURA RÁPIDA':'RAPID WELD','Sueldas 4 veces más rápido y siempre perfecto · 20 s':'Weld 4 times faster, always perfect · 20 s',
# --- end plate ---
'NAVE PERDIDA':'SHIP LOST','CARGA PERDIDA':'CARGO LOST','TRAJE ROTO':'SUIT BREACHED','LAS ARAÑAS DEVORARON EL CASCO':'THE SPIDERS DEVOURED THE HULL',
'LOS TRICOMAS SE PERDIERON EN EL VACÍO':'THE TRICHOMES WERE LOST IN SPACE','SEÑAL VITAL PERDIDA':'VITAL SIGNS LOST',
'Arañas eliminadas':'Spiders killed','Precisión':'Accuracy','Mejor multikill':'Best multikill','Tricomas rescatados':'Trichomes rescued','Tricomas perdidos':'Trichomes lost',
'Reparaciones':'Repairs','Escupidoras abatidas':'Spitters killed','Incineradoras abatidas':'Incinerators killed','Huevos destruidos':'Eggs destroyed',
'Tricomas a bordo al final':'Trichomes aboard at the end','¡NUEVO RÉCORD!':'NEW RECORD!','· Enter para reintentar':'· Enter to retry','Enter para reintentar':'Enter to retry',
# --- menu (touch panel + key labels) ---
'Arañas en el casco':'Spiders on the hull',
'Las arañas rojas se están comiendo tu nave. Mátalas, suelda el casco y rescata los tricomas que se escapan al vacío. Al final de cada ronda, la carga que queda a bordo suma puntos. ¿Hasta dónde llegarás?':
  'The red spiders are eating your ship. Kill them, weld the hull and rescue the trichomes escaping into space. At the end of each round, the cargo left aboard scores points. How far will you get?',
'Propulsores':'Thrusters','Espacio / C':'Space / C','Subir / bajar':'Up / down','Ratón':'Mouse','Mirar y apuntar':'Look and aim','Clic izq.':'Left click','Disparar':'Shoot',
'Clic der. / E':'Right click / E','Aspirar tricomas':'Vacuum trichomes','F (mantener)':'F (hold)','Soldar el casco':'Weld the hull','Recargar la pistola':'Reload the pistol',
'Acelerón para esquivar':'Boost to dodge','Empezar la ronda ya':'Start the round now','Ver al astronauta':'View the astronaut','Música / voces on/off':'Music / voices on/off',
'Joystick':'Joystick','Arrastrar':'Drag','Moverse':'Move','FUEGO':'FIRE','ASPIRAR':'VACUUM','Recoger partículas':'Collect particles','VER':'VIEW',
'HEADS Rescate Dorado':'HEADS Golden Rescue',
'SOLDAR':'WELD','EL CASCO':'THE HULL','ACELERÓN':'BOOST','RATÓN':'MOUSE','EL RATÓN':'THE MOUSE','LA RONDA YA':'THE ROUND NOW','MÚSICA / VOCES':'MUSIC / VOICES','PARA ESQUIVAR':'TO DODGE','LA PISTOLA':'THE PISTOL','RECARGAR':'RELOAD','MIRAR Y APUNTAR':'LOOK AND AIM','(MANTENER)':'(HOLD)','(O E)':'(OR E)','SUBIR':'UP','BAJAR':'DOWN','EMPEZAR':'START','SOLTAR':'RELEASE','ESPACIO':'SPACE','VER AL':'VIEW THE','ASTRONAUTA':'ASTRONAUT','UTILIDADES':'UTILITIES','MOVIMIENTO':'MOVEMENT','ACCIONES':'ACTIONS','PROPULSORES':'THRUSTERS',
# --- tutorial fragments (fallback when a line is split by <b>) ---
'Cuando una araña':'When a spider','se agacha y le brillan los ojos':'crouches and its eyes glow',', va a saltar: esquiva con':", it's about to jump: dodge with",
'Las arañas':'The spiders','se comen la nave':'eat the ship','. Mira el estado de la':'. Watch the','(arriba a la izquierda) y elimínalas':'status (top left) and kill them',
'Su punto débil está':'Their weak spot is','entre los ojos':'between the eyes',': headshot = doble daño y más puntos':': headshot = double damage and more points',
'La':'The','bodega':'hold','está destruida: repárala para poder entregar tricomas':'is destroyed: repair it to be able to deliver trichomes',
}
ZN={'MOTORES':'ENGINES','REACTOR':'REACTOR','BODEGA':'HOLD','CABINA':'COCKPIT','MOTOR':'ENGINE'}
# patterns: [regex source, replacement]; $1.. groups; {Z1} = zone name of group 1 translated
P=[
 [r'^(\d+) FUGA$','$1 LEAK'],[r'^(\d+) FUGAS$','$1 LEAKS'],[r'^(\d+) FUGAS? · PÉRDIDA ×([\d.,]+)$','$1 LEAKS · LOSS ×$2'],
 [r'^([\d.,]+) POR RESCATAR$','$1 TO RESCUE'],[r'^RESPIRO · (\d+) s$','BREATHER · $1 s'],[r'^CALMA · (\d+) s$','CALM · $1 s'],
 [r'^RONDA (\d+) · (\d+) ENEMIGO$','ROUND $1 · $2 ENEMY'],[r'^RONDA (\d+) · (\d+) ENEMIGOS$','ROUND $1 · $2 ENEMIES'],
 [r'^RONDA (\d+)$','ROUND $1'],[r'^RONDA (\d+) SUPERADA$','ROUND $1 CLEARED'],
 [r'^\+([\d.,]+) puntos por la carga a bordo · Enter para seguir$','+$1 points for the cargo aboard · Enter to continue'],
 [r'^\+([\d.,]+) puntos por la carga a bordo · perdidos ([\d.,]+) · Enter para seguir$','+$1 points for the cargo aboard · $2 lost · Enter to continue'],
 [r'^Ronda (\d+) en (\d+) s · Enter$','Round $1 in $2 s · Enter'],[r'^Ronda (\d+) · (\d+) arañas$','Round $1 · $2 spiders'],[r'^(\d+) arañas$','$1 spiders'],
 [r'^QUEDA 1 ARAÑA$','1 SPIDER LEFT'],[r'^QUEDAN (\d+) ARAÑAS$','$1 SPIDERS LEFT'],
 [r'^DESCARGANDO · quedan (\d+)$','UNLOADING · $1 left'],[r'^TE FALTAN (\d+) · vuelve a la bodega$','$1 TO GO · go back to the hold'],
 [r'^Cargando modelos (\d+)%$','Loading models $1%'],[r'^CARGANDO MODELOS (\d+)%$','LOADING MODELS $1%'],
 [r'^\+([\d.,]+) a bordo$','+$1 aboard'],[r'^−([\d.,]+) tricomas perdidos$','−$1 trichomes lost'],[r'^−([\d.,]+) carga$','−$1 cargo'],
 [r'^REPARADO \+([\d.,]+)$','REPAIRED +$1'],[r'^¡PERFECTO! \+([\d.,]+)$','PERFECT! +$1'],[r'^CRÍTICO \+([\d.,]+)$','CRITICAL +$1'],
 [r'^HUEVO DESTRUIDO \+([\d.,]+)$','EGG DESTROYED +$1'],[r'^RACHA x(\d+)$','STREAK x$1'],[r'^arañas fritas · \+([\d.,]+)$','spiders fried · +$1'],
 [r'^SOBRECARGA (\d+)$','OVERCHARGE $1'],[r'^PUNTOS x2 (\d+)$','POINTS x2 $1'],[r'^SOLDADURA RÁPIDA (\d+)$','RAPID WELD $1'],[r'^IMÁN (\d+)$','MAGNET $1'],
 [r'^ESCUPIDORA( [IVX]+)?$','SPITTER$1'],[r'^INCINERADORA( [IVX]+)?$','INCINERATOR$1'],
 [r'^Tanque (\d+) / (\d+)$','Tank $1 / $2'],[r'^Nave (\d+)%$','Ship $1%'],
 [r'^(\d+) · (\d+) perfectas$','$1 · $2 perfect'],[r'^(\d+) de (\d+)$','$1 of $2'],
 [r'^Récord: ([\d.,]+) · ronda (\d+) · Enter para reintentar$','Record: $1 · round $2 · Enter to retry'],
 [r'^REPARANDO (MOTORES|REACTOR|BODEGA|CABINA)$','REPAIRING {Z1}'],[r'^SOLDAR (MOTORES|REACTOR|BODEGA|CABINA)$','WELD {Z1}'],
 [r'^(MOTORES|REACTOR|BODEGA|CABINA) SELLADA$','{Z1} SEALED'],[r'^NIDO · (MOTORES|REACTOR|BODEGA|CABINA)$','NEST · {Z1}'],
 [r'^¡NIDO EN (?:LOS |EL |LA )(MOTORES|REACTOR|BODEGA|CABINA)!$','NEST IN THE {Z1}!'],
]
# tutorial lines, translated whole (they carry <b> markup)
H={
 # v66 phone tutorial
 '<b>Pulgar izquierdo</b>: empuja para moverte.':'<b>Left thumb</b>: push to move.',
 '<b class="c">Doble empuje</b> = acelerón.':'<b class="c">Double push</b> = boost.',
 '<b>Arrastra</b> a la derecha para girar.':'<b>Drag</b> on the right to turn.',
 '<b>Mantén DISPARAR</b> y desliza para apuntar.':'<b>Hold SHOOT</b> and slide to aim.',
 'Es tu carga: <b>mantén la barra llena</b>.':"It's your cargo: <b>keep the bar full</b>.",
 'Si llega a <b class="r">0, pierdes</b>.':'If it hits <b class="r">0, you lose</b>.',
 '<b>1</b> Pasa cerca: se aspiran solos.':'<b>1</b> Fly close: they get vacuumed up.',
 '<b>2</b> Llévalos a la <b class="c">BODEGA</b>.':'<b>2</b> Take them to the <b class="c">HOLD</b>.',
 '<b>TRAJE</b>: tu vida.':'<b>SUIT</b>: your life.',
 '<b>NAVE</b>: mata las arañas y suelda las roturas.':'<b>SHIP</b>: kill the spiders and weld the breaches.',
 'Si alguno llega a <b class="r">0, pierdes</b>.':'If either hits <b class="r">0, you lose</b>.',
 '¡Arañas en el casco! <b>Clic izquierdo</b> para dispararles':'Spiders on the hull! <b>Left click</b> to shoot them',
 'Se escapan <b>tricomas</b>, tu carga: aspíralos con <b>clic derecho</b> o <b>E</b>. Sigue los <b>rombos dorados</b>: lo que flote <b>30 s</b> se pierde':
   '<b>Trichomes</b>, your cargo, are escaping: vacuum them with <b>right click</b> or <b>E</b>. Follow the <b>gold diamonds</b>: anything floating for <b>30 s</b> is lost',
 'Lleva los tricomas a la <b>bodega</b> (anillo verde): lo que esté <b>a bordo</b> al acabar la ronda suma puntos':'Take the trichomes to the <b>hold</b> (green ring): whatever is <b>aboard</b> when the round ends scores points',
 'Cuanto más <b>dañada</b> está la nave, más rápido se escapan los tricomas: <b>suelda</b> las roturas para frenar la fuga':'The more <b>damaged</b> the ship, the faster the trichomes escape: <b>weld</b> the breaches to slow the leak',
 '¡Una <b>nube de tricomas</b>! Rescátala y llévala a la bodega para <b>recuperar carga</b>':'A <b>trichome cloud</b>! Rescue it and take it to the hold to <b>recover cargo</b>',
 'Su punto débil está <b>entre los ojos</b>: headshot = doble daño y más puntos':'Their weak spot is <b>between the eyes</b>: headshot = double damage and more points',
 '¡Premio! <b>Tócalo</b> antes de que desaparezca':'A prize! <b>Touch it</b> before it disappears',
 '<b>Calma</b>: aprovecha para reparar (el doble de rápido) y recoger carga':'<b>Calm</b>: use it to repair (twice as fast) and collect cargo',
 'Aprovecha el respiro: acércate al daño y mantén <b>F</b> para reparar':'Use the breather: get close to the damage and hold <b>F</b> to repair',
 'Suelta <b>F</b> dentro de la <b>franja dorada</b> para reparar al instante':'Release <b>F</b> inside the <b>gold band</b> to repair instantly',
 '¡Cuidado! Si te muerden <b>pierdes parte de la carga</b>. Vuelve a aspirarla':'Careful! If they bite you, <b>you lose some cargo</b>. Vacuum it back up',
 '<b>Tanque lleno</b>. Vuelve a la bodega a descargar':'<b>Tank full</b>. Go back to the hold to unload',
 'Cuando una araña <b>se agacha y le brillan los ojos</b>, va a saltar: esquiva con <b>Shift</b>':"When a spider <b>crouches and its eyes glow</b>, it's about to jump: dodge with <b>Shift</b>",
 'La <b>bodega</b> está destruida: repárala para poder entregar tricomas':'The <b>hold</b> is destroyed: repair it to be able to deliver trichomes',
}
# VO subtitles: Spanish line -> English line (from the same keys)
a=b.index('const VO_LINES');z=b.index('};',a)
for k,who,txt in re.findall(r"(\w+):\['([PI])','((?:[^'\\]|\\.)*)'\]",b[a:z]):
    if k in VO_EN: EN[txt]=VO_EN[k][2]
    else: print('VO missing EN',k)

# ---- v54: touch controls (phones) ----
EN.update({'PAUSA':'PAUSE','Pausa':'Pause','CONTINUAR':'RESUME','EMPEZAR RONDA YA':'START ROUND NOW','GIRA EL TELÉFONO':'TURN YOUR PHONE',
 'El juego se juega en horizontal':'The game is played in landscape','ROTURA':'BREACH','TOCA PARA SALTAR':'TAP TO SKIP','AUTO':'AUTO','CERCA':'NEAR',
 'Mantén el botón y arrástralo para apuntar':'Hold the button and drag it to aim','Pasa cerca del polvo dorado y se aspira solo':'Pass near the golden dust and it gets vacuumed up',
 'Toca el icono de la bodega o sigue el marcador cian':'Tap the hold icon or follow the cyan marker','QUÉDATE CERCA DE LA ROTURA':'STAY NEAR THE BREACH',
 'Se suelda sola si la miras · toca la barra en la franja dorada':'It welds itself while you face it · tap the bar on the gold band',
 'Moverse: nadas hacia donde miras':'Move: you swim where you look','Arrastrar':'Drag','Mirar (mitad derecha)':'Look (right half)',
 'Disparar · arrástralo para apuntar':'Shoot · drag it to aim','Doble empuje':'Double push','Acelerón: empuja, suelta y vuelve a empujar':'Boost: push, let go and push again',
 'Pasar cerca':'Pass near','Quedarte cerca':'Stay near','Soldar · toca la barra en la franja dorada':'Weld · tap the bar on the gold band',
 'Tocar aviso':'Tap a marker','Ir solo a una rotura o a la bodega':'Fly on your own to a breach or the hold','Música, voces y empezar la ronda ya':'Music, voices and start the round now'})
P.extend([[r'^\+([\d.,]+) puntos por la carga a bordo$','+$1 points for the cargo aboard'],
 [r'^\+([\d.,]+) puntos por la carga a bordo · perdidos ([\d.,]+)$','+$1 points for the cargo aboard · $2 lost'],
 [r'^Récord: ([\d.,]+) · ronda (\d+)$','Record: $1 · round $2'],[r'^(\d+) m$','$1 m']])
H.update({
 '¡Arañas en el casco! Mantén <b>DISPARAR</b> y arrástralo para apuntar':'Spiders on the hull! Hold <b>SHOOT</b> and drag it to aim',
 'Las arañas <b>se comen la nave</b>. Mira el estado de la <b>NAVE</b> (arriba a la izquierda) y elimínalas':'The spiders <b>are eating the ship</b>. Watch the <b>SHIP</b> status (top left) and take them out',
 'Se escapan <b>tricomas</b>, tu carga: <b>pasa cerca</b> y la manguera los aspira sola. Sigue los <b>rombos dorados</b>: lo que flote <b>30 s</b> se pierde':'<b>Trichomes</b> are escaping, your cargo: <b>pass near</b> and the hose vacuums them up on its own. Follow the <b>gold diamonds</b>: anything adrift for <b>30 s</b> is lost',
 'Lleva los tricomas a la <b>bodega</b> (anillo verde) o <b>toca su icono</b> para ir solo: lo que esté <b>a bordo</b> al acabar la ronda suma puntos':'Take the trichomes to the <b>hold</b> (green ring) or <b>tap its icon</b> to fly there: whatever is <b>aboard</b> when the round ends scores points',
 'Aprovecha el respiro: <b>toca una ROTURA</b> o acércate a ella y se suelda sola':'Use the breather: <b>tap a BREACH</b> or get close to it and it welds itself',
 '<b>Toca la barra</b> cuando pase por la <b>franja dorada</b> para reparar al instante':'<b>Tap the bar</b> when it crosses the <b>gold band</b> to repair instantly',
 'Cuando una araña <b>se agacha y le brillan los ojos</b>, va a saltar: esquiva con un <b>doble empuje</b> del joystick':"When a spider <b>crouches and its eyes glow</b>, it's about to jump: dodge with a <b>double push</b> of the stick"})
# ---- v56: phone controls (right stick) ----
EN.update({'Joystick izq.':'Left stick','Joystick dcho.':'Right stick','Girar rápido · un toque corto da la vuelta':'Fast turn · a short push spins you around',
 'Apuntar fino (mitad derecha)':'Fine aim (right half)'})
# ---- v60: phone start menu ----
EN.update({'TU MISIÓN':'YOUR MISSION','DEFIENDE':'DEFEND','Elimina arañas antes de que devoren el casco.':'Kill the spiders before they devour the hull.',
 'REPARA':'REPAIR','Acércate a una rotura: se suelda sola.':'Get close to a breach: it welds itself.',
 'RECOGE':'COLLECT','Pasa cerca del polvo dorado: son tricomas.':'Pass near the golden dust: those are trichomes.',
 'ENTREGA':'DELIVER','Llévalos a la bodega cian. A bordo suman puntos cada ronda.':'Take them to the cyan hold. Cargo aboard scores every round.',
 'Sobrevive tantas rondas como puedas.':'Survive as many rounds as you can.',
 'Pierdes: nave al 0 %, sin carga a bordo o traje roto.':'You lose if: ship at 0 %, no cargo aboard or suit breached.',
 'CONTROLES TÁCTILES':'TOUCH CONTROLS','MOVERSE':'MOVE','Pulgar izquierdo':'Left thumb','Doble empuje: acelerón.':'Double push: boost.',
 'APUNTAR Y DISPARAR':'AIM AND SHOOT','Arrastra a la derecha para apuntar.':'Drag on the right to aim.','Mantén':'Hold','y desliza.':'and slide.',
 'Toca un aviso:':'Tap an alert:','ve a la rotura o bodega.':'fly to the breach or the hold.','Pausa:':'Pause:',
 'música, voces y adelantar ronda.':'music, voices and start the round early.','Aspirar, soldar y descargar: automáticos.':'Vacuuming, welding and unloading: automatic.'})
# ---- v62: phone HUD (Santi's design, src/hud/hud.js) ----
EN.update({'ENEMIGO':'ENEMY','ENEMIGOS':'ENEMIES','s · RESPIRO':'s · BREATHER','s · CALMA':'s · CALM'})
# ---- v63: phones, shorter messages (no Shift on a phone) ----
H.update({'Las arañas <b>se comen la nave</b>.<br>Mira el estado de la <b>NAVE</b> y elimínalas':'The spiders <b>are eating the ship</b>.<br>Watch the <b>SHIP</b> status and take them out'})
EN.update({'Mátala antes de que destroce la nave':'Kill it before it wrecks the ship',
 'Viene a por ti · su núcleo del pecho es el punto débil':"It's coming for you · the core in its chest is the weak spot"})
# ---- v68: PC key hints at the bottom left (#pcKeys; SOLDAR, MANTÉN, ASPIRAR and ROTURA already exist above) ----
EN.update({'IMPULSO':'BOOST','CLIC DERECHO':'RIGHT CLICK','VE A DEJAR LOS TRICOMAS':'DROP OFF THE TRICHOMES','EN LA BODEGA':'IN THE HOLD'})
# sanity: every tutorial line must exist verbatim in the game code
for k in H:
    if k not in b: print('TUT NOT FOUND:',k[:60])
MENU_EN={'mov':'MOVEMENT','ver':'VERTICAL','rat':'MOUSE','acc':'ACTIONS','uti':'UTILITIES','prop':'THRUSTERS',
  'up':'UP','down':'DOWN','lc':['*LEFT','*CLICK','SHOOT'],'rc':['*RIGHT','*CLICK','VACUUM','TRICHOMES','(OR E)'],'aim':'LOOK AND AIM',
  'weld':['*WELD','*THE HULL','(HOLD)'],'rel':['*RELOAD','THE PISTOL'],'dash':['BOOST','TO DODGE'],
  'view':['VIEW THE','ASTRONAUT','(HOLD)'],'start':['START','THE ROUND NOW'],'mv':['MUSIC / VOICES','ON - OFF'],'esc':['RELEASE','THE MOUSE'],
  'space':'SPACE','enter':'ENTER','play':'PLAY','playKey':'ENTER'}
js='''// ---- i18n (v52): ES / EN. Everything on screen is DOM text, so a single translator covers HUD, messages, tips and menus:
// exact strings, patterns for texts with numbers, whole tutorial lines (HTML) and the VO subtitles. Spanish is the source.
window.I18N={lang:'es',EN:%s,H:%s,ZN:%s,MENU_EN:%s,
  P:%s.map(([s,r])=>[new RegExp(s),r])};
window.TR=function(s){const I=window.I18N;if(I.lang!=='en'||typeof s!=='string'||!s)return s;const t=s.trim();if(!t)return s;
  let r=I.EN[t];if(r===undefined){for(const [re,rep] of I.P){const m=t.match(re);if(m){r=rep.replace(/\\$(\\d)/g,(_,i)=>m[+i]===undefined?'':m[+i]).replace(/\\{Z(\\d)\\}/g,(_,i)=>I.ZN[m[+i]]||m[+i]);break;}}}
  if(r===undefined)return s;return s.match(/^\\s*/)[0]+r+s.match(/\\s*$/)[0];};
window.TRH=function(h){const I=window.I18N;return I.lang==='en'&&I.H[h]!==undefined?I.H[h]:h;};
(function(){const LET=/[A-Za-zÀ-ÿ]/;
  const trNode=n=>{const v=n.data;if(v.length>400||!LET.test(v))return;const p=n.parentNode;if(p&&p.closest&&p.closest('script,style,[data-noi18n]'))return;const r=TR(v);if(r!==v)n.data=r;};
  const trAttr=el=>{for(const a of ['aria-label','alt','title','data-alt']){const v=el.getAttribute&&el.getAttribute(a);if(v){const r=TR(v);if(r!==v)el.setAttribute(a,r);}}};
  const trEl=el=>{if(el.nodeType!==1||(el.closest&&el.closest('script,style,[data-noi18n]')))return;trAttr(el);for(const c of el.querySelectorAll('[aria-label],[alt],[title],[data-alt]'))trAttr(c);
    const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())trNode(n);};
  window.I18N.apply=()=>{if(window.I18N.lang!=='en')return;document.title=TR(document.title);trEl(document.body);};
  new MutationObserver(ms=>{if(window.I18N.lang!=='en')return;for(const m of ms){if(m.type==='characterData')trNode(m.target);else for(const n of m.addedNodes){if(n.nodeType===3)trNode(n);else trEl(n);}}})
    .observe(document.documentElement,{subtree:true,childList:true,characterData:true});})();
'''%(json.dumps(EN,ensure_ascii=False),json.dumps(H,ensure_ascii=False),json.dumps(ZN),json.dumps(MENU_EN,ensure_ascii=False),json.dumps(P,ensure_ascii=False))
src=rd(I18N_JS);A='// ---- i18n (v52)';Z="\n// language first: the picker shows"
assert src.count(A)==1 and src.count(Z)==1,'i18n block markers not found in public/i18n.js'
new=src[:src.index(A)]+js.rstrip('\n')+src[src.index(Z):]
if new!=src:open(I18N_JS,'w',encoding='utf-8').write(new)
print('public/i18n.js','updated' if new!=src else 'unchanged','· EN',len(EN),'P',len(P),'H',len(H))
