// UI 真实点击测试:工具栏 → 面板 → 画布点选铺设路径,验证 pick→tool 链路。
async (page) => {
  // 确保不读档干扰:可能已有存档无所谓,这里只验证新增铺设
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    g.camera.centerOnTile(ex - 14, ey + 6);
    g.camera.zoomIdx = 2;
    // 记录目标 tile 状态
    window.__T = { x: ex - 9, y: ey + 6 };   // 平整区内、空位
  });
  await page.waitForTimeout(900);
  // 打开路径面板
  await page.click('[data-tb="path"]');
  await page.waitForTimeout(300);
  const panelVisible = await page.evaluate(() => !!document.querySelector('.rct-win'));
  if (!panelVisible) throw new Error('路径面板未打开');
  // 点"主路"
  await page.click('.rct-win .rct-btn:has-text("主路")');
  await page.waitForTimeout(200);
  const tool = await page.evaluate(() => window.game.tools.tool?.type + ':' + window.game.tools.tool?.kind);
  if (!tool.startsWith('path')) throw new Error('工具未激活: ' + tool);
  // 目标 tile 转屏幕坐标
  const s = await page.evaluate(() => {
    const t = window.__T;
    const p = window.game.tileScreenPos(t.x, t.y);
    const pick = window.game.picker.pickTile(p.x, p.y);
    return { x: p.x, y: p.y, pick: pick ? [pick.x, pick.y] : null };
  });
  // 确认该 tile 还没有路径
  const hasBefore = await page.evaluate(() => {
    const g = window.game, t = window.__T;
    return { tile: g.world.path[g.world.idx(t.x, t.y)], total: g.world.path.reduce((s2, v) => s2 + (v ? 1 : 0), 0) };
  });
  await page.mouse.click(s.x, s.y);
  await page.waitForTimeout(300);
  const hasAfter = await page.evaluate(() => {
    const g = window.game, t = window.__T;
    return { tile: g.world.path[g.world.idx(t.x, t.y)], total: g.world.path.reduce((s2, v) => s2 + (v ? 1 : 0), 0) };
  });
  console.error(`CLICKTEST tool=${tool} screen=${s.x.toFixed(0)},${s.y.toFixed(0)} pick=${JSON.stringify(s.pick)} before=${JSON.stringify(hasBefore)} after=${JSON.stringify(hasAfter)}`);
  if (hasBefore.tile !== 0) console.error('CLICKTEST SKIP(目标格本来就有路径)');
  else if (hasAfter.tile === 1 || hasAfter.total > hasBefore.total) console.error('CLICKTEST OK');
  else throw new Error('点击未铺上路');
  // 顺手测整地面板打开
  await page.click('[data-tb="land"]');
  await page.waitForTimeout(200);
  const wins = await page.evaluate(() => document.querySelectorAll('.rct-win').length);
  console.error('WINS open=' + wins);
}
