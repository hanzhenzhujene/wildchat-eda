#!/usr/bin/env python3
"""Render neutral public EDA charts and a source-bounded visual catalog.
Uses saved aggregates only; publishes no person-level linkage identifiers.
"""
from pathlib import Path
import hashlib, json, math, re, textwrap
from datetime import datetime, timezone
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter, FuncFormatter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'website'; DIST=SITE; DATA=SITE/'data'
OUT=SITE/'assets/public-hub'; OUT.mkdir(parents=True,exist_ok=True)
META=SITE/'data/public-hub'; PUB=META; META.mkdir(parents=True,exist_ok=True)
V=json.loads((DATA/'validation.json').read_text()); M=json.loads((DATA/'microsoft_topics.json').read_text()); R=json.loads((DATA/'relational_v2.json').read_text())
L=json.loads((ROOT/'analysis/outputs/linkage/summary.json').read_text())
N=V['source']['n']; REV=V['source']['revision']; SRC=f'https://huggingface.co/datasets/allenai/WildChat-4.8M/tree/{REV}'
BLUE='#2563a6'; TEAL='#168276'; GOLD='#b88426'; PURPLE='#7b62a3'; INK='#172c3b'; MUTED='#5b6c79'; GRAY='#cbd5dc'; BG='#ffffff'
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.titlesize':16,'axes.titleweight':'bold','axes.labelcolor':MUTED,'text.color':INK,'axes.edgecolor':'#dde4e9','xtick.color':MUTED,'ytick.color':INK,'figure.facecolor':BG,'axes.facecolor':BG,'savefig.facecolor':BG,'axes.spines.top':False,'axes.spines.right':False,'axes.spines.left':False,'axes.spines.bottom':False,'grid.color':'#e8edf0'})
figs=[]
def clean(s):return str(s).replace('\u2013','-').replace('\u2014','-').replace('\u2260','!=')
def base(title,sub,h=4.2):
 fig,ax=plt.subplots(figsize=(9,h));fig.subplots_adjust(left=.26,right=.9,top=.78,bottom=.18)
 fig.text(.035,.95,title,fontsize=17,fontweight='bold',va='top');fig.text(.035,.86,sub,fontsize=10,color=MUTED,va='top')
 return fig,ax

def save(fig,id,title,category,scope,denominator,takeaway,source=SRC,href=None):
 fig.savefig(OUT/f'{id}.png',dpi=190,bbox_inches='tight');fig.savefig(OUT/f'{id}.svg',bbox_inches='tight');plt.close(fig)
 d={'id':id,'title':title,'file':f'/assets/public-hub/{id}.png','svg':f'/assets/public-hub/{id}.svg','category':category,'scope':scope,'denominator':denominator,'takeaway':takeaway,'source':source}
 if href:d['explorer_href']=href
 figs.append(d)

def bars(id,title,sub,labels,values,category,scope,denom,takeaway,colors=None,href=None,source=SRC,h=4.2,percent=True):
 fig,ax=base(title,sub,h);y=np.arange(len(labels)); ax.barh(y,values,color=colors or BLUE,height=.65);ax.set_yticks(y,[clean(x) for x in labels]);ax.invert_yaxis();ax.set_xlim(0,max(values)*1.2);ax.xaxis.grid(True);ax.set_axisbelow(True)
 if percent:ax.xaxis.set_major_formatter(PercentFormatter(100));ax.set_xlabel('Share of records')
 else:ax.xaxis.set_major_formatter(FuncFormatter(lambda x,_:f'{x:,.0f}'))
 for i,x in enumerate(values):ax.text(x+max(values)*.02,i,f'{x:.1f}%' if percent else f'{x:,.0f}',va='center',fontsize=10)
 save(fig,id,title,category,scope,denom,takeaway,source,href)

