struct VsOut {
  @builtin(position) position: vec4f,
}

struct Uniform {
  offset: vec2f,
  color: vec3f,
}

@group(0) @binding(0) var<uniform> uni: Uniform;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VsOut {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
  );

  return VsOut(
    vec4f(pos[vertexIndex] + uni.offset, 0, 1),
  );
}

@fragment
fn fs(fsIn: VsOut) -> @location(0) vec4f {
  return vec4f(uni.color, 1);
}