// 验证:音效(不报错)、关卡面板、第一视角。
async (page) => {
  const r = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    // 音效模块存在且可调用(headless 下静默)
    out.hasAudio = !!g.audio;
    g.audio.play('click'); g.audio.play('cash'); g.audio.play('win');
    // 打开关卡面板看一眼
    g.ui.panels.open('levels');
    out.levelsPanel = [...document.querySelectorAll('.rct-win')].some(w => w.textContent.includes('关卡'));
    g.ui.panels.open('levels');  // 再点一次关闭
    // 铺条路放进些游客,进入第一视角
    const w = g.world, ex = w.entrance.x, ey = w.entrance.y;
    for (let x = ex - 6; x <= ex + 6; x++) g.paths.place(x, ey + 6, 1);
    for (let i = 0; i < 40; i++) g.peeps.trySpawn();
    return out;
  });
  if (!r.hasAudio) console.error('FAIL no audio');
  if (!r.levelsPanel) console.error('FAIL levels panel');
  await page.waitForTimeout(5000);   // 等游客走上来
  await page.evaluate(() => {
    const g = window.game;
    if (!g.fp.enterRandom()) console.error('FAIL enterRandom(没有游客)');
    g.camera.snap?.();
  });
  await page.waitForTimeout(1200);
  const fp = await page.evaluate(() => window.game.fp.active);
  if (!fp) console.error('FAIL fp not active');
  await page.screenshot({ path: 'shots/67-first-person.png' });
  await page.evaluate(() => window.game.fp.exit());
}
