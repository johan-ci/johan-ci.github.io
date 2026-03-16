// Astuce: Ajoute "?debug=true" à l'adresse de ta page pour tout tester sur PC sans caméra !
const urlParams = new URLSearchParams(window.location.search);
const TEST_MODE = urlParams.has('debug') || urlParams.get('mode') === 'debug';

const mikoNames = ["Ava", "Nelya", "Mariam", "Antinea", "Rosa-Louise", "Romane", "Bahia", "Fatima"];
const mikoEmojis = ["🌸", "🌙", "✨", "🦊", "🎀", "🔮", "💫", "🦋"];

const guardianData = [
    { qr: "qr_mochi", n: "Mochi", e: "🍡", q: "Le Mochi, cette délicieuse boule sucrée japonaise, est fabriqué à base de...", a: ["Blé", "Riz", "Soja"], r: 1, type: "hold", instr: "La Pesée de Riz : Maintiens appuyé sans relâcher !" },
    { qr: "qr_ken", n: "Ken", e: "⚔️", q: "Comment s'appelle la célèbre épée courbée des Samouraïs ?", a: ["Le Katana", "Le Nunchaku", "L'Excalibur"], r: 0, type: "rhythm", instr: "Le Forgeron : Tape en rythme quand ça s'illumine !" },
    { qr: "qr_shinobi", n: "Shinobi", e: "🥷", q: "Quel est le vrai nom de l'étoile de lancer des Ninjas ?", a: ["Le Kunai", "Le Batarang", "Le Shuriken"], r: 2, type: "catch", instr: "Cache-Cache : Attrape-le 5 fois vite !" },
    { qr: "qr_aiko", n: "Aiko", e: "💖", q: "Que signifie le célèbre mot japonais 'Kawaii' ?", a: ["Bonjour", "Mignon", "Magique"], r: 1, type: "swipe", instr: "L'Éventail : Glisse ton doigt pour faire du vent !" },
    { qr: "qr_kitsune", n: "Kitsune", e: "🦊", q: "Combien de queues possède le plus puissant des renards magiques ?", a: ["3 queues", "7 queues", "9 queues"], r: 2, type: "shake", instr: "La Danse : Secoue le tel ou clique frénétiquement !" },
    { qr: "qr_sumo", n: "Sumo", e: "🍙", q: "Comment appelle-t-on les bandes dessinées japonaises ?", a: ["Les Comics", "Les Mangas", "Les Webtoons"], r: 1, type: "mash", instr: "Le Duel : VITE ! Tape 30 fois !" },
    { qr: "qr_zennon", n: "Zennon", e: "🧘", q: "Quel est le nom du vêtement traditionnel japonais ?", a: ["Le Sari", "Le Poncho", "Le Kimono"], r: 2, type: "statue", instr: "Méditation Zen : Chut... Ne touche plus l'écran." },
    { qr: "qr_taiko", n: "Taiko", e: "🥁", q: "Comment dit-on 'Baguettes' (pour manger) en japonais ?", a: ["Sushi", "Hashi", "Mochi"], r: 1, type: "drum", instr: "Le Tambour : Alterne Gauche (G) et Droite (D) !" },
    { qr: "qr_shogun", n: "Shogun", e: "🏯", q: "L'épée divine du début s'appelle... (Indice: Kusanagi)", a: ["Kusanagi", "Masamune", "Muramasa"], r: 0, type: "memory", instr: "Le Code Secret : Retiens et reproduis la séquence !" }
];

let currentFound = 0; let hpOni = 0; let audioCtx, masterGain;
let mainOscillators = []; let html5QrcodeScanner = null;
let hasGyro = false;
let audioLayers = { wind: null, chime: null, pad: null, melody: null };
let wakeLock = null; 

let gameStartTime = 0; let hubTimer = 0; let heartInterval = null; let introSkipped = false; let quizInterval = null;
let currentRule = 1; let easterEggTimer = null;

let eyesTimeout = setTimeout(() => {
    const eyes = document.getElementById('intro-eyes');
    if(eyes && eyes.style.display !== 'none') eyes.style.opacity = 1;
}, 1500);

async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } 
    catch (err) { console.log("WakeLock non supporté", err); }
}
document.addEventListener('click', requestWakeLock, {once:true});

async function transitionScreen(targetId, shadowEmoji = null) {
    const doors = document.getElementById('shoji-doors');
    const shadow = document.getElementById('shoji-shadow');
    
    if(shadow) {
        if(shadowEmoji) { shadow.innerText = shadowEmoji; } 
        else { const randomShadows = ["👹", "⛩️", "🦊", "🍡"]; shadow.innerText = randomShadows[Math.floor(Math.random() * randomShadows.length)]; }
    }
    
    doors.classList.add('closed'); playGameSFX('thud'); 
    await new Promise(r => setTimeout(r, 600)); 
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    doors.classList.remove('closed');
    await new Promise(r => setTimeout(r, 500)); 
}

function initSfx() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value = 0.6; masterGain.connect(audioCtx.destination);
    
    audioLayers.wind = audioCtx.createGain(); audioLayers.wind.gain.value = 0.2; audioLayers.wind.connect(masterGain);
    audioLayers.chime = audioCtx.createGain(); audioLayers.chime.gain.value = 0; audioLayers.chime.connect(masterGain);
    audioLayers.pad = audioCtx.createGain(); audioLayers.pad.gain.value = 0; audioLayers.pad.connect(masterGain);
    audioLayers.melody = audioCtx.createGain(); audioLayers.melody.gain.value = 0; audioLayers.melody.connect(masterGain);

    const bufSize = audioCtx.sampleRate * 2; const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const output = noiseBuf.getChannelData(0); for (let i=0; i<bufSize; i++) output[i] = Math.random()*2-1;
    const noiseSrc = audioCtx.createBufferSource(); noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
    const noiseFilter = audioCtx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 400; 
    noiseSrc.connect(noiseFilter); noiseFilter.connect(audioLayers.wind); noiseSrc.start();

    setInterval(() => {
        if(audioLayers.chime.gain.value > 0) {
            const osc = audioCtx.createOscillator(); osc.type = 'sine';
            osc.frequency.value = [523.25, 587.33, 659.25, 783.99, 880.00][Math.floor(Math.random()*5)];
            const g = audioCtx.createGain(); g.gain.setValueAtTime(0, audioCtx.currentTime);
            g.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 1); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 4);
            osc.connect(g); g.connect(audioLayers.chime); osc.start(); osc.stop(audioCtx.currentTime + 4);
        }
    }, 2000);

    const padOsc = audioCtx.createOscillator(); padOsc.type = 'triangle'; padOsc.frequency.value = 261.63; padOsc.connect(audioLayers.pad); padOsc.start();
    const melOsc1 = audioCtx.createOscillator(); melOsc1.type = 'sine'; melOsc1.frequency.value = 329.63; melOsc1.connect(audioLayers.melody); melOsc1.start();
    const melOsc2 = audioCtx.createOscillator(); melOsc2.type = 'sine'; melOsc2.frequency.value = 392.00; melOsc2.connect(audioLayers.melody); melOsc2.start();

    [73.42, 87.31, 110.00].forEach(f => {
        const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const gain = audioCtx.createGain(); gain.gain.value = 0;
        osc.connect(gain); gain.connect(masterGain); osc.start(); mainOscillators.push({osc: osc, gain: gain});
    });
}

