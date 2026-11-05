/* An input-grounded, three-stage walkthrough. Feature-token activity is schematic. */
(() => {
  'use strict';
  const root = document.querySelector('#method-tour');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const canvas = $('#method-canvas'), ctx = canvas.getContext('2d', {alpha: true});
  const tabs = [...root.querySelectorAll('[data-tour-stage]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 24000, stageDuration = duration / 3;
  const colors = {blue:'#78dfff', amber:'#ffc481', violet:'#c3a2ff', mint:'#73edbf'};
  const asset = name => `assets/method/${name}.webp`;
  const sprite = (name, frames, label) => `<div><div class="signal-sprite" data-sprite="${frames}" style="background-image:url('${asset(name)}');background-size:${frames*100}% 100%" role="img" aria-label="${label}"></div></div>`;
  const card = (title, chip, content, kind = '', detail = '') => `<div class="signal-card"><div class="signal-card-header"><strong>${title}</strong><span class="signal-chip ${kind}">${chip}</span>${detail ? `<small>${detail}</small>` : ''}</div>${content}</div>`;
  const miniTokens = () => '<div class="token-mini" aria-hidden="true">'+Array.from({length:11},()=>'<i></i>').join('')+'</div>';
  const stages = [
    {
      kicker:'The inputs · exposure windows', title:'Deblur the endpoints.',
      description:'Exposure TD and SD deblur the RGB endpoint features.',
      output:'Two blur-robust endpoint features · r̃₀, r̃₁', visual:'Exposure-guided cross-attention',
      caption:'Recover sharp endpoint features.',
      aria:'RGB query tokens attend to exposure-time TD and exposure-center SD tokens, producing two blur-robust endpoint features.',
      inputs: () => card('Two blurry exposures','RGB',`<div class="signal-images"><img src="${asset('rgb0')}" alt="Real blurry RGB endpoint at t0"><img src="${asset('rgb1')}" alt="Real blurry RGB endpoint at t1"></div>`)
        +card('Within each exposure','TD',`<div class="signal-images">${sprite('td0',10,'Temporal differences within the first exposure')}${sprite('td1',10,'Temporal differences within the second exposure')}</div>`,'td')
        +card('At each exposure center','SD',`<div class="signal-images"><img src="${asset('sd0')}" alt="Spatial differences at t0"><img src="${asset('sd1')}" alt="Spatial differences at t1"></div>`,'sd'),
      pins:[['RGB tokens · Q',17,12,'blue'],['Exposure tokens · K, V',17,83,'amber'],['Cross-attention',49,74,'violet'],['r̃₀',82,13,'mint'],['r̃₁',82,83,'violet']],
    },
    {
      kicker:'The inputs · between exposures', title:'Fill the moments in between.',
      description:'High-rate SD fills the moments between corrected endpoints.',
      output:'Time-specific visual tokens · z̃₀ … z̃ₙ … z̃ₙ₋₁', visual:'SD-guided temporal querying',
      caption:'Interpolate intermediate visual tokens.',
      aria:'High-rate spatial differences query both endpoint features to fill a dense sequence of time-specific visual tokens.',
      inputs: () => card('Corrected endpoint memory','K, V','<div class="tour-memory"><div><b>r̃₀ + τ₀</b>Past endpoint</div><div><b>r̃₁ + τ₁</b>Future endpoint</div></div>','memory')
        +card('Structure at every instant','SD',`<div class="signal-images">${sprite('sd-sequence',13,'Real high-rate spatial difference sequence')}</div>`,'sd')
        +card('Shared appearance, distinct times','Q','<p class="signal-copy">SD queries the endpoint memory.</p>','memory'),
      pins:[['Endpoint appearance memory · K, V',50,13,'violet'],['t₀',10,46,'blue'],['t₁',91,46,'violet'],['High-rate SD · Q',50,90,'mint']],
    },
    {
      kicker:'The inputs · geometry and time', title:'Decode the whole scene, together.',
      description:'Dense tokens and time jointly recover geometry, appearance, and motion.',
      output:'Dynamic 4D Gaussians · sharp views across time', visual:'Joint 4D reconstruction',
      caption:'Explore the reconstructed scene.',
      aria:'A real predicted depth point cloud animated with predicted world-space scene flow. Drag or use arrow keys to rotate.',
      inputs: () => card('Dense visual tokens','z̃ₙ',miniTokens()+'<p class="signal-copy">+ source time</p>','memory')
        +card('Query time for motion','t','<label class="signal-time-control"><span>t₀</span><input id="method-query-time" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Query scene time"><span>t₁</span><output id="method-query-label">t = 0.50</output></label>','sd')
        +card('Rendered appearance','RGB',`<div class="signal-images">${sprite('sharp',13,'Native sharp RGB rendering at the selected time')}${sprite('depth',13,'Predicted depth at the selected time')}</div><p class="signal-copy">Sharp RGB · predicted depth</p>`),
      pins:[['Foundation aggregator',50,7,'mint']],
    },
  ];
  let stage = -1, clock = reduced.matches ? 4800 : 0, playing = !reduced.matches;
  let visible = false, raf = 0, lastNow = 0, lastRender = 0, width = 1, height = 1;
  let cloud = null, cloudRequested = false, output = 'gaussian', outputManual = false, query = .5, queryManual = false;
  let viewAngle = 0, pointer = 0, dragging = false, lastX = 0;
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const ease = t => {t=clamp(t); return t*t*(3-2*t);};
  const seed = n => {const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

  function setStage(index) {
    if (stage === index) return;
    stage = index; root.dataset.stage = index;
    const s=stages[index];
    $('#tour-input-heading').textContent=s.kicker; $('#tour-title').textContent=s.title;
    $('#tour-description').textContent=s.description; $('#tour-output-text').textContent=s.output;
    $('#tour-visual-title').textContent=s.visual; $('#tour-visual-caption').textContent=s.caption;
    $('#tour-visual-index').textContent=`0${index+1} / 03`;
    $('#tour-input-cards').innerHTML=s.inputs();
    $('#tour-annotations').innerHTML=s.pins.map(([label,x,y,color])=>`<span class="tour-pin ${color}" style="left:${x}%;top:${y}%">${label}</span>`).join('');
    $('#tour-heads').hidden=index!==2; $('.tour-drag-hint').hidden=index!==2;
    canvas.setAttribute('aria-label',s.aria);
    $('#tour-panel').setAttribute('aria-labelledby',`tour-tab-${index}`);
    tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',i===index);tab.tabIndex=i===index?0:-1;});
    if(index===2){
      loadCloud();
      $('#method-query-time').addEventListener('input',event=>{
        query=Number(event.target.value);queryManual=true;setPlaying(false);draw();
      });
    }
    resize();
  }

  async function loadCloud() {
    if(cloudRequested)return; cloudRequested=true;
    try {
      const response=await fetch('assets/method/scene.json');
      if(!response.ok)throw Error('Missing scene');
      cloud=await response.json();
      cloud.points.forEach(p=>{p.push(`rgb(${p[3]},${p[4]},${p[5]})`);});
      draw();
    } catch { $('#tour-visual-caption').textContent='The 3D preview could not load. The complete architecture diagram is available below.'; }
  }
  function setPlaying(value){
    playing=value;
    $('#tour-play').innerHTML=value?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';
    $('#tour-play').setAttribute('aria-label',`${value?'Pause':'Play'} method walkthrough`);
    $('#tour-state').textContent=value?'Animated walkthrough':'Explore at your pace';
    lastNow=0; if(value)schedule(); else {cancelAnimationFrame(raf);raf=0;draw();}
  }
  function seek(value){clock=clamp(value,0,duration-1);setStage(Math.floor(clock/stageDuration));draw();}
  function resize(){
    const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    width=bounds.width;height=bounds.height;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  }
  function schedule(){if(!raf&&playing&&visible&&!document.hidden)raf=requestAnimationFrame(tick);}
  function tick(now){
    raf=0;if(!playing||!visible||document.hidden){lastNow=0;return;}
    if(lastNow)clock=(clock+Math.min(now-lastNow,80))%duration;
    lastNow=now;
    setStage(Math.floor(clock/stageDuration));
    if(now-lastRender>1000/30){draw();lastRender=now;}
    schedule();
  }

  function line(points,color,alpha=.5,widthPx=1){
    ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=widthPx;ctx.beginPath();
    points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();
  }
  function glow(x,y,r,color,alpha=.25){
    ctx.save();const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');
    ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  function dot(x,y,r,color,alpha=1){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  function beam(x0,y0,x1,y1,color,t,offset=0){
    ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.24;ctx.lineWidth=1;
    const bend=(x1-x0)*.48;
    const pos=u=>{const v=1-u;return [v*v*v*x0+3*v*v*u*(x0+bend)+3*v*u*u*(x1-bend)+u*u*u*x1,
      v*v*v*y0+3*v*v*u*y0+3*v*u*u*y1+u*u*u*y1];};
    ctx.beginPath();ctx.moveTo(x0,y0);ctx.bezierCurveTo(x0+bend,y0,x1-bend,y1,x1,y1);ctx.stroke();ctx.restore();
    for(let i=0;i<4;i++){
      const u=(t*.22+i/4+offset)%1;const [x,y]=pos(u);dot(x,y,2.1,color,.9);
      const [px,py]=pos(Math.max(0,u-.04));line([[px,py],[x,y]],color,.6,2);
    }
  }
  function tokenPlane(x,y,w,h,color,phase,alpha=1,skew=-.22,noise=0,id=0){
    ctx.save();ctx.translate(x,y);ctx.transform(1,skew,.13,1,0,0);ctx.globalAlpha=alpha;
    ctx.fillStyle='#14253ad9';ctx.strokeStyle=color;ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(-w/2-5,-h/2-5,w+10,h+10,5);ctx.fill();ctx.stroke();
    const cols=7,rows=5,gap=Math.max(1.5,w*.025),cw=(w-gap*(cols-1))/cols,ch=(h-gap*(rows-1))/rows;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const n=seed(id*1000+r*cols+c),pulse=.45+.45*Math.sin(phase*2.8+c*.6-r*.8+n*2);
      const jitter=noise*Math.sin(phase*4+n*20)*w*.035;
      ctx.globalAlpha=alpha*(.2+n*.4+pulse*.3);ctx.fillStyle=color;
      ctx.fillRect(-w/2+c*(cw+gap)+jitter,-h/2+r*(ch+gap),cw,ch);
    }
    ctx.globalAlpha=alpha*.7;ctx.fillStyle='#dcf8ff';
    const col=Math.floor((phase*.8+id*.15)%cols);
    for(let r=0;r<rows;r++)ctx.fillRect(-w/2+col*(cw+gap),-h/2+r*(ch+gap),cw,ch*.14);
    ctx.restore();
  }
  function background(t){
    ctx.clearRect(0,0,width,height);
    const W=width,H=height;
    for(let i=0;i<50;i++){
      const x=seed(i)*W,y=(seed(i+70)*H-t*(2+seed(i+100)*4)+H*10)%H;
      dot(x,y,seed(i+40)>.8?1.2:.6,'#90b8de',.12+seed(i+20)*.14);
    }
    const horizon=H*.7;
    for(let i=-8;i<=8;i++)line([[W*.5+i*W*.04,horizon],[W*.5+i*W*.16,H]],'#446887',.12);
    for(let i=0;i<6;i++){const y=horizon+(H-horizon)*(i*i/25);line([[0,y],[W,y]],'#446887',.1);}
  }
  function endpoint(t,u){
    const W=width,H=height,s=Math.min(W/780,H/420),c=colors;
    const x0=W*.17,x1=W*.49,x2=W*.82,y0=H*.31,y1=H*.68,ym=H*.5;
    glow(x1,ym,130*s,c.violet,.13);glow(x2,H*.32,95*s,c.mint,.12);
    beam(x0+55*s,y0,x1-52*s,ym-15*s,c.blue,t);
    beam(x0+55*s,y1,x1-52*s,ym+18*s,c.amber,t,.1);
    beam(x1+50*s,ym-12*s,x2-52*s,y0,c.mint,t,.3);
    beam(x1+50*s,ym+12*s,x2-52*s,y1,c.violet,t,.5);
    tokenPlane(x0-5*s,y0-7*s,85*s,60*s,c.blue,t,.22,-.16,1,8);
    tokenPlane(x0,y0,85*s,60*s,c.blue,t,.95,-.16,1,0);
    tokenPlane(x0-6*s,y1-8*s,85*s,60*s,c.amber,t,.25,-.16,0,8);
    tokenPlane(x0,y1,85*s,60*s,c.amber,t,.9,-.16,0,2);
    const reveal=.5+.5*ease(u*2);
    tokenPlane(x2,y0,91*s,66*s,c.mint,t,reveal,-.15,0,10);
    tokenPlane(x2,y1,91*s,66*s,c.violet,t,reveal,-.15,0,16);
    ctx.save();ctx.translate(x1,ym);
    for(let k=0;k<3;k++){
      ctx.rotate((k%2?-.8:1)*t*.17);ctx.beginPath();ctx.ellipse(0,0,(43+k*12)*s,(43+k*12)*s,0,0,Math.PI*2);
      ctx.strokeStyle=k===1?c.violet:c.blue;ctx.globalAlpha=.2+k*.14;ctx.lineWidth=k===1?1.5:1;
      ctx.setLineDash(k===1?[6*s,7*s]:[]);ctx.stroke();
    }
    ctx.restore();
    for(let k=0;k<7;k++){const a=t*(k%2?-.7:.5)+k*2.4;dot(x1+Math.cos(a)*51*s,ym+Math.sin(a)*51*s,2*s,k%2?c.amber:c.blue,.8);}
    tokenPlane(x1,ym,32*s,27*s,c.violet,t,1,0,0,35);
  }
  function interpolate(t,u){
    const W=width,H=height,s=Math.min(W/780,H/420),c=colors;
    const active=(Math.sin((t-8)*.7-Math.PI/2)+1)/2;
    glow(W*.5,H*.5,180*s,c.violet,.12);
    tokenPlane(W*.28,H*.24,49*s,34*s,c.blue,t,.9,-.18,0,10);
    tokenPlane(W*.72,H*.24,49*s,34*s,c.violet,t,.9,-.18,0,16);
    const targetX=W*(.12+active*.76),targetY=H*(.57-active*.14);
    beam(W*.28,H*.28,targetX,targetY-33*s,c.blue,t,.2);
    beam(W*.72,H*.28,targetX,targetY-33*s,c.violet,t,.7);
    for(let i=0;i<13;i++){
      const f=i/12,x=W*(.12+f*.76),y=H*(.57-f*.14)+Math.sin(t*.8+i*.5)*3*s;
      const distance=Math.abs(f-active),alpha=(.25+.65*ease(u*3-i*.06))*(1-distance*.4);
      const color=i===0?c.blue:i===12?c.violet:`hsl(${192+f*74} 90% 77%)`;
      tokenPlane(x,y,43*s,69*s,color,t+i*.18,alpha,-.25,0,i+40);
      if(distance<.055){glow(x,y,50*s,c.violet,.13);beam(x,H*.77,x,y+48*s,c.mint,t,.2);}
      dot(x,H*.79,2.2*s,c.mint,distance<.08?1:.27);
    }
    line([[W*.12,H*.79],[W*.88,H*.79]],c.mint,.2);
    for(let i=0;i<9;i++){
      const f=(t*.17+i/9)%1;dot(W*(.12+f*.76),H*.79,2*s,c.mint,.8);
    }
    dot(targetX,H*.79,4*s,c.mint);glow(targetX,H*.79,25*s,c.mint,.2);
    ctx.save();ctx.fillStyle='#b9d8e9';ctx.font=`${Math.max(10,11*s)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText(`t = ${active.toFixed(2)}`,targetX,H*.79+22*s);ctx.restore();
  }
  function depthColor(z){const f=clamp((z+1.1)/2.2);return `hsl(${240-f*220} 82% 65%)`;}
  function reconstruction(t,u){
    const W=width,H=height,s=Math.min(W/780,H/420),c=colors;
    if(playing&&!outputManual)output=['camera','depth','gaussian','motion'][Math.min(3,Math.floor(u*4))];
    root.querySelectorAll('[data-output]').forEach((button,i)=>{button.setAttribute('aria-pressed',button.dataset.output===output);button.dataset.lit=String(u>.1+i*.1);});
    tokenPlane(W*.12,H*.11,28*s,22*s,c.violet,t,.7,-.18,0,50);
    tokenPlane(W*.16,H*.11,28*s,22*s,c.violet,t,.8,-.18,0,51);
    beam(W*.2,H*.11,W*.48,H*.14,c.violet,t);
    for(let i=0;i<4;i++)if(u>.1+i*.1)beam(W*.5,H*.15,W*(.15+i*.235),H*.94,c.mint,t,i*.19);
    const yaw=viewAngle+pointer*.06+(playing?Math.sin(t*.48)*.17:.08),pitch=-.07;
    const ca=Math.cos(yaw),sa=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const project=(x,y,z)=>{
      const xx=ca*x+sa*z,zz=-sa*x+ca*z,yy=cp*y-sp*zz,zzz=sp*y+cp*zz;
      const k=3.7/(4.4+zzz);return [W*.5+xx*k*W*.29,H*.48+yy*k*W*.29,zzz,k];
    };
    glow(W*.5,H*.5,230*s,c.mint,.08);
    for(let ring=0;ring<2;ring++){
      const points=[];for(let i=0;i<=80;i++){
        const a=i/80*Math.PI*2;points.push(project(Math.cos(a)*(1.85+ring*.2),.85,Math.sin(a)*(1.05+ring*.15)));
      }line(points,c.mint,ring?.09:.21,1);
    }
    if(!cloud){
      ctx.save();ctx.fillStyle='#b7dacb';ctx.textAlign='center';ctx.font='12px sans-serif';ctx.fillText('Loading predicted geometry…',W/2,H/2);ctx.restore();return;
    }
    if(!queryManual&&playing)query=(Math.sin((t-16)*.65-Math.PI/2)+1)/2;
    const index=query*12,lo=Math.floor(index),hi=Math.min(12,lo+1),blend=index-lo;
    const a=cloud.motion[lo],b=cloud.motion[hi],points=[];
    const build=ease(u*3+.2);
    for(let i=0;i<cloud.points.length;i++){
      const p=cloud.points[i],dx=a[i][0]*(1-blend)+b[i][0]*blend,dy=a[i][1]*(1-blend)+b[i][1]*blend,dz=a[i][2]*(1-blend)+b[i][2]*blend;
      const x=p[0]+dx,y=p[1]+dy,z=(p[2]+dz)*build;
      const q=project(x,y,z);let color=p[6];
      if(output==='depth')color=depthColor(z);
      else if(output==='motion')color=`hsl(${180-Math.min(1,Math.hypot(dx,dy,dz)*6)*140} 90% 69%)`;
      else if(output==='camera')color='#80cfdd';
      points.push([q[0],q[1],q[2],Math.max(.8,1.7*s*q[3]),color,i,x,y,z]);
    }
    points.sort((a,b)=>b[2]-a[2]);
    ctx.save();ctx.globalAlpha=.86;
    for(const [x,y,z,r,color] of points){
      if(x<0||x>W||y<0||y>H)continue;
      ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,r*1.2,r,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    // Sparse native displacement vectors make the motion head inspectable.
    if(output==='motion')for(let i=0;i<points.length;i+=85){
      const [x,y,,,,id]=points[i],p=cloud.points[id],origin=project(p[0],p[1],p[2]);
      line([[origin[0],origin[1]],[x,y]],'#c4ffdd',.7,1);dot(x,y,1.6,'#d9ffee',.9);
    }
    for(let i=0;i<3;i++){
      const angle=t*.15+i*Math.PI*2/3,position=project(Math.cos(angle)*1.8,.5,Math.sin(angle)*1.1);
      const [x,y]=position,size=(output==='camera'?13:8)*s;
      if(output==='camera')line([[x,y],[W*.5,H*.48]],c.mint,.15);
      line([[x-size,y-size*.7],[x+size,y-size*.7],[x+size,y+size*.7],[x-size,y+size*.7],[x-size,y-size*.7]],c.mint,.6);
      line([[x-size,y-size*.7],[x,y-size*1.8],[x+size,y-size*.7]],c.mint,.5);
    }
    const control=$('#method-query-time');if(control)control.value=query;
    const label=$('#method-query-label');if(label)label.textContent=`t = ${query.toFixed(2)}`;
  }
  function draw(){
    if(stage<0||!width||!height)return;
    const t=clock/1000,u=(clock%stageDuration)/stageDuration;
    background(t);if(stage===0)endpoint(t,u);else if(stage===1)interpolate(t,u);else reconstruction(t,u);
    tabs.forEach((tab,i)=>{tab.querySelector('i').style.transform=`scaleX(${i<stage?1:i===stage?u:0})`;});
    $('#tour-seek').value=clock;$('#tour-time').textContent=`0${stage+1} / 03`;
    $('#tour-seek').setAttribute('aria-valuetext',`Stage ${stage+1}: ${tabs[stage].querySelector('strong').textContent}`);
    root.style.setProperty('--shortcut-travel',`${((t*.7)%1)*430-100}%`);
    root.querySelectorAll('[data-sprite]').forEach(node=>{
      const count=Number(node.dataset.sprite),f=stage===2?Math.round(query*(count-1)):Math.floor(t*6)%count;
      node.style.backgroundPosition=`${count===1?0:f/(count-1)*100}% 0`;
    });
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>{const resume=playing;seek(index*stageDuration+(resume?100:4800));setPlaying(resume);});
    tab.addEventListener('keydown',event=>{
      let target;if(event.key==='ArrowRight')target=(index+1)%3;else if(event.key==='ArrowLeft')target=(index+2)%3;
      else if(event.key==='Home')target=0;else if(event.key==='End')target=2;else return;
      event.preventDefault();tabs[target].click();tabs[target].focus();
    });
  });
  $('#tour-play').addEventListener('click',()=>setPlaying(!playing));
  $('#tour-replay').addEventListener('click',()=>{queryManual=false;outputManual=false;seek(0);setPlaying(true);});
  $('#tour-seek').addEventListener('input',event=>{setPlaying(false);seek(Number(event.target.value));});
  root.querySelectorAll('[data-output]').forEach(button=>button.addEventListener('click',()=>{
    output=button.dataset.output;outputManual=true;root.querySelectorAll('[data-output]').forEach(b=>b.setAttribute('aria-pressed',b===button));draw();
  }));
  canvas.addEventListener('pointerdown',event=>{
    if(stage!==2)return;dragging=true;lastX=event.clientX;canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(dragging){viewAngle=clamp(viewAngle+(event.clientX-lastX)*.006,-.7,.7);lastX=event.clientX;}
    else pointer=(event.clientX-canvas.getBoundingClientRect().left)/width-.5;
    if(!playing)draw();
  });
  const release=()=>{dragging=false;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('keydown',event=>{
    if(stage!==2||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();viewAngle=clamp(viewAngle+(event.key==='ArrowRight'?.06:-.06),-.7,.7);draw();
  });
  new ResizeObserver(resize).observe(canvas.parentElement);
  new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;lastNow=0;
    if(visible)schedule();else{cancelAnimationFrame(raf);raf=0;}
  },{threshold:.05}).observe($('.tour-visual'));
  document.addEventListener('visibilitychange',()=>{lastNow=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else schedule();});
  reduced.addEventListener('change',event=>{if(event.matches)setPlaying(false);});
  setStage(0);setPlaying(playing);
})();
