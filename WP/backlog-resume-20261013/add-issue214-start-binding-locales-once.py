import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
words={
'en':['LRM lot for this run','Choose an LRM lot','Chart-mode runs, including Provisional series, need their LRM lots bound before start. The lot stays fixed after start. Fixed-window runs can bind at first measurement.','Lot frozen at run start'],
'es':['Lote MRL para esta corrida','Elegir un lote MRL','Las corridas en modo de carta de control, incluidas las series provisionales, requieren vincular los lotes MRL antes de iniciar. El lote queda fijo al iniciar. En ventana fija se puede vincular en la primera medición.','Lote fijado al iniciar la corrida'],
'es-419':['Lote MRL para esta corrida','Elegir un lote MRL','Las corridas en modo de carta de control, incluidas las series provisionales, requieren vincular los lotes MRL antes de iniciar. El lote queda fijo al iniciar. En ventana fija se puede vincular en la primera medición.','Lote fijado al iniciar la corrida'],
'fr':['Lot MRL pour cette série','Choisir un lot MRL','Les séries en mode carte de contrôle, y compris les séries provisoires, exigent des lots MRL liés avant le démarrage. Le lot reste fixé après le démarrage. En mode fenêtre fixe, il peut être lié à la première mesure.','Lot fixé au démarrage de la série'],
'pt':['Lote MRL para esta corrida','Escolher um lote MRL','Corridas no modo de carta de controle, incluindo séries provisórias, exigem lotes MRL vinculados antes do início. O lote fica fixo após o início. No modo de janela fixa, pode ser vinculado na primeira medição.','Lote fixado no início da corrida']}
for base in ['client/src/translations','server/locales']:
 for locale,values in words.items():
  p=root/base/(locale+'.json');data=json.loads(p.read_bytes());namespace=data['controlCharts']
  keys=['lotAtStart','chooseLot','startBindingHelp','frozenLot'];assert all(key not in namespace for key in keys)
  namespace.update(dict(zip(keys,values)));p.write_bytes((json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode())
print('Added four start-binding strings to both locale surfaces, once, in all five locales.')
