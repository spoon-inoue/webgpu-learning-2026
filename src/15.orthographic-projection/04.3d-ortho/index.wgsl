struct Uniforms {
  matrix: mat4x4f,
}

struct Vertex {
  @location(0) position: vec4f,
  @location(1) color: vec4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: Vertex) -> VSOut {  
  return VSOut(
    uni.matrix * vert.position,
    vert.color,
  );
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return in.color;
}