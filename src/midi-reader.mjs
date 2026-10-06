const tag=(v,p)=>String.fromCharCode(...new Uint8Array(v.buffer,v.byteOffset+p,4));
function be16(v,p){return v.getUint16(p)} function be32(v,p){return v.getUint32(p)}
function varint(v,p){let value=0;for(let n=0;n<4;n++){if(p>=v.byteLength)throw Error('MIDI-Datei vorzeitig beendet');const b=v.getUint8(p++);value=(value<<7)|(b&127);if(!(b&128))return [value,p]}throw Error('Defekte MIDI-Zeitangabe')}
export function parseMidi(buffer){
  const v=new DataView(buffer);if(tag(v,0)!=='MThd')throw Error('Keine Standard-MIDI-Datei.');
  const fmt=be16(v,8),tracks=be16(v,10),ppq=be16(v,12);if(fmt>1||!ppq||ppq>=32768)throw Error('Dieses MIDI-Zeitformat wird nicht unterstützt.');
  let p=8+be32(v,4),events=[],lastTick=0;
  for(let t=0;t<tracks;t++){if(tag(v,p)!=='MTrk')throw Error('Ungültige MIDI-Spur');const end=p+8+be32(v,p+4);p+=8;let tick=0,running=0;
    while(p<end){let delta;[delta,p]=varint(v,p);tick+=delta;let status=v.getUint8(p);if(status<0x80){if(!running)throw Error('Ungültiger MIDI-Running-Status');status=running}else{p++;if(status<0xf0)running=status}
      if(status===0xff){const meta=v.getUint8(p++);let len;[len,p]=varint(v,p);if(meta===0x51&&len===3){events.push({tick,type:'tempo',value:(v.getUint8(p)<<16)|(v.getUint8(p+1)<<8)|v.getUint8(p+2)})}p+=len;continue}
      if(status===0xf0||status===0xf7){let len;[len,p]=varint(v,p);p+=len;continue}
      const command=status&0xf0,ch=status&15,one=[0xc0,0xd0].includes(command),d1=v.getUint8(p++),d2=one?0:v.getUint8(p++);
      if(command===0x90)events.push({tick,type:d2?'on':'off',ch,key:d1,vel:d2});
      else if(command===0x80)events.push({tick,type:'off',ch,key:d1,vel:d2});
      else if(command===0xc0)events.push({tick,type:'program',ch,value:d1});
      else if(command===0xb0)events.push({tick,type:'control',ch,cc:d1,value:d2});
    }p=end;lastTick=Math.max(lastTick,tick)
  }
  // Sorting off before on at an identical tick prevents overlapping repeated notes.
  const order={tempo:0,program:1,control:2,off:3,on:4};events.sort((a,b)=>a.tick-b.tick||order[a.type]-order[b.type]);
  let secs=0,last=0,micro=500000;for(const e of events){secs+=(e.tick-last)*micro/1e6/ppq;e.sec=secs;last=e.tick;if(e.type==='tempo')micro=e.value}
  const duration=secs+(lastTick-last)*micro/1e6/ppq;
  const channelInfo=Array.from({length:16},(_,ch)=>({ch,program:0,notes:0,volume:100,expression:127,pan:64}));
  for(const e of events){const c=channelInfo[e.ch];if(!c)continue;if(e.type==='program')c.program=e.value;else if(e.type==='on')c.notes++;else if(e.type==='control'){if(e.cc===7)c.volume=e.value;if(e.cc===10)c.pan=e.value;if(e.cc===11)c.expression=e.value}}
  return {events,duration:Math.max(secs,duration),ppq,channels:channelInfo.filter(x=>x.notes>0)};
}
