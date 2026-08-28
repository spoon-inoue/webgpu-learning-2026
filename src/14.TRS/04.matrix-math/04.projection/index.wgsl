struct Uniforms {
  color: vec4f,
  matrix: mat3x3f,
}

struct Vertex {
  @location(0) position: vec2f,
}

struct VSOut {
  @builtin(position) position: vec4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: Vertex) -> VSOut {
  var vsOut: VSOut;

  let clipSpace = (uni.matrix * vec3f(vert.position, 1)).xy;
  
  vsOut.position = vec4f(clipSpace, 0, 1);
  return vsOut;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return uni.color;
}