function updateDynamicMusic() {
    if(!audioCtx) return; const now = audioCtx.currentTime;
    if(currentFound >= 3) audioLayers.chime.gain.linearRampToValueAtTime(0.6, now + 2);
    if(currentFound >= 6) audioLayers.pad.gain.linearRampToValueAtTime(0.15, now + 2);
    if(currentFound >= 9) audioLayers.melody.gain.linearRampToValueAtTime(0.1, now + 2);
}

function transitionToDarkAudio() {
    if(!audioCtx) return; audioLayers.wind.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
    mainOscillators.forEach(obj => obj.gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 1));
}

function playGameSFX(type, freq=440) {
    if(!audioCtx) return; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination); const now = audioCtx.currentTime;
    if(type === 'heartbeat') { osc.type = 'sine'; osc.frequency.setValueAtTime(60, now); osc.frequency.exponentialRampToValueAtTime(30, now+0.3); gain.gain.setValueAtTime(0.7, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.3); osc.start(now); osc.stop(now+0.3); }
    else if(type === 'drum_g') { osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(50, now+0.2); gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.2); osc.start(now); osc.stop(now+0.2); } 
    else if(type === 'sword') { osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, now); gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.1); osc.start(now); osc.stop(now+0.1); } 
    else if(type === 'thud') { osc.type = 'square'; osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(20, now+0.2); gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.2); osc.start(now); osc.stop(now+0.2); } 
    else if(type === 'woosh') { osc.type = 'sine'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(800, now+0.15); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.15); osc.start(now); osc.stop(now+0.15); } 
    else if(type === 'zen') { osc.type = 'sine'; osc.frequency.setValueAtTime(329.63, now); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.4, now+1); gain.gain.exponentialRampToValueAtTime(0.01, now+4); osc.start(now); osc.stop(now+4); } 
    else if(type === 'pop') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now+0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.1); osc.start(now); osc.stop(now+0.1); } 
    else if(type === 'beep') { osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.2); osc.start(now); osc.stop(now+0.2); } 
    else if (type === 'chime_portal') {
        const freqs = [880, 1108.73, 1318.51, 1760];
        freqs.forEach((f, i) => { const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, now + i*0.1); g.gain.linearRampToValueAtTime(0.3, now + i*0.1 + 0.1); g.gain.exponentialRampToValueAtTime(0.01, now + i*0.1 + 1.5); o.connect(g); g.connect(audioCtx.destination); o.start(now + i*0.1); o.stop(now + i*0.1 + 1.5); });
    }
}

function playThunder() {
    if(!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    const bufferSize = audioCtx.sampleRate; const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const rumble = audioCtx.createBufferSource(); rumble.buffer = noiseBuffer;
    const rumbleFilter = audioCtx.createBiquadFilter(); rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(1000, audioCtx.currentTime); rumbleFilter.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1.5);
    const rumbleGain = audioCtx.createGain(); rumbleGain.gain.setValueAtTime(0.8, audioCtx.currentTime); rumbleGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    osc.connect(gain); gain.connect(masterGain); rumble.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(masterGain); osc.start(); osc.stop(audioCtx.currentTime + 1.5); rumble.start();
}

function playMikoChime(index) {
    if(!audioCtx) return; const scale = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77, 1108.73]; 
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = scale[index % scale.length];
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 1.5);
}

function playCorrect() {
    if(!audioCtx) return; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.5);
}

