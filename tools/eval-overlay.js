// 开始界面:默认 URL 进入应看到覆盖层,点"单人经营"应进入游戏。
async (page) => {
  const hasOverlay = await page.evaluate(() => !![...document.querySelectorAll('.rct-win .rct-btn')].find(b => b.textContent.includes('单人经营')));
  if (!hasOverlay) throw new Error('覆盖层未显示');
  await page.screenshot({ path: 'shots/34-overlay.png' });
  await page.click('text=单人经营');
  await page.waitForTimeout(2500);
  const ok = await page.evaluate(() => !!window.game && !!window.game.world);
  if (!ok) throw new Error('点击进入后游戏未启动');
  console.error('OVERLAY OK');
}
