struct Uniforms {
  matrix: mat4x4f,
  fudgeFactor: f32,
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
  let position = uni.matrix * vert.position;
  let zToDivideBy = 1 + position.z * uni.fudgeFactor;

  return VSOut(
    // vec4f(position.xy / zToDivideBy, position.zw),
    vec4f(position.xyz, zToDivideBy),
    vert.color,
  );
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return in.color;
}