function playWrong() {
    if(!audioCtx) return; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function playEvilLaugh() {
    const u = new SpeechSynthesisUtterance("Ha ha ha ha ha"); u.lang = "ja-JP"; u.pitch = 0.1; u.rate = 0.5; u.volume = 0.5; window.speechSynthesis.speak(u);
    if(!audioCtx) return;
    [100, 115, 130].forEach(f => {
        const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f;
        const gain = audioCtx.createGain(); gain.gain.setValueAtTime(0.4, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 2);
    });
}

const cvs = document.getElementById('canvas-fx');
const gl = cvs.getContext('webgl', { alpha: false, premultipliedAlpha: false });

let sakuraMood = { bg:[0.1,0.02,0.11], glow:[0.35,0.1,0.25], petal:[1.0,0.72,0.77], fog:[0.1,0.02,0.11], wind:0.2, speedMult:1.0 };
window.setSakuraMood = function(moodType) {
    if (moodType === 'INTRO') sakuraMood = { bg:[0.1,0.02,0.11], glow:[0.35,0.1,0.25], petal:[1.0,0.72,0.77], fog:[0.1,0.02,0.11], wind:0.2, speedMult:1.0 };
    else if (moodType === 'DARUMA') sakuraMood = { bg:[0.15,0.0,0.0], glow:[0.4,0.0,0.0], petal:[0.8,0.05,0.05], fog:[0.15,0.0,0.0], wind:1.5, speedMult:4.0 };
    else if (moodType === 'RITUEL') sakuraMood = { bg:[0.12, 0.05, 0.20], glow:[0.35, 0.15, 0.45], petal:[0.8, 0.9, 1.0], fog:[0.12, 0.05, 0.20], wind:0.05, speedMult:0.3 };
    else if (moodType === 'FINAL') sakuraMood = { bg:[0.0,0.0,0.0], glow:[0.0,0.0,0.0], petal:[1.0,0.85,0.3], fog:[0.0,0.0,0.0], wind:0.1, speedMult:0.6 };
};

if (gl) {
    const ext = gl.getExtension('ANGLE_instanced_arrays');
    function resize() { const dpr = window.devicePixelRatio || 1; cvs.width = window.innerWidth * dpr; cvs.height = window.innerHeight * dpr; gl.viewport(0, 0, cvs.width, cvs.height); }
    window.addEventListener('resize', resize); resize();
    function compile(type, id) { const s = gl.createShader(type); gl.shaderSource(s, document.getElementById(id).text); gl.compileShader(s); return s; }
    
    const bgProg = gl.createProgram(); gl.attachShader(bgProg, compile(gl.VERTEX_SHADER, 'bg-vs')); gl.attachShader(bgProg, compile(gl.FRAGMENT_SHADER, 'bg-fs')); gl.linkProgram(bgProg);
    const uBgCol = gl.getUniformLocation(bgProg, "uBgCol"); const uGlowCol = gl.getUniformLocation(bgProg, "uGlowCol");
    const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const petalProg = gl.createProgram(); gl.attachShader(petalProg, compile(gl.VERTEX_SHADER, 'petal-vs')); gl.attachShader(petalProg, compile(gl.FRAGMENT_SHADER, 'petal-fs')); gl.linkProgram(petalProg);
    const pVerts = [], pNorms = []; const segs = 4;
    for (let i = 0; i <= segs; i++) { for (let j = 0; j <= segs; j++) { let u = i / segs, v = j / segs; let w = Math.sin(u * Math.PI) * (1.0 - v * 0.6); let x = (v - 0.5) * 2.0 * w; let y = (u - 0.5) * 2.0; let z = (x*x + y*y) * 0.3; pVerts.push(x, y, z); let len = Math.sqrt(x*x + y*y + 1.0); pNorms.push(-x/len, -y/len, 1.0/len); } }
    const pInds = []; for (let i = 0; i < segs; i++) { for (let j = 0; j < segs; j++) { let p1 = i * (segs + 1) + j, p2 = p1 + 1, p3 = (i + 1) * (segs + 1) + j, p4 = p3 + 1; pInds.push(p1, p2, p3, p2, p4, p3); } }
    const vBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pVerts), gl.STATIC_DRAW);
    const nBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pNorms), gl.STATIC_DRAW);
    const iBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(pInds), gl.STATIC_DRAW);
    const numP = 300; const instData1 = new Float32Array(numP * 4); const instData2 = new Float32Array(numP * 2); 
    for(let p = 0; p < numP; p++) { instData1[p*4+0] = Math.random() * 3000 - 1500; instData1[p*4+1] = Math.random() * 3000 - 1500; instData1[p*4+2] = Math.random() * 2000 - 2000; instData1[p*4+3] = 10.0 + Math.random() * 15.0; instData2[p*2+0] = Math.random() * Math.PI * 2; instData2[p*2+1] = 0.5 + Math.random() * 1.0; }
    const iBuf1 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, iBuf1); gl.bufferData(gl.ARRAY_BUFFER, instData1, gl.STATIC_DRAW);
    const iBuf2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, iBuf2); gl.bufferData(gl.ARRAY_BUFFER, instData2, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(petalProg, "aPos"); const aNorm = gl.getAttribLocation(petalProg, "aNorm"); const aInst1 = gl.getAttribLocation(petalProg, "aInstData1"); const aInst2 = gl.getAttribLocation(petalProg, "aInstData2");
    const uTime = gl.getUniformLocation(petalProg, "uTime"); const uRes = gl.getUniformLocation(petalProg, "uRes"); const uWind = gl.getUniformLocation(petalProg, "uWind"); const uSpdM = gl.getUniformLocation(petalProg, "uSpdM"); const uPetalCol = gl.getUniformLocation(petalProg, "uPetalCol"); const uFogCol = gl.getUniformLocation(petalProg, "uFogCol");
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST);
    let t0 = performance.now(); let simTime = 0;

    function render(t) {
        let dt = (t - t0) * 0.001; t0 = t; simTime += dt;
        gl.disable(gl.DEPTH_TEST); gl.useProgram(bgProg); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.uniform3f(uBgCol, sakuraMood.bg[0], sakuraMood.bg[1], sakuraMood.bg[2]); gl.uniform3f(uGlowCol, sakuraMood.glow[0], sakuraMood.glow[1], sakuraMood.glow[2]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.enable(gl.DEPTH_TEST); gl.useProgram(petalProg); gl.uniform1f(uTime, simTime); 
        gl.uniform2f(uRes, cvs.width, cvs.height); 
        gl.uniform1f(uWind, sakuraMood.wind); gl.uniform1f(uSpdM, sakuraMood.speedMult); gl.uniform3f(uPetalCol, sakuraMood.petal[0], sakuraMood.petal[1], sakuraMood.petal[2]); gl.uniform3f(uFogCol, sakuraMood.fog[0], sakuraMood.fog[1], sakuraMood.fog[2]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuf); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, nBuf); gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, iBuf1); gl.enableVertexAttribArray(aInst1); gl.vertexAttribPointer(aInst1, 4, gl.FLOAT, false, 0, 0); ext.vertexAttribDivisorANGLE(aInst1, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, iBuf2); gl.enableVertexAttribArray(aInst2); gl.vertexAttribPointer(aInst2, 2, gl.FLOAT, false, 0, 0); ext.vertexAttribDivisorANGLE(aInst2, 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf); ext.drawElementsInstancedANGLE(gl.TRIANGLES, pInds.length, gl.UNSIGNED_SHORT, 0, numP);
        requestAnimationFrame(render);
    } requestAnimationFrame(render);
}

function talkSync(txt, lang, rate=0.85) {
    if(introSkipped) return Promise.resolve();
    return new Promise(r => { 
        if(masterGain && audioCtx) {
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.5);
        }
        const u = new SpeechSynthesisUtterance(txt); u.lang = lang; u.rate = rate; u.volume = 1; u.onend = r; 
        let timeout = setTimeout(() => { 
            window.speechSynthesis.cancel(); 
            if(masterGain && audioCtx) {
                masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
                masterGain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1);
            }
            r(); 
        }, 8000);
        u.onend = () => { 
            clearTimeout(timeout); 
            if(masterGain && audioCtx) {
                masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
                masterGain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1);
            }
            r(); 
        };
        window.speechSynthesis.speak(u); 
    });
}

async function showStoryText(htmlStr, spokenText, lang="ja-JP", rate=0.85) {
    if(introSkipped) return Promise.resolve();
    const st = document.getElementById('story-text');
    if(st.innerHTML !== "") { st.classList.add('text-fade-out'); await new Promise(r => setTimeout(r, 500)); }
    if(introSkipped) return;
    st.innerHTML = htmlStr; st.classList.remove('text-fade-out');
    if(spokenText) return talkSync(spokenText, lang, rate);
    else return Promise.resolve();
}

async function playScene(showIds, playAudio) {
    if(introSkipped) return Promise.resolve();
    const allLayers = ['layer-temple', 'layer-torii', 'layer-noface', 'layer-daruma']; 
    allLayers.forEach(id => { const el = document.getElementById(id); if(el && el.classList.contains('show-layer')) { el.style.opacity = 0; setTimeout(() => { el.classList.remove('show-layer'); }, 600); } });
    if (!showIds || !showIds.includes('neko-hero')) { const n = document.getElementById('neko-hero'); n.style.opacity = 0; setTimeout(() => { n.style.display = 'none'; }, 600); } 
    else { const n = document.getElementById('neko-hero'); n.style.display = 'flex'; setTimeout(() => { n.style.opacity = 1; }, 50); }
    await new Promise(r => setTimeout(r, 600));
    if(introSkipped) return;
    allLayers.forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.display = 'none'; });
    if(showIds) { const targets = Array.isArray(showIds) ? showIds : [showIds]; targets.forEach(id => { if(id !== 'neko-hero') { let el = document.getElementById(id); if(el) { el.style.display = 'flex'; void el.offsetWidth; el.style.opacity = 1; el.classList.add('show-layer'); } } }); }
    if(playAudio) playAudio();
    await new Promise(r => setTimeout(r, 200)); 
}

