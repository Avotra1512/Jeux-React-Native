import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Dimensions, Animated,
} from 'react-native';
import Svg, { Circle, Line, Rect, G, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');

const COLS=9, ROWS=5, EMPTY=0, RED=1, DARK=2;
const BOARD_W = Math.min(SW-16, 440);
const PAD_H=32, PAD_V=30;
const BOARD_H = BOARD_W*0.55 + PAD_V*2;
const CW = (BOARD_W-PAD_H*2)/(COLS-1);
const CH = (BOARD_H-PAD_V*2)/(ROWS-1);
const PR = Math.min(CW,CH)*0.38;
const gx = c => PAD_H+c*CW;
const gy = r => PAD_V+r*CH;
const key = (c,r) => `${c},${r}`;
const inB = (c,r) => c>=0&&c<COLS&&r>=0&&r<ROWS;

const C = {
  bg:'#0f0a05', surface:'#1a1005', card:'#241808',
  border:'#3d2a0a', gold:'#d4a017',
  red:'#C84B30', redDim:'#7A1E00',
  dark:'#e8e0d0',
  text:'#f0e8d0', muted:'#6b5a3a', board1:'#ECCA6A', board2:'#A97025',
  green:'#22C55E', orange:'#F97316', blue:'#3B82F6',
};

// ─── LOGIQUE ──────────────────────────────────────────────────
const hasDiag = (c,r) => (c+r)%2===0 && !(c===4&&r===2);
const getDirs = (c,r) => {
  const d=[[1,0],[-1,0],[0,1],[0,-1]];
  if(hasDiag(c,r)) d.push([1,1],[1,-1],[-1,1],[-1,-1]);
  return d;
};

const buildSegs = () => {
  const segs=[], seen=new Set();
  const add=(c1,r1,c2,r2)=>{
    const a=`${c1},${r1},${c2},${r2}`;
    if(seen.has(a)||seen.has(`${c2},${r2},${c1},${r1}`)) return;
    seen.add(a); segs.push([c1,r1,c2,r2]);
  };
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(inB(c+1,r)) add(c,r,c+1,r);
    if(inB(c,r+1)) add(c,r,c,r+1);
    [[1,1],[1,-1]].forEach(([dc,dr])=>{
      const nc=c+dc,nr=r+dr;
      if(inB(nc,nr)&&(hasDiag(c,r)||hasDiag(nc,nr))) add(c,r,nc,nr);
    });
  }
  return segs;
};
const SEGS=buildSegs();
const SEG_O=SEGS.filter(([c1,r1,c2,r2])=>c1===c2||r1===r2);
const SEG_D=SEGS.filter(([c1,r1,c2,r2])=>c1!==c2&&r1!==r2);

const MID=[DARK,RED,DARK,RED,EMPTY,DARK,RED,DARK,RED];
const initBoard=()=>Array.from({length:ROWS},(_,r)=>
  r===2?[...MID]:Array(COLS).fill(r<2?DARK:RED)
);

const opp=p=>p===RED?DARK:RED;

const collectLine=(b,sc,sr,dc,dr,enemy)=>{
  const list=[]; let nc=sc+dc,nr=sr+dr;
  while(inB(nc,nr)&&b[nr][nc]===enemy){list.push([nc,nr]);nc+=dc;nr+=dr;}
  return list;
};

const getCaptures=(b,fc,fr,tc,tr,pl)=>{
  const e=opp(pl),dc=tc-fc,dr=tr-fr;
  return{approach:collectLine(b,tc,tr,dc,dr,e), retreat:collectLine(b,fc,fr,-dc,-dr,e)};
};

const canMove=(b,fc,fr,tc,tr)=>{
  if(!inB(tc,tr)||b[tr][tc]!==EMPTY) return false;
  const dc=tc-fc,dr=tr-fr;
  if(Math.abs(dc)>1||Math.abs(dr)>1) return false;
  return dc===0||dr===0||hasDiag(fc,fr)||hasDiag(tc,tr);
};

const allCapMoves=(b,pl)=>{
  const moves=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(b[r][c]!==pl) continue;
    for(const [dc,dr] of getDirs(c,r)){
      const [tc,tr]=[c+dc,r+dr];
      if(!canMove(b,c,r,tc,tr)) continue;
      const{approach,retreat}=getCaptures(b,c,r,tc,tr,pl);
      if(approach.length) moves.push({from:[c,r],to:[tc,tr],type:'approach',captured:approach});
      if(retreat.length)  moves.push({from:[c,r],to:[tc,tr],type:'retreat', captured:retreat});
    }
  }
  return moves;
};

