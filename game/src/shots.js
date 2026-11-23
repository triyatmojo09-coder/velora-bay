// VELORA BAY 3D — deterministic screenshot staging for ?shot=title|foot|chase|vista.
// main.js builds the normal world first, then calls stageShot() to pose everything.
// Gameplay stays frozen (except water, lightbars and idle animation) while a shot is staged.
import * as THREE from 'three';

export function stageShot(name, ctx) {
  const { camera, player, playerCar, traffic, police, state, hud, beacon } = ctx;
  const place = (obj, x, z, heading) => {
    obj.pos ? (obj.pos.x = x, obj.pos.z = z) : obj.group.position.set(x, 0, z);
    if (obj.heading !== undefined) obj.heading = heading;
    if (obj.syncMesh) obj.syncMesh();
    if (obj.group && obj.pos === undefined) obj.group.rotation.y = heading;
  };
  const lookCam = (cx, cy, cz, tx, ty, tz) => {
    camera.position.set(cx, cy, cz);
    camera.lookAt(tx, ty, tz);
  };

  if (name === 'title') {
    // Across the bay from the south-east: peninsula glass skyline over the inlet
    // water with reflection streaks, downtown behind. Menu overlay is DOM.
    place(player, 120, 40, -1.2);
    player.group.position.set(120, 0, 40); player.group.rotation.y = -1.2;
    lookCam(228, 17, 148, 40, 16, -20);
    state.setObjective('');
    return;
  }
  if (name === 'foot') {
    // On foot mid-street at the crosswalk, a car passing, towers and palms around, job HUD live.
    place(player, 2, -50, 0.5);
    player.group.position.set(2, 0, -50); player.group.rotation.y = 0.5;
    if (traffic[0]) { traffic[0].sim.pos.x = -17; traffic[0].sim.pos.z = -51; traffic[0].sim.heading = Math.PI / 2; traffic[0].sim.syncMesh(); }
    state.startJob(0);
    hud.setStars(0);
    lookCam(8.6, 3.0, -58.6, 1, 1.3, -49);
    return;
  }
  if (name === 'chase') {
    // Player car mid-intersection, two VBPD units behind with lightbars flashing, 3 stars.
    place(playerCar, 0, 4, 0.15);
    playerCar.speed = 14;
    ctx.enterCarVisual(playerCar);
    const spots = [[-4.2, -9.5, 0.1], [5.2, -13.5, -0.12]];
    police.forEach((p, i) => {
      if (i < 2) {
        p.active = true;
        p.sim.pos.x = spots[i][0]; p.sim.pos.z = spots[i][1]; p.sim.heading = spots[i][2];
        p.sim.speed = 13; p.sim.syncMesh(); p.sim.group.visible = true;
      }
    });
    state.setWanted(3);
    state.startJob(2);
    hud.setStars(3);
    lookCam(8.2, 3.6, 19.5, 0, 1.1, -3);
    return;
  }
  if (name === 'vista') {
    // Low over the ocean east of the peninsula: skyline across the water with
    // reflection streaks, player small on the beach in the foreground.
    place(player, 171, 17, -1.35);
    player.group.position.set(171, 0, 17); player.group.rotation.y = -1.35;
    state.setObjective('Velora Bay — every tide brings trouble.');
    lookCam(216, 6.5, 44, 60, 15, -6);
    return;
  }
}