window.addEventListener('deviceorientation', (e) => {
    if(e.gamma !== null && e.beta !== null) {
        hasGyro = true;
        const compass = document.getElementById('needle-gold');
        if(compass) compass.style.transform = `rotate(${-e.alpha}deg)`;
        
        let px = e.gamma * 2; let py = (e.beta - 45) * 2; 
        document.documentElement.style.setProperty('--px', `${px}px`); document.documentElement.style.setProperty('--py', `${py}px`);
        document.documentElement.style.setProperty('--sx', `${-px * 0.3}px`); document.documentElement.style.setProperty('--sy', `${8 - py * 0.3}px`);
    }
}, true);

window.addEventListener('devicemotion', (e) => {
    if(!document.getElementById('screen-hub').classList.contains('active')) return;
    if(Math.abs(e.acceleration.x) > 3 || Math.abs(e.acceleration.y) > 3 || Math.abs(e.acceleration.z) > 3) {
        if(navigator.vibrate) navigator.vibrate(10); 
    }
}, true);

function nextRule() {
    playGameSFX('woosh');
    document.getElementById(`rule-${currentRule}`).style.display = 'none';
    currentRule++;
    if(currentRule > 4) {
        transitionScreen('screen-oath', "✨");
        document.getElementById('oath-names').innerText = mikoNames.join(" • ");
        resizeConstellationCanvas();
    } else {
        document.getElementById(`rule-${currentRule}`).style.display = 'flex';
    }
}

const runes = document.querySelectorAll('.rune-node');
let activeRunes = new Set();
const canvasLines = document.getElementById('constellation-lines');
const ctxLines = canvasLines ? canvasLines.getContext('2d') : null;

function resizeConstellationCanvas() {
    if(canvasLines) { canvasLines.width = document.getElementById('constellation-box').offsetWidth; canvasLines.height = document.getElementById('constellation-box').offsetHeight; }
}
window.addEventListener('resize', resizeConstellationCanvas);

function drawConstellation() {
    if(!ctxLines) return;
    ctxLines.clearRect(0, 0, canvasLines.width, canvasLines.height);
    if(activeRunes.size < 2) return;
    
    ctxLines.beginPath(); ctxLines.strokeStyle = "rgba(255, 215, 0, 0.8)"; ctxLines.lineWidth = 4;
    let first = true;
    activeRunes.forEach(rune => {
        const boxRect = document.getElementById('constellation-box').getBoundingClientRect();
        const rect = rune.getBoundingClientRect();
        const x = rect.left - boxRect.left + rect.width / 2;
        const y = rect.top - boxRect.top + rect.height / 2;
        if(first) { ctxLines.moveTo(x, y); first = false; } else { ctxLines.lineTo(x, y); }
    });
    ctxLines.closePath(); ctxLines.stroke(); ctxLines.fillStyle = "rgba(255, 183, 197, 0.3)"; ctxLines.fill();
}

runes.forEach((rune) => {
    const handlePointerDown = (e) => {
        e.preventDefault();
        if(!activeRunes.has(rune)) {
            activeRunes.add(rune); 
            rune.style.transform = "translate(-50%, -50%) scale(1.5)"; 
            rune.style.filter = "drop-shadow(0 0 20px var(--gold))";
            if(navigator.vibrate) navigator.vibrate(15); 
            playGameSFX('beep', 880 + (activeRunes.size * 50));
            document.getElementById('touch-count').innerText = activeRunes.size; 
            drawConstellation();
            
            if(activeRunes.size >= 8 || (TEST_MODE && activeRunes.size >= 1)) {
                runes.forEach(r => r.style.pointerEvents = 'none'); setTimeout(() => validateOath(), 500);
            }
        }
    };
    
    const handlePointerUp = (e) => {
        e.preventDefault(); 
        if (e.pointerType === 'mouse') return;

        activeRunes.delete(rune); 
        rune.style.transform = "translate(-50%, -50%) scale(1)"; 
        rune.style.filter = "none";
        document.getElementById('touch-count').innerText = activeRunes.size; 
        drawConstellation();
    };

    rune.addEventListener('pointerdown', handlePointerDown); 
    rune.addEventListener('pointerup', handlePointerUp); 
    rune.addEventListener('pointercancel', handlePointerUp); 
    rune.addEventListener('pointerleave', handlePointerUp);
});

function validateOath() {
    playGameSFX('chime_portal'); confetti({ particleCount: 150 });
    setTimeout(() => { gameStartTime = Date.now(); enterHub(); }, 1500);
}

let skipFillObj = null; let skipProgress = 0; let skipAnimFrame;
document.addEventListener('pointerdown', startSkip);
document.addEventListener('pointerup', endSkip);

function startSkip(e) {
    if(!document.getElementById('screen-narrative').classList.contains('active')) return;
    document.getElementById('skip-zone').style.display = 'flex'; skipFillObj = document.getElementById('skip-fill'); skipProgress = 0; growSkip();
}
function growSkip() {
    skipProgress += 5; if(skipFillObj) { skipFillObj.style.width = skipProgress + '%'; skipFillObj.style.height = skipProgress + '%'; }
    if(skipProgress >= 100) { forceSkipIntro(); return; } skipAnimFrame = requestAnimationFrame(growSkip);
}
function endSkip() { cancelAnimationFrame(skipAnimFrame); if(skipFillObj){ skipFillObj.style.width = '0%'; skipFillObj.style.height = '0%';} document.getElementById('skip-zone').style.display = 'none'; }

function forceSkipIntro() {
    introSkipped = true; window.speechSynthesis.cancel();
    document.getElementById('skip-zone').style.display = 'none';
    if(window.setSakuraMood) window.setSakuraMood('RITUEL');
    transitionScreen('screen-rules', "📜"); 
}

