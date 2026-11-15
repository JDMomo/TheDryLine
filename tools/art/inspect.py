import sys, os, glob
from PIL import Image
root=sys.argv[1]; out=sys.argv[2]
fs=sorted([f for f in glob.glob(root+'/**/*',recursive=True) if f.lower().endswith(('.png','.jpg','.jpeg','.webp'))])
thumbs=[]
for f in fs:
    im=Image.open(f); print(os.path.relpath(f,root), im.size, im.mode, 'alpha-range', im.getchannel('A').getextrema() if im.mode=='RGBA' else '-', 'corner', im.convert('RGBA').getpixel((3,3)))
    t=im.convert('RGBA'); bg=Image.new('RGBA',t.size,(40,60,60,255)); bg.alpha_composite(t); bg.thumbnail((640,430)); thumbs.append(bg.convert('RGB'))
cols=3; rows=(len(thumbs)+cols-1)//cols
sheet=Image.new('RGB',(cols*650,rows*440),(10,10,10))
for i,t in enumerate(thumbs): sheet.paste(t,((i%cols)*650+5,(i//cols)*440+5))
sheet.save(out,quality=80); print('sheet',sheet.size,len(thumbs))
