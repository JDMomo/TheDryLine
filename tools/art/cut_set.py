# Cut generated sprite sheets into uniform strips. usage: cut_set.py <srcdir> <outdir> <prefix> <standing height in output px> <preview.jpg> [anim=factor ...]
import sys, os, glob, json, re
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src,out,prefix,TARGET,prev=sys.argv[1],sys.argv[2],sys.argv[3],float(sys.argv[4]),sys.argv[5]
FACT=dict(a.split('=') for a in sys.argv[6:]); os.makedirs(out,exist_ok=True)
frames={}
for f in sorted(glob.glob(src+'/*.png')):
    m=re.match(r'(?:'+prefix+r'|ID)_(.+)_f(\d+)\.png',os.path.basename(f))
    if not m or m.group(1)=='ref': continue
    name,n=m.group(1),int(m.group(2))
    im=np.asarray(Image.open(f).convert('RGBA')).astype(np.float32); A=im[...,3]/255.0; H,W=A.shape
    border=np.concatenate([A[:6].ravel(),A[-6:].ravel(),A[:,:6].ravel(),A[:,-6:].ravel()])
    hazy=np.median(border)>0.03 or np.percentile(border,90)>0.08
    mask=ndi.binary_opening(A>(0.8 if hazy else 0.2),iterations=2 if hazy else 1)
    lab,k=ndi.label(ndi.binary_closing(mask,iterations=2))
    idx=np.arange(1,k+1); area=ndi.sum(np.ones_like(lab),lab,idx); cen=np.array(ndi.center_of_mass(np.ones_like(lab),lab,idx))
    order=np.argsort(-area); seeds=order[:n]
    # reading order: rows by y, then x
    sy=sorted(seeds,key=lambda i:cen[i][0]); objs=ndi.find_objects(lab)
    hmax=max(objs[i][0].stop-objs[i][0].start for i in seeds); rows=[[sy[0]]]
    for i in sy[1:]:
        if cen[i][0]-np.mean([cen[j][0] for j in rows[-1]])>0.5*hmax: rows.append([i])
        else: rows[-1].append(i)
    seeds=[i for r in rows for i in sorted(r,key=lambda i:cen[i][1])]
    members={i:[i] for i in seeds}
    for i in order[n:]:
        if area[i]<60 or area[i]<0.004*area[seeds[0]]: continue
        j=min(seeds,key=lambda s:np.hypot(*(cen[i]-cen[s]))); members[j].append(i)
    got=[]
    for s in seeds:
        fm=np.isin(lab,[i+1 for i in members[s]])
        ys,xs=np.where(fm); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        soft=ndi.binary_dilation(fm,iterations=2)[y0:y1,x0:x1]
        rgba=im[y0:y1,x0:x1].copy(); al=A[y0:y1,x0:x1]*soft
        if hazy: al=np.clip((al-0.55)/0.4,0,1)
        rgba[...,3]=al*255; body=objs[s]
        got.append((Image.fromarray(rgba.astype(np.uint8),'RGBA'), body[0].stop-body[0].start, (body[1].start+body[1].stop)/2-x0, y1-body[0].stop))
    S=max(h for _,h,_,_ in got)/float(FACT.get(name,1)); sc=TARGET/S
    fr=[]
    for g,h,cx,below in got:
        g2=g.resize((max(1,round(g.width*sc)),max(1,round(g.height*sc))),Image.LANCZOS); fr.append((g2,round(cx*sc),round(below*sc)))
    frames[name]=fr; print(f'{prefix}.{name}: {len(fr)} frames hazy={int(hazy)} scale={sc:.3f} maxw={max(g.width for g,_,_ in fr)} maxh={max(g.height for g,_,_ in fr)}')
half=max(max(cx,g.width-cx) for fr in frames.values() for g,cx,_ in fr); CW=int(np.ceil(2*half/8)*8)+8; CH=int(np.ceil(max(g.height for fr in frames.values() for g,_,_ in fr)/8)*8)+8
meta={'cell':[CW,CH],'anims':{}}
for name,fr in frames.items():
    strip=Image.new('RGBA',(CW*len(fr),CH),(0,0,0,0))
    for i,(g,cx,below) in enumerate(fr): strip.alpha_composite(g,(i*CW+CW//2-cx,max(0,CH-4-g.height+below)))
    strip.save(f'{out}/{name}.png'); meta['anims'][name]=len(fr)
json.dump(meta,open(out+'/strips.json','w')); print(prefix,'cell',CW,CH)
sheet=Image.new('RGBA',(CW*6,CH*len(frames)),(24,44,44,255))
for r,name in enumerate(frames): sheet.alpha_composite(Image.open(f'{out}/{name}.png').crop((0,0,CW*6,CH)),(0,r*CH))
sheet.convert('RGB').save(prev,quality=85)
