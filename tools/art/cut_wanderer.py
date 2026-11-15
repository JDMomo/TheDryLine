import sys, os, glob, json, re
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
src=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True)
LAY={4:(4,1),6:(3,2),8:(4,2)}
FACT=dict(idle=1.0,run=0.88,jump=1.0,land=1.0,dash=0.62,wallslide=0.95,doublejump=0.85,slash_side=0.93,slash_down=0.95,heavy=0.88,
          pierce=0.97,arc=1.0,burst=0.98,ground=0.8,mend=0.72,hurt=0.97,ko=0.93,revive=1.0,interact=1.03)
TARGET=120
frames={}
for f in sorted(glob.glob(src+'/*.png')):
    m=re.match(r'wanderer_(.+)_f(\d+)\.png',os.path.basename(f))
    if not m or m.group(1)=='ref': continue
    name,n=m.group(1),int(m.group(2)); cols,rows=LAY[n]
    im=np.asarray(Image.open(f).convert('RGBA')).astype(np.float32)
    A=im[...,3]/255.0; H,W=A.shape
    border=np.concatenate([A[:6].ravel(),A[-6:].ravel(),A[:,:6].ravel(),A[:,-6:].ravel()])
    hazy=np.median(border)>0.03 or np.percentile(border,90)>0.08
    mask=A>(0.8 if hazy else 0.2)
    mask=ndi.binary_opening(mask,iterations=1 if not hazy else 2)
    lab,k=ndi.label(ndi.binary_closing(mask,iterations=2))
    if k==0: print('EMPTY',name); continue
    idx=np.arange(1,k+1); area=ndi.sum(np.ones_like(lab),lab,idx); cen=ndi.center_of_mass(np.ones_like(lab),lab,idx)
    cells={}
    for i,a,(cy,cx) in zip(idx,area,cen):
        if a<80: continue
        c=min(cols-1,int(cx/(W/cols))); r=min(rows-1,int(cy/(H/rows)))
        cells.setdefault(r*cols+c,[]).append((a,i))
    got=[]
    for ci in range(n):
        comps=sorted(cells.get(ci,[]),reverse=True)
        if not comps: print('MISSING frame',name,ci); continue
        big=comps[0][0]; keep=[i for a,i in comps if a>=0.012*big]
        fm=np.isin(lab,keep)
        ys,xs=np.where(fm); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        soft=ndi.binary_dilation(fm,iterations=2)[y0:y1,x0:x1]
        rgba=im[y0:y1,x0:x1].copy(); al=A[y0:y1,x0:x1]*soft
        if hazy: al=np.clip((al-0.55)/0.4,0,1)
        rgba[...,3]=al*255
        got.append(Image.fromarray(rgba.astype(np.uint8),'RGBA'))
    hs=[g.height for g in got]; S=max(hs)/FACT[name]; sc=TARGET/S
    fr=[]
    for g in got:
        g=g.resize((max(1,round(g.width*sc)),max(1,round(g.height*sc))),Image.LANCZOS)
        a=np.asarray(g)[...,3].astype(float); col=a.sum(0); cum=np.cumsum(col); cx=int(np.searchsorted(cum,cum[-1]/2))
        fr.append((g,cx))
    frames[name]=fr
    print(f'{name:11s} n={len(fr)} hazy={int(hazy)} src_h={max(hs)} scale={sc:.3f} maxw={max(g.width for g,_ in fr)} maxh={max(g.height for g,_ in fr)}')
# uniform cell
half=max(max(cx,g.width-cx) for fr in frames.values() for g,cx in fr); CW=int(np.ceil(2*half/16)*16)+16; CH=int(np.ceil(max(g.height for fr in frames.values() for g,_ in fr)/16)*16)+8
meta={'cell':[CW,CH],'scale':2,'anims':{}}
for name,fr in frames.items():
    strip=Image.new('RGBA',(CW*len(fr),CH),(0,0,0,0))
    for i,(g,cx) in enumerate(fr): strip.alpha_composite(g,(i*CW+CW//2-cx,CH-4-g.height))
    strip.save(f'{out}/{name}.png'); meta['anims'][name]=len(fr)
json.dump(meta,open(out+'/strips.json','w'),indent=1); print('cell',CW,CH)
names=list(frames); sheet=Image.new('RGBA',(CW*8,CH*len(names)),(24,44,44,255))
for r,name in enumerate(names): sheet.alpha_composite(Image.open(f'{out}/{name}.png'),(0,r*CH))
for r in range(len(names)):  # foot line guide
    for x in range(0,sheet.width,6): sheet.putpixel((x,r*CH+CH-4),(90,120,110,255))
sheet=sheet.resize((sheet.width*2//5,sheet.height*2//5),Image.LANCZOS).convert('RGB'); sheet.save(sys.argv[3],quality=85); print('contact',sheet.size,names)
