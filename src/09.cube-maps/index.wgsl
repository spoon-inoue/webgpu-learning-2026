struct Vertex {
  @location(0) position: vec4f,
}

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

struct Uniforms {
  matrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ourSampler: sampler;
@group(0) @binding(2) var ourTexture: texture_cube<f32>;

@vertex
fn vs(vert: Vertex) -> VSOut {
  var vsOut: VSOut;
  vsOut.position = uni.matrix * vert.position;
  vsOut.normal = normalize(vert.position.xyz);
  return vsOut;
}

@fragment
fn fs(fsIn: VSOut) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, normalize(fsIn.normal));
}