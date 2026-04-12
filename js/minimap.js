/* ════════════ 미니맵 시스템 ════════════ */
/* 의존: config.js (ZONE_CENTERS, ZONE_INFO, ISLAND_CENTER_X, ISLAND_CENTER_Z),
         player.js (PL, currentZone), monster.js (monsters),
         multiplayer.js (remotePlayers, partyMembers, partyId),
         main.js (cYaw)
   선언: minimapCanvas, minimapCtx, fullmapOpen, initMinimap, tickMinimap,
          drawCornerMap, toggleFullMap, drawFullMap */

var minimapCanvas = null;
var minimapCtx = null;
var fullmapOpen = false;
var _minimapFrame = 0;
var _minimapWaypointX = null;
var _minimapWaypointZ = null;

/* 존별 지형 색상 */
var MINIMAP_ZONE_COLORS = {
  village:    '#c9a84c',
  meadow:     '#5dba3f',
  swamp:      '#3a7a3a',
  jungle:     '#1a9944',
  darkforest: '#2a4422',
  volcano:    '#cc3300',
  boss:       '#550000'
};

/* 월드 좌표 → 미니맵 픽셀 변환 */
/* 월드 범위: -660 ~ 660 (총 1320) */
var _MM_WORLD_SIZE = 1320;

function _worldToMini(wx, wz, canvasSize, range) {
  /* range: 월드 유닛 기준 반경 (corner map 용) */
  var cx = canvasSize / 2;
  var scale = canvasSize / (range * 2);
  var px = cx + wx * scale;
  var py = cx + wz * scale;
  return {x: px, y: py};
}

function _worldToFull(wx, wz, canvasW, canvasH) {
  var nx = (wx - ISLAND_CENTER_X) / _MM_WORLD_SIZE + 0.5;
  var nz = (wz - ISLAND_CENTER_Z) / _MM_WORLD_SIZE + 0.5;
  return {x: nx * canvasW, y: nz * canvasH};
}

