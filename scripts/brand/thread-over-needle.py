# Puts the thread in front of the needle where the top of the knot crosses the eye's walls:
# appends a thread-only copy of the artwork, clipped to two boxes around those crossings.
import copy, sys, xml.etree.ElementTree as ET
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
THREAD = {'#F07A5C', '#C4553B', '#C95A3F', '#FFA486', '#C23D22', '#932C17', '#9E2F19', '#E36A4C'}
# Root user space (viewBox 0 -1650 6431.1 2300). Left wall: the top arc only (the lower strand
# passes behind it further down). Right wall: slanted so the strand coming out of the eye stays behind.
SHAPES = ['3615,-1036 3726,-1036 3726,-920 3615,-920', '3855,-1041 3967,-1041 3967,-882 3855,-934']

def keep(e):
    return any(e.get(a) in THREAD for a in ('fill', 'stroke'))

def prune(el):
    for child in list(el):
        tag = child.tag.split('}')[1]
        if tag == 'clipPath':
            el.remove(child)
        elif tag == 'g':
            prune(child)
            if len(child) == 0:
                el.remove(child)
        elif not keep(child):
            el.remove(child)
        child.attrib.pop('id', None)

def run(path):
    tree = ET.parse(path)
    root = tree.getroot()
    if root.find(f'{{{NS}}}g[@id="thread-over"]') is not None:
        print('already done', path); return
    layer = ET.Element(f'{{{NS}}}g', {'id': 'thread-over', 'clip-path': 'url(#thread-over-clip)'})
    for child in list(root):
        layer.append(copy.deepcopy(child))
    prune(layer)
    clip = ET.Element(f'{{{NS}}}clipPath', {'id': 'thread-over-clip'})
    clip.set('clipPathUnits', 'userSpaceOnUse')
    for points in SHAPES:
        ET.SubElement(clip, f'{{{NS}}}polygon', {'points': points})
    root.append(clip)
    root.append(layer)
    tree.write(path, encoding='unicode', xml_declaration=False)
    print('ok', path)

for p in sys.argv[1:]:
    run(p)
