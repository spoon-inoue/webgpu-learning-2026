struct Uniforms {
  resolution: vec2f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex 
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  let pos = array(
    vec2f(-1, -1),
    vec2f( 3, -1),
    vec2f(-1,  3),
  );
  return vec4f(pos[vertexIndex], 0, 1);
}

@fragment 
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / uni.resolution;
  return vec4f(uv, 1, 1);
}