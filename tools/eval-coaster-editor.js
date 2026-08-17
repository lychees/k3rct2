// 验证:定制过山车编辑器 —— 真实 UI 走完 放站台→铺轨→闭环 全流程。
async (page) => {
  const SEQ = ['lift', 'lift', 'right', 'flat', 'right', 'down', 'down', 'flat', 'right', 'flat', 'right'];
  // 研发全开(否则定制过山车未解锁)+ 打开设施面板点"定制过山车"
  await page.evaluate(() => {
    const g = window.game;
    g.dispatchAction({ type: 'researchAll' });
    g.ui.panels.open('rides');
  });
  await page.waitForTimeout(400);
  const clicked = await page.evaluate(() => {
    const win = [...document.querySelectorAll('.rct-win')].find(w => w.textContent.includes('游乐设施'));
    const item = [...win.querySelectorAll('.rct-item')].find(i => i.textContent.includes('定制过山车'));
    if (!item) return false;
    item.click();
    return true;
  });
  if (!clicked) { console.error('FAIL mycoaster item not found'); return; }
  await page.waitForTimeout(400);
  // 编辑器面板选朝向"北"
  await page.evaluate(() => {
    const win = [...document.querySelectorAll('.rct-win')].find(w => w.querySelector('.titlebar')?.textContent.includes('过山车编辑器'));
    [...win.querySelectorAll('.rct-btn')].find(b => b.textContent === '北')?.click();
  });
  // 找可建锚点并取屏幕坐标
  const pt = await page.evaluate(() => {
    const g = window.game, w = g.world;
    const ex = w.entrance.x, ey = w.entrance.y;
    const SEQ = ['lift', 'lift', 'right', 'flat', 'right', 'down', 'down', 'flat', 'right', 'flat', 'right'];
    const H_UNIT = 0.55;
    for (let ay = ey + 16; ay < ey + 55; ay++) for (let ax = ex - 24; ax < ex + 20; ax++) {
      const h0 = w.maxH(ax, ay);
      let okA = true;
      for (let dy = -1; dy <= 3 && okA; dy++) for (let dx = 0; dx <= 2 && okA; dx++) {
        if (w.maxH(ax + dx, ay + dy) !== h0 || w.minH(ax + dx, ay + dy) !== h0) okA = false;
      }
      if (!okA || !g.rides.canBeginCustom(ax, ay).ok) continue;
      const fake = { pieces: [{ t: 'station', x: ax, y: ay, h: 0, dir: 1 }], baseY: h0 * H_UNIT, custom: true, complete: false };
      let okAll = true;
      for (const t of SEQ) {
        const chk = g.rides.canAddPiece(fake, t);
        if (!chk.ok) { okAll = false; break; }
        fake.pieces.push({ t, x: chk.x, y: chk.y, h: chk.h, dir: chk.dir });
      }
      if (!okAll) continue;
      g.camera.centerOnTile(ax + 1, ay + 1);
      g.camera.setZoom(1);
      g.camera.snap();
      const s = g.tileScreenPos(ax, ay);
      return { x: s.x, y: s.y };
    }
    return null;
  });
  if (!pt) { console.error('FAIL no anchor'); return; }
  await page.mouse.click(pt.x, pt.y);   // 放站台
  await page.waitForTimeout(500);
  // 依次点轨道件按钮(title=件 id)
  for (const t of SEQ) {
    const r = await page.evaluate((pid) => {
      const win = [...document.querySelectorAll('.rct-win')].find(w => w.querySelector('.titlebar')?.textContent.includes('过山车编辑器'));
      const b = [...win.querySelectorAll('.rct-btn')].find(b => b.title === pid);
      if (!b) return 'nobtn';
      b.click();
      return 'ok';
    }, t);
    if (r !== 'ok') { console.error('FAIL piece btn ' + t); return; }
    await page.waitForTimeout(120);
  }
  const st = await page.evaluate(() => {
    const g = window.game;
    const d = g.rides.list.find(r => r.custom && !r.complete);
    return d ? { pieces: d.pieces.length } : null;
  });
  console.error('DRAFT ' + JSON.stringify(st));
  await page.screenshot({ path: 'shots/77-coaster-editor.png' });
  // 完成闭环
  await page.evaluate(() => {
    const win = [...document.querySelectorAll('.rct-win')].find(w => w.querySelector('.titlebar')?.textContent.includes('过山车编辑器'));
    [...win.querySelectorAll('.rct-btn')].find(b => b.textContent === '完成闭环')?.click();
  });
  await page.waitForTimeout(500);
  const done = await page.evaluate(() => {
    const r = window.game.rides.list.find(r => r.custom);
    if (!r || !r.complete) return { complete: false };
    r.status = 'test';
    return { complete: true, excitement: r.excitement };
  });
  console.error('FINISH ' + JSON.stringify(done));
  if (!done.complete) console.error('FAIL not complete');
  await page.waitForTimeout(6000);   // 列车出站跑一段
  await page.screenshot({ path: 'shots/78-coaster-custom-running.png' });
}