async function launchExperience(event) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); 
    
    if(event && event.clientX) {
        let paw = document.createElement('div'); paw.className = 'magic-paw'; paw.innerText = '🐾';
        paw.style.left = event.clientX + 'px'; paw.style.top = event.clientY + 'px';
        document.body.appendChild(paw); setTimeout(() => paw.remove(), 1000); playGameSFX('beep', 880);
    }
    document.getElementById('intro-title').style.opacity = 0; document.querySelector('.bg-kanji').style.opacity = 0; document.getElementById('btn-start').style.display = 'none';
    
    clearTimeout(eyesTimeout); const eyes = document.getElementById('intro-eyes');
    if(eyes) { eyes.style.transition = 'opacity 0.5s ease'; eyes.style.opacity = 0; setTimeout(() => { eyes.style.display = 'none'; }, 500); }
    
    initSfx(); if(window.setSakuraMood) window.setSakuraMood('INTRO');
    await new Promise(r => setTimeout(r, 1000));
    if(introSkipped) return;
    
    await playScene('layer-temple', () => playGameSFX('thud'));
    await showStoryText("Il y a bien longtemps, au cœur du Japon...", "Mukashi mukashi, Nihon no chūshin de...", "ja-JP");
    if(introSkipped) return;
    
    await playScene('layer-torii', () => playMikoChime(2));
    await showStoryText("La forêt était imprégnée de magie pure.", "Mori wa junsui na mahō de mitasarete imashita.", "ja-JP");
    if(introSkipped) return;

    await playScene('layer-noface', () => { playMikoChime(4); playMikoChime(5); });
    await showStoryText("Les esprits Kodamas veillaient sur Neko-Jinja.", "Kodama no seirei ga Neko-Jinja o mimamotte imashita.", "ja-JP");
    if(introSkipped) return;

    const n = document.getElementById('neko-hero'); n.classList.remove('sleeping'); n.classList.add('cinematic-mode');
    document.getElementById('kusanagi-sword').style.display = 'block'; 
    
    await playScene('neko-hero', () => playMikoChime(1));
    await showStoryText("Le Gardien protégeait l'épée sacrée Kusanagi.", "Shugosha wa seinaru tsurugi, Kusanagi o mamotte imashita.", "ja-JP");
    if(introSkipped) return;

    transitionToDarkAudio(); document.getElementById('kusanagi-sword').classList.add('kusanagi-break'); 
    await new Promise(r => setTimeout(r, 800));

    n.classList.add('sucked-in'); playGameSFX('woosh');
    await new Promise(r => setTimeout(r, 1200));

    const flash = document.getElementById('flash'); flash.style.background = 'red'; flash.style.opacity = 1;
    document.getElementById('main-body').classList.add('violent-shake'); 
    playThunder(); if(navigator.vibrate) navigator.vibrate([300, 100, 400]);
    setTimeout(() => { flash.style.opacity = 0; flash.style.background = 'white'; }, 200);
    setTimeout(() => document.getElementById('main-body').classList.remove('violent-shake'), 400);
    n.style.display = 'none';

    if(window.setSakuraMood) window.setSakuraMood('DARUMA');

    // LE BOSS DARUMA ROUGE APPARAÎT BIEN À L'ÉCRAN
    await playScene('layer-daruma', () => { document.getElementById('cinematic-daruma').classList.add('awake'); playEvilLaugh(); });
    await showStoryText("Mais l'Ombre a pris forme et brisé le sceau !", "Kage ga katachi o nashi, fūin o yabutta!", "ja-JP");
    if(introSkipped) return;

    document.getElementById('cinematic-daruma').classList.add('glitch-active');
    if(navigator.vibrate) navigator.vibrate([100, 50, 300, 100, 500]); 
    
    const relicsBox = document.getElementById('relics'); relicsBox.innerHTML = '';
    const emojis = ["🍡", "⚔️", "🥷", "💖", "🦊", "🍙", "🧘", "🥁", "🏯"];
    emojis.forEach((em, i) => {
        let angle = (i * 40) * (Math.PI / 180); let tx = Math.cos(angle) * 300 + "px"; let ty = Math.sin(angle) * 300 + "px";
        relicsBox.innerHTML += `<div class="fleeing-neko" style="--tx: ${tx}; --ty: ${ty}; animation: blast-out 1s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;">${em}</div>`;
    });
    setTimeout(() => { relicsBox.innerHTML = ''; }, 1500);

    playGameSFX('sword');
    await showStoryText("L'harmonie est brisée.<br><span class='line-break'>Les 9 Nekos dispersés.</span>", "Chōwa wa kuzure, kokonotsu no neko wa chitte shimatta.", "ja-JP");
    if(introSkipped) return;

    await playScene(null); 
    if(!introSkipped) { forceSkipIntro(); }
}

function updateHeartBeat() {
    hubTimer++;
    const heart = document.getElementById('shadow-heart');
    const beatSpeed = Math.max(0.2, 1 - (hubTimer / 60)); 
    const scale = 1 + (hubTimer / 100);
    heart.style.animation = `pulse-core ${beatSpeed}s infinite alternate`;
    heart.style.transform = `scale(${scale})`;
    
    document.documentElement.style.setProperty('--darkness', 0); 
    if(hubTimer % Math.ceil(beatSpeed*2) === 0) playGameSFX('heartbeat');
}

function enterHub() {
    transitionScreen('screen-hub');
    const grid = document.getElementById('grid-nekos'); grid.innerHTML = "";
    guardianData.forEach((g, i) => { 
        let isUnlocked = i < currentFound;
        grid.innerHTML += `<div id="slot-${i}" class="slot ${isUnlocked ? 'unlocked' : ''}" onclick="handleSlotClick(${i})">${isUnlocked ? g.e : '🔒'}</div>`; 
    });
    document.getElementById('found-count').innerText = currentFound;
    document.getElementById('hub-progress-bar').style.width = (currentFound / 9 * 100) + "%";

    updateDynamicMusic(); document.documentElement.style.setProperty('--bg-lightness', (10 + (currentFound * 8)) + '%');
    hubTimer = 0; document.documentElement.style.setProperty('--darkness', 0); document.getElementById('shadow-heart').style.transform = `scale(1)`;
    if(heartInterval) clearInterval(heartInterval); heartInterval = setInterval(updateHeartBeat, 1000);
    if(!window.needleInterval) window.needleInterval = setInterval(() => { if(!hasGyro) document.getElementById('needle-gold').style.transform=`rotate(${Math.sin(Date.now()/500)*35}deg)`; }, 50);
}

function handleSlotClick(idx) { 
    if(idx === currentFound) { clearInterval(heartInterval); setupQuiz(); } 
    else if (idx < currentFound) alert("🌸 Déjà libéré !"); else alert("🔒 Dans l'ordre !"); 
}

