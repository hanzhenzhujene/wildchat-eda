"""Aggregate saved independent AI labels; generate the content-audit charts."""
import collections,csv,gzip,hashlib,json,pathlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
PURPOSES={
 'text_work':('Text work','Draft, summarize, translate or classify text.'),
 'information_learning':('Information / learning','Ask for facts or an explanation.'),
 'creative_roleplay':('Creative / roleplay','Invent a story, scene or character.'),
 'technical_problem':('Technical problem','Solve a coding, math or data task.'),
 'social_chat':('Social chat','Greet, banter or participate in an exchange.'),
 'personal_guidance':('Personal guidance','Seek help with an apparently lived situation.'),
 'other_unclear':('Other / unclear','The active task cannot be resolved.')}
PURPOSES={k:PURPOSES[k] for k in ['text_work','technical_problem','information_learning','creative_roleplay','social_chat','personal_guidance','other_unclear']}
MODES={'personal_help':'Personal interpersonal help','social_participation':'AI in a social exchange','described_hypothetical':'Interpersonal content / fiction','none_or_unclear':'No clear interpersonal focus'}
PACK={'direct_request':'Direct request','pasted_document':'Supplied document / code','embedded_history':'Embedded dialogue','unclear':'Unclear'}
BLUE='#356EB5';TEAL='#147D78';GRAY='#64717D';NAVY='#173854'
def load(p):return json.loads((ROOT/p).read_text())
def savefig(fig,name):
 out=ROOT/'outputs/figures';out.mkdir(exist_ok=True)
 fig.savefig(out/(name+'.png'),dpi=180,bbox_inches='tight',pad_inches=.15)
 fig.savefig(out/(name+'.svg'),bbox_inches='tight',pad_inches=.15,metadata={'Date':None,'Creator':'WildChat EDA'})
 svg_path=out/(name+'.svg')
 svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines())+"\n")
 plt.close(fig)
def main():
 plan=load('outputs/content_review_plan.json'); primary=load('reviews/content_a.json')+load('reviews/content_b.json')
 overlap=load('reviews/content_overlap.json'); final={r['row_index']:dict(r) for r in primary}
 assert len(final)==len(primary)==plan['n'] and set(final)==set(plan['ids'])
 assert {r['row_index'] for r in overlap}==set(plan['overlap_ids'])
 fields=['purpose','relational_mode','packaging']
 disagreements=[]
 for r in overlap:
  original=final[r['row_index']]
  diff={k:{'primary':original[k],'independent':r[k]} for k in fields if r[k]!=original[k]}
  if diff:disagreements.append({'row_index':r['row_index'],'fields':diff})
 adjudication=load('reviews/content_adjudication.json')
 for a in adjudication:
  assert a['row_index'] in final
  final[a['row_index']].update(a['updates'])
 rows=[final[i] for i in plan['ids']]
 for r in rows:
  assert r['purpose'] in PURPOSES and r['relational_mode'] in MODES and r['packaging'] in PACK
  assert r['confidence'] in ['high','medium','low']
 counts=lambda key:dict(collections.Counter(r[key] for r in rows))
 matrix=[[sum(r['purpose']==p and r['packaging']==f for r in rows) for f in PACK] for p in PURPOSES]
 summary={'n':len(rows),'unit':plan['unit'],'selection':plan['selection'],'seed':plan['seed'],
  'status':'AI-assisted content audit; no human validation. Counts describe 120 reviewed final requests only.',
  'purpose_counts':counts('purpose'),'relational_mode_counts':counts('relational_mode'),'packaging_counts':counts('packaging'),
  'confidence_counts':counts('confidence'),'purpose_definitions':{k:v[1] for k,v in PURPOSES.items()},
  'purpose_packaging_matrix':{'rows':list(PURPOSES),'columns':list(PACK),'counts':matrix},
  'overlap_n':len(overlap),'initial_disagreements':disagreements,
  'overlap_disagreement_counts':{k:sum(k in x['fields'] for x in disagreements) for k in fields},
  'adjudication_count':len(adjudication),
  'provenance':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['outputs/content_review_plan.json','reviews/content_a.json','reviews/content_b.json','reviews/content_overlap.json','reviews/content_adjudication.json']}}
 (ROOT/'outputs/content_audit_summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 (ROOT/'outputs/content_annotations.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 plt.rcParams.update({'font.family':'DejaVu Sans','font.size':14,'text.color':NAVY,'axes.labelcolor':NAVY,'svg.hashsalt':'content-audit-v1'})
 # Definitions are on the chart, so each counted category is interpretable.
 fig,ax=plt.subplots(figsize=(12.5,5.5));keys=list(PURPOSES)
 y=np.arange(len(keys));values=[summary['purpose_counts'].get(k,0) for k in keys]
 bars=ax.barh(y,values,color=BLUE,height=.55);ax.invert_yaxis()
 ax.set_yticks(y,[PURPOSES[k][0] for k in keys]);ax.set_xlim(0,max(values)*1.23)
 for i,v in enumerate(values):ax.text(v+.65,i,f'{v} / 120',va='center',fontsize=13,color=NAVY)
 for spine in ax.spines.values():spine.set_visible(False)
 ax.grid(axis='x',color='#E7ECF0');ax.set_axisbelow(True);ax.tick_params(length=0);ax.set_xlabel('Reviewed final requests')
 fig.tight_layout();savefig(fig,'09_request_purpose')
 fig,ax=plt.subplots(figsize=(12.5,5.4));a=np.array(matrix)
 ax.imshow(a,cmap='Blues',vmin=0,vmax=max(1,a.max()),aspect='auto')
 ax.set_xticks(range(len(PACK)),['Direct\nrequest','Supplied\ndocument / code','Embedded\ndialogue','Unclear'])
 ax.set_yticks(range(len(keys)),[PURPOSES[k][0] for k in keys]);ax.xaxis.tick_top()
 ax.tick_params(length=0,pad=9)
 for i in range(a.shape[0]):
  for j in range(a.shape[1]):ax.text(j,i,str(a[i,j]),ha='center',va='center',color='white' if a[i,j]>a.max()*.55 else NAVY,fontsize=17,weight='bold')
 for spine in ax.spines.values():spine.set_visible(False)
 fig.tight_layout();savefig(fig,'10_purpose_packaging')
 fig,ax=plt.subplots(figsize=(12.5,3.8));ks=list(MODES);vs=[summary['relational_mode_counts'].get(k,0) for k in ks]
 ax.barh([MODES[k] for k in ks],vs,color=[TEAL,TEAL,BLUE,GRAY],height=.6);ax.invert_yaxis();ax.set_xlim(0,120)
 for i,v in enumerate(vs):ax.text(v+.8,i,str(v),va='center',fontsize=16,weight='bold')
 ax.tick_params(length=0);ax.set_xlabel('Reviewed final requests (n = 120)');ax.grid(axis='x',color='#E7ECF0');ax.set_axisbelow(True)
 for spine in ax.spines.values():spine.set_visible(False)
 fig.tight_layout();savefig(fig,'11_relational_modes')
 print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
