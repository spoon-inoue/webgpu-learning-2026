struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs(
  @location(0) position: vec2f,
  @location(1) perVertexColor: vec4f,
  @location(2) color: vec4f,
  @location(3) offset: vec2f,
  @location(4) scale: vec2f,
) -> VSOut {
  var vsOut: VSOut;
  vsOut.position = vec4f(position * scale + offset, 0, 1);
  vsOut.color = color * perVertexColor;
  return vsOut;
}

@fragment
fn fs(fsIn: VSOut) -> @location(0) vec4f {
  return fsIn.color;
}