function startScan() {
    if(TEST_MODE) {
        document.getElementById('btn-scan').style.display = 'none';
        setTimeout(() => {
            playGameSFX('pop');
            const flash = document.getElementById('flash'); flash.style.background = 'white'; flash.style.opacity = 1;
            setTimeout(() => { flash.style.opacity = 0; clearInterval(heartInterval); setupQuiz(); }, 500);
        }, 1000);
        return; 
    }

    document.body.classList.add('ar-mode'); document.body.classList.add('ar-corrupted'); 
    document.getElementById('btn-scan').style.display = 'none'; document.getElementById('btn-cancel-scan').style.display = 'block';
    document.getElementById('canvas-fx').style.display = 'none';

    if(!html5QrcodeScanner) html5QrcodeScanner = new Html5Qrcode("qr-reader");
    html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (decodedText) => {
        if(decodedText === guardianData[currentFound].qr) {
            document.body.classList.remove('ar-corrupted'); playGameSFX('pop');
            const flash = document.getElementById('flash'); flash.style.background = 'white'; flash.style.opacity = 1;
            setTimeout(() => { flash.style.opacity = 0; stopScan(); clearInterval(heartInterval); setupQuiz(); }, 500);
        } else { playWrong(); alert("❌ Ce n'est pas le bon Neko ! Cherchez encore !"); }
    }).catch(err => { alert("Erreur Caméra. Activez le test via l'URL (?debug=true)."); stopScan(); });
}

function stopScan() {
    document.body.classList.remove('ar-mode'); document.body.classList.remove('ar-corrupted');
    document.getElementById('btn-scan').style.display = 'block'; document.getElementById('btn-cancel-scan').style.display = 'none';
    document.getElementById('canvas-fx').style.display = 'block';
    if(html5QrcodeScanner) html5QrcodeScanner.stop().catch(e => console.log(e));
}

function setupQuiz() {
    const g = guardianData[currentFound];
    document.getElementById('quiz-emoji').innerText = g.e; document.getElementById('quiz-title').innerText = "Garde " + g.n; document.getElementById('quiz-question').innerText = g.q;
    let html = ""; g.a.forEach((opt, idx) => html += `<div id="opt-${idx}" class="btn-ema" onclick="verifyQuiz(${idx})">${opt}</div>`);
    document.getElementById('quiz-options').innerHTML = html;
    
    transitionScreen('screen-quiz', g.e);
    
    const u = new SpeechSynthesisUtterance(g.q); u.lang = "ja-JP"; u.volume = 0.5; window.speechSynthesis.speak(u);

    let fuseTime = 100; document.getElementById('fuse-bar').style.width = "100%";
    if(quizInterval) clearInterval(quizInterval);
    quizInterval = setInterval(() => {
        fuseTime -= 1; document.getElementById('fuse-bar').style.width = fuseTime + "%";
        if(fuseTime <= 0) { clearInterval(quizInterval); window.speechSynthesis.cancel(); playWrong(); playEvilLaugh(); hpOni=10; document.getElementById('oni-pv').innerText=hpOni; document.getElementById('oni-fight').style.display='flex'; }
    }, 100);
}

function verifyQuiz(idx) {
    clearInterval(quizInterval); window.speechSynthesis.cancel();
    if(idx === guardianData[currentFound].r) { playCorrect(); confetti({ particleCount: 50 }); setTimeout(() => playMinigame(), 500); } 
    else { document.getElementById(`opt-${idx}`).classList.add('broken'); playWrong(); playEvilLaugh(); hpOni=10; document.getElementById('oni-pv').innerText=hpOni; document.getElementById('oni-fight').style.display='flex'; }
}

function exorcise() { 
    hpOni--; document.getElementById('oni-pv').innerText = hpOni; 
    const oni = document.querySelector('.shake-oni');
    oni.classList.add('oni-hit');
    setTimeout(() => oni.classList.remove('oni-hit'), 150);
    
    if(navigator.vibrate) navigator.vibrate(80); 
    if(hpOni<=0) document.getElementById('oni-fight').style.display='none'; 
}

let micContext = null; let micAnalyser = null; let micStream = null; let micLoop = null;

