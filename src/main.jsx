import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STYLE_PRESETS = {
  kompa: { label: 'Kompa', bpm: 98, swing: 0.08, bass: [0, 0.5, 1.5, 2.5, 3.25], chords: [0, 1, 2, 3], drum: 'soft-groove' },
  gouyad: { label: 'Gouyad', bpm: 92, swing: 0.12, bass: [0, 0.75, 1.5, 2.25, 3.5], chords: [0, 1.5, 3], drum: 'laidback' },
  afro: { label: 'Afro', bpm: 105, swing: 0.05, bass: [0, 0.5, 1.25, 2, 2.75, 3.5], chords: [0, 2], drum: 'afro-pop' },
  amapiano: { label: 'Amapiano', bpm: 112, swing: 0.06, bass: [0, 1.5, 2.75, 3.25], chords: [0, 2], drum: 'log-drum' },
  dancehall: { label: 'Dancehall', bpm: 96, swing: 0.04, bass: [0, 1, 2.5, 3.25], chords: [0, 2], drum: 'one-drop' },
  house: { label: 'House', bpm: 124, swing: 0, bass: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], chords: [0, 2], drum: 'four-on-floor' }
};

function App() {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const remixBufferRef = useRef(null);
  const [fileName, setFileName] = useState('Aucun fichier');
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(null);
  const [detectedKey, setDetectedKey] = useState('—');
  const [style, setStyle] = useState('kompa');
  const [status, setStatus] = useState('Prêt');
  const [remixReady, setRemixReady] = useState(false);
  const [mixSource, setMixSource] = useState(true);

  function getCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtxRef.current;
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStatus('Décodage audio...');
      setFileName(file.name);
      setRemixReady(false);
      remixBufferRef.current = null;
      const url = URL.createObjectURL(file);
      audioRef.current.src = url;
      const arr = await file.arrayBuffer();
      const ctx = getCtx();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      sourceBufferRef.current = buf;
      setDuration(buf.duration);
      drawWaveform(buf);
      const result = analyseAudio(buf);
      setBpm(result.bpm);
      setDetectedKey(result.key);
      setStatus(`Analyse OK : ${result.bpm} BPM / tonalité estimée ${result.key}`);
    } catch (err) {
      console.error(err);
      setStatus('Erreur import audio : format non décodable ou fichier corrompu. Essaie MP3/WAV standard.');
    }
  }

  function drawWaveform(buf) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, w, h);
    const data = buf.getChannelData(0);
    const step = Math.ceil(data.length / w);
    ctx.fillStyle = '#080b12'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1 * devicePixelRatio;
    ctx.beginPath();
    for (let x=0; x<w; x++) {
      let min=1,max=-1;
      const start=x*step;
      for(let i=0;i<step && start+i<data.length;i++){ const v=data[start+i]; if(v<min)min=v; if(v>max)max=v; }
      ctx.moveTo(x, (1+min)*h/2); ctx.lineTo(x, (1+max)*h/2);
    }
    ctx.stroke();
  }

  function analyseAudio(buf) {
    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const hop = Math.floor(sr * 0.02);
    const env = [];
    for (let i=0; i<data.length; i+=hop) {
      let sum=0;
      for (let j=0; j<hop && i+j<data.length; j++) sum += Math.abs(data[i+j]);
      env.push(sum / hop);
    }
    let bestBpm = 100, bestScore = -Infinity;
    for (let test=70; test<=160; test++) {
      const period = Math.round((60/test) / 0.02);
      let score=0;
      for (let i=period; i<env.length; i++) score += env[i] * env[i-period];
      if (score > bestScore) { bestScore = score; bestBpm = test; }
    }
    const keys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    let zc = 0;
    for(let i=1;i<Math.min(data.length, sr*10);i++) if((data[i-1]<0 && data[i]>=0)||(data[i-1]>=0 && data[i]<0)) zc++;
    return { bpm: bestBpm, key: keys[zc % 12] + (zc % 2 ? ' minor' : ' major') };
  }

  function generateRemix() {
    try {
    const ctx = getCtx();
    const preset = STYLE_PRESETS[style];
    const targetBpm = bpm || preset.bpm;
    const bars = 32;
    const secondsPerBeat = 60 / targetBpm;
    const total = bars * 4 * secondsPerBeat;
    const sr = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, Math.ceil(total*sr), sr);
    const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
    const add = (t, freq, len, gain, type='sine', pan=0) => synth(L,R,sr,t,freq,len,gain,type,pan);
    for (let bar=0; bar<bars; bar++) {
      const sectionGain = bar<4 ? .45 : bar<16 ? .7 : bar<28 ? 1 : .55;
      const base = bar*4*secondsPerBeat;
      // drums
      for(let b=0;b<4;b++) add(base+b*secondsPerBeat, 58, .09, .9*sectionGain, 'kick', 0);
      for(let b of [1,3]) add(base+b*secondsPerBeat, 190, .06, .35*sectionGain, 'snare', 0.05);
      for(let step=0; step<8; step++) add(base+step*.5*secondsPerBeat+preset.swing*secondsPerBeat*(step%2), 7000, .025, .08*sectionGain, 'hat', step%2?0.25:-0.25);
      if (bar % 8 === 7) for(let f=0; f<6; f++) add(base+(3+f/8)*secondsPerBeat, 140+f*25, .04, .22, 'snare', 0);
      // bass
      const root = 55 * Math.pow(2, (bar%4)/12);
      preset.bass.forEach((beat, idx)=> add(base+beat*secondsPerBeat+preset.swing*idx*0.03, root*(idx%3===2?1.5:1), .22, .55*sectionGain, 'bass', 0));
      // chords
      const chordRoot = 220 * Math.pow(2, (bar%4)/12);
      preset.chords.forEach(beat => {
        [1,1.25,1.5].forEach((mul, n)=> add(base+beat*secondsPerBeat, chordRoot*mul, .55, .09*sectionGain, 'pad', n===0?-0.35:n===1?0:0.35));
      });
      // hook on chorus-like bars
      if (bar>=16 && bar<28) [0,.5,1.5,2.25,3].forEach((beat,i)=> add(base+beat*secondsPerBeat, 440*Math.pow(2,[0,2,4,7,4][i]/12), .18, .14, 'lead', i%2?.2:-.2));
    }
    limit(L); limit(R);
    remixBufferRef.current = buffer;
    setRemixReady(true);
    setStatus(`Remix généré : ${preset.label}, ${targetBpm} BPM, ${bars} mesures`);
    } catch (err) {
      console.error(err);
      setStatus('Erreur pendant la génération remix : moteur audio non disponible.');
    }
  }

  function synth(L,R,sr,t,freq,len,gain,type,pan){
    const start=Math.floor(t*sr), n=Math.floor(len*sr);
    for(let i=0;i<n && start+i<L.length;i++){
      const x=i/n, env=Math.sin(Math.PI*x);
      let v=0;
      if(type==='kick') v=Math.sin(2*Math.PI*(freq*(1-x*0.8))*(i/sr))*Math.exp(-x*8);
      else if(type==='snare') v=(Math.random()*2-1)*Math.exp(-x*10)+Math.sin(2*Math.PI*freq*i/sr)*.2;
      else if(type==='hat') v=(Math.random()*2-1)*Math.exp(-x*25);
      else if(type==='bass') v=Math.tanh(Math.sin(2*Math.PI*freq*i/sr)*2)*Math.exp(-x*2);
      else if(type==='pad') v=Math.sin(2*Math.PI*freq*i/sr)*Math.sin(Math.PI*x);
      else if(type==='lead') v=Math.sin(2*Math.PI*freq*i/sr)+.25*Math.sin(2*Math.PI*freq*2*i/sr);
      else v=Math.sin(2*Math.PI*freq*i/sr);
      v*=gain*env;
      L[start+i]+=v*(pan<=0?1:1-pan); R[start+i]+=v*(pan>=0?1:1+pan);
    }
  }
  function limit(a){ for(let i=0;i<a.length;i++) a[i]=Math.max(-0.95,Math.min(0.95,Math.tanh(a[i]))); }

  async function playRemix() {
    if (!remixBufferRef.current) return;
    const ctx = getCtx();
    await ctx.resume();
    const src = ctx.createBufferSource(); src.buffer = remixBufferRef.current; src.connect(ctx.destination); src.start();
    if (mixSource && sourceBufferRef.current) {
      const ref = ctx.createBufferSource(); const g=ctx.createGain(); ref.buffer=sourceBufferRef.current; g.gain.value=.28; ref.connect(g).connect(ctx.destination); ref.start();
    }
    setStatus('Lecture remix...');
  }

  function exportWav() {
    const buf = remixBufferRef.current;
    if (!buf) return;
    const wav = encodeWav(buf);
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([wav],{type:'audio/wav'})); a.download=`fm-remix-${style}-v85.wav`; a.click();
  }

  return <main>
    <header><h1>FM Remix Forge Studio <span>V85 REAL APP BASE</span></h1><p>Base applicative réelle : import, waveform, BPM, génération remix simple, lecture, export.</p></header>
    <section className="panel">
      <input type="file" accept="audio/*" onChange={onFile}/>
      <div className="meta"><b>{fileName}</b><span>{duration? duration.toFixed(1)+' s':'—'}</span><span>{bpm? bpm+' BPM':'BPM —'}</span><span>{detectedKey}</span></div>
      <canvas ref={canvasRef} className="wave"></canvas>
      <audio ref={audioRef} controls className="audio"></audio>
    </section>
    <section className="grid">
      <div className="panel"><h2>Style</h2><select value={style} onChange={e=>setStyle(e.target.value)}>{Object.entries(STYLE_PRESETS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select><label><input type="checkbox" checked={mixSource} onChange={e=>setMixSource(e.target.checked)}/> Mixer avec la musique originale en fond</label></div>
      <div className="panel"><h2>Actions</h2><button onClick={generateRemix}>Générer remix simple</button><button disabled={!remixReady} onClick={playRemix}>Lire remix</button><button disabled={!remixReady} onClick={exportWav}>Exporter WAV</button></div>
    </section>
    <footer>{status}</footer>
  </main>
}

function encodeWav(buffer){
  const sr=buffer.sampleRate, len=buffer.length, channels=2, bytes=44+len*channels*2;
  const ab=new ArrayBuffer(bytes), v=new DataView(ab); let o=0;
  const ws=s=>{for(let i=0;i<s.length;i++)v.setUint8(o++,s.charCodeAt(i));};
  ws('RIFF'); v.setUint32(o,36+len*channels*2,true); o+=4; ws('WAVEfmt '); v.setUint32(o,16,true); o+=4; v.setUint16(o,1,true); o+=2; v.setUint16(o,channels,true); o+=2; v.setUint32(o,sr,true); o+=4; v.setUint32(o,sr*channels*2,true); o+=4; v.setUint16(o,channels*2,true); o+=2; v.setUint16(o,16,true); o+=2; ws('data'); v.setUint32(o,len*channels*2,true); o+=4;
  const L=buffer.getChannelData(0), R=buffer.getChannelData(1);
  for(let i=0;i<len;i++){ v.setInt16(o,Math.max(-1,Math.min(1,L[i]))*32767,true); o+=2; v.setInt16(o,Math.max(-1,Math.min(1,R[i]))*32767,true); o+=2; }
  return ab;
}

createRoot(document.getElementById('root')).render(<App/>);
