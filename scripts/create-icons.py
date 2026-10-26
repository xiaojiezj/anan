from PIL import Image, ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'android/app/src/main/res'
def icon(size,foreground=False):
    im=Image.new('RGBA',(432,432),(0,0,0,0) if foreground else '#3f6b52')
    d=ImageDraw.Draw(im)
    # The sprout sits inside the adaptive icon safe zone.
    d.line([(216,293),(216,166)],fill='#fff9dc',width=13)
    d.line([(171,294),(263,294)],fill='#fff9dc',width=13)
    d.ellipse((205,117,286,196),fill='#fff9dc')
    d.ellipse((153,175,220,240),fill='#d7e5b8')
    d.line([(218,208),(249,163)],fill='#3f6b52',width=8)
    d.line([(206,232),(175,205)],fill='#3f6b52',width=7)
    return im.resize((size,size),Image.Resampling.LANCZOS)
for density,size,fg in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
    folder=root/f'mipmap-{density}'
    for name in ['ic_launcher.png','ic_launcher_round.png']: icon(size).save(folder/name)
    icon(fg,True).save(folder/'ic_launcher_foreground.png')
(root/'values/ic_launcher_background.xml').write_text('<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#3f6b52</color></resources>')
# Replace generated landscape/portrait placeholder splash assets with the same quiet brand.
for p in root.rglob('splash.png'):
    with Image.open(p) as old: wh=old.size
    canvas=Image.new('RGB',wh,'#f8f7f2'); badge=icon(min(wh)//4); canvas.paste(badge,((wh[0]-badge.width)//2,(wh[1]-badge.height)//2),badge); canvas.save(p)
icon(432).save(Path(__file__).resolve().parents[1]/'public/app-icon.png')