function playMinigame() {
    const g = guardianData[currentFound];
    transitionScreen('screen-game', g.e);
    
    document.getElementById('target-name').innerText = g.n; document.getElementById('game-instr').innerText = g.instr;
    const arena = document.getElementById('game-arena'); arena.innerHTML=`<div id="game-target">${g.e}</div>`;
    const target = document.getElementById('game-target');
    document.getElementById('progress-container').style.display='block'; document.getElementById('progress-bar').style.width="0%";
    
    let score=0; let timer; let isGameActive = true; 
    const updateP = (s, goal) => { if(!isGameActive) return; let p=Math.min((s/goal)*100, 100); document.getElementById('progress-bar').style.width=p+"%"; if(p>=100) { isGameActive = false; clearInterval(timer); winGame(); } };

    if(g.type === "hold") { const startH=(e)=>{if(e.cancelable) e.preventDefault(); timer=setInterval(()=>{score+=2; playGameSFX('pop'); if(navigator.vibrate) navigator.vibrate(10); updateP(score, 100);},50);}; const endH=()=>clearInterval(timer); target.onmousedown=startH; target.onmouseup=endH; target.ontouchstart=startH; target.ontouchend=endH; }
    else if(g.type === "rhythm") { timer=setInterval(()=>{target.style.transform="scale(1.5)"; target.dataset.r="1"; setTimeout(()=>{target.style.transform="scale(1)"; target.dataset.r="0";},400);},1000); target.onclick=()=>{if(target.dataset.r==="1"){score++; playGameSFX('sword'); if(navigator.vibrate) navigator.vibrate([20, 20]); updateP(score, 5);}}; }
    else if(g.type === "catch") { target.classList.add('catch-target'); timer=setInterval(()=>{target.style.left=(Math.random()*60-30)+"px"; target.style.top=(Math.random()*60-30)+"px"; playGameSFX('woosh');},350); target.onclick=()=>{score++; playCorrect(); if(navigator.vibrate) navigator.vibrate(50); updateP(score, 5);}; }
    else if(g.type === "swipe") { let startX=0; target.ontouchstart=(e)=>startX=e.touches[0].clientX; target.ontouchend=(e)=>{if(Math.abs(e.changedTouches[0].clientX-startX)>50){score++; playGameSFX('woosh'); updateP(score, 5);}}; target.onclick=()=>{score++; playGameSFX('woosh'); updateP(score, 5);}; }
    else if(g.type === "shake") { if (window.DeviceMotionEvent) window.ondevicemotion=(e)=>{if(Math.abs(e.acceleration.x)>15 || Math.abs(e.acceleration.y)>15){score++; playMikoChime(Math.floor(Math.random()*8)); if(navigator.vibrate) navigator.vibrate(10); updateP(score, 50);}}; target.onclick=()=>{score+=5; playMikoChime(Math.floor(Math.random()*8)); updateP(score, 50);}; }
    else if(g.type === "mash") { target.onclick=()=>{ score++; playGameSFX('thud'); document.body.classList.add('shake-screen'); setTimeout(() => document.body.classList.remove('shake-screen'), 50); if(navigator.vibrate) navigator.vibrate([50]); updateP(score, 30);}; }
    else if(g.type === "statue") { target.style.opacity=0.5; playGameSFX('zen'); timer=setTimeout(()=>{ updateP(1,1); },4000); document.body.ontouchstart=()=>{clearTimeout(timer); playGameSFX('zen'); timer=setTimeout(()=>{updateP(1,1);},4000);}; }
    else if(g.type === "drum") { arena.innerHTML=`<div style="display:flex;"><div class="drum-btn" id="btn-G">G</div><div class="drum-btn" id="btn-D">D</div></div>`; let last=""; document.getElementById('btn-G').onclick=()=>{if(last!=="G"){score++; last="G"; playGameSFX('drum_g'); if(navigator.vibrate) navigator.vibrate(40); updateP(score, 10);}}; document.getElementById('btn-D').onclick=()=>{if(last!=="D"){score++; last="D"; playGameSFX('drum_d'); if(navigator.vibrate) navigator.vibrate(40); updateP(score, 10);}}; }
    else if(g.type === "memory") { const seq=["🍡","🦊","🍡","⛩️"]; let userSeq=[]; target.innerText="Regarde..."; setTimeout(()=>{target.innerText="🍡"; playGameSFX('beep', 440);},1000); setTimeout(()=>{target.innerText="🦊"; playGameSFX('beep', 554);},2000); setTimeout(()=>{target.innerText="🍡"; playGameSFX('beep', 440);},3000); setTimeout(()=>{target.innerText="⛩️"; playGameSFX('beep', 659);},4000); setTimeout(()=>{ arena.innerHTML=`<div style="display:flex; flex-wrap:wrap; justify-content:center;"><div class="mem-btn" onclick="mem('🍡')">🍡</div><div class="mem-btn" onclick="mem('🦊')">🦊</div><div class="mem-btn" onclick="mem('⛩️')">⛩️</div></div>`; window.mem=(s)=>{userSeq.push(s); playGameSFX('beep', 880); if(userSeq[userSeq.length-1]!==seq[userSeq.length-1]){userSeq=[]; playEvilLaugh(); hpOni=10; document.getElementById('oni-pv').innerText=hpOni; document.getElementById('oni-fight').style.display='flex';} else {score++; updateP(score, 4); playCorrect();}}; },5000); }
    
    else if(g.type === "mic") {
        document.getElementById('mic-gauge').style.display = 'block';
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            micStream = stream; micContext = new (window.AudioContext || window.webkitAudioContext)();
            micAnalyser = micContext.createAnalyser(); micAnalyser.fftSize = 256;
            const source = micContext.createMediaStreamSource(stream); source.connect(micAnalyser);
            const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
            function checkAudio() {
                if(!isGameActive) return;
                micAnalyser.getByteFrequencyData(dataArray);
                let sum = 0; for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                let avg = sum / dataArray.length;
                document.getElementById('mic-level').style.height = Math.min(avg, 100) + '%';
                if(avg > 50) { score+=1; updateP(score, 50); if(navigator.vibrate) navigator.vibrate(10); }
                micLoop = requestAnimationFrame(checkAudio);
            } checkAudio();
        }).catch(err => {
            document.getElementById('mic-gauge').style.display = 'none';
            document.getElementById('game-instr').innerText = "Micro refusé ! Glissez le doigt à la place !";
            let startX=0; target.ontouchstart=(e)=>startX=e.touches[0].clientX; target.ontouchend=(e)=>{if(Math.abs(e.changedTouches[0].clientX-startX)>50){score++; playGameSFX('woosh'); updateP(score, 5);}}; target.onclick=()=>{score++; playGameSFX('woosh'); updateP(score, 5);};
        });
    }
}

function winGame() {
    const wonIndex = currentFound; currentFound++; 
    window.ondevicemotion = null; document.body.ontouchstart = null; window.speechSynthesis.cancel();
    
    if(micStream) { micStream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(micLoop); document.getElementById('mic-gauge').style.display = 'none'; }
    
    const arena = document.getElementById('game-arena');
    arena.innerHTML = `<div style="font-size:100px;">✨</div>`; document.getElementById('game-instr').innerText = "RÉUSSI !";
    setTimeout(() => { if(currentFound >= 9) launchFinalCinematic(); else animateSoulToHub(wonIndex); }, 1500);
}