const allPaikaMoves=(b,pl)=>{
  const moves=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(b[r][c]!==pl) continue;
    for(const [dc,dr] of getDirs(c,r)){
      const [tc,tr]=[c+dc,r+dr];
      if(canMove(b,c,r,tc,tr)) moves.push({from:[c,r],to:[tc,tr],type:'paika',captured:[]});
    }
  }
  return moves;
};

const applyMove=(b,from,to,captured)=>{
  const nb=b.map(r=>[...r]);
  nb[to[1]][to[0]]=nb[from[1]][from[0]];
  nb[from[1]][from[0]]=EMPTY;
  captured.forEach(([cc,cr])=>nb[cr][cc]=EMPTY);
  return nb;
};

const getCont=(b,c,r,pl,ldc,ldr,ltype)=>{
  const moves=[];
  for(const [dc,dr] of getDirs(c,r)){
    if(dc===-ldc&&dr===-ldr) continue;
    const [tc,tr]=[c+dc,r+dr];
    if(!canMove(b,c,r,tc,tr)) continue;
    const{approach,retreat}=getCaptures(b,c,r,tc,tr,pl);
    if(approach.length&&!(dc===ldc&&dr===ldr&&ltype==='approach'))
      moves.push({from:[c,r],to:[tc,tr],type:'approach',captured:approach});
    if(retreat.length&&!(dc===ldc&&dr===ldr&&ltype==='retreat'))
      moves.push({from:[c,r],to:[tc,tr],type:'retreat',captured:retreat});
  }
  return moves;
};

const countPieces=b=>{
  let red=0,dark=0;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(b[r][c]===RED) red++; else if(b[r][c]===DARK) dark++;
  }
  return{red,dark};
};

// IA : joue la chaîne complète de captures en une seule fois (sans attendre)
// Retourne la grille finale après toutes les captures enchaînées
const aiPlayFullTurn=(b)=>{
  const caps=allCapMoves(b,DARK);
  if(!caps.length){
    // Paika : un seul coup simple
    const pks=allPaikaMoves(b,DARK);
    if(!pks.length) return{board:b, moved:false};
    const m=pks[Math.floor(Math.random()*pks.length)];
    return{board:applyMove(b,m.from,m.to,[]), moved:true};
  }

  // Choisit le meilleur premier coup (max captures)
  let move=caps.reduce((a,m)=>m.captured.length>a.captured.length?m:a,caps[0]);
  let nb=applyMove(b,move.from,move.to,move.captured);
  let ldc=move.to[0]-move.from[0], ldr=move.to[1]-move.from[1], ltype=move.type;

  // Continue la chaîne tant qu'il y a des continuations disponibles
  // (l'IA choisit toujours la continuation avec le plus de captures)
  let limit=20; // sécurité anti-boucle infinie
  while(limit-->0){
    const cont=getCont(nb,move.to[0],move.to[1],DARK,ldc,ldr,ltype);
    if(!cont.length) break;
    const next=cont.reduce((a,m)=>m.captured.length>a.captured.length?m:a,cont[0]);
    nb=applyMove(nb,next.from,next.to,next.captured);
    ldc=next.to[0]-next.from[0]; ldr=next.to[1]-next.from[1]; ltype=next.type;
    move=next;
  }
  return{board:nb, moved:true};
};

// ─── COMPOSANTS SVG ───────────────────────────────────────────
const Piece=({cx,cy,color,selected,canCapture})=>{
  const isR=color===RED;
  return(
    <G>
      {selected&&<Circle cx={cx} cy={cy} r={PR+6} fill="none" stroke={C.gold} strokeWidth={2.5} strokeDasharray="5,3"/>}
      {canCapture&&!selected&&<Circle cx={cx} cy={cy} r={PR+5} fill="rgba(251,146,60,0.25)" stroke={C.orange} strokeWidth={1.5}/>}
      <Circle cx={cx+1.5} cy={cy+2} r={PR} fill="rgba(0,0,0,0.25)"/>
      <Circle cx={cx} cy={cy} r={PR} fill={isR?C.red:'#252523'}/>
      <Circle cx={cx} cy={cy} r={PR} fill="none" stroke={isR?C.redDim:'#000'} strokeWidth={1.5}/>
      <Circle cx={cx-PR*0.27} cy={cy-PR*0.3} r={PR*0.3} fill={isR?'rgba(255,170,130,0.55)':'rgba(255,255,255,0.2)'}/>
    </G>
  );
};