/* ── 초기화 ── */
function initMinimap() {
  /* 코너 미니맵 캔버스 */
  var size = 120;
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = size;
  minimapCanvas.height = size;
  minimapCanvas.id = 'minimap-canvas';
  minimapCanvas.style.cssText = [
    'position:fixed',
    'top:12px',
    'right:12px',
    'width:' + size + 'px',
    'height:' + size + 'px',
    'border-radius:50%',
    'border:2px solid rgba(255,255,255,0.3)',
    'box-shadow:0 2px 8px rgba(0,0,0,0.6)',
    'z-index:400',
    'pointer-events:none',
    'display:block'
  ].join(';');
  minimapCtx = minimapCanvas.getContext('2d');
  document.body.appendChild(minimapCanvas);

  /* 존 이름 레이블 */
  var zoneLbl = document.createElement('div');
  zoneLbl.id = 'minimap-zone-label';
  zoneLbl.style.cssText = [
    'position:fixed',
    'top:' + (size + 18) + 'px',
    'right:12px',
    'width:' + size + 'px',
    'text-align:center',
    'color:#e8d5a3',
    'font-size:11px',
    'font-family:inherit',
    'pointer-events:none',
    'z-index:400',
    'text-shadow:0 1px 3px rgba(0,0,0,0.9)',
    'letter-spacing:0.5px'
  ].join(';');
  document.body.appendChild(zoneLbl);

  /* 전체 맵 오버레이 */
  var fmOverlay = document.createElement('div');
  fmOverlay.id = 'fullmap-overlay';
  fmOverlay.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:100%',
    'height:100%',
    'background:rgba(0,0,0,0.85)',
    'z-index:900',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column'
  ].join(';');

  var fmTitle = document.createElement('div');
  fmTitle.textContent = '전체 지도';
  fmTitle.style.cssText = 'color:#c9a84c;font-size:18px;font-family:inherit;margin-bottom:10px;letter-spacing:2px;text-shadow:0 2px 6px rgba(0,0,0,0.8);';

  var fmCanvas = document.createElement('canvas');
  fmCanvas.id = 'fullmap-canvas';
  fmCanvas.style.cssText = 'border:1px solid rgba(255,255,255,0.2);border-radius:6px;cursor:crosshair;max-width:90vw;max-height:80vh;';

  var fmHint = document.createElement('div');
  fmHint.textContent = '[M] / [ESC] 닫기    |    클릭: 웨이포인트 설정';
  fmHint.style.cssText = 'color:#888;font-size:12px;font-family:inherit;margin-top:8px;';

  fmOverlay.appendChild(fmTitle);
  fmOverlay.appendChild(fmCanvas);
  fmOverlay.appendChild(fmHint);
  document.body.appendChild(fmOverlay);

  /* 전체 맵 클릭 → 웨이포인트 */
  fmCanvas.addEventListener('click', function(e) {
    var rect = fmCanvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / rect.width * fmCanvas.width;
    var cy = (e.clientY - rect.top) / rect.height * fmCanvas.height;
    /* 픽셀 → 월드 좌표 */
    _minimapWaypointX = (cx / fmCanvas.width - 0.5) * _MM_WORLD_SIZE + ISLAND_CENTER_X;
    _minimapWaypointZ = (cy / fmCanvas.height - 0.5) * _MM_WORLD_SIZE + ISLAND_CENTER_Z;
    /* 재렌더 */
    drawFullMap();
    if (typeof addChat === 'function') addChat('sys', '[지도]', '웨이포인트가 설정되었습니다.');
  });

  /* 웨이포인트 방향 HUD 화살표 */
  var wpArrow = document.createElement('div');
  wpArrow.id = 'waypoint-arrow';
  wpArrow.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'width:36px',
    'height:36px',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'z-index:401',
    'pointer-events:none'
  ].join(';');
  wpArrow.innerHTML = '<svg width="36" height="36" viewBox="0 0 36 36"><polygon points="18,4 28,28 18,22 8,28" fill="#f0c040" stroke="#000" stroke-width="1.5" opacity="0.92"/></svg>';
  document.body.appendChild(wpArrow);
}

/* ── 틱 (게임 루프에서 호출) ── */
function tickMinimap() {
  _minimapFrame++;
  if (_minimapFrame % 3 !== 0) return;
  if (!minimapCanvas || !PL || !PL.group) return;
  drawCornerMap();
  _updateZoneLabel();
  _updateWaypointArrow();
}

