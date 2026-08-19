struct VsOut {
  @builtin(position) position: vec4f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VsOut {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
  );

  return VsOut(
    vec4f(pos[vertexIndex], 0, 1),
  );
}

@fragment
fn fs(fsIn: VsOut) -> @location(0) vec4f {
  let cyan = vec4f(0, 1, 1, 1);

  let grid = vec2u(fsIn.position.xy) / 8;
  let checker = (grid.x + grid.y) % 2 == 1;

  if (checker) { discard; }

  return cyan;
}