"""Post-hoc discovery of short first-person relationship questions.

This rule was added after the random audit revealed template contamination.
It is used to find illustrative cases, NOT estimate prevalence or validate recall.
"""
import json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
REL=re.compile(r'\bmy (?:\w+\s+){0,2}(?:wife|husband|boyfriend|girlfriend|friend|mother|father|mom|dad|parents|boss|colleague|coworker|neighbor|roommate|partner|sister|brother|son|daughter)\b',re.I)
ASK=re.compile(r'\b(advice|should I|how (?:do|can|should) I|help me|I need help|what (?:do|can|should) I|what should|can you help)\b',re.I)
BOT=re.compile(r'\b(Blockman|Zexy|group chat history|message to answer|respond to the last message)\b',re.I)
FICTION=re.compile(r'\b(roleplay|fictional|write a story|write a scene|novel|fanfiction|story about)\b',re.I)

def main():
    found=[]
    with (ROOT/'data/raw/sample.jsonl').open() as stream:
        for line in stream:
            r=json.loads(line)
            if r['language']!='English':continue
            users=[m['content'] or '' for m in r['conversation'] if m['role']=='user']
            if any(BOT.search(t) for t in users):continue
            matches=[(i,t) for i,t in enumerate(users) if len(t)<4500 and REL.search(t) and ASK.search(t) and not FICTION.search(t)]
            if matches:found.append({'row_index':r['row_index'],'matches':matches,'conversation':r['conversation']})
    (ROOT/'reviews/targeted_pack.json').write_text(json.dumps(found,ensure_ascii=False))
    (ROOT/'outputs/targeted_search_summary.json').write_text(json.dumps({'purpose':'Post-hoc example discovery; not included in random audit counts','retrieved_rows':len(found),'row_indices':[r['row_index'] for r in found],'independently_AI_reviewed_ids':[753427,2031077]},indent=2))
    print(f'{len(found)} post-hoc candidates; inspect before use')

if __name__=='__main__':main()