/* ── 코너 미니맵 그리기 ── */
function drawCornerMap() {
  var ctx = minimapCtx;
  var size = minimapCanvas.width;
  var half = size / 2;
  var RANGE = 300; /* 표시 반경 (월드 유닛) */

  ctx.clearRect(0, 0, size, size);

  /* 원형 클리핑 */
  ctx.save();
  ctx.beginPath();
  ctx.arc(half, half, half - 1, 0, Math.PI * 2);
  ctx.clip();

  /* 배경 */
  ctx.fillStyle = 'rgba(10,12,20,0.82)';
  ctx.fillRect(0, 0, size, size);

  var px = PL.group.position.x;
  var pz = PL.group.position.z;
  var yaw = (typeof cYaw !== 'undefined') ? cYaw : 0;

  /* 카메라 회전에 맞게 캔버스 회전 (북=카메라 위 방향) */
  ctx.translate(half, half);
  ctx.rotate(-yaw);
  ctx.translate(-half, -half);

  /* 존 배경 색상 그리기 */
  var zoneKeys = Object.keys(ZONE_CENTERS);
  for (var zi = 0; zi < zoneKeys.length; zi++) {
    var zk = zoneKeys[zi];
    var zc = ZONE_CENTERS[zk];
    var zColor = MINIMAP_ZONE_COLORS[zk] || '#334';
    /* 존 중심 → 미니맵 좌표 (플레이어 상대) */
    var relX = zc.cx - px;
    var relZ = zc.cz - pz;
    var scale = size / (RANGE * 2);
    var sx = half + relX * scale;
    var sy = half + relZ * scale;
    var sr = zc.r * scale;
    var grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, zColor + 'aa');
    grad.addColorStop(1, zColor + '00');
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /* NPC 도트 (노랑, 표시 범위 내) */
  if (typeof npcs !== 'undefined') {
    for (var ni = 0; ni < npcs.length; ni++) {
      var npc = npcs[ni];
      var npcX, npcZ;
      if (npc.mesh && npc.mesh.position) {
        npcX = npc.mesh.position.x; npcZ = npc.mesh.position.z;
      } else if (typeof npc.px !== 'undefined') {
        npcX = npc.px; npcZ = npc.pz;
      } else continue;
      var ndx = npcX - px, ndz = npcZ - pz;
      var ndist = Math.sqrt(ndx * ndx + ndz * ndz);
      if (ndist > RANGE) continue;
      var ns = size / (RANGE * 2);
      var nx2 = half + ndx * ns;
      var ny2 = half + ndz * ns;
      _drawDot(ctx, nx2, ny2, 3, '#ffe033', '#000', 0.5);
    }
  }

  /* 던전 입구 (주황) */
  if (typeof DUNGEONS !== 'undefined') {
    for (var di = 0; di < DUNGEONS.length; di++) {
      var dg = DUNGEONS[di];
      var dgdx = dg.entrance.x - px, dgdz = dg.entrance.z - pz;
      var dgdist = Math.sqrt(dgdx * dgdx + dgdz * dgdz);
      if (dgdist > RANGE) continue;
      var dgs = size / (RANGE * 2);
      var dgx = half + dgdx * dgs;
      var dgy = half + dgdz * dgs;
      _drawDot(ctx, dgx, dgy, 4, '#ff8800', '#000', 0.8);
    }
  }

  /* 몬스터 도트 (빨강) */
  if (typeof monsters !== 'undefined') {
    for (var mi = 0; mi < monsters.length; mi++) {
      var m = monsters[mi];
      if (!m.mesh || m.hp <= 0) continue;
      var mdx = m.mesh.position.x - px;
      var mdz = m.mesh.position.z - pz;
      var mdist = Math.sqrt(mdx * mdx + mdz * mdz);
      if (mdist > RANGE) continue;
      var ms = size / (RANGE * 2);
      var mx2 = half + mdx * ms;
      var my2 = half + mdz * ms;
      _drawDot(ctx, mx2, my2, 2.5, '#ff3333', '#000', 0.5);
    }
  }

  /* 원격 플레이어 / 파티원 도트 */
  if (typeof remotePlayers !== 'undefined') {
    var isInParty = (typeof partyId !== 'undefined' && partyId !== null);
    var partyUids = {};
    if (isInParty && typeof partyMembers !== 'undefined') {
      for (var pi = 0; pi < partyMembers.length; pi++) {
        partyUids[partyMembers[pi].uid] = true;
      }
    }
    var rpIds = Object.keys(remotePlayers);
    for (var ri = 0; ri < rpIds.length; ri++) {
      var rp = remotePlayers[rpIds[ri]];
      if (!rp || !rp.group) continue;
      var rdx = rp.group.position.x - px;
      var rdz = rp.group.position.z - pz;
      var rdist = Math.sqrt(rdx * rdx + rdz * rdz);
      if (rdist > RANGE) continue;
      var rs = size / (RANGE * 2);
      var rx2 = half + rdx * rs;
      var ry2 = half + rdz * rs;
      var isParty = isInParty && partyUids[rpIds[ri]];
      var dotColor = isParty ? '#4488ff' : '#cccccc';
      _drawDot(ctx, rx2, ry2, 3, dotColor, '#000', 0.7);
    }
  }

  /* 플레이어 (녹색, 중앙) */
  ctx.restore(); /* 회전 해제 후 플레이어는 항상 중앙 고정 */
  ctx.save();
  ctx.beginPath();
  ctx.arc(half, half, half - 1, 0, Math.PI * 2);
  ctx.clip();
  _drawDot(ctx, half, half, 4, '#44ff66', '#006622', 1.0);

  /* 테두리 링 */
  ctx.restore();
  ctx.beginPath();
  ctx.arc(half, half, half - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  /* 북쪽 표시 (N) */
  ctx.save();
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  /* N 방향은 cYaw=0일 때 위쪽 */
  var northAngle = -yaw - Math.PI / 2;
  var nx3 = half + Math.cos(northAngle) * (half - 10);
  var ny3 = half + Math.sin(northAngle) * (half - 10);
  ctx.fillText('N', nx3, ny3 - 4);
  ctx.restore();
}

function _drawDot(ctx, x, y, r, fill, stroke, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

/* ── 존 이름 레이블 업데이트 ── */
function _updateZoneLabel() {
  var lbl = document.getElementById('minimap-zone-label');
  if (!lbl) return;
  var zk = (typeof currentZone !== 'undefined') ? currentZone : 'village';
  var info = (typeof ZONE_INFO !== 'undefined' && ZONE_INFO[zk]) ? ZONE_INFO[zk] : null;
  lbl.textContent = info ? info.name : zk;
  lbl.style.color = info ? info.color : '#e8d5a3';
}

/* ── 웨이포인트 화살표 ── */
function _updateWaypointArrow() {
  var arrow = document.getElementById('waypoint-arrow');
  if (!arrow || _minimapWaypointX === null) {
    if (arrow) arrow.style.display = 'none';
    return;
  }
  if (!PL || !PL.group) return;
  var dx = _minimapWaypointX - PL.group.position.x;
  var dz = _minimapWaypointZ - PL.group.position.z;
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 15) {
    /* 도착 — 웨이포인트 제거 */
    _minimapWaypointX = null;
    _minimapWaypointZ = null;
    arrow.style.display = 'none';
    return;
  }
  /* 각도: atan2(dz, dx) → 화면 회전 */
  var angle = Math.atan2(dz, dx) * (180 / Math.PI) + 90;
  var yaw = (typeof cYaw !== 'undefined') ? cYaw * (180 / Math.PI) : 0;
  angle -= yaw;
  arrow.style.display = 'flex';
  arrow.querySelector('svg').style.transform = 'rotate(' + angle + 'deg)';
}

/* ── 전체 맵 토글 ── */
function toggleFullMap() {
  var overlay = document.getElementById('fullmap-overlay');
  if (!overlay) return;
  fullmapOpen = !fullmapOpen;
  if (fullmapOpen) {
    overlay.style.display = 'flex';
    drawFullMap();
  } else {
    overlay.style.display = 'none';
  }
}

/* ── 전체 맵 그리기 ── */
function drawFullMap() {
  var fmCanvas = document.getElementById('fullmap-canvas');
  if (!fmCanvas) return;

  /* 캔버스 크기 설정 */
  var mapW = Math.min(700, Math.floor(window.innerWidth * 0.88));
  var mapH = Math.min(700, Math.floor(window.innerHeight * 0.78));
  fmCanvas.width = mapW;
  fmCanvas.height = mapH;

  var ctx = fmCanvas.getContext('2d');
  ctx.clearRect(0, 0, mapW, mapH);

  /* 배경 */
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, mapW, mapH);

  /* worldmap.png가 있으면 배경으로 사용 (비동기 로드 캐시) */
  if (!drawFullMap._imgTried) {
    drawFullMap._imgTried = true;
    var img = new Image();
    img.onload = function() {
      drawFullMap._bgImg = img;
      if (fullmapOpen) drawFullMap();
    };
    img.onerror = function() { drawFullMap._bgImg = null; };
    img.src = 'data/worldmap.png';
  }

  if (drawFullMap._bgImg) {
    ctx.drawImage(drawFullMap._bgImg, 0, 0, mapW, mapH);
  } else {
    /* 프로그래매틱 존 그리기 */
    var zoneKeys = Object.keys(ZONE_CENTERS);
    for (var zi = 0; zi < zoneKeys.length; zi++) {
      var zk = zoneKeys[zi];
      var zc = ZONE_CENTERS[zk];
      var zColor = MINIMAP_ZONE_COLORS[zk] || '#334455';
      var fp = _worldToFull(zc.cx, zc.cz, mapW, mapH);
      /* 반경도 스케일 */
      var scaleX = mapW / _MM_WORLD_SIZE;
      var scaleZ = mapH / _MM_WORLD_SIZE;
      var fr = zc.r * Math.min(scaleX, scaleZ);
      var grad = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, fr);
      grad.addColorStop(0, zColor + 'cc');
      grad.addColorStop(0.6, zColor + '66');
      grad.addColorStop(1, zColor + '00');
      ctx.beginPath();
      ctx.arc(fp.x, fp.y, fr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    /* 섬 경계 원 */
    var islandFP = _worldToFull(ISLAND_CENTER_X, ISLAND_CENTER_Z, mapW, mapH);
    var islandScaleX = mapW / _MM_WORLD_SIZE;
    var islandScaleZ = mapH / _MM_WORLD_SIZE;
    var islandR = Math.min(ISLAND_RADIUS_X * islandScaleX, ISLAND_RADIUS_Z * islandScaleZ) * 0.92;
    ctx.beginPath();
    ctx.arc(islandFP.x, islandFP.y, islandR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,150,200,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* 존 이름 라벨 */
  var zoneKeys2 = Object.keys(ZONE_CENTERS);
  for (var z2i = 0; z2i < zoneKeys2.length; z2i++) {
    var zk2 = zoneKeys2[z2i];
    var zc2 = ZONE_CENTERS[zk2];
    var info2 = (typeof ZONE_INFO !== 'undefined' && ZONE_INFO[zk2]) ? ZONE_INFO[zk2] : null;
    var zName = info2 ? info2.name : zk2;
    var zCol2 = info2 ? info2.color : '#ccc';
    var fp2 = _worldToFull(zc2.cx, zc2.cz, mapW, mapH);
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(fp2.x - 40, fp2.y - 9, 80, 18);
    ctx.fillStyle = zCol2;
    ctx.fillText(zName, fp2.x, fp2.y);
    ctx.restore();
  }

  /* 던전 입구 (주황 다이아몬드) */
  if (typeof DUNGEONS !== 'undefined') {
    for (var di = 0; di < DUNGEONS.length; di++) {
      var dg = DUNGEONS[di];
      var dfp = _worldToFull(dg.entrance.x, dg.entrance.z, mapW, mapH);
      _drawFullDiamond(ctx, dfp.x, dfp.y, 7, '#ff8800');
      ctx.save();
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffaa44';
      ctx.fillText(dg.name, dfp.x, dfp.y + 14);
      ctx.restore();
    }
  }

  /* NPC 위치 (노랑 삼각형) */
  if (typeof npcs !== 'undefined') {
    for (var ni = 0; ni < npcs.length; ni++) {
      var npc = npcs[ni];
      var npcX, npcZ;
      if (npc.mesh && npc.mesh.position) {
        npcX = npc.mesh.position.x; npcZ = npc.mesh.position.z;
      } else if (typeof npc.px !== 'undefined') {
        npcX = npc.px; npcZ = npc.pz;
      } else continue;
      var nfp = _worldToFull(npcX, npcZ, mapW, mapH);
      _drawFullTriangle(ctx, nfp.x, nfp.y, 5, '#ffe033');
    }
  }

  /* 원격 플레이어 */
  if (typeof remotePlayers !== 'undefined') {
    var isInParty2 = (typeof partyId !== 'undefined' && partyId !== null);
    var partyUids2 = {};
    if (isInParty2 && typeof partyMembers !== 'undefined') {
      for (var pi2 = 0; pi2 < partyMembers.length; pi2++) {
        partyUids2[partyMembers[pi2].uid] = true;
      }
    }
    var rpIds2 = Object.keys(remotePlayers);
    for (var ri2 = 0; ri2 < rpIds2.length; ri2++) {
      var rp2 = remotePlayers[rpIds2[ri2]];
      if (!rp2 || !rp2.group) continue;
      var rfp = _worldToFull(rp2.group.position.x, rp2.group.position.z, mapW, mapH);
      var isParty2 = isInParty2 && partyUids2[rpIds2[ri2]];
      var rpColor = isParty2 ? '#4488ff' : '#cccccc';
      _drawFullDot(ctx, rfp.x, rfp.y, 4, rpColor);
      if (rp2.name) {
        ctx.save();
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = rpColor;
        ctx.fillText(rp2.name, rfp.x, rfp.y - 7);
        ctx.restore();
      }
    }
  }

  /* 웨이포인트 표시 */
  if (_minimapWaypointX !== null) {
    var wfp = _worldToFull(_minimapWaypointX, _minimapWaypointZ, mapW, mapH);
    ctx.save();
    ctx.beginPath();
    ctx.arc(wfp.x, wfp.y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 2;
    ctx.stroke();
    /* X 표시 */
    ctx.beginPath();
    ctx.moveTo(wfp.x - 5, wfp.y - 5); ctx.lineTo(wfp.x + 5, wfp.y + 5);
    ctx.moveTo(wfp.x + 5, wfp.y - 5); ctx.lineTo(wfp.x - 5, wfp.y + 5);
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  /* 플레이어 위치 (녹색 애니메이션 화살표) */
  if (PL && PL.group) {
    var pfp = _worldToFull(PL.group.position.x, PL.group.position.z, mapW, mapH);
    var yaw2 = (typeof cYaw !== 'undefined') ? cYaw : 0;
    ctx.save();
    ctx.translate(pfp.x, pfp.y);
    ctx.rotate(yaw2);
    /* 화살표 (삼각형) */
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fillStyle = '#44ff66';
    ctx.strokeStyle = '#006622';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    /* 녹색 원 펄스 (draw 시마다 정적으로 표시) */
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(68,255,102,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    /* 플레이어 이름 */
    if (typeof myName !== 'undefined' && myName) {
      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#44ff66';
      ctx.fillText(myName, pfp.x, pfp.y - 15);
      ctx.restore();
    }
  }

  /* 범례 */
  _drawFullMapLegend(ctx, mapW, mapH);
}

function _drawFullDot(ctx, x, y, r, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function _drawFullDiamond(ctx, x, y, size, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function _drawFullTriangle(ctx, x, y, size, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x - size, y + size);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function _drawFullMapLegend(ctx, mapW, mapH) {
  var items = [
    {color:'#44ff66', label:'나 (플레이어)'},
    {color:'#4488ff', label:'파티원'},
    {color:'#cccccc', label:'다른 플레이어'},
    {color:'#ffe033', label:'NPC'},
    {color:'#ff8800', label:'던전 입구'},
    {color:'#f0c040', label:'웨이포인트'}
  ];
  var lx = 8, ly = mapH - 10 - items.length * 16;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(lx - 4, ly - 4, 138, items.length * 16 + 8);
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var iy = ly + i * 16 + 8;
    ctx.beginPath();
    ctx.arc(lx + 5, iy, 4, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ccc';
    ctx.fillText(item.label, lx + 14, iy);
  }
  ctx.restore();
}