# Source census
lang=V['categories']['language']; top=lang[:8]; remainder=sum(x['census']['count'] for x in lang[8:]);labels=[x['label'] for x in top]+['Other source labels']; vals=[x['census']['pct'] for x in top]+[remainder/N*100]
bars('census_languages','English is just over half of released records',f'Full pinned release | {N:,} records | source language labels',labels,vals,'Census','All 86 source shards; no additional filters',N,'English accounts for 52.5%; language-specific conclusions need their own scope.',href='/atlas.html#explorer?snapshot=1&view=composition',h=5)
models=V['categories']['model_family'];bars('census_models','Model versions are mixed across the release',f'Full pinned release | {N:,} records | model families',[x['label'] for x in models],[x['census']['pct'] for x in models],'Census','All 86 source shards; model family aggregation',N,'This is a mixture of model generations, not a snapshot of one current assistant.',href='/atlas.html#explorer?snapshot=1&view=composition',h=5)
months=sorted(V['categories']['month'],key=lambda x:x['key']);fig,ax=base('Collection volume varies strongly over time',f'Full pinned release | {N:,} records | source timestamps',4.7);fig.subplots_adjust(left=.1,bottom=.23);x=np.arange(len(months));ax.fill_between(x,[q['census']['count'] for q in months],color=BLUE,alpha=.13);ax.plot(x,[q['census']['count'] for q in months],color=BLUE,lw=2.5);ax.set_xticks(x[::3],[q['key'] for q in months][::3],rotation=35,ha='right');ax.set_ylabel('Released records');ax.yaxis.set_major_formatter(FuncFormatter(lambda x,_:f'{x/1000:.0f}k'));ax.grid(axis='y');save(fig,'census_dates','Collection volume varies strongly over time','Census','All records; month of source timestamp',N,'More records in a month reflect collection volume, not necessarily more users or greater demand.',href='/atlas.html#explorer?snapshot=1&view=exchange')
turns=V['categories']['turn_bucket'];order=['1','2','3','4-5','6-10','11+'];turns=sorted(turns,key=lambda x: next((i for i,s in enumerate(order) if s==clean(x['key'])),len(order)));bars('census_turns','Most records contain one user message',f'Full pinned release | {N:,} records | stored user-message counts',[x['label'] for x in turns],[x['census']['pct'] for x in turns],'Census','All source records; counted stored user messages',N,'83.5% contain one stored user message; that does not describe a person\'s complete AI usage.',colors=[BLUE]+[TEAL]*(len(turns)-1),href='/atlas.html#explorer?snapshot=1&view=exchange',h=4.5)
# English total lengths
fig,ax=base('English records have a long text-length tail',f'English source label | {V["lengths"]["census"]["n"]:,} records | totals per record',4.8);fig.subplots_adjust(left=.1);ecdf=V['lengths']['census']['ecdf']
for k,label,c in [('user_pct','User text',BLUE),('assistant_pct','AI text',TEAL)]:
 pts=[q for q in ecdf if k in q and q['words']>0];ax.plot([q['words'] for q in pts],[q[k] for q in pts],label=label,c=c,lw=2.4)
ax.set_xscale('log');ax.set_xlim(1,100000);ax.set_ylim(0,100);ax.set_xlabel('Whitespace-delimited words across all stored messages of that role (log scale)');ax.set_ylabel('Records at or below length');ax.yaxis.set_major_formatter(PercentFormatter(100));ax.grid();ax.legend(loc='lower right',frameon=False);save(fig,'english_lengths','English records have a long text-length tail','Census','English-labeled records; total words per role per record',V['lengths']['census']['n'],'Median total user text is 176 words; large pasted inputs contribute to the upper tail.',href='/atlas.html#explorer?snapshot=1&view=length')
# sampling distance
keys=['language','model','month','turn_bucket'];fig,ax=base('A row-random sample is closer to the census', 'Total variation distance | lower = closer | 20,000 records in each sample',4.7);fig.subplots_adjust(left=.17);y=np.arange(len(keys));orig=[V['distances'][k]['original_vs_census']*100 for k in keys];rand=[V['distances'][k]['random_vs_census']*100 for k in keys];ax.barh(y-.16,orig,.28,label='Original block sample',color=GOLD);ax.barh(y+.16,rand,.28,label='Uniform row sample',color=TEAL);ax.set_yticks(y,['Language','Model','Month','User-message count']);ax.invert_yaxis();ax.set_xlim(0,max(orig)*1.3);ax.set_xlabel('Total variation distance (percentage points)');ax.grid(axis='x');ax.set_axisbelow(True);ax.legend(frameon=False,loc='lower right');save(fig,'sampling_comparison','A row-random sample is closer to the census','Sampling','Two separate 20,000-record samples compared with the full release',20000,'The original block sample differs most in month/model mix; full-release counts now replace sample estimates.',href='/atlas.html#methods?source=validation')
# AI classified domains and intents
for k,id,title,category in [('intents','task_distribution','Writing and information lookup lead task labels','Tasks'),('domains','topic_distribution','Topic labels span many domains','Topics')]:
 rows=M[k][:10];rows += ([{'label':'All remaining labels','count':sum(x['count'] for x in M[k][10:]),'share_pct':sum(x['share_pct'] for x in M[k][10:])}] if len(M[k])>10 else [])
 bars(id,title,f'Microsoft GPT-4o-mini labels | {N:,} released records | one label per record',[x['label'] for x in rows],[x['share_pct'] for x in rows],category,'Microsoft released classifications aligned row-by-row to the pinned release',N,'AI classifications describe stored content; label accuracy has not been human-validated in this audit.',colors=TEAL if k=='intents' else BLUE,href='/atlas.html#explorer?snapshot=1&view='+('task' if k=='intents' else 'topic'),source=M['source']['url'],h=5.8)
