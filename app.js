(function(){
  const root=document.documentElement; root.classList.add('js');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) root.classList.add('reduce');
  const small=()=>innerWidth<760;

  /* ---------- shared helpers ---------- */
  const triple=name=>getComputedStyle(root).getPropertyValue(name).trim().split(',').map(v=>+v/255);
  const isLight=()=>{const t=root.getAttribute('data-theme');return t?t==='light':matchMedia('(prefers-color-scheme: light)').matches};
  const themeFns=[]; const fireTheme=()=>themeFns.forEach(f=>f());
  new MutationObserver(fireTheme).observe(root,{attributes:true,attributeFilter:['data-theme']});
  const mq=matchMedia('(prefers-color-scheme: light)'); mq.addEventListener&&mq.addEventListener('change',fireTheme);
  function watch(el,cb){
    if(!('IntersectionObserver' in window)){cb(true);return}
    new IntersectionObserver(es=>cb(es[0].isIntersecting),{rootMargin:'120px'}).observe(el);
  }
  // loop that only runs while its element is on screen and the tab is visible
  function loop(el,draw){
    let on=false,raf=0;
    let failed=false;
    const tick=t=>{raf=0;try{draw(t/1000)}catch(e){if(!failed){failed=true;console.error(e)}}if(on&&!document.hidden&&!reduce)raf=requestAnimationFrame(tick)};
    const kick=()=>{if(!raf)raf=requestAnimationFrame(tick)};
    watch(el,v=>{on=v;if(v)kick()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&on)kick()});
    return kick;
  }
  function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function makeNoise(seed){
    const r=rng(seed),P=new Float32Array(512);for(let i=0;i<512;i++)P[i]=r();
    const h=(x,y)=>P[(x*73856093^y*19349663)&511], sm=t=>t*t*(3-2*t);
    const n=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),u=sm(x-xi),v=sm(y-yi);
      const a=h(xi,yi),b=h(xi+1,yi),c=h(xi,yi+1),d=h(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
    return (x,y)=>{let s=0,amp=1,f=1,norm=0;for(let o=0;o<4;o++){s+=n(x*f,y*f)*amp;norm+=amp;amp*=.5;f*=2.03}return s/norm};
  }

  /* ---------- theme toggle / clock / copy ---------- */
  const btn=document.getElementById('themeBtn');
  try{const t=localStorage.getItem('oa-theme');if(t)root.setAttribute('data-theme',t)}catch(e){}
  btn.addEventListener('click',()=>{
    const next=isLight()?'dark':'light';root.setAttribute('data-theme',next);
    try{localStorage.setItem('oa-theme',next)}catch(e){}
  });
  const copyBtn=document.getElementById('copyBtn'),email=document.getElementById('email');
  copyBtn.addEventListener('click',()=>{
    const done=()=>{copyBtn.textContent='Copied';setTimeout(()=>copyBtn.textContent='Copy',1600)};
    const sel=()=>{const r=document.createRange();r.selectNodeContents(email);const s=getSelection();s.removeAllRanges();s.addRange(r);copyBtn.textContent='Selected'};
    try{navigator.clipboard.writeText(email.textContent).then(done,sel)}catch(e){sel()}
  });

  /* ---------- pointer + scroll state ---------- */
  let mx=0,my=0,smx=0,smy=0;
  if(!reduce)addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});

  /* =========================================================
     1. Hero: animated contour terrain (raw WebGL fragment shader)
     ========================================================= */
  const plate=document.querySelector('.plate'), heroCv=document.getElementById('glTerrain');
  const SNOISE=`vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;
  const HERO_FS=`#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes;uniform float uTime,uScroll,uScale;uniform vec2 uMouse;
uniform vec3 uBg,uD1,uD2,uLine,uAcc;
${SNOISE}
float iso(float h,float L,float w){float f=h*L;float d=.5-abs(fract(f)-.5);float fw=fwidth(f);return 1.-smoothstep(fw*.5*w,fw*(.5*w+1.),d);}
void main(){
  vec2 fc=gl_FragCoord.xy;vec2 n=fc/uRes;float asp=uRes.x/uRes.y;
  float r=length((n-vec2(.72,-.2))*vec2(asp*.55,1.));
  vec3 col=mix(uD2,uD1,smoothstep(0.,.45,r));col=mix(col,uBg,smoothstep(.38,.9,r));
  float t=uTime;
  vec2 pc=vec2(.72*asp,.40);float cyc=fract(t/9.);float pr=cyc*1.9;
  float dpc=length(fc/uRes.y-pc);float ring=exp(-pow((dpc-pr)*10.,2.))*(1.-cyc)*smoothstep(0.,.08,cyc);
  float lines=0.,acc=0.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float depth=i==0?.12:(i==1?.26:.45);
    float sc=i==0?1.15:(i==1?1.6:2.3);
    float L=i==0?9.:(i==1?7.:8.);
    float a=i==0?.06:(i==1?.10:.15);
    vec2 q=(fc+vec2(-uMouse.x*depth*90.,depth*uScroll+uMouse.y*depth*60.)*uScale)/uRes.y*sc;
    vec3 p=vec3(q,t*.028+fi*7.31);
    float h=snoise(p)*.62+snoise(p*2.03+3.1)*.28;
    if(i==2)h+=snoise(p*4.1-1.7)*.1;
    h=h*.5+.5;
    float l=iso(h,L,1.);
    lines+=l*a;
    if(i==2)acc+=iso(h,L*.25,1.3)*.11;
    acc+=l*ring*(.3+fi*.4);
  }
  col=mix(col,uLine,clamp(lines,0.,1.));
  col=mix(col,uAcc,clamp(acc,0.,1.));
  gl_FragColor=vec4(col,1.);
}`;
  function heroGL(){
    if(!heroCv)return false;
    const gl=heroCv.getContext('webgl',{antialias:false,alpha:false,depth:false,powerPreference:'high-performance'});
    if(!gl||!gl.getExtension('OES_standard_derivatives'))return false;
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
    const pr=gl.createProgram();
    try{gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,HERO_FS))}catch(e){return false}
    gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return false;
    gl.useProgram(pr);
    const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const U={};['uRes','uTime','uScroll','uScale','uMouse','uBg','uD1','uD2','uLine','uAcc'].forEach(k=>U[k]=gl.getUniformLocation(pr,k));
    let scale=1;
    const colors=()=>{gl.uniform3fv(U.uBg,triple('--gl-bg'));gl.uniform3fv(U.uD1,triple('--gl-d1'));gl.uniform3fv(U.uD2,triple('--gl-d2'));
      gl.uniform3fv(U.uLine,triple('--contour'));gl.uniform3fv(U.uAcc,triple('--contour-accent'))};
    const size=()=>{scale=Math.max(1,Math.min(devicePixelRatio||1,small()?1.25:1.5));
      const w=Math.round(heroCv.clientWidth*scale),h=Math.round(heroCv.clientHeight*scale);
      if(heroCv.width!==w||heroCv.height!==h){heroCv.width=w;heroCv.height=h;gl.viewport(0,0,w,h)}
      gl.uniform2f(U.uRes,w,h);gl.uniform1f(U.uScale,scale)};
    plate.classList.add('gl-on');colors();size();
    const t0=performance.now()/1000;let still=12.0;
    const draw=t=>{
      smx+=(mx-smx)*.06;smy+=(my-smy)*.06;
      gl.uniform1f(U.uTime,reduce?still:(t||performance.now()/1000)-t0+4);
      gl.uniform1f(U.uScroll,reduce?0:scrollY);gl.uniform2f(U.uMouse,smx,smy);
      gl.drawArrays(gl.TRIANGLES,0,3);
    };
    const kick=loop(heroCv,draw);
    addEventListener('resize',()=>{size();kick();draw()});
    themeFns.push(()=>{colors();draw()});
    draw();
    return true;
  }

  // 2D fallback: static contour plates (marching squares) for devices without WebGL
  const plates=[...document.querySelectorAll('.plate canvas.fb')];
  function drawPlates(){
    const cs=getComputedStyle(root),base=cs.getPropertyValue('--contour').trim(),acc=cs.getPropertyValue('--contour-accent').trim();
    const dpr=Math.min(devicePixelRatio||1,2);
    plates.forEach(cv=>{
      const W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
      cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
      const noise=makeNoise(+cv.dataset.seed),sc=+cv.dataset.scale,L=+cv.dataset.levels,a=+cv.dataset.alpha;
      const step=W<700?10:8,cols=Math.ceil(W/step)+1,rows=Math.ceil(H/step)+1,F=new Float32Array(cols*rows);
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)F[j*cols+i]=noise(i*step/sc,j*step/sc);
      for(let k=1;k<=L;k++){
        const th=.18+k*(.64/(L+1)),major=k%4===0;
        g.strokeStyle=`rgba(${cv.dataset.accent&&major?acc:base},${major?a*1.9:a})`;g.lineWidth=major?1.1:.8;g.beginPath();
        for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){
          const tl=F[j*cols+i],tr=F[j*cols+i+1],br=F[(j+1)*cols+i+1],bl=F[(j+1)*cols+i];
          const c=(tl>th?8:0)|(tr>th?4:0)|(br>th?2:0)|(bl>th?1:0);if(c===0||c===15)continue;
          const x=i*step,y=j*step,l=(p,q)=>(th-p)/(q-p);
          const T=[x+step*l(tl,tr),y],R=[x+step,y+step*l(tr,br)],B=[x+step*l(bl,br),y+step],Lf=[x,y+step*l(tl,bl)];
          const seg=(p,q)=>{g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1])};
          switch(c){case 1:case 14:seg(Lf,B);break;case 2:case 13:seg(B,R);break;case 3:case 12:seg(Lf,R);break;
            case 4:case 11:seg(T,R);break;case 5:seg(Lf,T);seg(B,R);break;case 6:case 9:seg(T,B);break;
            case 7:case 8:seg(Lf,T);break;case 10:seg(T,R);seg(Lf,B);break;}
        }
        g.stroke();
      }
    });
  }
  const heroOK=heroGL();
  if(!heroOK){drawPlates();addEventListener('resize',drawPlates);themeFns.push(drawPlates)}

  /* =========================================================
     2. Terrain scan: LiDAR-style point cloud, scroll-scrubbed
     ========================================================= */
  const T3=window.THREE;
  function scanGL(){
    const sec=document.getElementById('work'),cv=document.getElementById('glScan');
    if(!T3||!cv)return false;
    let renderer;try{renderer=new T3.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'})}catch(e){return false}
    renderer.setClearColor(0x000000,0);
    const scene=new T3.Scene(),cam=new T3.PerspectiveCamera(36,1,.1,200);
    const NX=small()?150:250,NZ=small()?110:180,W=36,D=26;
    const N=NX*NZ,pos=new Float32Array(N*3),r=rng(7),noise=makeNoise(73);
    let k=0;
    for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++){
      const u=x/(NX-1),v=z/(NZ-1);
      const h=noise(u*7.5+2.3,v*5.5+4.1);
      const ridge=1-Math.abs(noise(u*3.1+9,v*2.4+1)*2-1);
      pos[k++]=(u-.5)*W+(r()-.5)*W/NX*.9;
      pos[k++]=Math.pow(h,1.7)*7.2+ridge*1.4-2.6;
      pos[k++]=(v-.5)*D+(r()-.5)*D/NZ*.9;
    }
    const geo=new T3.BufferGeometry();geo.setAttribute('position',new T3.BufferAttribute(pos,3));
    const mat=new T3.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{uScan:{value:0},uTime:{value:0},uPR:{value:1},uLine:{value:new T3.Color()},uAcc:{value:new T3.Color()},uBoost:{value:1}},
      vertexShader:`uniform float uScan,uPR,uTime;varying float vD,vS,vH;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