function animateSoulToHub(idx) {
    transitionScreen('screen-hub');
    setTimeout(() => {
        const grid = document.getElementById('grid-nekos'); grid.innerHTML = "";
        guardianData.forEach((g, i) => { let isUnlocked = i < currentFound - 1; grid.innerHTML += `<div id="slot-${i}" class="slot ${isUnlocked ? 'unlocked' : ''}" onclick="handleSlotClick(${i})">${isUnlocked ? g.e : '🔒'}</div>`; });

        let flyingSoul = document.createElement('div'); flyingSoul.className = 'captured-soul'; flyingSoul.innerText = guardianData[idx].e; document.body.appendChild(flyingSoul);
        setTimeout(() => {
            const targetSlot = document.getElementById(`slot-${idx}`); const rect = targetSlot.getBoundingClientRect();
            const x = rect.left + rect.width/2 - window.innerWidth/2; const y = rect.top + rect.height/2 - window.innerHeight*0.4;
            flyingSoul.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.5)`;
            
            setTimeout(() => {
                flyingSoul.remove(); targetSlot.classList.add('unlocked'); targetSlot.innerText = guardianData[idx].e;
                confetti({ particleCount: 80, origin: { x: rect.left/window.innerWidth, y: rect.top/window.innerHeight } }); playCorrect();
                document.getElementById('found-count').innerText = currentFound; document.getElementById('hub-progress-bar').style.width = (currentFound / 9 * 100) + "%";
                document.documentElement.style.setProperty('--bg-lightness', (10 + (currentFound * 8)) + '%'); updateDynamicMusic();
                hubTimer = 0; document.documentElement.style.setProperty('--darkness', 0);
                if(heartInterval) clearInterval(heartInterval); heartInterval = setInterval(updateHeartBeat, 1000);
            }, 1000);
        }, 100);
    }, 600);
}

async function launchFinalCinematic() {
    transitionScreen('screen-final', "✨");
    const fs = document.getElementById('final-circ-nekos');
    
    document.getElementById('sky-background').style.opacity = 1; 
    document.getElementById('flash').style.opacity = 1; if(window.setSakuraMood) window.setSakuraMood('FINAL');
    if(navigator.vibrate) navigator.vibrate([200, 50, 200, 50, 200]);
    setTimeout(() => document.getElementById('flash').style.opacity = 0, 200);
    setTimeout(() => { document.getElementById('final-title').style.opacity = 1; document.getElementById('final-title').style.transform = "translateY(0)"; }, 1000);

    await new Promise(r => setTimeout(r, 1500));
    const sf = document.getElementById('final-story-box');
    const showFinalText = async (htmlStr, spokenText, lang = "ja-JP") => { 
        sf.style.opacity = 0; await new Promise(r => setTimeout(r, 400)); 
        sf.innerHTML = htmlStr; sf.style.opacity = 1; return talkSync(spokenText, lang, 0.9); 
    };

    sf.style.transition = "opacity 0.4s ease";
    await showFinalText("Les 9 Gardiens sont réunis.", "Kokonotsu no shugosha ga atsumatta.");
    
    // Le Daruma apparait
    document.getElementById('final-daruma').style.opacity = 0; document.getElementById('final-daruma').style.transform = "translate(-50%, -50%) scale(2)";
    playThunder(); if(navigator.vibrate) navigator.vibrate([300, 100, 400]);
    document.getElementById('flash').style.background = 'white'; document.getElementById('flash').style.opacity = 1;
    setTimeout(() => { document.getElementById('flash').style.opacity = 0; }, 500);

    await showFinalText("L'Ombre se dresse une dernière fois.", "Kage ga saigo ni tachiagaru."); 
    await showFinalText("Mais la magie des héroïnes est plus forte !", "Shikashi, hiroin no mahō wa sāra ni tsuyoi!"); 

    for(let i=0; i<mikoNames.length; i++) {
        const el = document.createElement('div'); el.className='final-node falling-star'; el.innerText = mikoNames[i];
        const rad = (i/mikoNames.length)*Math.PI*2;
        el.style.left = (150 + Math.cos(rad)*140 - 30) + "px"; el.style.top = (150 + Math.sin(rad)*140 - 45) + "px";
        fs.appendChild(el);
        setTimeout(() => { playMikoChime(i);}, i*300);
    }
    
    await new Promise(r => setTimeout(r, mikoNames.length*300 + 1000));
    
    const nodes = document.querySelectorAll('.final-node');
    nodes.forEach((node, i) => {
        setTimeout(() => {
            node.style.color = "var(--gold)"; node.style.textShadow = "0 0 20px var(--gold)";
            const rad = (i/mikoNames.length)*Math.PI*2;
            let laser = document.createElement('div'); laser.className = 'laser-beam';
            laser.style.left = (150 + Math.cos(rad)*140) + "px"; laser.style.top = (150 + Math.sin(rad)*140) + "px";
            laser.style.transform = `rotate(${rad + Math.PI}rad)`; laser.style.setProperty('--length', '140px');
            fs.appendChild(laser); playGameSFX('sword'); if(navigator.vibrate) navigator.vibrate(50);
        }, i * 200);
    });

    await new Promise(r => setTimeout(r, nodes.length*200 + 300));
    
    // Le Daruma disparait
    playThunder(); if(navigator.vibrate) navigator.vibrate([300, 100, 400]);
    document.getElementById('flash').style.background = 'white'; document.getElementById('flash').style.opacity = 1;
    document.getElementById('final-daruma').style.display = 'none';
    setTimeout(() => { document.getElementById('flash').style.opacity = 0; }, 500);
    
    nodes.forEach(n => n.style.opacity = 0); 
    setTimeout(() => { document.getElementById('final-neko-hero').style.opacity = 1; }, 500);
    await new Promise(r => setTimeout(r, 1500));
    
    await showFinalText("<span style='color:white;'>La lumière brille à nouveau sur Neko-Jinja.</span>", "Hikari ga futatabi Neko-Jinja o terasu."); 
    await showFinalText("Votre amitié a purifié l'Ombre.", "Anata-tachi no yūjō ga kage o jōka shimashita."); 
    await showFinalText("Les Gardiens vous remercient pour votre courage.", "Shugosha-tachi wa anata no yūki ni kansha shite imasu.");
    await showFinalText("Le parchemin a scellé votre victoire.", "Yōhishi wa anata no shōri o fūin shimashita.");

    let elapsedMs = Date.now() - gameStartTime; let mins = Math.floor(elapsedMs / 60000); let secs = Math.floor((elapsedMs % 60000) / 1000);
    document.getElementById('cert-time').innerText = `${mins} min et ${secs} sec`;
    
    const cert = document.getElementById('victory-cert'); cert.style.display = 'block';
    
    document.getElementById('selfie-container').style.display = 'block';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
    .then(stream => { document.getElementById('selfie-cam').srcObject = stream; })
    .catch(e => { console.log("Pas de camera selfie possible"); document.getElementById('selfie-container').style.display = 'none'; });

    setTimeout(() => { cert.style.transform = 'scale(1)'; }, 100);

    const ivConf = setInterval(() => confetti({ particleCount: 30, origin: { y: 0.8 } }), 1500);
    confetti({ particleCount: 200, origin: {y: 0.8} }); 
    if(navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    
    await showFinalText("<span style='font-size:26px;'>Prenez le screenshot pour le Selfie de Légende !</span>", "Prenez le screenshot pour le Selfie de Légende !", "fr-FR"); 
    
    await new Promise(r => setTimeout(r, 2000));
    await showFinalText("<span style='font-size:26px;'>Et maintenant... Direction chez AVA pour un goûter DE LÉGENDE !</span>", "Et maintenant... Direction chez AVA pour un goûter DE LÉGENDE !", "fr-FR"); 

    document.getElementById('btn-download').style.display = "block"; setTimeout(() => document.getElementById('btn-download').style.transform = "scale(1)", 100);
    
    setTimeout(() => clearInterval(ivConf), 5000);
}

function downloadPolaroid() {
    const video = document.getElementById('selfie-cam');
    const canvas = document.getElementById('polaroid-canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1080; canvas.height = 1400;
    
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#1a051d";
    ctx.fillRect(80, 80, 920, 920);

    if(video && video.videoWidth > 0) {
        const size = Math.min(video.videoWidth, video.videoHeight);
        const x = (video.videoWidth - size) / 2;
        const y = (video.videoHeight - size) / 2;
        ctx.drawImage(video, x, y, size, size, 80, 80, 920, 920);
    }

    ctx.fillStyle = "#d32f2f";
    ctx.font = "bold 80px 'Ma Shan Zheng', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pacte Accompli", canvas.width / 2, 1150);

    ctx.fillStyle = "#3d2f2d";
    ctx.font = "40px 'Fredoka One', sans-serif";
    ctx.fillText("Le Sanctuaire des 9 Nekos", canvas.width / 2, 1250);

    let elapsedMs = Date.now() - gameStartTime; let mins = Math.floor(elapsedMs / 60000); let secs = Math.floor((elapsedMs % 60000) / 1000);
    ctx.font = "30px sans-serif";
    ctx.fillText(`Purifié en ${mins} min et ${secs} sec par les 8 Mikos.`, canvas.width / 2, 1320);

    const link = document.createElement('a');
    link.download = 'Sanctuaire-Polaroid-Souvenir.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    playGameSFX('pop');
    if(navigator.vibrate) navigator.vibrate(50);
}
