import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const width = 1200;
const height = 630;
const rgba = Buffer.alloc(width * height * 4);
const colors = {
  cream: [251, 245, 233, 255], dark: [48, 61, 49, 255],
  muted: [195, 190, 174, 255], accent: [213, 124, 54, 255], pale: [230, 223, 207, 255],
};
const font = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],"'":['00100','00100','00000','00000','00000','00000','00000'],' ':['00000','00000','00000','00000','00000','00000','00000']
};
function pixel(x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (Math.floor(y) * width + Math.floor(x)) * 4;
  rgba.set(color, offset);
}
function rect(x, y, w, h, color) { for (let yy=y; yy<y+h; yy++) for (let xx=x; xx<x+w; xx++) pixel(xx, yy, color); }
function circle(cx, cy, radius, color) { for (let y=-radius; y<=radius; y++) for (let x=-radius; x<=radius; x++) if (x*x+y*y<=radius*radius) pixel(cx+x,cy+y,color); }
function line(x1,y1,x2,y2,thickness,color) {
  const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
  for(let i=0;i<=steps;i++){ const t=i/steps; circle(Math.round(x1+(x2-x1)*t),Math.round(y1+(y2-y1)*t),thickness,color); }
}
function text(value, x, y, scale, color) {
  let cursor=x;
  for(const char of value.toUpperCase()){
    const glyph=font[char] ?? font[' '];
    glyph.forEach((row,ry)=>[...row].forEach((bit,rx)=>{ if(bit==='1') rect(cursor+rx*scale,y+ry*scale,scale,scale,color); }));
    cursor += 6*scale;
  }
}
function crc32(buffer) {
  let crc=0xffffffff;
  for(const byte of buffer){ crc^=byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  return (crc^0xffffffff)>>>0;
}
function chunk(type, data) {
  const name=Buffer.from(type); const length=Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([length,name,data,crc]);
}
rect(0,0,width,height,colors.cream);
for(let x=710;x<1200;x+=82) line(x,0,x-230,630,2,colors.pale);
for(let y=55;y<630;y+=78) line(650,y,1200,y+95,2,colors.pale);
line(790,80,1115,520,7,colors.accent);
circle(1010,255,72,colors.dark); circle(1010,255,34,colors.cream); line(1010,320,1010,470,18,colors.dark);
rect(62,78,12,474,colors.accent);
text("WYATT'S NYC RECS",105,105,10,colors.dark);
text("A FRIEND'S GUIDE TO THE CITY",110,245,5,colors.dark);
text('FOOD  DRINKS  MUSIC  WANDERING',110,330,4,colors.accent);
text('60 PERSONAL PICKS',110,475,5,colors.dark);
const raw=Buffer.alloc((width*4+1)*height);
for(let y=0;y<height;y++){ raw[y*(width*4+1)]=0; rgba.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4); }
const header=Buffer.alloc(13); header.writeUInt32BE(width,0); header.writeUInt32BE(height,4); header.set([8,6,0,0,0],8);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'public'),{recursive:true});
await writeFile(path.join(root,'public','og-image.png'),png);
