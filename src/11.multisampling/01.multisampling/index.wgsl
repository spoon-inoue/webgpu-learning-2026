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
  return vec4f(1, 0, 0, 1);
}