struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
}

struct Uniforms {
  matrix: mat4x4f,
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uni: Uniforms;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VsOut {
  let pos = array(
    vec2f(0, 0),  // center
    vec2f(1, 0),  // right, center
    vec2f(0, 1),  // center, top

    vec2f(0, 1),  // center, top
    vec2f(1, 0),  // right, center
    vec2f(1, 1),  // right, top
  );

  let xy = pos[vertexIndex];
  return VsOut(
    uni.matrix * vec4f(xy, 0, 1),
    xy,
  );
}

@fragment
fn fs(fsIn: VsOut) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsIn.texcoord);
}