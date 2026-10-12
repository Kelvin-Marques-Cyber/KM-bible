"""Draw a simple original book icon, without external imagery."""
from pathlib import Path
from PIL import Image,ImageDraw
r=Path(__file__).resolve().parents[1]
for folder,size in [('mipmap-mdpi',48),('mipmap-hdpi',72),('mipmap-xhdpi',96),('mipmap-xxhdpi',144),('mipmap-xxxhdpi',192)]:
 im=Image.new('RGB',(size*4,size*4),'#2f4d3d');d=ImageDraw.Draw(im);u=size*4;d.rounded_rectangle((u*.18,u*.17,u*.82,u*.82),radius=u*.045,fill='#e4d4aa');d.rectangle((u*.22,u*.17,u*.28,u*.82),fill='#bc985d');d.line((u*.43,u*.3,u*.65,u*.3),fill='#2f4d3d',width=max(2,int(u*.025)));d.line((u*.43,u*.4,u*.69,u*.4),fill='#2f4d3d',width=max(2,int(u*.016)));d.line((u*.43,u*.49,u*.69,u*.49),fill='#2f4d3d',width=max(2,int(u*.016)));d.polygon([(u*.52,u*.62),(u*.65,u*.62),(u*.65,u*.92),(u*.585,u*.84),(u*.52,u*.92)],fill='#8e4736');im.resize((size,size),Image.Resampling.LANCZOS).save(r/f'android/app/src/main/res/{folder}/ic_launcher.png')
# iOS uses the same original design in its required 1024px master.
im.resize((1024,1024),Image.Resampling.LANCZOS).save(r/'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png')