vD=-mv.z;vS=position.z-uScan;vH=position.y;
float band=exp(-pow(vS*1.6,2.));gl_PointSize=clamp(uPR*(1.6+band*1.8)*(24./vD),1.5,3.2*uPR);}`,
      fragmentShader:`uniform vec3 uLine,uAcc;uniform float uBoost;varying float vD,vS,vH;
void main(){vec2 c=gl_PointCoord-.5;if(dot(c,c)>.25)discard;
float fog=smoothstep(46.,12.,vD)*smoothstep(1.5,5.,vD);
float band=exp(-pow(vS*1.6,2.));
float scanned=smoothstep(-.2,1.2,vS);
float iso=step(.86,fract(vH*1.35));
float a=mix(.22,.6,scanned)+iso*scanned*.3;
vec3 col=mix(uLine,uAcc,clamp(band+iso*scanned*.55,0.,1.));
gl_FragColor=vec4(col,(a+band*.9)*fog*uBoost);}`});
    const pts=new T3.Points(geo,mat);scene.add(pts);
    // sweep plane edge: a thin line across the terrain at the scan position
    const colors=()=>{const l=triple('--contour'),a=triple('--contour-accent');
      mat.uniforms.uLine.value.setRGB(l[0],l[1],l[2]);mat.uniforms.uAcc.value.setRGB(a[0],a[1],a[2]);
      const light=isLight();mat.blending=light?T3.NormalBlending:T3.AdditiveBlending;mat.uniforms.uBoost.value=light?1.6:1;mat.needsUpdate=true};
    colors();
    const size=()=>{const pr=Math.min(devicePixelRatio||1,1.75);renderer.setPixelRatio(pr);mat.uniforms.uPR.value=pr;
      renderer.setSize(cv.clientWidth,cv.clientHeight,false);cam.aspect=cv.clientWidth/Math.max(1,cv.clientHeight);cam.updateProjectionMatrix()};
    size();
    const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
    const draw=t=>{
      const rc=sec.getBoundingClientRect();
      let p=reduce?.55:Math.min(1,Math.max(0,(innerHeight-rc.top)/(innerHeight+rc.height)));
      const e=ease(p),tt=reduce?0:(t||0);
      cam.position.set(Math.sin(e*Math.PI)*5-2+Math.sin(tt*.15)*.4+smx*1.2, 15-e*9.5+Math.sin(tt*.2)*.15, 21-e*13);
      cam.lookAt(e*2-1,-1,-3-e*5);
      const scan=D*.42-p*D*1.0;mat.uniforms.uScan.value=scan;
      mat.uniforms.uTime.value=tt;
      renderer.render(scene,cam);
    };
    const kick=loop(sec,draw);
    addEventListener('resize',()=>{size();draw()});
    themeFns.push(()=>{colors();draw()});
    draw();
    return true;
  }
  if(!scanGL())root.classList.add('nogl-scan');

  /* =========================================================
     3. Homelab rack: a scroll-driven tour of the real 15U cabinet (units: inches)
     ========================================================= */
  function rackGL(){
    const tour=document.querySelector('.rack-tour');if(!T3||!tour)return false;
    const sticky=tour.querySelector('.rack-sticky'),cv=tour.querySelector('canvas.rack3d'),svg=tour.querySelector('svg.rack-lines'),labWrap=tour.querySelector('.rack-labels');
    const cards=[...tour.querySelectorAll('.tour-card')],railBtns=[...tour.querySelectorAll('.tour-rail button')];
    const rail=tour.querySelector('.tour-rail'),hint=tour.querySelector('.tour-hint'),skip=tour.querySelector('.tour-skip');
    let renderer;try{renderer=new T3.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'})}catch(e){return false}
    tour.classList.add('gl');renderer.setClearColor(0x000000,0);
    const scene=new T3.Scene(),cam=new T3.PerspectiveCamera(28,1,.5,1500);
    scene.add(new T3.HemisphereLight(0xdfe3e8,0x0b0b0b,.62));
    const key=new T3.DirectionalLight(0xffffff,.9);key.position.set(-40,70,60);scene.add(key);
    const rim=new T3.DirectionalLight(0xc98e3e,.85);rim.position.set(55,35,-45);scene.add(rim);
    const fillL=new T3.DirectionalLight(0x8fa3b8,.32);fillL.position.set(60,15,45);scene.add(fillL);

    /* ---- small builders ---- */
    const STD=(c,r=.6,m=.35)=>new T3.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    const BASIC=c=>new T3.MeshBasicMaterial({color:c});
    const maxAniso=renderer.capabilities.getMaxAnisotropy?Math.min(8,renderer.capabilities.getMaxAnisotropy()):1;
    const tex=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T3.CanvasTexture(c);t.anisotropy=maxAniso;return t};
    const edgeSets={},edgeMat=id=>edgeSets[id]||(edgeSets[id]=new T3.LineBasicMaterial({transparent:true,opacity:.18}));
    function B(parent,w,h,d,x,y,z,mat,edge){const g=new T3.BoxGeometry(w,h,d),m=new T3.Mesh(g,mat);m.position.set(x,y,z);
      if(edge)m.add(new T3.LineSegments(new T3.EdgesGeometry(g),edge));parent.add(m);return m}
    function P(parent,w,h,x,y,z,mat,rx=0,ry=0){const m=new T3.Mesh(new T3.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,0);parent.add(m);return m}
    const glowTex=tex(64,64,g=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.22,'rgba(255,255,255,.5)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)});
    function glow(parent,color,size,op,x,y,z){const s=new T3.Sprite(new T3.SpriteMaterial({map:glowTex,color,transparent:true,opacity:op,blending:T3.AdditiveBlending,depthWrite:false}));s.scale.set(size,size,1);s.position.set(x,y,z);parent.add(s);return s}
    const tagTex=t=>tex(512,128,(g,w,h)=>{g.fillStyle='#f1f0ea';g.fillRect(0,0,w,h);g.fillStyle='#141414';g.font='600 60px Arial, Helvetica, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,w/2,h/2+3)});
    const tag=(parent,t,w,h,x,y,z,rx=0)=>P(parent,w,h,x,y,z,new T3.MeshBasicMaterial({map:tagTex(t)}),rx);
    const V=(x,y,z)=>new T3.Vector3(x,y,z);

    /* ---- textures drawn from the photos' details ---- */
    const U=1.75,Y0=3,NU=15,RH=NU*U,uy=n=>Y0+(n-1)*U;
    const diamond=tex(128,64,(g,w,h)=>{g.fillStyle='#202327';g.fillRect(0,0,w,h);g.fillStyle='#060707';const s=16;
      for(let r=0;r<=h/(s/2)+1;r++){const y=r*s/2;for(let x=(r%2)*s/2-s;x<=w+s;x+=s){g.beginPath();g.moveTo(x,y-s*.36);g.lineTo(x+s*.4,y);g.lineTo(x,y+s*.36);g.lineTo(x-s*.4,y);g.closePath();g.fill()}}});
    diamond.wrapS=diamond.wrapT=T3.RepeatWrapping;diamond.repeat.set(5,3);
    const railTex=tex(32,1024,(g,w,h)=>{g.fillStyle='#191b1e';g.fillRect(0,0,w,h);g.fillStyle='#020202';const px=h/RH;
      for(let u=0;u<NU;u++)for(const o of [.25,.875,1.5])g.fillRect(w/2-7,h-(u*U+o)*px-7,14,14)});
    const numTex=tex(64,1024,(g,w,h)=>{g.fillStyle='#d8d6cf';g.font='600 15px Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';const px=h/RH;
      for(let u=1;u<=NU;u++){g.fillText(String(u).padStart(2,'0'),w/2,h-((u-1)*U+U/2)*px);g.fillRect(w/2-13,h-u*U*px,26,1.5)}});
    const chevTex=tex(512,256,(g,w,h)=>{g.fillStyle='#2b3137';g.fillRect(0,0,w,h);g.strokeStyle='#07080a';g.lineWidth=18;
      for(let i=0;i<5;i++){const x=58+i*92;g.beginPath();g.moveTo(x,46);g.lineTo(x+46,h/2);g.lineTo(x,h-46);g.stroke()}});
    const ventTex=tex(1024,48,(g,w,h)=>{g.fillStyle='#0d0e0f';g.fillRect(0,0,w,h);g.fillStyle='#2c2f33';for(let x=20;x<w-20;x+=11)g.fillRect(x,12,4,24)});
    const pduTex=tex(256,64,(g,w,h)=>{g.fillStyle='#0d0e0f';g.fillRect(0,0,w,h);g.fillStyle='#d9d7d0';g.font='600 17px Arial, sans-serif';g.fillText('10-OUTLET 1U PDU',10,27);g.fillText('RACK POWER HUB',10,49)});
    const hddTex=tex(256,384,(g,w,h)=>{g.fillStyle='#9a9ea3';g.fillRect(0,0,w,h);g.fillStyle='#e9e8e4';g.fillRect(24,30,w-48,h*.55);g.fillStyle='#8a8d91';
      for(let i=0;i<9;i++)g.fillRect(40,60+i*20,i%3?120:170,6);g.fillStyle='#202224';g.fillRect(40,250,60,26)});
    const streakTex=tex(256,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,h);[[0,0],[.42,0],[.5,.55],[.56,0],[.7,0],[.74,.25],[.78,0],[1,0]].forEach(([s,a])=>gr.addColorStop(s,`rgba(255,255,255,${a})`));g.fillStyle=gr;g.fillRect(0,0,w,h)});
    const shadowTex=tex(128,128,g=>{const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(0,0,0,.85)');r.addColorStop(.55,'rgba(0,0,0,.45)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128)});
    const shadowMat=new T3.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.8});

    /* ---- floor: the site's contour map, faded at the edges ---- */
    const floorCv=document.createElement('canvas');floorCv.width=floorCv.height=1024;const floorTex=new T3.CanvasTexture(floorCv);floorTex.anisotropy=maxAniso;
    function drawFloor(){
      const g=floorCv.getContext('2d'),S=1024,cs=getComputedStyle(root),c=cs.getPropertyValue('--contour').trim(),a=cs.getPropertyValue('--contour-accent').trim();
      g.globalCompositeOperation='source-over';g.clearRect(0,0,S,S);
      const noise=makeNoise(91),step=8,n=S/step+1,F=new Float32Array(n*n);
      for(let j=0;j<n;j++)for(let i=0;i<n;i++)F[j*n+i]=noise(i*step/260,j*step/260);
      for(let k=1;k<=11;k++){const th=.2+k*(.6/12),major=k%4===0;g.strokeStyle=`rgba(${major?a:c},${major?.38:.2})`;g.lineWidth=major?1.6:1.1;g.beginPath();
        for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
          const tl=F[j*n+i],tr=F[j*n+i+1],br=F[(j+1)*n+i+1],bl=F[(j+1)*n+i];
          const cc=(tl>th?8:0)|(tr>th?4:0)|(br>th?2:0)|(bl>th?1:0);if(cc===0||cc===15)continue;
          const x=i*step,y=j*step,l=(p,q)=>(th-p)/(q-p);
          const T=[x+step*l(tl,tr),y],R=[x+step,y+step*l(tr,br)],Bm=[x+step*l(bl,br),y+step],L=[x,y+step*l(tl,bl)];
          const sg=(p,q)=>{g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1])};
          switch(cc){case 1:case 14:sg(L,Bm);break;case 2:case 13:sg(Bm,R);break;case 3:case 12:sg(L,R);break;case 4:case 11:sg(T,R);break;
            case 5:sg(L,T);sg(Bm,R);break;case 6:case 9:sg(T,Bm);break;case 7:case 8:sg(L,T);break;case 10:sg(T,R);sg(L,Bm);break}
        }
        g.stroke()}
      g.globalCompositeOperation='destination-in';const r=g.createRadialGradient(S/2,S/2,S*.06,S/2,S/2,S*.5);r.addColorStop(0,'rgba(0,0,0,1)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,S,S);
      g.globalCompositeOperation='source-over';floorTex.needsUpdate=true;
    }
    P(scene,250,250,-8,.01,-4,new T3.MeshBasicMaterial({map:floorTex,transparent:true,depthWrite:false}),-Math.PI/2);
    const shadow=(x,z,w,d,ry=0)=>{const m=P(scene,w,d,x,.03,z,shadowMat,-Math.PI/2);m.rotation.z=ry;return m};

    /* ---- the cabinet ---- */
    const rack=new T3.Group();scene.add(rack);
    const W=23.5,D=22,H=31,FT=1.2,ZF=D/2;
    const cab=STD(0x101113,.5,.5),cabIn=STD(0x08090a,.95,.05),eCab=edgeMat('cab');
    B(rack,.5,H-FT,D,-W/2+.25,FT+(H-FT)/2,0,cab,eCab);
    B(rack,.5,H-FT,D,W/2-.25,FT+(H-FT)/2,0,cab,eCab);
    B(rack,W,.6,D,0,H-.3,0,cab,eCab);
    B(rack,W,.8,D,0,FT+.4,0,cab,eCab);
    B(rack,W-1,H-FT-1.4,.3,0,FT+.8+(H-FT-1.4)/2,-D/2+.2,cabIn);
    B(rack,W,1.5,.5,0,H-.6-.75,ZF-.25,cab,eCab);
    P(rack,W-2.2,1.0,0,H-1.35,ZF+.012,new T3.MeshBasicMaterial({map:ventTex}));
    for(const sx of [-1,1])for(const sz of [-1,1]){const f=new T3.Mesh(new T3.CylinderGeometry(.7,.8,FT,16),cab);f.position.set(sx*(W/2-1.6),FT/2,sz*(D/2-1.6));rack.add(f)}
    const roofFans=[],ringMat=new T3.LineBasicMaterial({color:0x3a3d42});
    for(const fx of [-5.6,5.6]){const g=new T3.Group();g.position.set(fx,H+.01,-1.5);rack.add(g);
      const disc=new T3.Mesh(new T3.CircleGeometry(3.1,40),BASIC(0x040404));disc.rotation.x=-Math.PI/2;g.add(disc);
      const blades=new T3.Group();blades.position.y=.006;g.add(blades);
      for(let i=0;i<7;i++){const pv=new T3.Group();pv.rotation.y=i*Math.PI*2/7;const b=new T3.Mesh(new T3.PlaneGeometry(2.3,.9),BASIC(0x25282c));b.rotation.x=-Math.PI/2;b.position.x=1.5;pv.add(b);blades.add(pv)}
      for(const r of [1.0,2.0,3.05]){const pts=[];for(let a=0;a<=48;a++)pts.push(V(Math.cos(a/48*Math.PI*2)*r,.014,Math.sin(a/48*Math.PI*2)*r));g.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts),ringMat))}
      for(let a=0;a<4;a++){const an=a*Math.PI/4;g.add(new T3.Line(new T3.BufferGeometry().setFromPoints([V(-Math.cos(an)*3.05,.014,-Math.sin(an)*3.05),V(Math.cos(an)*3.05,.014,Math.sin(an)*3.05)]),ringMat))}
      roofFans.push(blades)}
    const railMat=STD(0x17191c,.55,.5),railFace=new T3.MeshStandardMaterial({map:railTex,roughness:.55,metalness:.4}),numMat=new T3.MeshBasicMaterial({map:numTex,transparent:true,depthWrite:false});
    for(const sx of [-1,1]){for(const zr of [8.6,-8.6])B(rack,.65,RH,.6,sx*9.62,Y0+RH/2,zr,railMat);
      P(rack,.65,RH,sx*9.62,Y0+RH/2,8.6+.31,railFace);P(rack,1.6,RH,sx*10.75,Y0+RH/2,8.6+.31,numMat)}
    const shelfMat=STD(0x2a3036,.45,.65);
    B(rack,19.2,.14,13.4,0,uy(9)-.07,8.95-6.7,shelfMat,eCab);
    B(rack,19.9,U,.12,0,uy(8)+U/2,9.0,shelfMat,eCab);

    /* ---- PDU (U7): seven of ten rockers lit, as in the photo ---- */
    const pdu=new T3.Group();pdu.position.set(0,uy(7),9.0);rack.add(pdu);
    B(pdu,19.0,U-.05,.14,0,U/2,0,STD(0x0c0d0e,.5,.5),edgeMat('pdu'));
    B(pdu,17.0,U-.15,6,0,U/2,-3.07,STD(0x111214,.6,.4));
    P(pdu,3.2,.8,-7.3,U/2,.08,new T3.MeshBasicMaterial({map:pduTex}));
    const brk=new T3.Mesh(new T3.CylinderGeometry(.36,.36,.2,20),STD(0x050505,.4,.3));brk.rotation.x=Math.PI/2;brk.position.set(-4.75,U/2,.12);pdu.add(brk);
    [1,1,1,1,0,0,0,1,1,1].forEach((on,i)=>{const x=-3.25+i*1.27;P(pdu,.74,.98,x,U/2,.09,on?BASIC(0xff4b22):STD(0x3a100b,.5,.2));if(on)glow(pdu,0xff4b22,2.2,.45,x,U/2,.35)});

    /* ---- Dell OptiPlex 7050 SFF, lying flat ---- */
    function optiplex(name,id){
      const g=new T3.Group(),e=edgeMat(id);
      B(g,11.4,3.62,11.5,0,1.81,-5.75,STD(0x121416,.45,.55),e);
      P(g,4.75,3.42,-3.2,1.81,.012,new T3.MeshStandardMaterial({map:diamond,roughness:.7,metalness:.3}));
      P(g,.95,3.42,-.32,1.81,.012,STD(0x8a8f95,.35,.8));
      const logo=new T3.Mesh(new T3.TorusGeometry(.3,.045,8,28),STD(0x3b3f44,.4,.6));logo.position.set(-.32,1.81,.03);g.add(logo);
      P(g,5.4,3.42,2.85,1.81,.012,STD(0x0b0c0d,.5,.4));
      B(g,4.9,.035,.03,2.85,3.2,.03,STD(0x3a3d42,.5,.5));
      P(g,.48,.2,.95,1.45,.03,BASIC(0x2f6fd6));P(g,.36,.14,.95,.98,.03,BASIC(0x050505));
      P(g,.48,.2,1.95,1.45,.03,BASIC(0x050505));P(g,.48,.2,1.95,.98,.03,BASIC(0x050505));
      const jack=new T3.Mesh(new T3.CircleGeometry(.12,16),BASIC(0x050505));jack.position.set(2.75,1.45,.03);g.add(jack);
      const btn=new T3.Mesh(new T3.CylinderGeometry(.36,.36,.12,24),STD(0x0a0a0b,.4,.5));btn.rotation.x=Math.PI/2;btn.position.set(4.95,2.35,.06);g.add(btn);
      const ring=new T3.Mesh(new T3.TorusGeometry(.36,.05,8,32),BASIC(0xe4f1ff));ring.position.set(4.95,2.35,.12);g.add(ring);
      glow(g,0x9ccaff,1.4,.55,4.95,2.35,.3);
      tag(g,name,2.9,.7,2.6,2.55,.035);
      return g;
    }
    const infra=optiplex('pve-infra-01','infra');infra.position.set(-3.55,uy(9),8.55);rack.add(infra);
    const lab=optiplex('pve-lab-01','lab');lab.position.set(-3.7,uy(9)+3.64,8.62);rack.add(lab);

    /* ---- 8-port PoE switch; port 4 negotiates 100 Mbps, so its LED is amber ---- */
    const sw=new T3.Group();sw.position.set(5.95,uy(9),8.8);rack.add(sw);
    B(sw,6.6,1.1,4,0,.55,-2,STD(0x1b1d20,.45,.55),edgeMat('switch'));
    P(sw,6.5,1.0,0,.55,.012,STD(0x0f1012,.5,.5));
    P(sw,.12,.07,-2.85,.8,.02,BASIC(0x5bd46e));
    const ports=[],portLeds=[];
    for(let i=0;i<8;i++){const x=-1.95+i*.62;ports.push(V(x,.42,0));
      P(sw,.46,.4,x,.42,.02,BASIC(0x040404));
      portLeds.push(P(sw,.13,.06,x-.12,.84,.022,BASIC(i===3?0xffad2e:i<5?0x5bd46e:0x1a1b1c)));
      P(sw,.13,.06,x+.12,.84,.022,BASIC(0x1a1b1c))}

    /* ---- Raspberry Pi in its vented case, sitting on the switch ---- */
    const pi=new T3.Group();pi.position.set(4.45,uy(9)+1.1,8.5);rack.add(pi);
    B(pi,3.3,2.85,3.3,0,1.425,-1.65,STD(0x141517,.35,.65),edgeMat('pi'));
    const slots=[];for(const [y0,n] of [[1.55,6],[.55,3]])for(let i=0;i<n;i++)slots.push(P(pi,2.3,.075,-.1,y0+i*.19,.012,BASIC(0x3fd7ff)));
    const piGlow=glow(pi,0x3fd7ff,4.4,.3,-.1,1.6,.45);
    P(pi,.12,.12,1.3,.32,.013,BASIC(0xff2b2b));glow(pi,0xff2b2b,.7,.6,1.3,.32,.1);
    tag(pi,'pi-node-1',2.5,.6,0,2.852,-.45,-Math.PI/2);

    /* ---- the two loose 3.5" drives behind the switch ---- */
    const hddTop=new T3.MeshStandardMaterial({map:hddTex,roughness:.35,metalness:.7});
    for(let i=0;i<2;i++){const h=new T3.Group();h.position.set(6.3+i*.25,uy(9)+i*1.03,1.1-i*.3);rack.add(h);
      B(h,4,1.0,5.8,0,.5,0,STD(0x1c1e20,.5,.6),eCab);P(h,3.9,5.7,0,1.006,0,hddTop,-Math.PI/2)}

    /* ---- server130: a tempered-glass tower lying on its side under the PDU ---- */
    const s130=new T3.Group();s130.position.set(0,Y0+.15,0);rack.add(s130);
    const eS=edgeMat('server130'),SW=17.6,SH=9.9,SD=15.2,SZ=8.6,SB=SZ-SD;
    B(s130,SW,.2,SD,0,.1,SZ-SD/2,shelfMat);
    B(s130,SW,2.9,.14,0,1.55,SZ,shelfMat,eS);
    B(s130,SW,.14,SD,0,3.0,SZ-SD/2,shelfMat);
    P(s130,SW-.5,SD-.5,0,3.075,SZ-SD/2,new T3.MeshStandardMaterial({map:chevTex,roughness:.5,metalness:.6}),-Math.PI/2);
    tag(s130,'server130',2.7,.62,6.4,1.9,SZ+.08);
    for(const x of [-SW/2+.16,SW/2-.16])for(const z of [SZ-.16,SB+.16])B(s130,.32,SH-3,.32,x,3+(SH-3)/2,z,cab,eS);
    for(const z of [SZ-.16,SB+.16])B(s130,SW,.3,.32,0,SH-.15,z,cab,eS);
    for(const x of [-SW/2+.16,SW/2-.16])B(s130,.32,.3,SD,x,SH-.15,SZ-SD/2,cab,eS);
    const sGlass=new T3.MeshStandardMaterial({color:0x0b0f12,transparent:true,opacity:.16,roughness:.06,metalness:.9,depthWrite:false});
    const sStreak=new T3.MeshBasicMaterial({map:streakTex,transparent:true,opacity:.09,blending:T3.AdditiveBlending,depthWrite:false});
    P(s130,SW-.6,SH-3.3,0,3+(SH-3)/2,SZ-.04,sGlass);P(s130,SW-.6,SH-3.3,0,3+(SH-3)/2,SZ-.02,sStreak);
    P(s130,SW-.6,SD-.6,0,SH-.03,SZ-SD/2,sGlass,-Math.PI/2);P(s130,SW-.6,SD-.6,0,SH-.01,SZ-SD/2,sStreak,-Math.PI/2);
    const bz=SB+5.6;
    B(s130,9.6,.12,9.6,-3.4,3.14,bz,STD(0x0f1113,.5,.4));
    B(s130,4.4,4.9,2.4,-3.0,5.65,bz-.4,STD(0x2a2d31,.4,.7),eS);
    const cf=new T3.Mesh(new T3.TorusGeometry(1.9,.16,8,32),STD(0x1a1c1f,.5,.5));cf.position.set(-3.0,5.65,bz+.85);s130.add(cf);
    for(let i=0;i<2;i++)B(s130,.24,1.3,5.2,-.2+i*.42,3.85,bz-.6,STD(0x17181a,.5,.5));
    B(s130,9.4,4.2,1.45,-1.2,5.3,bz+4.0,STD(0x1a1c1e,.45,.6),eS);
    glow(s130,0x37d67a,5,.42,1.2,5.6,bz+4.0);
    P(s130,.14,.14,-6.4,3.3,bz-3.6,BASIC(0xff2b2b),-Math.PI/2);glow(s130,0xff2b2b,.9,.7,-6.4,3.5,bz-3.6);
    for(let i=0;i<2;i++)B(s130,4,1,5.8,6.2,3.6+i*1.04,SB+3.6,STD(0x1c1e20,.5,.6));

    /* ---- glass door, hinged on the right ---- */
    const door=new T3.Group();door.position.set(W/2,0,ZF);rack.add(door);
    const DY0=FT+.8,DH=H-.6-1.5-DY0,gx=-W/2+.55;
    const dFrame=new T3.MeshStandardMaterial({color:0x101113,roughness:.5,metalness:.5,transparent:true,opacity:1});
    const dEdge=new T3.LineBasicMaterial({transparent:true,opacity:.18});
    const dGlass=new T3.MeshStandardMaterial({color:0x0b0f12,transparent:true,opacity:.26,roughness:.08,metalness:.9,depthWrite:false});
    const dStreak=new T3.MeshBasicMaterial({map:streakTex,transparent:true,opacity:.12,blending:T3.AdditiveBlending,depthWrite:false});
    B(door,2.3,DH,.5,-W+1.15,DY0+DH/2,.25,dFrame,dEdge);
    B(door,1.2,DH,.5,-.6,DY0+DH/2,.25,dFrame,dEdge);
    B(door,W-3.5,1.3,.5,gx,DY0+DH-.65,.25,dFrame,dEdge);
    B(door,W-3.5,1.3,.5,gx,DY0+.65,.25,dFrame,dEdge);
    P(door,W-3.5,DH-2.6,gx,DY0+DH/2,.22,dGlass);
    P(door,W-3.5,DH-2.6,gx,DY0+DH/2,.24,dStreak);
    const lockMat=new T3.MeshStandardMaterial({color:0xb9bcc0,roughness:.3,metalness:.9,transparent:true});
    const lock=new T3.Mesh(new T3.CylinderGeometry(.32,.32,.35,20),lockMat);lock.rotation.x=Math.PI/2;lock.position.set(-W+1.15,DY0+DH*.42,.6);door.add(lock);
    shadow(0,0,34,32);

    /* ---- the GPU worker: a glass-sided desktop beside the rack ---- */
    const TW=9.2,TH=19.2,TD=17.6;
    const tower=new T3.Group();tower.position.set(-31,0,-3);tower.rotation.y=.6;scene.add(tower);
    const eT=edgeMat('gpu'),tFrame=STD(0x0e0f10,.45,.55);
    B(tower,TW,.4,TD,0,TH-.2,0,tFrame,eT);B(tower,TW,.6,TD,0,.9,0,tFrame,eT);
    B(tower,.3,TH-1.2,TD,TW/2-.15,.6+(TH-1.2)/2,0,tFrame,eT);B(tower,TW,TH-1.2,.3,0,.6+(TH-1.2)/2,-TD/2+.15,tFrame,eT);
    B(tower,.35,TH-1.2,.35,-TW/2+.175,.6+(TH-1.2)/2,TD/2-.175,tFrame,eT);
    for(const sx of [-1,1])for(const sz of [-1,1])B(tower,1.6,.6,1.2,sx*(TW/2-1.2),.3,sz*(TD/2-1.6),tFrame);
    const tGlass=new T3.MeshStandardMaterial({color:0x0b0f12,transparent:true,opacity:.2,roughness:.06,metalness:.9,depthWrite:false});
    const tStreak=new T3.MeshBasicMaterial({map:streakTex,transparent:true,opacity:.1,blending:T3.AdditiveBlending,depthWrite:false});
    P(tower,TW-.4,TH-1.4,0,TH/2,TD/2-.05,tGlass);P(tower,TW-.4,TH-1.4,0,TH/2,TD/2-.03,tStreak);
    P(tower,TD-.4,TH-1.4,-TW/2+.05,TH/2,0,tGlass,0,-Math.PI/2);P(tower,TD-.4,TH-1.4,-TW/2+.03,TH/2,0,tStreak,0,-Math.PI/2);
    B(tower,.18,9.6,9.6,TW/2-.55,12.6,-3.2,STD(0x111214,.5,.4));
    const rgbParts=[];
    for(let i=0;i<2;i++){B(tower,.5,4.2,.25,TW/2-.95,13.6,-.9+i*.42,STD(0x18191b,.5,.5));rgbParts.push(P(tower,.06,4.1,TW/2-1.21,13.6,-.9+i*.42,BASIC(0x111111),0,-Math.PI/2))}
    const pump=new T3.Group();pump.position.set(TW/2-1.15,14.6,-4.7);tower.add(pump);
    B(pump,.9,2.5,2.5,0,0,0,STD(0x0d0e0f,.4,.5));
    const pumpRing=new T3.Mesh(new T3.TorusGeometry(1.0,.09,8,32),BASIC(0x111111));pumpRing.rotation.y=Math.PI/2;pumpRing.position.x=-.47;pump.add(pumpRing);rgbParts.push(pumpRing);
    const gpuCard=new T3.Group();gpuCard.position.set(1.2,9.6,-2.4);tower.add(gpuCard);
    B(gpuCard,4.6,1.7,10.6,0,0,0,STD(0x17191b,.45,.6),eT);
    B(gpuCard,.08,.5,8.5,-2.32,.35,.6,STD(0x9ea2a7,.3,.85));
    rgbParts.push(P(gpuCard,6,.12,-2.33,-.42,1.2,BASIC(0x111111),0,-Math.PI/2));
    B(tower,TW-.6,4.4,TD-.6,0,.6+2.2,0,STD(0x131416,.6,.4));
    const tFans=[];
    function fan(x,y,z,ry){const g=new T3.Group();g.position.set(x,y,z);g.rotation.y=ry;tower.add(g);
      const ring=new T3.Mesh(new T3.TorusGeometry(2.05,.2,10,40),BASIC(0x161616));g.add(ring);
      const hub=new T3.Mesh(new T3.CircleGeometry(.62,20),BASIC(0x0e0e0f));hub.position.z=.02;g.add(hub);
      const blades=new T3.Group();g.add(blades);
      for(let i=0;i<7;i++){const pv=new T3.Group();pv.rotation.z=i*Math.PI*2/7;const b=new T3.Mesh(new T3.PlaneGeometry(1.25,.55),new T3.MeshBasicMaterial({color:0x2a2d31,side:T3.DoubleSide}));b.position.x=1.25;b.rotation.x=.5;pv.add(b);blades.add(pv)}
      tFans.push({ring,blades,gl:glow(g,0xffffff,6.5,0,0,0,.3)})}
    for(let i=0;i<3;i++)fan(0,6.9+i*4.45,TD/2-1.0,0);
    for(let i=0;i<3;i++)fan(TW/2-.8,6.9+i*4.45,TD/2-3.6,-Math.PI/2);
    const tPower=P(tower,.12,.12,TW/2-.6,TH-.6,TD/2+.01,BASIC(0x141414));
    shadow(-31,-3,15,23,-.6);

    /* ---- patch cables, colored like the photo, plus the Pi's USB-C lead ---- */
    const cableMats=[0x1d1f22,0x9a9da2,0xe7e6e1,0x2f6fd6,0x1d1f22].map(c=>STD(c,.55,.15)),usbMat=STD(0xe7e6e1,.6,.1);
    let cables=[],usb=null,wolCurve=null,wolLine=null;
    const wolMat=new T3.LineDashedMaterial({dashSize:.9,gapSize:.7,transparent:true,opacity:.4});
    function buildCables(){
      scene.updateMatrixWorld(true);
      cables.forEach(c=>{rack.remove(c.mesh);c.mesh.geometry.dispose()});cables=[];
      for(let i=0;i<5;i++){const p=sw.localToWorld(ports[i].clone());
        const curve=new T3.CatmullRomCurve3([p.clone(),V(p.x,p.y,p.z+.6),V(p.x-.25+i*.05,p.y-1.3,p.z+1.0),V(p.x-.5+i*.1,14.5-i*.32,p.z+1.15),
          V(p.x+1.7+i*.28,13.7-i*.28,p.z+.95),V(10.25,14.5-i*.22,9.6),V(10.35,15.4,3)],false,'catmullrom',.5);
        const mesh=new T3.Mesh(new T3.TubeGeometry(curve,64,.11,6,false),cableMats[i]);rack.add(mesh);cables.push({curve,mesh})}
      if(usb){rack.remove(usb);usb.geometry.dispose()}
      const s=pi.localToWorld(V(1.65,.7,-1.2));
      usb=new T3.Mesh(new T3.TubeGeometry(new T3.CatmullRomCurve3([s,V(s.x+1,s.y+.3,s.z+.2),V(8.7,s.y-.2,s.z-.3),V(9.1,uy(9)+.3,s.z-2),V(9.15,uy(9)-.4,2)]),40,.085,6,false),usbMat);rack.add(usb);
      if(wolLine){scene.remove(wolLine);wolLine.geometry.dispose()}
      const a=sw.localToWorld(ports[5].clone()),b=tower.localToWorld(V(TW/2-.8,1.2,TD/2-1.6));
      wolCurve=new T3.CatmullRomCurve3([a,V(a.x,a.y,a.z+1.2),V(a.x-1.5,8,ZF+3),V(a.x-5,.3,ZF+4.6),V(-10,.3,ZF+5.2),V(b.x+3,.3,b.z+3.5),b],false,'catmullrom',.4);
      wolLine=new T3.Line(new T3.BufferGeometry().setFromPoints(wolCurve.getSpacedPoints(90).filter(p=>p.y<.7)),wolMat);wolLine.computeLineDistances();scene.add(wolLine);
    }
    const pkGeo=new T3.SphereGeometry(.16,10,8);
    const packets=[0,1,2,3,4].map(i=>{const m=new T3.Mesh(pkGeo,new T3.MeshBasicMaterial({color:i===0?0xe0a458:0xf2f0ea,transparent:true,opacity:0}));rack.add(m);return {m,i,off:i*.23,spd:.3+i*.035,rev:i%2===1}});
    const wolPk=new T3.Mesh(new T3.SphereGeometry(.24,12,10),new T3.MeshBasicMaterial({color:0xe0a458,transparent:true,opacity:0}));scene.add(wolPk);
    const wolGlow=glow(scene,0xe0a458,2.6,0,0,0,0);

    /* ---- callout map for the closing wide shot ---- */
    const NS='http://www.w3.org/2000/svg',mapG=document.createElementNS(NS,'g'),leadG=document.createElementNS(NS,'g');
    mapG.setAttribute('class','map');leadG.setAttribute('class','lead');svg.append(mapG,leadG);
    const leadP=document.createElementNS(NS,'path'),leadD=document.createElementNS(NS,'circle');leadD.setAttribute('r','3');leadG.append(leadP,leadD);
    const callouts=[
      {id:'gpu',side:'L',name:'gpu-worker',sub:'RTX 3060 Ti · asleep',obj:tower,at:V(-TW/2,TH*.72,TD/2)},
      {id:'lab',side:'L',name:'pve-lab-01',sub:'Proxmox · Kali, Ubuntu',obj:lab,at:V(-5.7,2.7,0)},
      {id:'infra',side:'L',name:'pve-infra-01',sub:'Proxmox · router, DNS',obj:infra,at:V(-5.7,1.1,0)},
      {id:'pi',side:'R',name:'pi-node-1',sub:'Pi 4 · uptime monitor',obj:pi,at:V(1.65,2.5,0)},
      {id:'switch',side:'R',name:'switch',sub:'8-port PoE gigabit',obj:sw,at:V(3.3,.55,0)},
      {id:'pdu',side:'R',name:'pdu',sub:'10 outlets · 7 live',obj:pdu,at:V(9.5,U/2,.1)},
      {id:'server130',side:'R',name:'server130',sub:'Windows Server 2025',obj:s130,at:V(SW/2,SH-.2,SZ)},
    ];
    callouts.forEach(c=>{const el=document.createElement('div');el.className='co '+(c.side==='R'?'r':'l');el.innerHTML=`<b>${c.name}</b><span>${c.sub}</span>`;labWrap.appendChild(el);
      c.el=el;c.subEl=el.querySelector('span');c.path=document.createElementNS(NS,'path');c.dot=document.createElementNS(NS,'circle');c.dot.setAttribute('r','2.4');mapG.append(c.path,c.dot)});
    const measure=()=>{callouts.forEach(c=>{c.w=c.el.offsetWidth;c.h=c.el.offsetHeight});cardSz=cards.map(c=>[c.offsetWidth,c.offsetHeight])};
    let cardSz=[];
    const pv=new T3.Vector3();
    function layoutMap(op){
      labWrap.style.opacity=op;mapG.style.opacity=op;if(op<.01)return;
      const w=cv.clientWidth,h=cv.clientHeight,compact=w<640,pad=compact?12:28,gap=compact?26:46;
      const sides={L:[],R:[]};
      callouts.forEach(c=>{pv.copy(c.at);c.obj.localToWorld(pv);pv.project(cam);c.ax=(pv.x+1)/2*w;c.ay=(1-pv.y)/2*h;sides[c.side].push(c)});
      for(const s of ['L','R']){const arr=sides[s].sort((a,b)=>a.ay-b.ay);
        let y=pad+20;arr.forEach(c=>{c.ly=Math.max(c.ay-9,y);y=c.ly+gap});
        const over=y-gap-(h-pad-60-(arr.length?arr[arr.length-1].h||30:30));if(over>0)arr.forEach(c=>{c.ly-=over});
        arr.forEach(c=>{const x=s==='L'?pad:w-pad-c.w;c.el.style.transform=`translate(${x.toFixed(1)}px,${c.ly.toFixed(1)}px)`;
          const ex=s==='L'?pad+c.w+8:w-pad-c.w-8,ey=c.ly+8,kx=s==='L'?ex+18:ex-18;
          c.path.setAttribute('d',`M${c.ax.toFixed(1)},${c.ay.toFixed(1)}L${kx.toFixed(1)},${ey.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}`);
          c.dot.setAttribute('cx',c.ax.toFixed(1));c.dot.setAttribute('cy',c.ay.toFixed(1))})}
    }

    /* ---- the tour: one stop per machine; the camera glides between them as you scroll ---- */
    const stops=[
      {id:'overview',F:V(-9,12.5,0),w:62,h:40,az:-.3,el:.16,wide:1,frac:.5,shift:.13},
      {id:'infra',obj:infra,at:V(0,1.8,-2.5),w:14.5,h:9,az:-.42,el:.14,pin:V(5.7,1.9,0)},
      {id:'lab',obj:lab,at:V(0,1.8,-2.5),w:14.5,h:9,az:-.3,el:.26,pin:V(5.7,1.9,0)},
      {id:'pi',obj:pi,at:V(0,1.4,-1.6),w:8,h:6.5,az:-.16,el:.22,pin:V(1.65,1.7,0)},
      {id:'switch',obj:sw,at:V(0,.55,-1),w:9.5,h:6,az:.04,el:.12,pin:V(3.3,.6,0)},
      {id:'pdu',obj:pdu,at:V(0,U/2,-1),w:19,h:8,az:-.2,el:.1,pin:V(9.5,U/2,.1)},
      {id:'server130',obj:s130,at:V(0,5.2,1.2),w:22,h:14,az:-.3,el:.44,pin:V(SW/2,7,SZ)},
      {id:'gpu',obj:tower,at:V(0,10,0),w:16,h:24,az:.12,el:.12,pin:V(TW/2,TH*.62,TD/2)},
      {id:'outro',F:V(-9,13,0),w:84,h:42,az:-.42,el:.2,wide:1,shift:0},
    ];
    const S=stops.length,idx={};stops.forEach((s,i)=>idx[s.id]=i);
    const focus=s=>s.F?s.F.clone():s.obj.localToWorld(s.at.clone());
    const sst=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},lerp=(a,b,t)=>a+(b-a)*t;
    // each machine slides out of the rack while the camera is on it
    const base=new Map([infra,lab,sw,pi,pdu,s130].map(o=>[o,o.position.clone()]));
    const pullV={infra:V(0,0,6.5),lab:V(-.4,.7,7.5),pi:V(0,1.8,3.2),switch:V(0,0,5.2),pdu:V(0,0,5),server130:V(0,0,6.5)};
    const wt={};let lastPull='';
    function applyPulls(ue){
      for(const id of ['infra','lab','pi','switch','pdu','server130','gpu'])wt[id]=sst(0,1,1-Math.abs(ue-idx[id]));
      infra.position.copy(base.get(infra)).addScaledVector(pullV.infra,wt.infra);
      lab.position.copy(base.get(lab)).addScaledVector(pullV.lab,wt.lab);
      sw.position.copy(base.get(sw)).addScaledVector(pullV.switch,wt.switch);
      pi.position.copy(base.get(pi)).addScaledVector(pullV.switch,wt.switch).addScaledVector(pullV.pi,wt.pi);
      pdu.position.copy(base.get(pdu)).addScaledVector(pullV.pdu,wt.pdu);
      s130.position.copy(base.get(s130)).addScaledVector(pullV.server130,wt.server130);
      const k=(wt.switch+wt.pi*2).toFixed(3);if(k!==lastPull){lastPull=k;buildCables()}
    }
    function doorFade(e){const k=1-.84*e;dFrame.opacity=k;lockMat.opacity=k;dFrame.depthWrite=k>.9;dGlass.opacity=.26*(1-.8*e);dStreak.opacity=.12*(1-e);dEdge.opacity=.18+.22*e;dEdge.color.copy(boneC)}
    const tf=Math.tan(14*Math.PI/180);
    const shiftOf=s=>s.shift!==undefined?s.shift:(s.wide?.08:.15);
    function dist(s,asp,cmp){const frac=s.wide?(cmp?.96:(s.frac||.82)):(cmp?.84:.36),fh=s.wide?.86:(cmp?.42:.6);return Math.max(s.w/(frac*2*tf*asp),s.h/(fh*2*tf))}

    /* ---- theme ---- */
    const boneC=new T3.Color(),accC=new T3.Color(),dim=new T3.Color(0x161616),col=new T3.Color();
    function colors(){const l=triple('--contour'),a=triple('--contour-accent');boneC.setRGB(l[0],l[1],l[2]);accC.setRGB(a[0],a[1],a[2]);
      wolMat.color.copy(accC);shadowMat.opacity=isLight()?.32:.8;drawFloor()}
    colors();

    /* ---- rail + skip ---- */
    let navH=58,sh=1;
    const stopY=k=>{const top=tour.getBoundingClientRect().top+scrollY-navH;return top+(k/(S-1))*(tour.offsetHeight-sh)};
    railBtns.forEach((b,k)=>b.addEventListener('click',()=>scrollTo({top:stopY(k)+2,behavior:reduce?'auto':'smooth'})));
    skip.addEventListener('click',()=>scrollTo({top:tour.getBoundingClientRect().top+scrollY+tour.offsetHeight-navH,behavior:reduce?'auto':'smooth'}));

    const size=()=>{navH=parseFloat(getComputedStyle(sticky).top)||58;sh=sticky.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(sticky.clientWidth,sh,false);cam.aspect=sticky.clientWidth/Math.max(1,sh);cam.updateProjectionMatrix();measure()};
    size();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(measure);
    let last=0,mxS=0,myS=0,awake=false,railOn=-1;
    function draw(t){
      t=t||performance.now()/1000;const dt=Math.min(.05,last?t-last:.016);last=t;
      const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
      const cmp=w<760,asp=w/h;
      // scroll progress through the tour, with a short hold at every stop
      const tr=tour.getBoundingClientRect(),P=Math.min(1,Math.max(0,(navH-tr.top)/Math.max(1,tr.height-sh)));
      const u=P*(S-1),i=Math.min(S-2,Math.floor(u)),f=sst(.2,.8,u-i),ue=i+f;
      applyPulls(ue);
      door.rotation.y=1.85*sst(.12,.7,ue);doorFade(sst(.5,1.15,ue));
      // camera: interpolate focus, angle, and distance; a little pull-back between close-ups
      const A=stops[i],Bs=stops[i+1],Fc=focus(A).lerp(focus(Bs),f);
      mxS+=(mx-mxS)*.05;myS+=(my-myS)*.05;
      const az=lerp(A.az,Bs.az,f)+mxS*.05,el=lerp(A.el,Bs.el,f)-myS*.035;
      let d=Math.exp(lerp(Math.log(dist(A,asp,cmp)),Math.log(dist(Bs,asp,cmp)),f));
      if(!A.wide&&!Bs.wide)d*=1+.2*Math.sin(Math.PI*f);
      const wideK=lerp(A.wide?1:0,Bs.wide?1:0,f),visW=2*d*tf*asp,visH=2*d*tf;
      if(cmp)Fc.y-=visH*.17*(1-wideK*.5);else{const s=lerp(shiftOf(A),shiftOf(Bs),f)*visW;Fc.x+=Math.cos(az)*s;Fc.z-=Math.sin(az)*s}
      cam.position.set(Fc.x+d*Math.sin(az)*Math.cos(el),Fc.y+d*Math.sin(el),Fc.z+d*Math.cos(az)*Math.cos(el));cam.lookAt(Fc);
      // highlight the machine in focus
      for(const id in edgeSets){if(id==='cab')continue;const k=wt[id]||0;edgeSets[id].color.copy(boneC).lerp(accC,k);edgeSets[id].opacity=.18+.62*k}
      // wake-on-LAN: a magic packet crosses the floor on the way to the GPU worker, which wakes on arrival
      const pf=sst(6.2,6.85,ue),wake=sst(6.8,7.05,ue);
      if(pf>0&&pf<1&&wolCurve){wolPk.position.copy(wolCurve.getPointAt(pf));const o=Math.min(1,Math.sin(Math.PI*pf)*1.6);wolPk.material.opacity=o;wolGlow.position.copy(wolPk.position);wolGlow.material.opacity=o*.6;portLeds[5].material.color.setHex(pf<.25?0x5bd46e:0x1a1b1c)}
      else{wolPk.material.opacity=0;wolGlow.material.opacity=0;portLeds[5].material.color.setHex(0x1a1b1c)}
      // ambient life
      if(!reduce){
        roofFans.forEach(b=>{b.rotation.y+=dt*3.2});
        portLeds.forEach((l,j)=>{if(j<5&&Math.random()<.08)l.visible=!l.visible||Math.random()<.6});
        slots.forEach((s,k)=>s.material.color.setHSL(.52+.07*Math.sin(t*.6+k*.45),.85,.55));
        piGlow.material.color.setHSL(.52+.07*Math.sin(t*.6+2),.85,.55);
        packets.forEach(o=>{const c=cables[o.i];if(!c)return;const g=((t*o.spd+o.off)%1+1)%1;o.m.position.copy(c.curve.getPointAt(o.rev?1-g:g));o.m.material.opacity=Math.sin(Math.PI*g)*.95});
      }
      tFans.forEach((fn,j)=>{col.setHSL((t*.07+j*.11)%1,.6,.52);fn.ring.material.color.copy(dim).lerp(col,wake);fn.gl.material.color.copy(col);fn.gl.material.opacity=.3*wake;if(!reduce)fn.blades.rotation.z+=dt*wake*14});
      rgbParts.forEach((m,j)=>{col.setHSL((t*.07+.5+j*.13)%1,.6,.52);m.material.color.copy(dim).lerp(col,wake)});
      tPower.material.color.setHex(wake>.5?0xdfeeff:0x141414);
      if((wake>.5)!==awake){awake=wake>.5;const g=callouts[0];g.subEl.textContent='RTX 3060 Ti · '+(awake?'awake':'asleep');g.w=g.el.offsetWidth}
      renderer.render(scene,cam);
      // cards: the one for the current stop fades in beside its machine, with a leader line
      const k=Math.round(ue);let leadOp=0;
      cards.forEach((c,j)=>{const op=1-sst(.14,.36,Math.abs(ue-j));
        if(op<=.005){if(c.style.visibility!=='hidden'){c.style.visibility='hidden';c.style.opacity='0'}return}
        c.style.visibility='visible';c.style.opacity=op.toFixed(3);
        const par=(ue-j)*-70;
        if(cmp){c.style.transform=`translate3d(0,${(par*.4).toFixed(1)}px,0)`;return}
        const [cw,chh]=cardSz[j]||[340,260],s=stops[j];let x=w*.6,y=h/2-chh/2;
        if(s.pin){pv.copy(s.pin);s.obj.localToWorld(pv);pv.project(cam);const px=(pv.x+1)/2*w,py=(1-pv.y)/2*h;
          x=Math.min(w-cw-56,Math.max(px+110,w*.56));y=Math.min(h-chh-64,Math.max(64,py-chh*.38));
          if(j===k){const ly=y+par+34;leadP.setAttribute('d',`M${px.toFixed(1)},${py.toFixed(1)}L${(x-24).toFixed(1)},${ly.toFixed(1)}L${x.toFixed(1)},${ly.toFixed(1)}`);leadD.setAttribute('cx',px.toFixed(1));leadD.setAttribute('cy',py.toFixed(1));leadOp=op}}
        c.style.transform=`translate3d(${x.toFixed(1)}px,${(y+par).toFixed(1)}px,0)`});
      leadG.style.opacity=cmp?0:leadOp.toFixed(3);
      // closing wide shot shows the whole map; rail, hint, and skip fade at the ends
      const mapOp=sst(7.35,7.85,ue);layoutMap(mapOp);
      rail.style.opacity=(1-mapOp).toFixed(3);
      hint.style.opacity=(1-sst(.05,.3,ue)).toFixed(3);
      const sk=1-sst(7.2,7.6,ue);skip.style.opacity=sk.toFixed(3);skip.style.pointerEvents=sk<.1?'none':'auto';
      const on=Math.min(railBtns.length-1,Math.round(ue));if(on!==railOn){railOn=on;railBtns.forEach((b,j)=>{b.classList.toggle('on',j===on);if(j===on)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')})}
    }
    const kick=loop(tour,draw);
    addEventListener('scroll',()=>kick(),{passive:true});
    addEventListener('resize',()=>{size();draw()});
    if(reduce)addEventListener('scroll',()=>draw(),{passive:true});
    themeFns.push(()=>{colors();draw()});
    draw();
    return true;
  }
  rackGL();

  /* ---------- DOM parallax, nav state, progress ---------- */
  const nav=document.getElementById('nav'),bar=document.getElementById('progress');
  const speedEls=[...document.querySelectorAll('[data-speed]')];
  const links=[...document.querySelectorAll('.nav ul a')],secs=links.map(a=>document.querySelector(a.getAttribute('href')));
  let ticking=false;
  function frame(){
    ticking=false;
    const y=scrollY,vh=innerHeight,max=document.documentElement.scrollHeight-vh;
    nav.classList.toggle('scrolled',y>8);
    bar.style.transform=`scaleX(${max>0?y/max:0})`;
    let active=-1;secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<vh*.4)active=i});
    links.forEach((a,i)=>a.classList.toggle('on',i===active));
    if(reduce)return;
    if(!heroOK)plates.forEach(cv=>{const d=+cv.dataset.depth;cv.style.transform=`translate3d(${mx*d*-28}px,${y*d+my*d*-20}px,0)`});
    speedEls.forEach(el=>{
      const r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;
      el.style.transform=`translate3d(0,${((r.top+r.height/2-vh/2)*(+el.dataset.speed)).toFixed(1)}px,0)`;
    });
  }
  const req=()=>{if(!ticking){ticking=true;requestAnimationFrame(frame)}};
  addEventListener('scroll',req,{passive:true});addEventListener('resize',req);
  if(!reduce&&!heroOK)addEventListener('pointermove',req,{passive:true});
  frame();

  /* ---------- reveal: below-the-fold elements settle in; everything is readable at rest ---------- */
  if(!reduce&&'IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('pre');io.unobserve(e.target)}}),{rootMargin:'0px 0px 6% 0px'});
    document.querySelectorAll('.rv').forEach(el=>{if(el.getBoundingClientRect().top>innerHeight){el.classList.add('pre');io.observe(el)}});
  }
})();
