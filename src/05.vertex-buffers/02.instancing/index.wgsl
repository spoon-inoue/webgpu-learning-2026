struct Vertex {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
  @location(2) offset: vec2f,
  @location(3) scale: vec2f,
  @location(4) perVertexColor: vec4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs(
  vert: Vertex,
  @builtin(instance_index) instanceIndex: u32
) -> VSOut {
  var vsOut: VSOut;
  vsOut.position = vec4f(vert.position * vert.scale + vert.offset, 0, 1);
  vsOut.color = vert.color * vert.perVertexColor;
  return vsOut;
}

@fragment
fn fs(fsIn: VSOut) -> @location(0) vec4f {
  return fsIn.color;
}