# Final request labels
labelnames={'none':'No interpersonal content','social_participation':'Presented social exchange','described_hypothetical':'Described / hypothetical situation','personal_help':'Personal-help request','unclear':'Unclear'}; cnt=R['summary']['relational_mode_counts']; ks=sorted(cnt,key=cnt.get,reverse=True)
bars('request_content','Interpersonal content has several distinct forms','Uniform row sample | 2,000 final stored requests | AI labels; no human validation',[labelnames[k] for k in ks],[cnt[k]/2000*100 for k in ks],'Content labels','2,000 rows sampled uniformly without replacement; final request classified using stored history',2000,'31 of 2,000 final requests are labeled personal help; a social topic alone does not establish a real relationship event.',colors=[GRAY,TEAL,GOLD,BLUE,PURPLE],href='/atlas.html#audit?snapshot=1&view=charts',h=4.7)
pc=R['summary']['purpose_counts'];names={'text_work':'Text work','information_learning':'Information / learning','social_chat':'Social chat','technical_problem':'Technical problem','creative_roleplay':'Creative / roleplay','other_unclear':'Other / unclear','personal_guidance':'Personal guidance'};ks=sorted(pc,key=pc.get,reverse=True)
bars('request_purpose','Text work also dominates the 2,000-request sample','Uniform row sample | 2,000 final stored requests | separate AI annotation scheme',[names[k] for k in ks],[pc[k]/2000*100 for k in ks],'Content labels','2,000 uniformly selected records; final active request is the annotation unit',2000,'These final-request labels use a different unit and taxonomy from Microsoft whole-record labels.',colors=TEAL,href='/atlas.html#audit?snapshot=1&view=charts',h=5)
# linkage aggregate only
recordbands=['1','2-5','6-20','21-100','101+'];mapping={clean(q['band']):q for q in L['records_per_key_distribution']};rows=[mapping[k] for k in recordbands]
bars('linkage_records','Most exact metadata combinations occur once','Complete metadata only | 1,921,755 combinations | combinations are not people',recordbands,[q['groups']/L['totals']['complete_keys']*100 for q in rows],'Linkage','Exact hashed IP + accept-language + user-agent; all three components nonblank',L['totals']['complete_keys'],'156,930 combinations occur in multiple records; a repeated combination does not establish identity.',colors=[GRAY]+[BLUE]*4,h=4.6)
spanorder=['0 days','<1 day','1-6 days','7-29 days','30-89 days','90-364 days','365+ days'];sp={clean(q['band']):q['groups'] for q in L['span_distribution']};bars('linkage_span','Most repeated combinations have short spans','Repeated exact metadata combinations | 156,930 combinations | last-turn UTC timestamps',spanorder,[sp[k]/L['repeated_key_groups']['groups']*100 for k in spanorder],'Linkage','Repeated complete metadata combinations only; latest minus earliest record timestamp',L['repeated_key_groups']['groups'],'66 combinations span at least one year; their identity, continuous use and topic continuity are not established.',colors=[GRAY,BLUE,BLUE,TEAL,TEAL,GOLD,GOLD],h=5)
# Safe publishable aggregates
safe={k:L[k] for k in ['dataset','revision','split','scope','group_key','unit','span_definition','totals','repeated_key_groups','at_least_two_distinct_contents','span_distribution','records_per_key_distribution','concentration','raw_text_read','linkage_keys_published']}
safe.update({'source_url':SRC,'documentation_url':f'https://huggingface.co/datasets/allenai/WildChat-4.8M/blob/{REV}/README.md#data-fields','limits':['Exact metadata matches do not confirm the same person.','Shared networks and browser settings can merge people; changes can split one person.','Time span is not continuous activity or evidence of a single continuing issue.'],'generated_at':'2026-10-23'})
(PUB/'linkage.json').write_text(json.dumps(safe,indent=2)+'\n')
# Legacy figure entries preserve their original scopes.
legacy={
 '01_languages':('Language labels','20,000-record original block sample',20000),
 '02_models':('Model mix','20,000-record original block sample',20000),
 '03_models_by_year':('Model mix by year','20,000-record original block sample',20000),
 '04_stored_turns':('Stored user-message counts','20,000-record original block sample',20000),
 '05_text_length_ecdf':('Text-length ECDF','English-labeled subset of original block sample',10636),
 '06_template_length':('Template text lengths','English-labeled subset of original block sample; see chart subgroups',10636),
 '07_repetition_quality':('Repeated content and source flags','20,000-record original block sample',20000),
 '08_month_coverage':('Month coverage','20,000-record original block sample',20000),
 '09_request_purpose':('Request purpose','120-record AI-label analysis; not a population sample',120),
 '10_purpose_packaging':('Purpose and supplied material','120-record AI-label analysis; not a population sample',120),
 '11_relational_modes':('Interpersonal content modes','120-record AI-label analysis; not a population sample',120),
 '12_joint_lengths':('Input and response lengths','English-labeled subset of original block sample',10636)}