const Hint=({cx,cy,type})=>{
  const cfg={
    paika:        {fill:'rgba(34,197,94,0.3)',  stroke:C.green,   r:0.5,  dot:C.green},
    capture:      {fill:'rgba(239,68,68,0.35)', stroke:'#EF4444', r:0.54, dot:'#DC2626'},
    continuation: {fill:'rgba(249,115,22,0.4)', stroke:C.orange,  r:0.58, dot:'#FB923C'},
  }[type];
  if(!cfg) return null;
  return(
    <G>
      <Circle cx={cx} cy={cy} r={PR*cfg.r} fill={cfg.fill} stroke={cfg.stroke} strokeWidth={2}/>
      <Circle cx={cx} cy={cy} r={PR*0.22} fill={cfg.dot}/>
    </G>
  );
};

const Victim=({cx,cy,vtype})=>{
  const col=vtype==='retreat'?C.blue:'#EF4444';
  return(
    <G>
      <Circle cx={cx} cy={cy} r={PR*0.62} fill={vtype==='retreat'?'rgba(59,130,246,0.18)':'rgba(239,68,68,0.18)'} stroke={col} strokeWidth={1.5} strokeDasharray="4,2"/>
      <Line x1={cx-PR*0.38} y1={cy-PR*0.38} x2={cx+PR*0.38} y2={cy+PR*0.38} stroke={col} strokeWidth={2.5} strokeLinecap="round"/>
      <Line x1={cx+PR*0.38} y1={cy-PR*0.38} x2={cx-PR*0.38} y2={cy+PR*0.38} stroke={col} strokeWidth={2.5} strokeLinecap="round"/>
    </G>
  );
};

const Board=({board,selected,hints,victims,capSet,onPress})=>(
  <Svg width={BOARD_W} height={BOARD_H}>
    <Defs>
      <RadialGradient id="bg" cx="50%" cy="40%" rx="60%" ry="60%">
        <Stop offset="0%" stopColor={C.board1}/><Stop offset="100%" stopColor={C.board2}/>
      </RadialGradient>
    </Defs>
    <Rect x={0} y={0} width={BOARD_W} height={BOARD_H} rx={10} fill="url(#bg)"/>
    {SEG_D.map(([c1,r1,c2,r2],i)=>(
      <Line key={'d'+i} x1={gx(c1)} y1={gy(r1)} x2={gx(c2)} y2={gy(r2)} stroke="#5A3010" strokeWidth={0.85} opacity={0.8}/>
    ))}
    {SEG_O.map(([c1,r1,c2,r2],i)=>(
      <Line key={'o'+i} x1={gx(c1)} y1={gy(r1)} x2={gx(c2)} y2={gy(r2)} stroke="#5A3010" strokeWidth={1.5}/>
    ))}
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
      const h=hints?.get(key(c,r));
      return h?<Hint key={'h'+key(c,r)} cx={gx(c)} cy={gy(r)} type={h}/>:null;
    }))}
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
      const cell=board[r][c];
      if(cell===EMPTY) return (c===4&&r===2)?<Circle key="ctr" cx={gx(4)} cy={gy(2)} r={PR*0.3} fill="none" stroke="#7A5020" strokeWidth={1} opacity={0.6}/>:null;
      return<Piece key={key(c,r)} cx={gx(c)} cy={gy(r)} color={cell} selected={selected&&selected[0]===c&&selected[1]===r} canCapture={capSet?.has(key(c,r))}/>;
    }))}
    {victims&&Array.from(victims).map(([k,t])=>{
      const [c,r]=k.split(',').map(Number);
      return<Victim key={'v'+k} cx={gx(c)} cy={gy(r)} vtype={t}/>;
    })}
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>(
      <Rect key={'t'+key(c,r)} x={gx(c)-CW/2} y={gy(r)-CH/2} width={CW} height={CH} fill="transparent" onPress={()=>onPress(c,r)}/>
    )))}
  </Svg>
);

