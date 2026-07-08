struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
  );
  let color = array<vec4f, 3>(
    vec4f(1, 0, 0, 1),
    vec4f(0, 1, 0, 1),
    vec4f(0, 0, 1, 1),
  );

  var vsOut: VSOut;
  vsOut.position = vec4f(pos[vertexIndex], 0, 1);
  vsOut.color = color[vertexIndex];
  return vsOut;
}

@fragment
// fn fs(fsIn: VSOut) -> @location(0) vec4f {
fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}