struct VSOut {
  @builtin(position) position: vec4f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
  );

  var vsOut: VSOut;
  vsOut.position = vec4f(pos[vertexIndex], 0, 1);
  return vsOut;
}
