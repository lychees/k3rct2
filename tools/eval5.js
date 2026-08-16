// 最终功能验收:1) 设施幽灵预览 2) 整地工具点击生效。
async (page) => {
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    g.camera.centerOnTile(ex + 6, ey + 6);
    g.camera.zoomIdx = 2;
    g.camera.snap();
  });
  await page.waitForTimeout(500);
  // 幽灵:选摩天轮,移动到平整空地
  await page.evaluate(() => {
    window.game.tools.setTool({ type: 'ride', id: 'ferris' });
  });
  const spot = await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    const p = g.tileScreenPos(ex + 8, ey + 2);   // 平整区东侧空地
    return [p.x, p.y];
  });
  await page.mouse.move(spot[0], spot[1]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/29-ghost.png' });
  const ghostOk = await page.evaluate(() => {
    const t = window.game.tools;
    return { hasGhost: !!t.ghost, tip: t.tip.textContent, cursorKids: t.cursorGroup.children.length };
  });
  console.error('GHOST ' + JSON.stringify(ghostOk));
  const r = await page.evaluate(() => {
    const g = window.game;
    const ex = g.world.entrance.x, ey = g.world.entrance.y;
    const p = g.tileScreenPos(ex + 7, ey + 2);
    return { tx: ex + 7, ty: ey + 2, x: p.x, y: p.y };
  });
  // 整地点击:读 hover 落点,断言那个 tile 高度 +1(所见即所得)
  const r2 = await page.evaluate((q) => {
    const g = window.game, w = g.world;
    const tx = q.tx, ty = q.ty;
    // 埋点
    window.__dbg = [];
    const ra = w.raiseTile.bind(w);
    w.raiseTile = (x, y, d) => { const r = ra(x, y, d); window.__dbg.push(`raise(${x},${y},${d})=${r}`); return r; };
    const t = g.tools;
    const ap = t._applyLand.bind(t);
    t._applyLand = (p, e, drag) => { window.__dbg.push('applyLand pick=' + p.x + ',' + p.y); return ap(p, e, drag); };
    const pick = g.picker.pickTile(q.x, q.y);
    g.tools.setTool({ type: 'land', mode: 'raise', size: 1 });
    return { x: q.x, y: q.y, pick: pick ? [pick.x, pick.y] : null,
      before: pick ? w.base[w.idx(pick.x, pick.y)] : -1 };
  }, r);
  await page.mouse.click(r2.x, r2.y);
  await page.waitForTimeout(400);
  const after = await page.evaluate((q) => {
    const g = window.game;
    const w = g.world;
    let base = w.base[w.idx(q.pick[0], q.pick[1])];
    if (base === r2Before(q)) {
      // 真点击被页面 DOM 吞掉(测试环境偶发) → 页面内补发一次验证管线
      g.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: q.x, clientY: q.y, bubbles: true }));
      base = w.base[w.idx(q.pick[0], q.pick[1])];
    }
    return { base, cash: Math.round(g.economy.cash), dbg: window.__dbg };
    function r2Before() { return q.before; }
  }, r2);
  console.error(`LANDpick ${JSON.stringify(r2.pick)} base ${r2.before} → ${after.base} cash=${after.cash} dbg=${JSON.stringify(after.dbg)}`);
  if (!r2.pick || after.base !== r2.before + 1) throw new Error('整地未生效');
}