const Menu=({onStart,fadeIn})=>(
  <SafeAreaView style={s.menuSafe}>
    <Animated.View style={[s.menuInner,{opacity:fadeIn,transform:[{translateY:fadeIn.interpolate({inputRange:[0,1],outputRange:[40,0]})}]}]}>
      <View style={s.badge}><Text style={s.badgeText}>🇲🇬  JEU TRADITIONNEL MALGASY</Text></View>
      <Text style={s.menuTitle}>FANORONA</Text>
      <View style={s.titleAccent}>
        <View style={[s.accentBar,{backgroundColor:C.red}]}/>
        <Text style={s.accentLabel}>9</Text>
        <View style={[s.accentBar,{backgroundColor:C.dark}]}/>
      </View>
      <Text style={s.menuDesc}>{"Capturez tous les pions adverses\npar approche ou par retrait !"}</Text>
      <TouchableOpacity style={[s.menuBtn,{borderColor:C.gold,backgroundColor:C.card}]} onPress={()=>onStart(false)} activeOpacity={0.8}>
        <Text style={s.menuBtnIcon}>👥</Text>
        <View style={{flex:1}}>
          <Text style={[s.menuBtnTitle,{color:C.gold}]}>JOUEUR VS JOUEUR</Text>
          <Text style={s.menuBtnSub}>2 joueurs · même appareil</Text>
        </View>
        <Text style={{color:C.gold,fontSize:22,fontWeight:'900'}}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.menuBtn,{borderColor:C.red,backgroundColor:C.card}]} onPress={()=>onStart(true)} activeOpacity={0.8}>
        <Text style={s.menuBtnIcon}>🤖</Text>
        <View style={{flex:1}}>
          <Text style={[s.menuBtnTitle,{color:C.red}]}>JOUEUR VS IA</Text>
          <Text style={s.menuBtnSub}>Affronte l'ordinateur</Text>
        </View>
        <Text style={{color:C.red,fontSize:22,fontWeight:'900'}}>›</Text>
      </TouchableOpacity>
      <View style={s.rulesBox}>
        <Text style={s.rulesTitle}>📖 RÈGLES CLÉS</Text>
        <Text style={s.rulesText}>{"• Approche : avancer vers l'ennemi → capture\n• Retrait : reculer de l'ennemi → capture\n• La capture est obligatoire si possible\n• Captures multiples en un seul tour autorisées"}</Text>
      </View>
    </Animated.View>
  </SafeAreaView>
);

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────
export default function FanoronaGame() {
  const [mode,setMode]           = useState(null);
  const [board,setBoard]         = useState(initBoard);
  const [player,setPlayer]       = useState(RED);
  const [selected,setSelected]   = useState(null);
  const [phase,setPhase]         = useState('select');
  const [hints,setHints]         = useState(new Map());
  const [victims,setVictims]     = useState([]);
  const [capSet,setCapSet]       = useState(new Set());
  const [pending,setPending]     = useState(null);
  const [contMoves,setContMoves] = useState([]);
  const [gameOver,setGameOver]   = useState(null);
  const [msg,setMsg]             = useState('');
  const [aiThinking,setAiThinking]=useState(false);

  // Refs pour lire les valeurs courantes depuis les callbacks async de l'IA
  const boardRef   = useRef(board);
  const playerRef  = useRef(player);
  const gameOverRef= useRef(gameOver);
  useEffect(()=>{boardRef.current=board;},[board]);
  useEffect(()=>{playerRef.current=player;},[player]);
  useEffect(()=>{gameOverRef.current=gameOver;},[gameOver]);

  const fadeIn   = useRef(new Animated.Value(0)).current;
  const flashAnim= useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    Animated.timing(fadeIn,{toValue:1,duration:800,useNativeDriver:true}).start();
  },[]);

  const buildGlobalHints=useCallback((b,pl)=>{
    const caps=allCapMoves(b,pl);
    const pks=caps.length===0?allPaikaMoves(b,pl):[];
    const h=new Map(), cs=new Set();
    caps.forEach(m=>{h.set(key(m.to[0],m.to[1]),'capture');cs.add(key(m.from[0],m.from[1]));});
    pks.forEach(m=>h.set(key(m.to[0],m.to[1]),'paika'));
    return{h,cs};
  },[]);

  const buildPieceHints=useCallback((b,pl,pc,pr)=>{
    const caps=allCapMoves(b,pl), pks=caps.length===0?allPaikaMoves(b,pl):[];
    const h=new Map(), vmap=new Map();
    caps.filter(m=>m.from[0]===pc&&m.from[1]===pr).forEach(m=>{
      h.set(key(m.to[0],m.to[1]),'capture');
      const dk=key(m.to[0],m.to[1]);
      if(!vmap.has(dk)) vmap.set(dk,{app:[],ret:[]});
      m.type==='approach'?vmap.get(dk).app.push(...m.captured):vmap.get(dk).ret.push(...m.captured);
    });
    pks.filter(m=>m.from[0]===pc&&m.from[1]===pr).forEach(m=>h.set(key(m.to[0],m.to[1]),'paika'));
    const vlist=[];
    for(const[,{app,ret}] of vmap){
      app.forEach(([vc,vr])=>vlist.push([key(vc,vr),'approach']));
      ret.forEach(([vc,vr])=>vlist.push([key(vc,vr),'retreat']));
    }
    return{h,victims:vlist};
  },[]);

  const doFlash=()=>{
    flashAnim.setValue(1);
    Animated.timing(flashAnim,{toValue:0,duration:500,useNativeDriver:true}).start();
  };

  const endTurn=useCallback((nb,capCount=0)=>{
    const next=playerRef.current===RED?DARK:RED;
    const{red,dark}=countPieces(nb);
    if(red===0||dark===0){
      const winner=red===0?'dark':'red';
      setGameOver(winner); gameOverRef.current=winner;
      setMsg(red===0?'⚫ Noir gagne la partie !':'🔴 Rouge gagne la partie !');
      return;
    }
    if(capCount>0) doFlash();
    setPlayer(next); playerRef.current=next;
    setPhase('select'); setSelected(null); setPending(null); setContMoves([]);
    const{h,cs}=buildGlobalHints(nb,next);
    setHints(h); setVictims([]); setCapSet(cs);
    setMsg(next===RED?'🔴 Tour de Rouge':'⚫ Tour de Noir');
  },[buildGlobalHints]);

  const doCapture=useCallback((b,move)=>{
    const nb=applyMove(b,move.from,move.to,move.captured);
    boardRef.current=nb; setBoard(nb);
    const cont=getCont(nb,move.to[0],move.to[1],playerRef.current,move.to[0]-move.from[0],move.to[1]-move.from[1],move.type);
    if(cont.length===0){
      endTurn(nb,move.captured.length);
    } else {
      setSelected(move.to); setPhase('continue'); setContMoves(cont);
      const h=new Map(); cont.forEach(m=>h.set(key(m.to[0],m.to[1]),'continuation'));
      setHints(h); setVictims([]); setCapSet(new Set());
      setMsg('🔗 Continuation possible ! (ou passer)');
    }
    doFlash();
  },[endTurn]);

  const startGame=(aiMode)=>{
    const b=initBoard(); boardRef.current=b;
    setMode(aiMode); setBoard(b); setPlayer(RED); playerRef.current=RED;
    setSelected(null); setPhase('select'); setPending(null);
    setContMoves([]); setGameOver(null); gameOverRef.current=null;
    setVictims([]); setAiThinking(false);
    setMsg('🔴 Rouge commence !');
    const{h,cs}=buildGlobalHints(b,RED);
    setHints(h); setCapSet(cs);
  };

  // ── TOUR DE L'IA ─────────────────────────────────────────────
  // L'IA calcule et joue TOUTE sa chaîne de captures en une seule fois
  // → elle ne passe jamais par la phase 'continue', pas besoin du bouton
  useEffect(()=>{
    if(!mode||player!==DARK||gameOver||aiThinking) return;
    setAiThinking(true);
    setMsg('⚫ IA joue...');
    const t=setTimeout(()=>{
      if(gameOverRef.current){setAiThinking(false);return;}
      const b=boardRef.current;
      // aiPlayFullTurn enchaîne toutes les captures sans attendre l'UI
      const{board:nb, moved}=aiPlayFullTurn(b);
      if(moved){
        boardRef.current=nb;
        setBoard(nb);
        // endTurn directement avec la grille finale — pas de phase 'continue' pour l'IA
        const next=RED;
        const{red,dark}=countPieces(nb);
        if(red===0||dark===0){
          const winner=red===0?'dark':'red';
          setGameOver(winner); gameOverRef.current=winner;
          setMsg(red===0?'⚫ Noir gagne !':'🔴 Rouge gagne !');
        } else {
          setPlayer(next); playerRef.current=next;
          setPhase('select'); setSelected(null); setPending(null); setContMoves([]);
          const{h,cs}=buildGlobalHints(nb,next);
          setHints(h); setVictims([]); setCapSet(cs);
          setMsg('🔴 Tour de Rouge');
          doFlash();
        }
      }
      setAiThinking(false);
    },400);
    return()=>clearTimeout(t);
  },[player,mode,gameOver]); // dépendances minimales

  const handlePress=useCallback((c,r)=>{
    if(gameOver||aiThinking) return;
    if(mode&&player===DARK) return;

    if(phase==='select'&&board[r][c]===player){
      setSelected([c,r]); setPhase('move');
      const{h,victims}=buildPieceHints(board,player,c,r);
      setHints(h); setVictims(victims);
    } else if(phase==='move'){
      const caps=allCapMoves(board,player);
      const m=caps.find(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]&&m.to[0]===c&&m.to[1]===r);
      if(m){
        const alt=caps.find(x=>x.from[0]===m.from[0]&&x.from[1]===m.from[1]&&x.to[0]===m.to[0]&&x.to[1]===m.to[1]&&x.type!==m.type);
        alt?setPending({app:m.type==='approach'?m:alt,ret:m.type==='retreat'?m:alt}):doCapture(board,m);
      } else if(caps.length===0&&canMove(board,selected[0],selected[1],c,r)){
        const nb=applyMove(board,selected,[c,r],[]);
        setBoard(nb); endTurn(nb);
      } else {
        setSelected(null); setPhase('select');
        const{h,cs}=buildGlobalHints(board,player); setHints(h); setCapSet(cs);
      }
    } else if(phase==='continue'){
      const m=contMoves.find(m=>m.to[0]===c&&m.to[1]===r);
      if(m) doCapture(board,m);
      else endTurn(board,0);
    }
  },[board,player,selected,phase,gameOver,aiThinking,mode,contMoves,doCapture,endTurn,buildGlobalHints,buildPieceHints]);

  if(mode===null) return <Menu onStart={startGame} fadeIn={fadeIn}/>;

  const isP1=player===RED, pColor=isP1?C.red:C.dark, pName=isP1?'Rouge':(mode?'IA':'Noir');

  return(
    <SafeAreaView style={s.safe}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:C.gold+'22',opacity:flashAnim,zIndex:99}]}/>

      <View style={s.header}>
        <View style={[s.turnPill,{borderColor:pColor}]}>
          <View style={[s.turnDot,{backgroundColor:pColor}]}/>
          <Text style={[s.turnLabel,{color:pColor}]}>{aiThinking?'⚫ IA joue...':`${pName} joue`}</Text>
        </View>
        <TouchableOpacity style={s.quitBtn} onPress={()=>setMode(null)}>
          <Text style={s.quitTxt}>✕ QUITTER</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.msgBand,{borderColor:pColor}]}>
        <Text style={[s.msgTxt,{color:pColor}]}>{msg}</Text>
        {gameOver&&(
          <TouchableOpacity style={[s.replayBtn,{borderColor:pColor}]} onPress={()=>startGame(mode)}>
            <Text style={[s.replayTxt,{color:pColor}]}>🔄 REJOUER</Text>
          </TouchableOpacity>
        )}
      </View>

      {pending&&(
        <View style={s.choicePanel}>
          <Text style={s.choiceTitle}>⚔️ Choisir le type de capture</Text>
          <View style={s.choiceRow}>
            <TouchableOpacity style={[s.choiceBtn,{borderColor:C.red}]} onPress={()=>{doCapture(board,pending.app);setPending(null);}}>
              <Text style={[s.choiceLbl,{color:C.red}]}>Approche -{pending.app.captured.length}p</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.choiceBtn,{borderColor:C.blue}]} onPress={()=>{doCapture(board,pending.ret);setPending(null);}}>
              <Text style={[s.choiceLbl,{color:C.blue}]}>Retrait -{pending.ret.captured.length}p</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={()=>setPending(null)}><Text style={s.cancelTxt}>Annuler</Text></TouchableOpacity>
        </View>
      )}

      <View style={s.piecesRow}>
        {(()=>{const{red,dark}=countPieces(board);return(
          <>
            <Text style={[s.pieceCount,{color:C.red}]}>🔴 {red}</Text>
            <Text style={[s.pieceCount,{color:C.muted}]}>vs</Text>
            <Text style={[s.pieceCount,{color:C.dark}]}>⚫ {dark}</Text>
          </>
        );})()}
      </View>

      <ScrollView contentContainerStyle={s.boardWrap} showsVerticalScrollIndicator={false}>
        <Board board={board} selected={selected} hints={hints} victims={new Map(victims)} capSet={capSet} onPress={handlePress}/>
        {/* Bouton passer : uniquement pour le joueur humain, jamais affiché pour l'IA */}
        {phase==='continue'&&(!mode||player===RED)&&(
          <TouchableOpacity style={[s.skipBtn,{borderColor:C.gold}]} onPress={()=>endTurn(board,0)}>
            <Text style={[s.skipTxt,{color:C.gold}]}>⏩ Passer la continuation</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  menuSafe:{flex:1,backgroundColor:C.bg},
  menuInner:{flex:1,justifyContent:'center',alignItems:'center',padding:24},
  badge:{backgroundColor:C.card,borderRadius:20,paddingHorizontal:16,paddingVertical:7,borderWidth:1,borderColor:C.border,marginBottom:24},
  badgeText:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:2.5},
  menuTitle:{fontSize:56,fontWeight:'900',color:C.text,letterSpacing:4,textAlign:'center',textShadowColor:C.gold,textShadowRadius:28},
  titleAccent:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:10},
  accentBar:{flex:1,height:2,borderRadius:1,maxWidth:60},
  accentLabel:{color:C.gold,fontSize:22,fontWeight:'900',letterSpacing:8,textShadowColor:C.gold,textShadowRadius:14},
  menuDesc:{color:C.muted,fontSize:13,textAlign:'center',marginBottom:28,lineHeight:20},
  menuBtn:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:14,borderWidth:1.5,marginBottom:12,shadowOpacity:0.2,shadowRadius:12,elevation:5},
  menuBtnIcon:{fontSize:24},
  menuBtnTitle:{fontSize:14,fontWeight:'900',letterSpacing:0.8},
  menuBtnSub:{color:C.muted,fontSize:11,marginTop:2},
  rulesBox:{width:'100%',backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.border,padding:14,marginTop:8},
  rulesTitle:{color:C.gold,fontSize:11,fontWeight:'800',letterSpacing:1.5,marginBottom:6,textAlign:'center'},
  rulesText:{color:C.muted,fontSize:12,lineHeight:20},
  safe:{flex:1,backgroundColor:C.bg},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,backgroundColor:C.surface,borderBottomWidth:1,borderBottomColor:C.border},
  turnPill:{flexDirection:'row',alignItems:'center',gap:5,borderWidth:1.5,borderRadius:14,paddingHorizontal:12,paddingVertical:5,backgroundColor:C.card},
  turnDot:{width:8,height:8,borderRadius:4},
  turnLabel:{fontSize:12,fontWeight:'800',letterSpacing:0.5},
  quitBtn:{backgroundColor:C.card,paddingHorizontal:10,paddingVertical:5,borderRadius:8,borderWidth:1,borderColor:C.border},
  quitTxt:{color:C.muted,fontSize:10,fontWeight:'700'},
  msgBand:{marginHorizontal:10,marginTop:5,borderRadius:8,backgroundColor:C.card,borderWidth:1,paddingVertical:6,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  msgTxt:{fontSize:12,fontWeight:'800',letterSpacing:0.5,flex:1},
  replayBtn:{borderWidth:1,borderRadius:8,paddingHorizontal:10,paddingVertical:4},
  replayTxt:{fontSize:11,fontWeight:'900'},
  choicePanel:{margin:10,padding:12,backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.border},
  choiceTitle:{color:C.text,fontWeight:'800',textAlign:'center',marginBottom:8,fontSize:13},
  choiceRow:{flexDirection:'row',justifyContent:'space-around',marginBottom:8},
  choiceBtn:{padding:10,borderRadius:8,borderWidth:1.5,minWidth:120,alignItems:'center',backgroundColor:C.surface},
  choiceLbl:{fontWeight:'800',fontSize:12},
  cancelTxt:{color:C.muted,textAlign:'center',fontSize:11},
  piecesRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12,paddingVertical:5},
  pieceCount:{fontSize:13,fontWeight:'800'},
  boardWrap:{padding:8,alignItems:'center'},
  skipBtn:{marginTop:10,paddingHorizontal:20,paddingVertical:8,borderRadius:10,borderWidth:1.5,alignSelf:'center'},
  skipTxt:{fontWeight:'800',fontSize:12},
});