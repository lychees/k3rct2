// 验证:观光小火车 + 激流勇进 建圈并跑起来。
async (page) => {
  const r = await page.evaluate(() => {
    const g = window.game, w = g.world;
    g.dispatchAction({ type: 'cheatMoney', amount: 100000 });
    g.dispatchAction({ type: 'researchAll' });
    const ex = w.entrance.x, ey = w.entrance.y;
    const H_UNIT = 0.55;
    const PLANS = [
      ['train', ['flat', 'right', 'flat', 'right', 'flat', 'right', 'left', 'right', 'right']],
      ['flume', ['lift', 'lift', 'right', 'flat', 'right', 'down', 'down', 'flat', 'right', 'flat', 'right']],
    ];
    const out = [];
    for (const [defId, SEQ] of PLANS) {
      let anchor = null;
      outer: for (let ay = ey + 16; ay < ey + 55; ay++) for (let ax = ex - 24; ax < ex + 20; ax++) {
        const h0 = w.maxH(ax, ay);
        let okA = true;
        for (let dy = -1; dy <= 3 && okA; dy++) for (let dx = 0; dx <= 2 && okA; dx++) {
          if (w.maxH(ax + dx, ay + dy) !== h0 || w.minH(ax + dx, ay + dy) !== h0) okA = false;
        }
        if (!okA || !g.rides.canBeginCustom(ax, ay).ok) continue;
        const fake = { def: (await0 => 0, null), pieces: [], baseY: 0, custom: true, complete: false };
        // 预演
        fake.def = { style: defId === 'mycoaster' ? undefined : defId };
        fake.pieces = [{ t: 'station', x: ax, y: ay, h: 0, dir: 1 }];
        fake.baseY = h0 * H_UNIT;
        let okAll = true;
        for (const t of SEQ) {
          const chk = g.rides.canAddPiece(fake, t);
          if (!chk.ok) { okAll = false; break; }
          fake.pieces.push({ t, x: chk.x, y: chk.y, h: chk.h, dir: chk.dir });
        }
        if (okAll) { anchor = [ax, ay]; break outer; }
      }
      if (!anchor) { out.push(defId + ':no-anchor'); continue; }
      const b = g.dispatchAction({ type: 'coasterBegin', id: defId, x: anchor[0], y: anchor[1], dir: 1 });
      if (!b.ok) { out.push(defId + ':begin-' + b.reason); continue; }
      const ride = g.rides.list[g.rides.list.length - 1];
      let bad = null;
      for (const t of SEQ) {
        const rr = g.dispatchAction({ type: 'coasterPiece', rideId: ride.id, piece: t });
        if (!rr.ok) { bad = t + ':' + rr.reason; break; }
      }
      if (bad) { out.push(defId + ':piece-' + bad); continue; }
      const f = g.dispatchAction({ type: 'coasterFinish', rideId: ride.id });
      if (!f.ok) { out.push(defId + ':finish-' + f.reason); continue; }
      ride.status = 'test';
      out.push(defId + ':ok@' + anchor.join(','));
    }
    const xs = g.rides.list.map(r => r.x), ys = g.rides.list.map(r => r.y);
    g.camera.centerOnTile((Math.min(...xs) + Math.max(...xs)) / 2 + 3, (Math.min(...ys) + Math.max(...ys)) / 2 + 4);
    g.camera.setZoom(0);
    g.camera.snap();
    return out;
  });
  console.error('TRACK ' + JSON.stringify(r));
  if (r.some(s => !s.endsWith('ok@52,40') && !s.includes(':ok@'))) console.error('FAIL some track failed');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'shots/86-train-flume.png' });
}