for id,(title,scope,n) in legacy.items():
 figs.append({'id':'archive_'+id,'title':title,'file':f'/assets/figures/{id}.png','svg':None,'category':'Archive','scope':scope,'denominator':n,'takeaway':'Historical figure. Use current census and larger-sample charts for current summaries.','source':SRC,'analysis_date':'2026-10-20 (original EDA)','status':'historical'})
(PUB/'figures.json').write_text(json.dumps(figs,indent=2)+'\n')
# PDF: landscape visual catalog. Main charts 2/page, archive 4/page.
pdf=DIST/'assets/WildChat_Relational_EDA.pdf';W,H=900,660;c=canvas.Canvas(str(pdf),pagesize=(W,H));c.setTitle('WildChat EDA - Public visual catalog');c.setAuthor('WildChat EDA');c.setSubject('Pinned-release census, AI labels, sampling checks and aggregate metadata linkage')
def txt(s,x,y,size=10,color=INK,bold=False):
 c.setFillColor(HexColor(color));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,clean(s))
def wrap(s,x,y,width=110,size=10,leading=14,color=MUTED):
 for line in textwrap.wrap(clean(s),width):txt(line,x,y,size,color);y-=leading
 return y
page=0
def start(title,kicker):
 global page;page+=1;c.setFillColor(HexColor('#f7f9fa'));c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(HexColor(TEAL));c.rect(34,H-39,28,4,fill=1,stroke=0);txt(kicker.upper(),75,H-39,9,TEAL,True);txt(title,34,H-76,25,INK,True)
def end():
 txt('WildChat EDA | pinned release c827c6df... | 23 Oct 2026',34,22,8,MUTED);txt(str(page),W-45,22,9,MUTED);c.showPage()
