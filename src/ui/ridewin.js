// 单个设施窗口:开关/测试状态、票价、统计、定位、拆除。
const STATUS = [
  ['closed', '关闭'], ['test', '测试'], ['open', '开放'],
];

export function openRideWindow(game, wm, rideId) {
  const ride = game.rides.findRide(rideId);
  if (!ride) return;
  const id = 'ride-' + rideId;
  const titleOf = () => (ride.customName || ride.def.name) + ' #' + ride.id;
  const w = wm.open({
    id, title: titleOf(), x: 300 + (rideId % 5) * 30, y: 120 + (rideId % 5) * 26,
    build(el, win) {
      const statusRow = document.createElement('div');
      statusRow.className = 'rct-row';
      const btns = {};
      for (const [st, label] of STATUS) {
        const b = document.createElement('button');
        b.className = 'rct-btn small';
        b.textContent = label;
        b.addEventListener('click', () => {
          game.dispatchAction({ type: 'rideStatus', rideId: ride.id, status: st });
          sync();
        });
        btns[st] = b;
        statusRow.appendChild(b);
      }
      el.appendChild(statusRow);
      // 票价
      const priceRow = document.createElement('div');
      priceRow.className = 'rct-row';
      const priceLabel = document.createElement('span');
      const minus = document.createElement('button');
      minus.className = 'rct-btn small'; minus.textContent = '−';
      minus.addEventListener('click', () => {
        game.dispatchAction({ type: 'ridePrice', rideId: ride.id, price: Math.max(0, Math.round((ride.price - 0.5) * 2) / 2) });
        sync();
      });
      const plus = document.createElement('button');
      plus.className = 'rct-btn small'; plus.textContent = '+';
      plus.addEventListener('click', () => {
        game.dispatchAction({ type: 'ridePrice', rideId: ride.id, price: Math.min(20, Math.round((ride.price + 0.5) * 2) / 2) });
        sync();
      });
      priceRow.append(document.createTextNode('票价:'), minus, priceLabel, plus);
      el.appendChild(priceRow);
      // 改名 + 涂装
      const nameRow = document.createElement('div');
      nameRow.className = 'rct-row';
      const nameIn = document.createElement('input');
      nameIn.placeholder = ride.def.name;
      nameIn.maxLength = 16;
      nameIn.value = ride.customName || '';
      nameIn.style.cssText = 'flex:1;min-width:90px;background:rgba(20,24,34,0.8);border:1px solid rgba(255,255,255,0.25);color:#e8e6d0;padding:4px 6px;border-radius:3px;font-size:12px;outline:none';
      nameIn.addEventListener('keydown', e => e.stopPropagation());
      const nameBtn = document.createElement('button');
      nameBtn.className = 'rct-btn small'; nameBtn.textContent = '改名';
      nameBtn.addEventListener('click', () => {
        game.dispatchAction({ type: 'rideRename', rideId: ride.id, name: nameIn.value });
        wm.setTitle(id, titleOf());
        game.audio?.play('click');
      });
      nameRow.append(nameIn, nameBtn);
      el.appendChild(nameRow);
      const paintRow = document.createElement('div');
      paintRow.className = 'rct-row';
      paintRow.appendChild(document.createTextNode('涂装:'));
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = '#' + (ride.paint ?? 0xffffff).toString(16).padStart(6, '0');
      picker.title = '任意颜色(真彩色)';
      picker.style.cssText = 'width:44px;height:22px;padding:0;border:1px solid rgba(255,255,255,0.35);background:none;cursor:pointer';
      picker.addEventListener('input', () => {   // 拖动时本地即时预览
        const v = parseInt(picker.value.slice(1), 16);
        ride.paint = v;
        game.rides.applyPaint(ride);
      });
      picker.addEventListener('change', () => {   // 选定后走动作层(联机广播/存档)
        game.dispatchAction({ type: 'ridePaint', rideId: ride.id, color: parseInt(picker.value.slice(1), 16) });
        game.audio?.play('click');
      });
      const defBtn = document.createElement('button');
      defBtn.className = 'rct-btn small';
      defBtn.textContent = '默认';
      defBtn.title = '恢复默认配色';
      defBtn.addEventListener('click', () => {
        picker.value = '#ffffff';
        game.dispatchAction({ type: 'ridePaint', rideId: ride.id, color: 0xffffff });
        game.audio?.play('click');
      });
      paintRow.append(picker, defBtn);
      el.appendChild(paintRow);
      const stats = document.createElement('div');
      stats.className = 'hint';
      el.appendChild(stats);
      // 出入口
      const gateRow = document.createElement('div');
      gateRow.className = 'rct-row';
      const bEnt = document.createElement('button');
      bEnt.className = 'rct-btn small'; bEnt.textContent = '设入口';
      bEnt.addEventListener('click', () => game.tools.setTool({ type: 'gate', rideId: ride.id, which: 'entrance' }));
      const bExt = document.createElement('button');
      bExt.className = 'rct-btn small'; bExt.textContent = '设出口';
      bExt.addEventListener('click', () => game.tools.setTool({ type: 'gate', rideId: ride.id, which: 'exit' }));
      const gateInfo = document.createElement('span');
      gateInfo.className = 'hint';
      gateRow.append(bEnt, bExt, gateInfo);
      el.appendChild(gateRow);
      // 操作
      const ops = document.createElement('div');
      ops.className = 'rct-row';
      const locate = document.createElement('button');
      locate.className = 'rct-btn small'; locate.textContent = '定位';
      locate.addEventListener('click', () => game.camera.centerOnTile(ride.x + ride.def.w / 2, ride.y + ride.def.h / 2));
      const renov = document.createElement('button');
      renov.className = 'rct-btn small';
      renov.title = '园龄归零、可靠度恢复、故障修好';
      renov.addEventListener('click', () => { game.dispatchAction({ type: 'rideRenovate', rideId: ride.id }); sync(); });
      const demolish = document.createElement('button');
      demolish.className = 'rct-btn small'; demolish.textContent = '拆除';
      demolish.addEventListener('click', () => {
        game.dispatchAction({ type: 'rideRemove', rideId: ride.id });
      });
      ops.append(locate, renov, demolish);
      el.appendChild(ops);
      const sync = () => {
        for (const [st, b] of Object.entries(btns)) b.classList.toggle('active', ride.status === st);
        priceLabel.textContent = game.economy.fmt(ride.price);
        renov.textContent = `翻新 ${game.economy.fmt(game.rides.renovateCost(ride))}`;
        const entOk = game.rides.gateConnected(ride, 'entrance');
        const extOk = game.rides.gateConnected(ride, 'exit');
        gateInfo.textContent = `入口${entOk ? '✓' : '未接通'} 出口${extOk ? '✓' : '未接通'}`;
        gateInfo.style.color = entOk ? '#9fd0a0' : '#ff9a80';
        stats.innerHTML =
          `兴奋度 ${game.rides.effExcitement(ride).toFixed(0)} · 强度 ${ride.intensity.toFixed(0)} · 晕眩 ${ride.nausea.toFixed(0)}<br>` +
          `园龄 ${ride.ageMonths || 0} 月 · 排队 ${ride.queue.length} 人 · 累计接待 ${ride.guestsServed} 人<br>` +
          `可靠度 ${Math.round(ride.reliability ?? 95)}%${ride.broken ? ' <b style="color:#ff6a50">故障中</b>' : ''}<br>` +
          `收入 <span class="pos">${game.economy.fmt(ride.incomeTotal)}</span> · 月维护 ${game.economy.fmt(ride.def.upkeep)}`;
      };
      win.refresh = sync;
      sync();
    },
  });
  return w;
}
