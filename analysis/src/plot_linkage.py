"""Plot aggregate linkage statistics. No identifiers or dialogue text."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'outputs/linkage'
d=json.loads((OUT/'summary.json').read_text())
t=d['totals'];r=d['repeated_key_groups']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,
 'axes.spines.right':False,'axes.spines.left':False,'axes.spines.bottom':False})
fig=plt.figure(figsize=(14,8),facecolor='#fbfcfb')
fig.text(.055,.945,'WildChat: possible links across conversations',size=23,weight='bold',color='#17394d')
fig.text(.055,.9,'Released data: no persistent user ID field.',size=12,color='#17394d',weight='bold')
fig.text(.055,.868,'Authors’ suggestion: IP hash + browser/language details may link conversations from the same user.',size=12,color='#52636c')
for x,value,label in [(.055,f'{r["groups"]:,}','IP/browser combinations found in 2+ records'),
                     (.395,f'{r["median_span_days"]*24:.1f} hours','Median time from first to last record*'),
                     (.745,f'{r["span_ge_30days"]:,}','Combinations spanning at least 30 days')]:
 fig.text(x,.79,value,size=25,weight='bold',color='#147e79')
 fig.text(x,.755,label,size=11,color='#52636c')
fig.text(.055,.688,'Records per IP/browser combination',size=13,weight='bold',color='#17394d')
fig.text(.055,.659,f'All {t["complete_keys"]:,} combinations',size=10.5,color='#52636c')
fig.text(.56,.688,'Time between first and last record',size=13,weight='bold',color='#17394d')
fig.text(.56,.659,f'*Among {r["groups"]:,} combinations found in 2+ records',size=10.5,color='#52636c')
ax1=fig.add_axes([.10,.25,.33,.36]);ax2=fig.add_axes([.64,.25,.29,.36])
counts={v['band']:v for v in d['records_per_key_distribution']}
bands=['1','2–5','6–20','21–100','101+'];vals=[counts.get(b,{}).get('groups',0) for b in bands]
ax1.barh(bands,vals,color=['#95a7af']+['#147e79']*4,height=.58)
ax1.invert_yaxis()
ax1.set_xlim(0,max(vals)*1.35)
def share(v,n):
 return '<0.1%' if 0<v/n<.001 else f'{v/n:.1%}'
for i,v in enumerate(vals):ax1.text(v+max(vals)*.025,i,f'{v:,} ({share(v,t["complete_keys"])})',va='center',size=10)
spans={v['band']:v['groups'] for v in d['span_distribution']}
spans['<1 day']+=spans.pop('0 days',0)
bands2=['<1 day','1–6 days','7–29 days','30–89 days','90–364 days','365+ days']
vals2=[spans.get(b,0) for b in bands2]
assert sum(vals)==t['complete_keys']
assert sum(vals2)==r['groups']
assert sum(vals[1:])==r['groups']
assert sum(vals2[3:])==r['span_ge_30days']
ax2.barh(bands2,vals2,color='#426f9c',height=.58);ax2.invert_yaxis()
ax2.set_xlim(0,max(vals2)*1.42)
for i,v in enumerate(vals2):ax2.text(v+max(vals2)*.025,i,f'{v:,} ({share(v,r["groups"])})',va='center',size=10)
for a in (ax1,ax2):
 a.tick_params(axis='both',length=0);a.xaxis.set_major_formatter(FuncFormatter(lambda x,p:f'{x/1000:.0f}k'))
 a.set_xlabel('Number of IP/browser combinations',size=10,color='#52636c');a.grid(axis='x',alpha=.12);a.set_axisbelow(True)
fig.text(.055,.155,'This may help connect one person’s chats, but the combination is not a verified unique user ID.',size=12,weight='bold',color='#17394d')
fig.text(.055,.116,'Full release: 3,199,860 records. 2,832,257 (88.5%) had all linking details. Span uses record end times (UTC).',size=10.5,color='#52636c')
fig.text(.055,.08,'Counts: our analysis of allenai/WildChat-4.8M · train · c827c6df… · 21 Oct 2026',size=10.5,color='#52636c')
fig.text(.055,.044,'Official explanation: WildChat paper, §2 · arxiv.org/abs/2405.01470',size=10.5,color='#52636c')
fig.savefig(OUT/'linkage-distributions.png',dpi=180,facecolor=fig.get_facecolor())