def image_fit(path,x,y,w,h):
 im=Image.open(path);iw,ih=im.size;ratio=min(w/iw,h/ih);dw,dh=iw*ratio,ih*ratio;c.drawImage(ImageReader(im),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto')
start('WildChat EDA','Public visual catalog')
wrap('What is stored, how use varies, and where the evidence stops.',34,548,105,16,20,INK)
metrics=[('3,199,860','released records'),('10,334,364','stored messages'),('83.5%','one-user-message records'),('76','source language labels')]
for i,(a,b) in enumerate(metrics):
 x=34+i*215;c.setFillColor(HexColor('#ffffff'));c.roundRect(x,405,200,92,8,fill=1,stroke=0);txt(a,x+15,461,22,BLUE,True);txt(b,x+15,436,10,MUTED)
y=365
for a,b in [('1. Source census','Language, model mix, timestamps, conversation depth and English text length.'),('2. Classification','Microsoft whole-record topic/task labels and a separate 2,000-request AI-label sample.'),('3. Evidence checks','Sampling comparison and aggregate cross-record metadata matches.'),('4. Archive','Twelve original figures, retained with their narrower sample scopes.')]:
 txt(a,34,y,13,INK,True);wrap(b,244,y,width=91,size=11);y-=54
wrap('Unit: a released record is a stored conversation object, not a unique person or an account. It may contain several messages or pasted material. Source: allenai/WildChat-4.8M, default/train, all 86 shards at the revision below. The release name does not equal the row count at this pinned revision.',34,132,136,10,14)
wrap(SRC,34,69,145,8,11,BLUE);end()
# 6 pages with 2 charts each
main=figs[:12]; pagepairs=[(0,1,'Language and models','Full-release census'),(2,3,'Time and conversation depth','Full-release census'),(4,5,'Text length and sample checks','Census / sampling'),(6,7,'Task and topic','Microsoft AI labels'),(8,9,'Final-request content','2,000-row AI-label sample'),(10,11,'Cross-record metadata matches','Aggregate linkage')]
for a,b,title,kicker in pagepairs:
 start(title,kicker)
 for j,idx in enumerate([a,b]):
  f=main[idx];x=24+j*440;image_fit(DIST/f['file'].lstrip('/'),x,196,430,355)
  txt(f"{f['denominator']:,}  |  denominator",x+12,177,9,TEAL,True)
  wrap(f['takeaway'],x+12,157,width=58,size=11,leading=15,color=INK)
  wrap(f['scope'],x+12,103,width=72,size=8,leading=11)
  label='Microsoft released classifications' if f['source']==M['source']['url'] else ('Saved pinned-release aggregate analysis')
  txt(label,x+12,62,8,BLUE)
  c.linkURL(f['source'],(x+12,57,x+414,76),relative=0)
 if a==8:txt('AI annotations only. No human validation. Sampling intervals do not cover label error.',36,42,9,GOLD)
 if a==10:txt('Repeated exact metadata combinations are not verified users. No identifiers are published.',36,42,9,GOLD)
 end()
# 3 archive pages, 4 charts per page = 10 pages total
entries=list(legacy.items())
for p in range(3):
 start(f'Original figures {p*4+1}-{p*4+4}','Historical appendix | narrower scopes')
 for j,(id,(title,scope,n)) in enumerate(entries[p*4:p*4+4]):
  x=28+(j%2)*440;y=320 if j<2 else 72;image_fit(DIST/f'assets/figures/{id}.png',x,y,420,213);txt(title,x+8,y+1,10,INK,True);wrap(f'{scope} | denominator {n:,}',x+8,y-14,width=70,size=8,leading=10)
 txt('Original block sample: 20,000 records. Earlier analysis: 120 AI-labeled records. These scopes are not pooled.',36,42,9,GOLD);end()
c.save()
# Keep the exported PDF and its published checksum in sync.
metadata_path=SITE/'data/source_metadata.json'
metadata=json.loads(metadata_path.read_text())
pdf_relative='assets/WildChat_Relational_EDA.pdf'
pdf_sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
generated=datetime.now(timezone.utc).date().isoformat()
asset=next((x for x in metadata.get('assets',[]) if x.get('path')==pdf_relative),None)
if asset is None:
    asset={'path':pdf_relative}
    metadata.setdefault('assets',[]).append(asset)
asset.update({'source_path':'scripts/build_public_figures.py','sha256':pdf_sha,'bytes':pdf.stat().st_size,'description':'Public visual catalog; current census charts and historical figures retain separate scopes.'})
metadata.setdefault('output_checksums',{})[pdf_relative]=pdf_sha
metadata['public_catalog']={'generated':generated,'path':pdf_relative,'sha256':pdf_sha,'notes':'Current figures retain distinct census, AI-label and historical sample scopes.'}
metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'new_figures':12,'archived_figures':12,'pdf_pages':page,'pdf':str(pdf),'figure_index':str(PUB/'figures.json')},indent=2))
