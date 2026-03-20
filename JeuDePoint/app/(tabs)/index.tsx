import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, Animated
} from "react-native";
import Svg, { Polygon } from "react-native-svg";

const EMPTY = 0;
const P1 = 1;
const P2 = 2;
const CELL_SIZE = 32;

const C = {
  bg:      "#0a0a0f",
  surface: "#12121a",
  card:    "#1a1a28",
  border:  "#2a2a3d",
  p1:      "#00e5ff",
  p1bg:    "#0d1f2a",
  p2:      "#ff3d6b",
  p2bg:    "#2a0d15",
  text:    "#e8e8f0",
  muted:   "#555570",
  grid:    "#1a1a2a",
  gold:    "#ffd700",
};

export default function JeuDePointsMalagasy() {
  const [size, setSize] = useState(32);
  const [grid, setGrid] = useState(null);
  const [player, setPlayer] = useState(P1);
  const [isAiMode, setIsAiMode] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [capturedSet, setCapturedSet] = useState(new Set());
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [lastCapture, setLastCapture] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [gameOver, setGameOver] = useState(null); // null | 'p1' | 'p2' | 'extended'

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const flashAnim  = useRef(new Animated.Value(0)).current;
  const fadeIn     = useRef(new Animated.Value(0)).current;
  const winAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (isAiMode && player === P2 && !gameOver) {
      const t = setTimeout(makeAiMove, 700);
      return () => clearTimeout(t);
    }
  }, [player, isAiMode, grid, gameOver]);

  const triggerFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 700, useNativeDriver: true }).start();
  };

  const triggerWin = () => {
    winAnim.setValue(0);
    Animated.spring(winAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  };

  const initGame = (modeIA) => {
    setGrid(Array.from({ length: 32 }, () => Array(32).fill(EMPTY)));
    setSize(32);
    setIsAiMode(modeIA);
    setScore({ p1: 0, p2: 0 });
    setTerritories([]);
    setCapturedSet(new Set());
    setPlayer(P1);
    setMoveCount(0);
    setLastCapture(null);
    setGameOver(null);
  };

  const makeAiMove = () => {
    if (!grid) return;
    const moves = [];
    grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === EMPTY) moves.push({ x, y });
    }));
    if (moves.length > 0) {
      const m = moves[Math.floor(Math.random() * moves.length)];
      handlePress(m.x, m.y);
    }
  };

  // ── Vérifie si la grille est pleine et décide quoi faire ──────
  const checkGridFull = (newGrid, newScore, newSize) => {
    const isFull = newGrid.every(row => row.every(c => c !== EMPTY));
    if (!isFull) return false;

    if (newScore.p1 !== newScore.p2) {
      // Quelqu'un gagne
      setGameOver(newScore.p1 > newScore.p2 ? 'p1' : 'p2');
      triggerWin();
    } else {
      // Égalité → on étend la grille de +4 lignes et +4 colonnes
      const extSize = newSize + 4;
      const extGrid = Array.from({ length: extSize }, (_, y) =>
        Array.from({ length: extSize }, (_, x) =>
          y < newSize && x < newSize ? newGrid[y][x] : EMPTY
        )
      );
      setSize(extSize);
      setGrid(extGrid);
      setGameOver('extended'); // message temporaire
      setTimeout(() => setGameOver(null), 2500); // disparaît après 2.5s
    }
    return true;
  };

  const handlePress = (x, y) => {
    if (!grid || grid[y][x] !== EMPTY || gameOver) return;

    const newGrid = grid.map(r => [...r]);
    newGrid[y][x] = player;

    const allCaptures = detectAllCaptures(newGrid, x, y, player, capturedSet);
    let newScore = { ...score };

    if (allCaptures.totalCaptured > 0) {
      const newCapturedSet = new Set(capturedSet);
      allCaptures.newlyCapturedKeys.forEach(k => newCapturedSet.add(k));
      setCapturedSet(newCapturedSet);
      setTerritories(prev => [...prev, ...allCaptures.cycles.map(c => ({ points: c, owner: player }))]);

      newScore = {
        ...score,
        [player === P1 ? 'p1' : 'p2']: score[player === P1 ? 'p1' : 'p2'] + allCaptures.totalCaptured
      };
      setScore(newScore);
      setLastCapture({ player, count: allCaptures.totalCaptured });
      triggerFlash();
    }

    setMoveCount(c => c + 1);
    setPlayer(player === P1 ? P2 : P1);

    // Vérifier grille pleine APRÈS avoir mis à jour la grille
    const full = checkGridFull(newGrid, newScore, size);
    if (!full) setGrid(newGrid);
  };

  // ── MENU ──────────────────────────────────────────────────────
  if (isAiMode === null) {
    return (
      <SafeAreaView style={s.menuSafe}>
        <Animated.View style={[s.menuInner, {
          opacity: fadeIn,
          transform: [{ translateY: fadeIn.interpolate({ inputRange: [0,1], outputRange: [40,0] }) }]
        }]}>
          <View style={s.badge}>
            <Text style={s.badgeText}>🇲🇬  JEU TRADITIONNEL MALAGASY</Text>
          </View>
          <Text style={s.menuTitle}>JEU DE{"\n"}POINTS</Text>
          <View style={s.titleAccent}>
            <View style={[s.accentBar, { backgroundColor: C.p1 }]} />
            <Text style={s.accentLabel}>MALAGASY</Text>
            <View style={[s.accentBar, { backgroundColor: C.p2 }]} />
          </View>
          <View style={s.dotsRow}>
            {[C.p1, C.p2, C.p1, C.p2, C.p1, C.p2].map((col, i) => (
              <View key={i} style={[s.demoDot, { backgroundColor: col, shadowColor: col }]} />
            ))}
          </View>
          <Text style={s.menuDesc}>Encercle les points adverses pour gagner !</Text>
          <Animated.View style={[s.btnWrap, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={[s.menuBtn, s.btnP1]} onPress={() => initGame(false)} activeOpacity={0.8}>
              <View style={[s.btnIconWrap, { backgroundColor: C.p1 + "22" }]}>
                <Text style={s.btnIcon}>👥</Text>
              </View>
              <View style={s.btnTextWrap}>
                <Text style={[s.btnTitle, { color: C.p1 }]}>JOUEUR VS JOUEUR</Text>
                <Text style={s.btnSub}>2 joueurs · même appareil</Text>
              </View>
              <Text style={[s.btnArrow, { color: C.p1 }]}>›</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={[s.menuBtn, s.btnP2]} onPress={() => initGame(true)} activeOpacity={0.8}>
            <View style={[s.btnIconWrap, { backgroundColor: C.p2 + "22" }]}>
              <Text style={s.btnIcon}>🤖</Text>
            </View>
            <View style={s.btnTextWrap}>
              <Text style={[s.btnTitle, { color: C.p2 }]}>JOUEUR VS IA</Text>
              <Text style={s.btnSub}>Affronte l'ordinateur</Text>
            </View>
            <Text style={[s.btnArrow, { color: C.p2 }]}>›</Text>
          </TouchableOpacity>
          <View style={s.rulesBox}>
            <Text style={s.rulesTitle}>📖 RÈGLE RAPIDE</Text>
            <Text style={s.rulesText}>
              Placez vos points à tour de rôle.{"\n"}
              Encerclez les points adverses pour marquer !{"\n"}
              Grille pleine → le plus de points gagne.{"\n"}
              Égalité → la grille s'agrandit !
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── ÉCRAN DE VICTOIRE ─────────────────────────────────────────
  if (gameOver === 'p1' || gameOver === 'p2') {
    const winnerIsP1 = gameOver === 'p1';
    const winColor   = winnerIsP1 ? C.p1 : C.p2;
    const winnerName = winnerIsP1 ? "JOUEUR 1" : (isAiMode ? "L'IA" : "JOUEUR 2");
    return (
      <SafeAreaView style={[s.menuSafe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={[s.winCard, { borderColor: winColor, transform: [{ scale: winAnim }] }]}>
          <Text style={s.winTrophy}>🏆</Text>
          <Text style={[s.winTitle, { color: winColor }]}>{winnerName}</Text>
          <Text style={s.winSub}>GAGNE LA PARTIE !</Text>

          <View style={s.winScoreRow}>
            <View style={[s.winScoreBox, { borderColor: C.p1 }]}>
              <Text style={[s.winScoreLabel, { color: C.p1 }]}>J1</Text>
              <Text style={[s.winScoreNum, { color: C.p1 }]}>{score.p1}</Text>
            </View>
            <Text style={s.winVs}>VS</Text>
            <View style={[s.winScoreBox, { borderColor: C.p2 }]}>
              <Text style={[s.winScoreLabel, { color: C.p2 }]}>{isAiMode ? "IA" : "J2"}</Text>
              <Text style={[s.winScoreNum, { color: C.p2 }]}>{score.p2}</Text>
            </View>
          </View>

          <Text style={s.winGridInfo}>Grille finale : {size}×{size}</Text>

          <TouchableOpacity style={[s.winBtn, { backgroundColor: winColor + "22", borderColor: winColor }]}
            onPress={() => setIsAiMode(null)}>
            <Text style={[s.winBtnText, { color: winColor }]}>🔄 REJOUER</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── JEU ───────────────────────────────────────────────────────
  const isP1 = player === P1;
  const curColor = isP1 ? C.p1 : C.p2;
  const flashBg  = (lastCapture?.player === P1 ? C.p1 : C.p2) + "28";

  return (
    <SafeAreaView style={s.container}>
      <Animated.View pointerEvents="none" style={[
        StyleSheet.absoluteFill,
        { backgroundColor: flashBg, opacity: flashAnim, zIndex: 99 }
      ]} />

      {/* HEADER */}
      <View style={s.header}>
        <View style={[s.scoreCard, isP1 && s.scoreCardActiveP1]}>
          <View style={[s.scorePip, { backgroundColor: C.p1 }]} />
          <View>
            <Text style={[s.scoreName, { color: C.p1 }]}>J · 1</Text>
            <Text style={[s.scoreNum,  { color: C.p1 }]}>{score.p1}</Text>
          </View>
          {isP1 && <Text style={{ color: C.p1, fontSize: 16 }}>▶</Text>}
        </View>

        <View style={s.centerCol}>
          <View style={[s.turnPill, { borderColor: curColor }]}>
            <View style={[s.turnDot, { backgroundColor: curColor }]} />
            <Text style={[s.turnLabel, { color: curColor }]}>
              {isP1 ? "J1 joue" : (isAiMode ? "IA joue" : "J2 joue")}
            </Text>
          </View>
          <Text style={s.moveCnt}>coup {moveCount + 1}</Text>
          <TouchableOpacity style={s.quitBtn} onPress={() => setIsAiMode(null)}>
            <Text style={s.quitTxt}>✕ QUITTER</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.scoreCard, !isP1 && s.scoreCardActiveP2]}>
          {!isP1 && <Text style={{ color: C.p2, fontSize: 16 }}>◀</Text>}
          <View>
            <Text style={[s.scoreName, { color: C.p2 }]}>{isAiMode ? "I · A" : "J · 2"}</Text>
            <Text style={[s.scoreNum,  { color: C.p2 }]}>{score.p2}</Text>
          </View>
          <View style={[s.scorePip, { backgroundColor: C.p2 }]} />
        </View>
      </View>

      {/* Bandeau extension grille */}
      {gameOver === 'extended' && (
        <View style={[s.captureBand, { borderColor: C.gold }]}>
          <Text style={[s.captureMsg, { color: C.gold }]}>
            ⚖️ ÉGALITÉ ! La grille s'agrandit à {size}×{size} !
          </Text>
        </View>
      )}

      {/* Bandeau capture */}
      {lastCapture && gameOver !== 'extended' && (
        <View style={[s.captureBand, { borderColor: lastCapture.player === P1 ? C.p1 : C.p2 }]}>
          <Text style={[s.captureMsg, { color: lastCapture.player === P1 ? C.p1 : C.p2 }]}>
            ⚡ {lastCapture.player === P1 ? "Joueur 1" : (isAiMode ? "IA" : "Joueur 2")} encercle {lastCapture.count} point{lastCapture.count > 1 ? "s" : ""} !
          </Text>
        </View>
      )}

      {/* Taille grille si agrandie */}
      {size > 32 && (
        <View style={s.gridSizeBadge}>
          <Text style={s.gridSizeText}>Grille {size}×{size}</Text>
        </View>
      )}

      {/* GRILLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ width: size * CELL_SIZE, height: size * CELL_SIZE, backgroundColor: C.bg, margin: 8 }}>
            <Svg style={StyleSheet.absoluteFill}>
              {territories.map((t, i) => (
                <Polygon
                  key={i}
                  points={t.points.map(p =>
                    `${p.x * CELL_SIZE + CELL_SIZE / 2},${p.y * CELL_SIZE + CELL_SIZE / 2}`
                  ).join(" ")}
                  fill={t.owner === P1 ? "rgba(0,229,255,0.15)" : "rgba(255,61,107,0.15)"}
                  stroke={t.owner === P1 ? C.p1 : C.p2}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>

            {grid && grid.map((row, y) => (
              <View key={y} style={s.row}>
                {row.map((cell, x) => (
                  <Pressable
                    key={x}
                    onPress={() => handlePress(x, y)}
                    style={({ pressed }) => [s.cell, pressed && cell === EMPTY && s.cellHover]}
                  >
                    <View style={s.lineV} />
                    <View style={s.lineH} />
                    {cell !== EMPTY && (
                      <View style={[s.dot, cell === P1 ? s.dotP1 : s.dotP2]} />
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

// LOGIQUE ORIGINALE 

function detectAllCaptures(grid, startX, startY, player, alreadyCaptured) {
  const opponent = player === P1 ? P2 : P1;
  const allCycles = findAllCycles(grid, startX, startY, player);
  const newlyCapturedKeys = new Set();
  const validCycles = [];

  for (const cycle of allCycles) {
    let foundNew = false;
    grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === opponent) {
        const k = `${x},${y}`;
        if (!alreadyCaptured.has(k) && !newlyCapturedKeys.has(k) && isPointInPoly({ x, y }, cycle)) {
          newlyCapturedKeys.add(k);
          foundNew = true;
        }
      }
    }));
    if (foundNew) validCycles.push(cycle);
  }

  return { cycles: validCycles, newlyCapturedKeys, totalCaptured: newlyCapturedKeys.size };
}

function findAllCycles(grid, startX, startY, player) {
  const results = [];
  const seenCycleKeys = new Set();

  function dfs(x, y, px, py, path) {
    for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx === px && ny === py) continue;
      if (grid[ny]?.[nx] !== player) continue;
      if (nx === startX && ny === startY && path.length >= 3) {
        const cycle = [...path, { x, y }];
        const cycleKey = cycle.map(p => `${p.x},${p.y}`).sort().join('|');
        if (!seenCycleKeys.has(cycleKey)) {
          seenCycleKeys.add(cycleKey);
          results.push(cycle);
        }
        continue;
      }
      if (path.some(p => p.x === nx && p.y === ny)) continue;
      if (path.length > 60) continue;
      dfs(nx, ny, x, y, [...path, { x, y }]);
    }
  }

  dfs(startX, startY, -1, -1, [{ x: startX, y: startY }]);
  return results;
}

function isPointInPoly(point, polygon) {
  let x = point.x, y = point.y, inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x, yi = polygon[i].y;
    let xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

// ── STYLES ────────────────────────────────────────────────────
const s = StyleSheet.create({
  menuSafe:  { flex: 1, backgroundColor: C.bg },
  menuInner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  badge: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: C.border, marginBottom: 28 },
  badgeText: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  menuTitle: { fontSize: 52, fontWeight: '900', color: C.text, letterSpacing: 3, textAlign: 'center', lineHeight: 56, textShadowColor: C.p1, textShadowRadius: 24 },
  titleAccent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  accentBar: { flex: 1, height: 2, borderRadius: 1, maxWidth: 50 },
  accentLabel: { color: C.p2, fontSize: 16, fontWeight: '900', letterSpacing: 6, textShadowColor: C.p2, textShadowRadius: 12 },
  dotsRow: { flexDirection: 'row', gap: 8, marginVertical: 18 },
  demoDot: { width: 14, height: 14, borderRadius: 7, shadowOpacity: 1, shadowRadius: 8, elevation: 5 },
  menuDesc: { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  btnWrap: { width: '100%' },
  menuBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 12 },
  btnP1: { backgroundColor: C.p1bg, borderColor: C.p1, shadowColor: C.p1, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  btnP2: { backgroundColor: C.p2bg, borderColor: C.p2, shadowColor: C.p2, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  btnIconWrap: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnIcon: { fontSize: 22 },
  btnTextWrap: { flex: 1 },
  btnTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  btnSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  btnArrow: { fontSize: 22, fontWeight: '900' },
  rulesBox: { width: '100%', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 8, alignItems: 'center' },
  rulesTitle: { color: C.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  rulesText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 19 },

  // Victoire
  winCard: { width: '85%', backgroundColor: C.card, borderRadius: 24, borderWidth: 2, padding: 32, alignItems: 'center', shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  winTrophy: { fontSize: 72, marginBottom: 8 },
  winTitle: { fontSize: 36, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  winSub: { color: C.muted, fontSize: 14, fontWeight: '700', letterSpacing: 3, marginTop: 4, marginBottom: 24 },
  winScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  winScoreBox: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', minWidth: 80 },
  winScoreLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  winScoreNum: { fontSize: 40, fontWeight: '900', lineHeight: 48 },
  winVs: { color: C.muted, fontSize: 16, fontWeight: '900' },
  winGridInfo: { color: C.muted, fontSize: 11, marginBottom: 24 },
  winBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  winBtnText: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // Jeu
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1.5, borderColor: C.border, minWidth: 90 },
  scoreCardActiveP1: { borderColor: C.p1, shadowColor: C.p1, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  scoreCardActiveP2: { borderColor: C.p2, shadowColor: C.p2, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  scorePip: { width: 8, height: 8, borderRadius: 4 },
  scoreName: { fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  scoreNum: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  centerCol: { alignItems: 'center', gap: 3 },
  turnPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.card },
  turnDot: { width: 7, height: 7, borderRadius: 4 },
  turnLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  moveCnt: { color: C.muted, fontSize: 9, fontWeight: '600' },
  quitBtn: { backgroundColor: C.card, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: C.border },
  quitTxt: { color: C.muted, fontSize: 9, fontWeight: '700' },
  captureBand: { marginHorizontal: 10, marginTop: 5, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, paddingVertical: 5, alignItems: 'center' },
  captureMsg: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  gridSizeBadge: { alignSelf: 'center', marginTop: 4, backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 1, borderColor: C.gold },
  gridSizeText: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  row: { flexDirection: 'row' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, justifyContent: 'center', alignItems: 'center' },
  cellHover: { backgroundColor: 'rgba(255,255,255,0.03)' },
  lineV: { position: 'absolute', width: 0.5, height: '100%', backgroundColor: C.grid },
  lineH: { position: 'absolute', width: '100%', height: 0.5, backgroundColor: C.grid },
  dot: { width: 14, height: 14, borderRadius: 7, zIndex: 10, shadowOpacity: 0.8, shadowRadius: 6, elevation: 5 },
  dotP1: { backgroundColor: C.p1, shadowColor: C.p1 },
  dotP2: { backgroundColor: C.p2, shadowColor: C.p2 },
});